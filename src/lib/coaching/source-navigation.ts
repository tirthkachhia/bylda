import { sourceTurns } from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import type { BehaviorRunSource, Evidence } from "./types";

export type CallSourceTarget = {
  organizationId: string;
  repId: string | null;
  callId: string;
  startSeconds: number | null;
  source:
    | { kind: "behavior"; runId: string; turnId?: number; eventId?: string }
    | { kind: "report"; reportId: string; exchangeIndex?: number }
    | { kind: "call" };
};

export type OpenCallSource = (target: CallSourceTarget) => void | Promise<void>;
export type OpenCall = (callId: string, seconds?: number | null) => void;

/** Optional richer handler keeps existing report/calls consumers compatible. */
export type SourceNavigationProps = {
  onOpenCall: OpenCall;
  onOpenSource?: OpenCallSource;
};

export function validSourceSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Called after media metadata loads. Null never becomes a seek to zero. */
export function playbackSeekSeconds(value: unknown, duration: number | null = null): number | null {
  if (!validSourceSeconds(value)) return null;
  if (duration === null || duration === Infinity) return value;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return Math.min(value, Math.max(0, duration - 0.01));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value === value.trim();

/** Validate external/deep-link input without coercing absent or invalid times. */
export function parseCallSourceTarget(value: unknown): CallSourceTarget {
  if (
    !isRecord(value) ||
    !identifier(value.organizationId) ||
    !(value.repId === null || identifier(value.repId)) ||
    !identifier(value.callId) ||
    !(value.startSeconds === null || validSourceSeconds(value.startSeconds)) ||
    !isRecord(value.source)
  )
    throw new Error("Invalid call source target.");
  const source = value.source;
  let parsed: CallSourceTarget["source"];
  if (source.kind === "behavior") {
    if (
      !identifier(source.runId) ||
      (source.turnId !== undefined &&
        !(Number.isSafeInteger(source.turnId) && Number(source.turnId) >= 0)) ||
      (source.eventId !== undefined && !identifier(source.eventId))
    )
      throw new Error("Invalid behavioral source identity.");
    parsed = {
      kind: "behavior",
      runId: source.runId,
      ...(source.turnId !== undefined ? { turnId: source.turnId as number } : {}),
      ...(source.eventId !== undefined ? { eventId: source.eventId as string } : {}),
    };
  } else if (source.kind === "report") {
    if (
      !identifier(source.reportId) ||
      (source.exchangeIndex !== undefined && !Number.isSafeInteger(source.exchangeIndex))
    )
      throw new Error("Invalid report source identity.");
    parsed = {
      kind: "report",
      reportId: source.reportId,
      ...(source.exchangeIndex !== undefined
        ? { exchangeIndex: source.exchangeIndex as number }
        : {}),
    };
  } else if (source.kind === "call") parsed = { kind: "call" };
  else throw new Error("Unknown call source kind.");
  return {
    organizationId: value.organizationId,
    repId: value.repId,
    callId: value.callId,
    startSeconds: value.startSeconds,
    source: parsed,
  };
}

export type BehaviorSourceResolution =
  | {
      status: "available";
      runId: string;
      transcriptHash: string;
      turns: Evidence[];
      highlightedTurnId: number | null;
      seekSeconds: number | null;
    }
  | {
      status: "unavailable";
      reason: "source_missing" | "source_mismatch" | "snapshot_missing" | "turn_missing";
    };

/** Resolve only the retained snapshot supplied; never substitute the current transcript. */
export function resolveBehaviorSource(
  input: CallSourceTarget,
  run: BehaviorRunSource | null,
): BehaviorSourceResolution {
  const target = parseCallSourceTarget(input);
  if (!run) return { status: "unavailable", reason: "source_missing" };
  if (
    target.source.kind !== "behavior" ||
    run.id !== target.source.runId ||
    run.organization_id !== target.organizationId ||
    run.call_id !== target.callId ||
    run.rep_id !== target.repId
  )
    return { status: "unavailable", reason: "source_mismatch" };
  const snapshot = run.source_snapshot;
  if (
    !snapshot ||
    !identifier(run.transcript_hash) ||
    !(
      snapshot.structured_turns === null ||
      (Array.isArray(snapshot.structured_turns) &&
        snapshot.structured_turns.every(
          (turn) =>
            turn &&
            typeof turn.text === "string" &&
            ["rep", "customer", "unknown"].includes(turn.speaker),
        ))
    ) ||
    typeof snapshot.transcript_text !== "string"
  )
    return { status: "unavailable", reason: "snapshot_missing" };
  const turns = sourceTurns(snapshot.structured_turns, snapshot.transcript_text);
  if (!turns.length) return { status: "unavailable", reason: "snapshot_missing" };
  const turnId = target.source.turnId ?? null;
  const turn = turnId === null ? null : turns.find((entry) => entry.turn_id === turnId);
  if (turnId !== null && !turn) return { status: "unavailable", reason: "turn_missing" };
  return {
    status: "available",
    runId: run.id,
    transcriptHash: run.transcript_hash,
    turns,
    highlightedTurnId: turnId,
    // A selected source turn is authoritative, including an unknown timestamp.
    seekSeconds: turn ? turn.start_s : target.startSeconds,
  };
}

/** Snapshot requests must not degrade into time-only navigation on old consumers. */
export async function requestCallSource(input: CallSourceTarget, handlers: SourceNavigationProps) {
  const target = parseCallSourceTarget(input);
  if (handlers.onOpenSource) {
    await handlers.onOpenSource(target);
    return { status: "requested" } as const;
  }
  if (target.source.kind === "behavior")
    return { status: "unavailable", reason: "snapshot_navigation_unavailable" } as const;
  handlers.onOpenCall(target.callId, target.startSeconds);
  return { status: "requested" } as const;
}
