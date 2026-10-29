import { describe, expect, it, vi } from "vitest";
import {
  normalizeBehavior,
  sourceTurns,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";
import type { BehaviorRunSource } from "../coaching/types";
import {
  parseCallSourceTarget,
  playbackSeekSeconds,
  requestCallSource,
  resolveBehaviorSource,
  type CallSourceTarget,
} from "../coaching/source-navigation";

const turns: ParsedTurn[] = [
  {
    index: 0,
    speaker: "rep",
    text: "What is blocking the rollout?",
    start: "00:00",
    end: "00:02",
    start_s: 0,
    end_s: 2,
    overlap: false,
    tone: { label: "neutral", note: "" },
  },
  {
    index: 1,
    speaker: "customer",
    text: "Our team needs training.",
    start: "00:03",
    end: "00:05",
    start_s: 3,
    end_s: 5,
    overlap: false,
    tone: { label: "neutral", note: "" },
  },
];
const run: BehaviorRunSource = {
  id: "run-old",
  organization_id: "org",
  call_id: "call",
  rep_id: "rep",
  call_occurred_at: "2026-10-01T12:00:00Z",
  started_at: "2026-10-02T12:00:00Z",
  prompt_version: "v1",
  taxonomy_version: "v1",
  models: ["model"],
  analysis: normalizeBehavior({}, sourceTurns(turns, "")),
  transcript_hash: "original-hash",
  playbook_version_id: null,
  source_snapshot: {
    structured_turns: turns,
    structured_meta: null,
    transcript_text: "Original source",
  },
};
const target: CallSourceTarget = {
  organizationId: "org",
  repId: "rep",
  callId: "call",
  startSeconds: 99,
  source: { kind: "behavior", runId: "run-old", turnId: 0 },
};

describe("retained source navigation", () => {
  it("uses the cited run and turn's own time, including turn zero and time zero", () => {
    expect(resolveBehaviorSource(target, run)).toMatchObject({
      status: "available",
      runId: "run-old",
      transcriptHash: "original-hash",
      highlightedTurnId: 0,
      seekSeconds: 0,
      turns: [
        { turn_id: 0, text: turns[0].text },
        { turn_id: 1, text: turns[1].text },
      ],
    });
  });

  it.each([
    { id: "run-new" },
    { organization_id: "other-org" },
    { call_id: "other-call" },
    { rep_id: "other-rep" },
  ])("does not substitute a mismatched source: %j", (mismatch) => {
    expect(resolveBehaviorSource(target, { ...run, ...mismatch })).toEqual({
      status: "unavailable",
      reason: "source_mismatch",
    });
  });

  it("does not substitute another turn or transcript for an unavailable source", () => {
    expect(resolveBehaviorSource(target, null)).toMatchObject({ reason: "source_missing" });
    expect(
      resolveBehaviorSource(
        { ...target, source: { kind: "behavior", runId: run.id, turnId: 9 } },
        run,
      ),
    ).toMatchObject({ reason: "turn_missing" });
    expect(
      resolveBehaviorSource(target, {
        ...run,
        source_snapshot: { structured_turns: [], structured_meta: null, transcript_text: "" },
      }),
    ).toMatchObject({ reason: "snapshot_missing" });
  });

  it("keeps unknown timing unknown while highlighting a snapshot turn", () => {
    const plain = {
      ...run,
      source_snapshot: {
        structured_turns: null,
        structured_meta: null,
        transcript_text: "Rep: historical words\nCustomer: response",
      },
    };
    expect(resolveBehaviorSource(target, plain)).toMatchObject({
      status: "available",
      highlightedTurnId: 0,
      seekSeconds: null,
      turns: [
        { speaker: "unknown", start_s: null },
        { speaker: "unknown", start_s: null },
      ],
    });
  });

  it("uses a validated citation time when no exact turn was supplied", () => {
    expect(
      resolveBehaviorSource(
        { ...target, startSeconds: 12.5, source: { kind: "behavior", runId: run.id } },
        run,
      ),
    ).toMatchObject({ status: "available", highlightedTurnId: null, seekSeconds: 12.5 });
  });

  it("does not infer a source turn from a negative report exchange index", async () => {
    const report: CallSourceTarget = {
      ...target,
      startSeconds: null,
      source: { kind: "report", reportId: "report", exchangeIndex: -12 },
    };
    expect(parseCallSourceTarget(report).source).toEqual(report.source);
    const onOpenCall = vi.fn();
    await requestCallSource(report, { onOpenCall });
    expect(onOpenCall).toHaveBeenCalledWith("call", null);
  });

  it("withholds snapshot navigation when only the legacy time callback exists", async () => {
    const onOpenCall = vi.fn();
    expect(await requestCallSource(target, { onOpenCall })).toEqual({
      status: "unavailable",
      reason: "snapshot_navigation_unavailable",
    });
    expect(onOpenCall).not.toHaveBeenCalled();
  });

  it("passes provenance to the richer handler and never falls back after failure", async () => {
    const onOpenCall = vi.fn(),
      onOpenSource = vi.fn().mockRejectedValue(new Error("Source deleted"));
    await expect(requestCallSource(target, { onOpenCall, onOpenSource })).rejects.toThrow(
      "Source deleted",
    );
    expect(onOpenSource).toHaveBeenCalledWith(target);
    expect(onOpenCall).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { ...target, startSeconds: undefined },
    { ...target, startSeconds: -1 },
    { ...target, startSeconds: NaN },
    { ...target, startSeconds: "0" },
    { ...target, organizationId: "" },
    { ...target, source: { kind: "behavior", runId: "run", turnId: -1 } },
    { ...target, source: { kind: "report", reportId: "report", exchangeIndex: 1.5 } },
  ])("rejects incomplete or invalid external targets: %j", (input) => {
    expect(() => parseCallSourceTarget(input)).toThrow();
  });
});

describe("shared playback fallback contract", () => {
  it.each([null, undefined, "0", -1, NaN, Infinity])("does not turn %s into time zero", (time) => {
    expect(playbackSeekSeconds(time)).toBeNull();
  });
  it("preserves zero and fractional times and clamps to available media", () => {
    expect(playbackSeekSeconds(0, 20)).toBe(0);
    expect(playbackSeekSeconds(1.25)).toBe(1.25);
    expect(playbackSeekSeconds(100, 20)).toBe(19.99);
    expect(playbackSeekSeconds(100, Infinity)).toBe(100);
    expect(playbackSeekSeconds(10, 0)).toBeNull();
    expect(playbackSeekSeconds(10, NaN)).toBeNull();
  });
});
