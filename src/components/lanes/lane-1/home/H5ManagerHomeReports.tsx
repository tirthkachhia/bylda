import { Link } from "@tanstack/react-router";
import { Button, Icon, StateEmpty } from "@/components/bylda";
import { useBrief, useReports, type ReportListItem } from "@/lib/data";
import { HomeTab } from "./shared/HomeTab";
import { ListCard, ListRow, ROW_LIST, SectionLabel } from "./shared/List";

/**
 * H5 · Manager Home — Reports
 * Figma 43:2139 (page 1:6) · Lane 1 — Ansh · route /app/home/reports
 * Hooks: useHomeFeed (via HomeTab) + useReports (+ useBrief per row for read time and summary).
 *
 * Reports "ready for you", newest first. The Figma frame is broken — its four cards are 188px
 * wide with the sparkline and Open button clipped — so this follows the evident intent: one
 * full-width row per report (LANE_REQUESTS #33). Sparklines are omitted: no per-report series
 * exists in the data layer.
 */
export function H5ManagerHomeReports() {
  return <HomeTab eyebrow="HOME · REPORTS">{() => <ReadyForYou />}</HomeTab>;
}

function ReadyForYou() {
  const reports = useReports();
  if (reports.isLoading) return null;
  const rows = (reports.data ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));

  if (rows.length === 0) {
    return (
      <StateEmpty
        eyebrow="HOME · REPORTS"
        title="No reports yet."
        body="Your daily and weekly briefs land here once Bylda has analyzed enough calls."
      />
    );
  }
  return (
    <>
      <SectionLabel>READY FOR YOU</SectionLabel>
      <ListCard className={ROW_LIST}>
        {rows.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
      </ListCard>
    </>
  );
}

function ReportRow({ report: r }: { report: ReportListItem }) {
  const brief = useBrief(r.id);
  const first = brief.data?.sections[0];
  const summary = first?.insights[0]?.headline ?? first?.body ?? null;
  const meta = [r.period, brief.data ? `${brief.data.readMinutes}-min read` : null]
    .filter(Boolean)
    .join(" · ");
  const daily = r.kind === "daily_manager" || r.kind === "daily_rep";

  return (
    <ListRow className="gap-3.5 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-by-tile bg-by-surface-inset text-by-text-secondary">
        <Icon name="file" size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="type-ui-body-strong text-by-text-primary">{r.title}</span>
        {summary ? <span className="type-ui-small text-by-text-secondary">{summary}</span> : null}
        <span className="type-ui-small text-by-text-tertiary">{meta}</span>
      </span>
      <Button asChild variant="secondary">
        {daily ? (
          <Link to="/app/reports/daily" search={{ reportId: r.id } as never}>
            Open
          </Link>
        ) : (
          <Link to="/app/reports">Open</Link>
        )}
      </Button>
    </ListRow>
  );
}
