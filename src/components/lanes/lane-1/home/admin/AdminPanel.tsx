import { Link } from "@tanstack/react-router";
import { ContextPanel, SkeletonBar, cn } from "@/components/bylda";
import {
  useDataSources,
  useDeliveryChannels,
  useMembers,
  useMethodologies,
  usePlan,
  useTeams,
  type Plan,
} from "@/lib/data";
import { checklistFor, type ChecklistItem } from "./summary";

const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Context panel (Figma 31:10009): setup checklist, seats & plan, and why this home exists.
 * The checklist is derived from live data — every item is a fact about the workspace, none is typed in.
 */
export function AdminPanel() {
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <Checklist />
        <SeatsAndPlan />
        <div className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
          <p className="type-mono-micro text-by-text-tertiary">WHY THIS HOME</p>
          <p className="type-ui-small text-by-text-primary">
            Owners care whether Bylda is working and being used. Team intelligence is one click
            away, but not the first thing shown.
          </p>
        </div>
      </div>
    </ContextPanel>
  );
}

function Checklist() {
  const methodologies = useMethodologies();
  const sources = useDataSources();
  const members = useMembers();
  const channels = useDeliveryChannels();
  const teams = useTeams();
  const loading = [methodologies, sources, members, channels, teams].some((q) => q.isLoading);

  const items = loading
    ? []
    : checklistFor({
        methodologies: methodologies.data ?? [],
        sources: sources.data ?? [],
        members: members.data ?? [],
        channels: channels.data ?? [],
        teams: teams.data ?? [],
      });
  const done = items.filter((i) => i.done).length;

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="type-ui-label flex-1 text-by-text-primary">SETUP CHECKLIST</h2>
        {!loading ? (
          <span className="type-mono-micro text-by-text-tertiary">
            {done} of {items.length}
          </span>
        ) : null}
      </div>
      {loading
        ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-by-border-engraved py-2.5">
              <SkeletonBar width="70%" height={12} />
            </div>
          ))
        : items.map((item) => <ChecklistRow key={item.id} item={item} />)}
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const body = (
    <>
      <span
        className={cn(
          "type-mono-data",
          item.done ? "text-by-text-secondary" : "text-by-text-tertiary",
        )}
        aria-hidden
      >
        {item.done ? "✓" : "○"}
      </span>
      <span
        className={cn(
          "type-ui-small flex-1",
          item.done ? "text-by-text-secondary" : "text-by-text-primary",
        )}
      >
        <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
        {item.label}
      </span>
    </>
  );
  const row = "flex gap-2 border-b border-by-border-engraved py-1.5";
  if (item.done || !item.link) return <div className={row}>{body}</div>;
  return (
    <Link
      to={item.link.to}
      params={"params" in item.link ? item.link.params : undefined}
      className={cn(row, "transition-colors duration-200 ease-out hover:bg-by-surface-hover")}
    >
      {body}
    </Link>
  );
}

function SeatsAndPlan() {
  const plan = usePlan();
  return (
    <div className="flex flex-col">
      <h2 className="type-ui-label mb-1 text-by-text-primary">SEATS &amp; PLAN</h2>
      {plan.isLoading ? (
        <SkeletonBar width="80%" height={12} />
      ) : plan.data ? (
        <PlanRows plan={plan.data} />
      ) : (
        <p className="type-ui-small text-by-text-tertiary">No plan on file.</p>
      )}
    </div>
  );
}

function PlanRows({ plan }: { plan: Plan }) {
  const rows: [string, string][] = [
    [
      "Plan",
      plan.status === "active" ? plan.tier : `${plan.tier} · ${plan.status.replace("_", " ")}`,
    ],
    ["Seats", `${plan.seatsUsed} of ${plan.seats ?? "—"}`],
    [
      plan.cancelAtPeriodEnd ? "Ends" : "Renews",
      plan.periodEnd ? date.format(new Date(plan.periodEnd)) : "—",
    ],
  ];
  return (
    <>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2.5 border-b border-by-border-engraved py-2">
          <span className="type-mono-micro w-20 text-by-text-tertiary">{k}</span>
          <span className="type-ui-small flex-1 text-by-text-primary">{v}</span>
        </div>
      ))}
    </>
  );
}
