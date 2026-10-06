import type { SystemStateProps } from "./SystemState";

/**
 * The 13 states on page 17 (19:2), as presets. Defaults reproduce the Figma copy
 * exactly; pass real numbers — never invent them in a screen.
 */
type Cb = () => void;

export const systemStates = {
  /** Y1 · 19:6 */
  homeNoCalls: (
    p: { onConnect?: Cb; onUpload?: Cb; neededPerTeam?: number } = {},
  ): SystemStateProps => ({
    eyebrow: "HOME · NO CALLS YET",
    tag: { tone: "neutral", label: "Empty" },
    title: "Nothing to analyze yet.",
    body: `Connect a call source or upload 5+ recordings. Bylda starts finding patterns at ~${p.neededPerTeam ?? 50} calls per team.`,
    actions: [
      { label: "Connect calls", variant: "primary", onClick: p.onConnect },
      { label: "Upload files", variant: "ghost", onClick: p.onUpload },
    ],
  }),
  /** Y2 · 19:19 */
  analysisProcessing: (
    p: {
      analyzed?: number;
      total?: number;
      etaMinutes?: number;
      perRep?: number;
      onNotify?: Cb;
    } = {},
  ): SystemStateProps => ({
    eyebrow: "HOME · ANALYSIS PROCESSING",
    tag: { tone: "info", label: "Loading" },
    title: `${p.analyzed ?? 312} of ${p.total ?? 486} calls analyzed.`,
    body: `Your first brief will be ready in ~${p.etaMinutes ?? 14} min. Insights appear as soon as each rep has ${p.perRep ?? 10} analyzed calls.`,
    actions: [{ label: "Email me when ready", variant: "secondary", onClick: p.onNotify }],
  }),
  /** Y3 · 19:30 — also the OutcomeAssociation n<30 state */
  insufficientData: (
    p: { seenIn?: number; needed?: number; onExplain?: Cb } = {},
  ): SystemStateProps => ({
    eyebrow: "BEHAVIOR · INSUFFICIENT DATA",
    tag: { tone: "attention", label: "Low evidence" },
    title: "Not enough calls yet to tell whether this behavior is associated with outcomes.",
    body: `Seen in ${p.seenIn ?? 7} calls. Bylda needs ~${p.needed ?? 30} calls with and without it, plus outcomes from your CRM.`,
    actions: [{ label: "What counts as enough?", variant: "ghost", onClick: p.onExplain }],
  }),
  /** Y4 · 19:41 */
  noPatternYet: (p: { onViewReps?: Cb } = {}): SystemStateProps => ({
    eyebrow: "INTELLIGENCE · NO PATTERN YET",
    tag: { tone: "neutral", label: "Empty" },
    title: "No team-wide pattern this week.",
    body: "That’s normal for a steady team. Individual rep changes still show on each profile.",
    actions: [{ label: "View rep changes", variant: "ghost", onClick: p.onViewReps }],
  }),
  /** Y5 · 19:52 */
  analysisFailed: (p: { reason?: string; onRetry?: Cb; onReport?: Cb } = {}): SystemStateProps => ({
    eyebrow: "CALL · ANALYSIS FAILED",
    tag: { tone: "regress", label: "Error" },
    tone: "error",
    title: "We couldn’t analyze this call.",
    body:
      p.reason ??
      "Audio has one channel and speakers overlap for 84% of it. Try the dual-channel recording from Zoom.",
    actions: [
      { label: "Retry", variant: "secondary", onClick: p.onRetry },
      { label: "Report issue", variant: "ghost", onClick: p.onReport },
    ],
  }),
  /** Y6 · 19:65 */
  missingTranscript: (p: { durationLabel?: string; onInclude?: Cb } = {}): SystemStateProps => ({
    eyebrow: "CALL · MISSING TRANSCRIPT",
    tag: { tone: "attention", label: "Partial" },
    title: `Audio only — ${p.durationLabel ?? "40 seconds"}.`,
    body: "Looks like a voicemail or dropped call. Excluded from rep trends.",
    actions: [{ label: "Include anyway", variant: "ghost", onClick: p.onInclude }],
  }),
  /** Y7 · 19:76 */
  unsupportedFile: (p: { fileName?: string; onChoose?: Cb } = {}): SystemStateProps => ({
    eyebrow: "UPLOAD · UNSUPPORTED FILE",
    tag: { tone: "regress", label: "Error" },
    tone: "error",
    title: `${p.fileName ?? "kickoff.mov"} isn’t supported.`,
    body: "Use mp3, m4a, wav, mp4, vtt or txt. Max 2 GB.",
    actions: [{ label: "Choose another file", variant: "secondary", onClick: p.onChoose }],
  }),
  /** Y8 · 19:87 */
  integrationDisconnected: (
    p: {
      provider?: string;
      since?: string;
      waiting?: number;
      reason?: string;
      onReconnect?: Cb;
    } = {},
  ): SystemStateProps => ({
    eyebrow: "INTEGRATION · DISCONNECTED",
    tag: { tone: "regress", label: "Reconnect required" },
    tone: "error",
    title: `${p.provider ?? "Aircall"} stopped syncing on ${p.since ?? "Sep 27"}.`,
    body: `${p.reason ?? "The access token expired."} ${p.waiting ?? 23} calls since then are waiting and will backfill on reconnect.`,
    actions: [
      { label: `Reconnect ${p.provider ?? "Aircall"}`, variant: "primary", onClick: p.onReconnect },
    ],
  }),
  /** Y9 · 19:98 */
  permissionDenied: (
    p: { ownerFirstName?: string; managerFirstName?: string; onRequest?: Cb } = {},
  ): SystemStateProps => ({
    eyebrow: "REP · PERMISSION DENIED",
    tag: { tone: "neutral", label: "Restricted" },
    title: `This is ${p.ownerFirstName ?? "Sarah"}’s call.`,
    body: `Reps see their own calls and calls their manager shares with them. Ask ${p.managerFirstName ?? "Dana"} if you want to learn from it.`,
    actions: [{ label: "Request access", variant: "ghost", onClick: p.onRequest }],
  }),
  /** Y10 · 19:109 */
  teamNoMembers: (p: { onInvite?: Cb; onMap?: Cb; recorder?: string } = {}): SystemStateProps => ({
    eyebrow: "TEAM · NO MEMBERS",
    tag: { tone: "neutral", label: "Empty" },
    title: "No reps on this team yet.",
    body: "Invite reps by email, or map them automatically from your call recorder’s user list.",
    actions: [
      { label: "Invite reps", variant: "primary", onClick: p.onInvite },
      { label: `Map from ${p.recorder ?? "Zoom"}`, variant: "ghost", onClick: p.onMap },
    ],
  }),
  /** Y11 · 19:122 */
  callDeleted: (
    p: { deletedOn?: string; retentionDays?: number; onBack?: Cb } = {},
  ): SystemStateProps => ({
    eyebrow: "CALL · DELETED",
    tag: { tone: "neutral", label: "Removed" },
    title: `This call was deleted by an admin on ${p.deletedOn ?? "Sep 20"}.`,
    body: `Retention policy: ${p.retentionDays ?? 90} days. Insights that used it keep counts but lose the evidence link.`,
    actions: [{ label: "Back to calls", variant: "ghost", onClick: p.onBack }],
  }),
  /** Y12 · 19:133 */
  searchNoResults: (
    p: { query?: string; windowDays?: number; onWiden?: Cb } = {},
  ): SystemStateProps => ({
    eyebrow: "SEARCH · NO RESULTS",
    tag: { tone: "neutral", label: "Empty" },
    title: `No calls match “${p.query ?? "procurement freeze"}” in the last ${p.windowDays ?? 30} days.`,
    body: "Try 90 days, or search transcripts instead of summaries.",
    actions: [{ label: "Search 90 days", variant: "ghost", onClick: p.onWiden }],
  }),
} as const;

export type SystemStateId = keyof typeof systemStates;

/** Y1–Y13 by page-17 code, for the gallery and FRAMES.md cross-reference. */
export const STATE_CODES: {
  code: string;
  node: string;
  id: SystemStateId | "skeleton";
  name: string;
}[] = [
  { code: "Y1", node: "19:6", id: "homeNoCalls", name: "Home · No calls yet" },
  { code: "Y2", node: "19:19", id: "analysisProcessing", name: "Home · Analysis processing" },
  { code: "Y3", node: "19:30", id: "insufficientData", name: "Behavior · Insufficient data" },
  { code: "Y4", node: "19:41", id: "noPatternYet", name: "Intelligence · No pattern yet" },
  { code: "Y5", node: "19:52", id: "analysisFailed", name: "Call · Analysis failed" },
  { code: "Y6", node: "19:65", id: "missingTranscript", name: "Call · Missing transcript" },
  { code: "Y7", node: "19:76", id: "unsupportedFile", name: "Upload · Unsupported file" },
  { code: "Y8", node: "19:87", id: "integrationDisconnected", name: "Integration · Disconnected" },
  { code: "Y9", node: "19:98", id: "permissionDenied", name: "Rep · Permission denied" },
  { code: "Y10", node: "19:109", id: "teamNoMembers", name: "Team · No members" },
  { code: "Y11", node: "19:122", id: "callDeleted", name: "Call · Deleted" },
  { code: "Y12", node: "19:133", id: "searchNoResults", name: "Search · No results" },
  { code: "Y13", node: "19:144", id: "skeleton", name: "Feed · Skeleton" },
];
