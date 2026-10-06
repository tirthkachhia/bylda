import { DataBoundary } from "@/components/bylda";
import { useUsage, type UsageMeter } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalAccountLayout, LocalAccountMetric, LocalAccountMissingRow } from "./LocalAccount";
import { usageValue } from "./accountModel";
export function E16SettingsUsage() {
  return (
    <LocalAccountLayout active="Usage">
      <UsageContent />
    </LocalAccountLayout>
  );
}
function UsageContent() {
  const query = useUsage();
  return (
    <DataBoundary
      query={query}
      empty={
        <>
          <LocalSettingsHeading title="Usage" />
          <LocalSettingsEmpty noun="usage records" />
        </>
      }
    >
      {(items) => <UsageSettings items={items} />}
    </DataBoundary>
  );
}
function UsageSettings({ items }: { items: UsageMeter[] }) {
  const periods = [...new Set(items.map((item) => item.period))];
  const period = periods.length === 1 ? periods[0] : undefined;
  const calls = period ? items.find((item) => item.key === "calls_analyzed") : undefined;
  const seats = period ? items.find((item) => item.key === "seats") : undefined;
  return (
    <>
      <LocalSettingsHeading title="Usage" subtitle={period ?? "Usage by reporting period"} />
      <div className="flex min-h-20 rounded-by-card border border-by-border-engraved bg-by-surface-raised max-lg:flex-wrap">
        <LocalAccountMetric
          label="CALLS ANALYZED"
          value={calls ? calls.used.toLocaleString("en-US") : "—"}
        />
        <LocalAccountMetric label="AUDIO HOURS" value="—" hint="Not available" />
        <LocalAccountMetric label="SEATS" value={usageValue(seats)} />
        <LocalAccountMetric label="FAILED" value="—" hint="Not available" />
      </div>
      <section className="flex min-h-44 flex-col gap-6 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
        <h2 className="type-ui-label">CALLS ANALYZED PER DAY</h2>
        <p className="type-ui-small text-by-text-secondary">Daily usage isn't available yet.</p>
      </section>
      <LocalSettingsTable
        headings={["TEAM", "SEATS", "CALLS", "HOURS", "COST"]}
        columnClasses={["w-[30%]", "w-[12%]", "w-[12%]", "w-[13%]", "w-[33%]"]}
      >
        <LocalAccountMissingRow columns={5}>
          Team usage and costs aren't available yet.
        </LocalAccountMissingRow>
      </LocalSettingsTable>
      <h2 className="type-ui-label">USAGE METERS</h2>
      <LocalSettingsTable headings={["METER", "USED", "LIMIT", "PERIOD"]}>
        {items.map((item, index) => (
          <tr key={`${item.key}:${item.period}:${index}`}>
            <td className={cell}>{item.label}</td>
            <td className={cell}>{item.used.toLocaleString("en-US")}</td>
            <td className={cell}>
              {item.limit === null ? "Not available" : item.limit.toLocaleString("en-US")}
            </td>
            <td className={cell}>{item.period}</td>
          </tr>
        ))}
      </LocalSettingsTable>
    </>
  );
}
