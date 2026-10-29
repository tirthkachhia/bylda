import { useQuery } from "@tanstack/react-query";
import { callScoresQuery } from "@/lib/queries";
import { validSourceSeconds } from "@/lib/coaching/source-navigation";
import { timeLabel } from "@/lib/coaching/behavior";

/** Current call scoring has exchange identity, not immutable behavioral turn identity. */
export function CallScores({
  callId,
  onSeek,
}: {
  callId: string;
  onSeek?: (seconds: number) => void;
}) {
  const q = useQuery(callScoresQuery(callId));
  if (q.isPending)
    return (
      <p role="status" className="p-5 text-sm">
        Loading learning moments…
      </p>
    );
  if (q.error)
    return (
      <p role="alert" className="p-5 text-sm">
        Learning moments could not load.{" "}
        <button className="underline" onClick={() => void q.refetch()}>
          Retry
        </button>
      </p>
    );
  const moments = q.data?.moments ?? [];
  const rows = q.data?.rows ?? [];
  return (
    <section className="space-y-4" data-design-screen="learning-moments">
      <h2 className="text-lg">Learning moments</h2>
      <p className="text-xs text-by-text-secondary">
        Current exchange-scoring evidence. These rows do not retain the behavioral analysis run’s
        turn IDs.
      </p>
      {!moments.length ? (
        <p className="figma-empty">No learning moments are available for this call.</p>
      ) : (
        <ol className="space-y-3">
          {moments.map((m) => {
            const row = rows.find((r) => r.exchange_index === m.exchange_index);
            const raw = row?.start_s;
            const at =
              typeof raw === "number"
                ? raw
                : typeof raw === "string" && raw.trim()
                  ? Number(raw)
                  : null;
            const known = validSourceSeconds(at);
            return (
              <li
                key={m.id}
                className="rounded-lg border border-by-border-engraved bg-by-surface-hover p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="figma-button font-mono"
                    disabled={!known || !onSeek}
                    onClick={() => {
                      if (known) onSeek?.(at);
                    }}
                  >
                    {timeLabel(known ? at : null)}
                  </button>
                  <h3 className="text-sm font-medium">{m.headline ?? "Moment worth reviewing"}</h3>
                  {m.low_confidence && (
                    <span className="text-xs text-by-text-secondary">Low confidence</span>
                  )}
                </div>
                <p className="mt-3 text-[13px]">{m.why_it_matters}</p>
                <div className="my-3 space-y-2 rounded-md border border-by-border-engraved bg-white p-3 text-xs">
                  {m.rep_text && (
                    <blockquote>
                      <strong>Rep:</strong> {m.rep_text}
                    </blockquote>
                  )}
                  {m.customer_text && (
                    <blockquote>
                      <strong>Buyer:</strong> {m.customer_text}
                    </blockquote>
                  )}
                </div>
                {!m.low_confidence && m.what_to_say_instead && (
                  <p className="text-[13px]">
                    <strong>Practice:</strong> {m.what_to_say_instead}
                  </p>
                )}
                {m.playbook_guideline && (
                  <p className="mt-3 text-xs text-by-text-secondary">
                    {m.guideline_source === "playbook" ? "Playbook" : "General guidance"}:{" "}
                    {m.playbook_guideline}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
