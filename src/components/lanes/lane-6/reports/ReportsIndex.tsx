import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useReports, useViewer, type ReportListItem, type Viewer } from "@/lib/data";
import {
  Button,
  DataBoundary,
  SystemState,
  StateEmpty,
  Tag,
  cn,
  systemStates,
} from "@/components/bylda";
import {
  filterReports,
  kindLabel,
  reportTabs,
  reportsForViewer,
  type ReportTab,
} from "./reportModel";

export function ReportsIndex() {
  const viewer = useViewer();
  const reports = useReports();
  return (
    <DataBoundary query={viewer}>
      {(v) => (
        <DataBoundary
          query={reports}
          empty={
            <StateEmpty
              title="No reports yet."
              body="Your reports will appear here when they’re available."
            />
          }
          error={
            reports.error?.name === "ForbiddenForRoleError"
              ? () => <SystemState {...systemStates.permissionDenied()} />
              : undefined
          }
        >
          {(rows) => <ReportTable rows={reportsForViewer(rows, v)} viewer={v} />}
        </DataBoundary>
      )}
    </DataBoundary>
  );
}
function ReportTable({ rows, viewer }: { rows: ReportListItem[]; viewer: Viewer }) {
  const [tab, setTab] = useState<ReportTab>("All");
  const [notice, setNotice] = useState("");
  const filtered = filterReports(rows, tab);
  return (
    <div className="flex min-w-0 flex-col gap-5 px-9 py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-editorial-h1">Reports</h1>
          <p className="type-ui-small mt-2 text-by-text-secondary">
            Everything Bylda writes for you, as living documents. Daily briefs are P0; the rest ship
            next.
          </p>
        </div>
        {viewer.role !== "rep" && (
          <Button
            variant="secondary"
            onClick={() =>
              setNotice("Report scheduling isn’t connected yet. No schedule was created.")
            }
          >
            Schedule a report
          </Button>
        )}
      </header>
      <nav
        aria-label="Report categories"
        className="flex flex-wrap gap-[18px] border-b border-by-border-engraved"
      >
        {reportTabs.map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setNotice(
                t === "Shared with me"
                  ? "Sharing metadata isn’t available yet. No shared reports are inferred."
                  : "",
              );
            }}
            className={cn(
              "type-ui-body flex gap-1.5 py-2",
              tab === t
                ? "border-b-2 border-by-text-primary text-by-text-primary"
                : "text-by-text-secondary",
            )}
          >
            {t}
            {["All", "Daily briefs", "Weekly"].includes(t) && (
              <span className="type-mono-micro text-by-text-tertiary">
                {filterReports(rows, t).length}
              </span>
            )}
          </button>
        ))}
      </nav>
      {notice && (
        <p
          role="status"
          className="type-ui-small rounded-by-control border border-by-border-engraved bg-by-surface-inset p-3"
        >
          {notice}
        </p>
      )}
      {filtered.length ? (
        <div className="overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised">
          <table className="w-full min-w-[850px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="type-mono-micro bg-by-surface-inset text-by-text-tertiary">
              <tr>
                {["REPORT", "TYPE", "FOR", "PERIOD", "DELIVERY", "STATUS"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-by-border-engraved">
                  <td className="px-4 py-3">
                    <ReportLink
                      report={r}
                      viewer={viewer}
                      unavailable={() =>
                        setNotice(
                          "This report format is part of the next Reports section. It hasn’t been implemented yet.",
                        )
                      }
                    />
                    <p className="type-mono-micro mt-1 text-by-text-tertiary">
                      {new Date(r.generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Tag tone="neutral">{kindLabel[r.kind]}</Tag>
                  </td>
                  <td className="type-ui-small px-4 py-3">
                    {r.kind === "daily_manager"
                      ? `${viewer.name} (you)`
                      : r.kind === "weekly_manager"
                        ? (viewer.team?.name ?? "—")
                        : "—"}
                  </td>
                  <td className="type-mono-data px-4 py-3 text-by-text-secondary">{r.period}</td>
                  <td className="type-ui-small px-4 py-3">In-app</td>
                  <td
                    className="type-ui-small px-4 py-3 text-by-text-tertiary"
                    title="Read and delivery status unavailable"
                  >
                    —
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <StateEmpty
          title={
            tab === "Shared with me"
              ? "Shared reports aren’t available yet."
              : "No reports in this category."
          }
          body="Try another report category."
        />
      )}
    </div>
  );
}
function ReportLink({
  report,
  viewer,
  unavailable,
}: {
  report: ReportListItem;
  viewer: Viewer;
  unavailable: () => void;
}) {
  const className = "type-ui-body-strong text-left hover:underline";
  if (report.kind === "daily_manager")
    return (
      <Link className={className} to="/app/reports/daily" search={{ reportId: report.id }}>
        {report.title}
      </Link>
    );
  if (report.kind === "weekly_manager")
    return (
      <Link className={className} to="/app/reports/weekly" search={{ reportId: report.id }}>
        {report.title}
      </Link>
    );
  if (report.kind === "weekly_rep" && viewer.role === "rep")
    return (
      <Link className={className} to="/app/reports/rep/$repId" params={{ repId: viewer.id }}>
        {report.title}
      </Link>
    );
  return (
    <button className={className} onClick={unavailable}>
      {report.title}
    </button>
  );
}
