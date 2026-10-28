import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallRecording } from "../../components/app/coaching/CallRecording";
import {
  feedbackAllowsRecommendation,
  secondsFromCitation,
  type BehaviorFeedback,
} from "../coaching/behavior";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { enabled: boolean }) =>
    options.enabled ? { data: "https://example.invalid/signed-recording" } : {},
}));
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});

describe("source citation playback", () => {
  it("parses exact cited timestamps and rejects malformed ones", () => {
    expect(secondsFromCitation("41:10")).toBe(2470);
    expect(secondsFromCitation("01:02:03")).toBe(3723);
    expect(secondsFromCitation("03:99")).toBeNull();
    expect(secondsFromCitation("-1:05")).toBeNull();
  });
  it("seeks to the requested evidence position after recording metadata loads", () => {
    act(() => root.render(<CallRecording path="org/call.wav" seekSeconds={2470} />));
    const audio = host.querySelector("audio")!;
    Object.defineProperty(audio, "readyState", { value: 1 });
    Object.defineProperty(audio, "duration", { value: 2700 });
    audio.play = vi.fn().mockResolvedValue(undefined);
    act(() => audio.dispatchEvent(new Event("loadedmetadata")));
    expect(audio.currentTime).toBe(2470);
    expect(audio.play).toHaveBeenCalled();
  });
  it("shows an explicit transcript fallback when the recording is unavailable", () => {
    act(() => root.render(<CallRecording path={null} seekSeconds={15} />));
    expect(host.querySelector("audio")).toBeNull();
    expect(host.textContent).toContain("timestamp links open the transcript");
  });
});

it("does not recommend findings that a reviewer rejected or another reviewer disputes", () => {
  const review = (
    id: string,
    author: string,
    accuracy: BehaviorFeedback["accuracy"],
    usefulness: BehaviorFeedback["usefulness"],
  ): BehaviorFeedback => ({
    id,
    event_id: "e",
    reviewed_by: author,
    accuracy,
    usefulness,
    correction: "",
    created_at: `2026-10-27T12:00:0${id}Z`,
  });
  const rejected = review("1", "manager", "incorrect", "useful"),
    corrected = review("2", "manager", "accurate", "useful");
  expect(feedbackAllowsRecommendation([rejected])).toBe(false);
  expect(feedbackAllowsRecommendation([rejected, corrected])).toBe(true);
  expect(
    feedbackAllowsRecommendation([corrected, review("3", "other", "incorrect", "useful")]),
  ).toBe(false);
  expect(feedbackAllowsRecommendation([review("4", "manager", "accurate", "unhelpful")])).toBe(
    false,
  );
});
