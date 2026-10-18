import { formatDuration, formatWhen, initials, type CoachingCall } from "@/lib/coaching/calls";

function stageLabel(call: CoachingCall) {
  if (call.insight) return "Reviewed";
  if (call.coaching_stage === "queued" || call.coaching_stage === "transcribing")
    return "Transcribing…";
  if (call.coaching_stage === "scoring") return "Scoring…";
  if (call.coaching_stage === "failed") return "Transcription failed";
  return call.transcript ? "Transcript ready" : "Awaiting transcript";
}

/** Searchable list of one rep's calls. Selection is owned by the parent. */
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
    <aside className="overflow-hidden rounded-[20px] border border-black/[0.09] bg-by-surface-raised xl:sticky xl:top-0 xl:max-h-[calc(100vh-145px)]">
      <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-4">
        <span className="text-[12px] font-bold">Calls</span>
        <span className="rounded-full bg-[#e7e8e4] px-2 py-1 text-[9px] font-semibold text-[#777d85]">
          {calls.length} loaded
        </span>
      </div>
      <div className="border-b border-black/5 p-3">
        <input
          aria-label="Search calls"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search contacts or companies…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="max-h-[calc(100vh-205px)] overflow-y-auto p-2">
        {calls.length === 0 && (
          <p className="p-5 text-sm text-slate-500">
            No calls match your search.{" "}
            <button className="mt-2 block font-semibold text-blue-700" onClick={() => onSearch("")}>
              Clear search
            </button>
          </p>
        )}
        {calls.map((call) => (
          <button
            key={call.id}
            onClick={() => onSelect(call.id)}
            aria-pressed={call.id === selectedId}
            className={`mb-1 flex w-full items-center gap-3 rounded-by-card p-3 text-left ${call.id === selectedId ? "bg-[#e5ebf5]" : "hover:bg-black/[0.03]"}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbe7f8] text-[10px] font-bold text-[#346dbf]">
              {initials(call.contactName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold">{call.contactName}</span>
              <span className="block truncate text-[9px] text-by-text-secondary">
                {call.company} · {formatWhen(call.started_at ?? call.created_at)}
              </span>
              <span
                className={`mt-0.5 block text-[9px] ${call.coaching_stage === "failed" ? "text-red-600" : "text-[#3275d8]"}`}
              >
                {formatDuration(call.duration)} · {stageLabel(call)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
