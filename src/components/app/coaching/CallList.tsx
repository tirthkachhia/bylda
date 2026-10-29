import { formatDuration, formatWhen, initials, type CoachingCall } from "@/lib/coaching/calls";
function callStageLabel(call: CoachingCall) {
  if (call.coaching_stage === "queued" || call.coaching_stage === "transcribing")
    return "Transcribing…";
  if (call.coaching_stage === "scoring") return "Scoring…";
  if (call.coaching_stage === "analyzing") return "Analyzing…";
  if (call.coaching_stage === "analysis_failed") return "Analysis needs retry";
  if (call.coaching_stage === "failed") return "Processing failed";
  return call.insight ? "Analyzed" : call.transcript ? "Transcript ready" : "Awaiting transcript";
}
export function CallList({
  calls,
  selectedId,
  onSelect,
  search,
  onSearch,
}: {
  calls: CoachingCall[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-by-border-engraved bg-white"
      aria-label="Calls list"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-by-border-engraved p-3">
        <p className="text-xs text-by-text-secondary">{calls.length} matching loaded calls</p>
        <label className="flex items-center gap-2 rounded-md border border-by-border-control px-3 py-2">
          <img src="/figma/search.svg" alt="" />
          <input
            aria-label="Search loaded calls"
            placeholder="Search calls, accounts…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="w-48 bg-transparent text-xs outline-none"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="bg-by-surface-sidebar text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Call</th>
              <th className="px-4 py-3">Rep</th>
              <th className="px-4 py-3">Why it matters</th>
              <th className="px-4 py-3">CRM stage</th>
              <th className="px-4 py-3">Length</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.id}
                className={`border-t border-by-border-engraved ${selectedId === call.id ? "bg-by-surface-sidebar" : "hover:bg-by-surface-hover"}`}
              >
                <td className="max-w-64 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(call.id)}
                    className="text-left font-medium underline-offset-4 hover:underline"
                  >
                    {call.contactName}
                  </button>
                  <p className="mt-1 text-[11px] text-by-text-tertiary">
                    {formatWhen(call.started_at ?? call.created_at)}
                  </p>
                  <p
                    className={`mt-1 text-[11px] ${call.coaching_stage?.includes("failed") ? "text-red-700" : "text-by-text-secondary"}`}
                  >
                    {callStageLabel(call)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-by-avatar-metal text-[9px]">
                      {initials(call.repName ?? "?")}
                    </span>
                    {call.repName ?? "Unassigned"}
                  </span>
                </td>
                <td className="max-w-sm px-4 py-3 text-xs leading-5">
                  {call.insight?.summary ||
                    (call.transcript ? "Analysis pending" : "Transcript unavailable")}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-by-border-engraved px-2 py-1 text-[11px]">
                    {call.dealStage ?? "Unknown"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {formatDuration(call.duration)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!calls.length && (
        <p className="p-8 text-sm text-by-text-secondary">
          No loaded calls match these filters.{" "}
          <button type="button" onClick={() => onSearch("")} className="underline">
            Clear search
          </button>
        </p>
      )}
    </section>
  );
}
