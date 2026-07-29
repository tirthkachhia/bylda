/**
 * NextToolPrompt — one clear next move after a tool run, instead of a
 * dead-end output screen.
 *
 * Primary suggestion comes from the tool relationship map (HANDOFFS —
 * first entry = primary). The one-line reason is pulled from the run's own
 * `recommended_next_actions` output when an entry matches the suggested
 * tool; if the output produced no matching reason, no reason is shown —
 * never fabricated.
 *
 * Tapping the primary (or any secondary) launches the next tool through
 * the existing pre-briefed flow: ?context= / ?title= prefill plus
 * ?fromRun=, which makes the server inject this run's full output into the
 * next tool's AI context. "Not now" always dismisses — a suggestion, not a
 * wizard.
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { HANDOFFS } from "@/lib/handoffs";

export interface RunNextAction {
  type: string;
  target?: string;
  label: string;
  reason: string;
}

interface NextToolPromptProps {
  /** Route key of the tool that just finished */
  toolKey: string;
  /** Run id of the finished run — carried as ?fromRun= for server-side chaining */
  runId: string | null;
  /** Run title — carried as ?title= */
  runTitle: string;
  /** Primary input of the finished run — carried as ?context= */
  contextValue: string;
  /** The run's own recommended_next_actions output (reasons come from here) */
  nextActions: RunNextAction[];
  /** Map backend toolKey → route slug, for matching output actions to handoffs */
  slugByToolKey: Map<string, string>;
  onDismiss: () => void;
}

export function NextToolPrompt({
  toolKey,
  runId,
  runTitle,
  contextValue,
  nextActions,
  slugByToolKey,
  onDismiss,
}: NextToolPromptProps) {
  const chain = HANDOFFS[toolKey] ?? [];
  if (chain.length === 0) return null;

  const primary = chain[0];
  const rest = chain.slice(1, 4);

  // Reason for the primary suggestion — only from real output data.
  const matchesPrimary = (a: RunNextAction) => {
    if (!a.target) return false;
    const slug = slugByToolKey.get(a.target) ?? a.target;
    return slug === primary.toolKey;
  };
  const reason = nextActions.find(matchesPrimary)?.reason ?? null;

  const launchSearch = (to: string) =>
    to.startsWith("/app/launchpad/")
      ? ({ context: contextValue, title: runTitle, fromRun: runId ?? undefined } as never)
      : undefined;

  return (
    <div
      className="px-5 py-4"
      style={{ borderTop: "1px solid color-mix(in oklab, var(--border) 60%, transparent)" }}
    >
      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        Next
      </div>

      {/* Primary — the one clear next move */}
      <Link
        to={primary.to}
        search={launchSearch(primary.to)}
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border p-3.5 transition hover:-translate-y-0.5"
        style={{
          borderColor: "color-mix(in oklab, var(--primary) 35%, var(--border))",
          background: "color-mix(in oklab, var(--primary) 5%, var(--surface))",
        }}
      >
        <div className="min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
            Next: {primary.label}
          </div>
          {reason && (
            <p
              className="mt-0.5 text-[11.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {reason}
            </p>
          )}
          <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-faint)" }}>
            Opens pre-briefed with this run's output — nothing to retype.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
      </Link>

      {/* Secondary options + dismiss — quiet, never blocking */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {rest.map((h) => (
          <Link
            key={h.to}
            to={h.to}
            search={launchSearch(h.to)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition hover:opacity-100"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              opacity: 0.85,
            }}
          >
            {h.label} <ArrowRight className="h-3 w-3" />
          </Link>
        ))}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto rounded-xl px-3 py-1.5 text-[12px] font-medium transition hover:opacity-100"
          style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
