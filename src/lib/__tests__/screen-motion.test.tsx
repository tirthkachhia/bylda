import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/app", reduced: false }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => state.path }));
import { ScreenMotion } from "@/components/app/ScreenMotion";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel, finished: new Promise(() => undefined) }));
beforeEach(() => {
  state.path = "/app";
  state.reduced = false;
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("matchMedia", () => ({
    matches: state.reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});
const page = (loaded = true) => (
  <ScreenMotion>
    <main id="workspace-content">
      <input defaultValue="draft" />
      {loaded ? <article>Saved evidence</article> : <p>Loading</p>}
    </main>
  </ScreenMotion>
);
describe("app screen motion", () => {
  it("cancels active reveals on rapid navigation without remounting live controls", () => {
    act(() => root.render(page()));
    act(() => vi.runOnlyPendingTimers());
    const input = host.querySelector("input")!;
    input.value = "Keep this draft";
    expect(animate).toHaveBeenCalled();
    state.path = "/app/reports";
    act(() => root.render(page()));
    act(() => vi.runOnlyPendingTimers());
    expect(cancel).toHaveBeenCalled();
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("Keep this draft");
  });
  it("reveals asynchronously loaded content", async () => {
    act(() => root.render(page(false)));
    act(() => vi.runOnlyPendingTimers());
    animate.mockClear();
    act(() => root.render(page(true)));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => vi.runOnlyPendingTimers());
    expect(animate).toHaveBeenCalled();
    expect(host.textContent).toContain("Saved evidence");
  });
  it("keeps content immediately visible without animations when reduced motion is requested", () => {
    state.reduced = true;
    act(() => root.render(page()));
    act(() => vi.runOnlyPendingTimers());
    expect(animate).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Saved evidence");
  });
});
