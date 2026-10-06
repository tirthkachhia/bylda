import { Avatar, Button, DataBoundary } from "@/components/bylda";
import { useAuditLog } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalAccountLayout } from "./LocalAccount";
import { auditCsv, displayDate, sortedAudit } from "./accountModel";
export function E18SettingsAuditLog() {
  return (
    <LocalAccountLayout active="Audit log">
      <AuditContent />
    </LocalAccountLayout>
  );
}
function AuditContent() {
  const query = useAuditLog();
  const canExport = !!query.data?.length && !query.error && !query.isLoading && !query.isEmpty;
  return (
    <>
      <LocalSettingsHeading
        title="Audit log"
        subtitle="Who accessed or changed what. Times shown in UTC."
        action={
          <Button variant="secondary" asChild={canExport} disabled={!canExport}>
            {canExport && query.data ? (
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(auditCsv(sortedAudit(query.data)))}`}
                download="bylda-audit.csv"
              >
                Export CSV
              </a>
            ) : (
              "Export CSV"
            )}
          </Button>
        }
      />
      <DataBoundary query={query} empty={<LocalSettingsEmpty noun="audit entries" />}>
        {(entries) => (
          <LocalSettingsTable
            headings={["WHEN (UTC)", "WHO", "ACTION", "TARGET"]}
            columnClasses={["w-[16%]", "w-[20%]", "w-[33%]", "w-[31%]"]}
          >
            {sortedAudit(entries).map((entry) => (
              <tr key={entry.id}>
                <td className={`${cell} type-mono-data text-by-text-secondary`}>
                  <time dateTime={entry.createdAt}>{displayDate(entry.createdAt, true)}</time>
                </td>
                <td className={cell}>
                  <span className="flex items-center gap-2">
                    {entry.actorName.toLowerCase() !== "system" && (
                      <Avatar name={entry.actorName} size={22} />
                    )}
                    <span className="type-ui-body-strong">{entry.actorName}</span>
                  </span>
                </td>
                <td className={cell}>{entry.action}</td>
                <td className={cell}>{entry.entity || "Not available"}</td>
              </tr>
            ))}
          </LocalSettingsTable>
        )}
      </DataBoundary>
    </>
  );
}
