import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  StateEmpty,
  SystemState,
  systemStates,
  Tag,
  cn,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCalls,
  useMyCalls,
  useSavedViews,
  useViewer,
  type Call,
  type SavedView,
  type Viewer,
} from "@/lib/data";
import {
  LocalField,
  LocalSelect,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
import {
  durationLabel,
  emptyFilters,
  filterCalls,
  medianDuration,
  ownCalls,
  sortCalls,
  type LocalCallFilters,
} from "./callIndexModel";

export function LocalCallIndex({ mode }: { mode: "saved" | "all" | "mine" }) {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        mode === "mine" || person.role === "rep" ? (
          <OwnIndex viewer={person} />
        ) : (
          <ManagerIndex mode={mode} viewer={person} />
        )
      }
    </DataBoundary>
  );
}
function callError(error: unknown) {
  return error instanceof ForbiddenForRoleError ? (
    <SystemState {...systemStates.permissionDenied()} />
  ) : null;
}
function CallsBoundary({
  query,
  children,
}: {
  query: ReturnType<typeof useCalls>;
  children: (calls: Call[]) => ReactNode;
}) {
  return (
    <DataBoundary
      query={query}
      empty={
        <StateEmpty title="No calls yet." body="Your calls will appear when they’re available." />
      }
      error={(error) =>
        callError(error) ?? (
          <SystemState
            title="Calls couldn’t load."
            body={error instanceof Error ? error.message : "Try again."}
            actions={[{ label: "Retry", onClick: () => void query.refetch() }]}
          />
        )
      }
    >
      {children}
    </DataBoundary>
  );
}
function ManagerIndex({ mode, viewer }: { mode: "saved" | "all"; viewer: Viewer }) {
  const query = useCalls();
  return (
    <CallsBoundary query={query}>
      {(calls) => <ManagerContent calls={calls} mode={mode} viewer={viewer} />}
    </CallsBoundary>
  );
}
function ManagerContent({
  calls,
  mode,
  viewer,
}: {
  calls: Call[];
  mode: "saved" | "all";
  viewer: Viewer;
}) {
  const saved = useSavedViews();
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState<SavedView | null>(null);
  const [sort, setSort] = useState("Coaching value");
  const [panel, setPanel] = useState(mode === "all");
  const [notice, setNotice] = useState("");
  const safeCalls = viewer.role === "rep" ? ownCalls(calls, viewer) : calls;
  const visible = sortCalls(filterCalls(safeCalls, filters, selected?.filter), sort);
  const change = <K extends keyof LocalCallFilters>(key: K, value: LocalCallFilters[K]) =>
    setFilters((old) => ({ ...old, [key]: value }));
  const save = () =>
    setNotice(
      "Unsaved draft: saving views isn’t available yet. Your filters apply only in this session.",
    );
  return (
    <section className="flex min-w-0 flex-col gap-4 px-8 py-6 max-lg:px-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="type-editorial-h1">Calls</h1>
        <Button variant="secondary" asChild>
          <Link to="/app/calls/upload" search={true}>
            Upload calls
          </Link>
        </Button>
      </div>
      <nav
        aria-label="Call views"
        className="flex flex-wrap items-center gap-4 border-b border-by-border-engraved"
      >
        <Link
          to="/app/calls/all"
          search={true}
          className={cn("type-ui-body py-2", !selected && "border-b-2 border-by-text-primary")}
          onClick={() => setSelected(null)}
        >
          All calls{" "}
          <span className="type-mono-micro text-by-text-tertiary">{calls.length} loaded</span>
        </Link>
        <DataBoundary query={saved} empty={<span className="type-ui-small">No saved views.</span>}>
          {(views) =>
            views.map((view) => (
              <button
                key={view.id}
                className={cn(
                  "type-ui-body py-2 text-by-text-secondary",
                  selected?.id === view.id &&
                    "border-b-2 border-by-text-primary text-by-text-primary",
                )}
                onClick={() => {
                  if (view.filter.teamId) {
                    setNotice(
                      "This saved view requires team scoping, which is unavailable. Your current calls remain visible.",
                    );
                    return;
                  }
                  setSelected(view);
                  setFilters(emptyFilters());
                  setNotice("");
                }}
              >
                {view.name} <span className="type-mono-micro">{view.count}</span>
              </button>
            ))
          }
        </DataBoundary>
        <Button variant="ghost" size="sm" onClick={save}>
          + Save view
        </Button>
      </nav>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 [&_input]:py-1.5 [&_input]:type-ui-small [&_label>span]:sr-only">
          <LocalField
            label="Search accounts and contacts"
            value={filters.search}
            onChange={(event) => change("search", event.target.value)}
            placeholder="Search accounts, contacts…"
          />
        </div>
        <LocalSelect
          label="Sort calls"
          value={sort}
          options={["Coaching value", "Newest first"]}
          onChange={setSort}
        />
        <Button variant="secondary" aria-expanded={panel} onClick={() => setPanel(!panel)}>
          Filters
        </Button>
      </div>
      {notice && (
        <p role="status" className="type-ui-small text-by-text-secondary">
          {notice}
        </p>
      )}
      <CallTable calls={visible} compact={panel} />
      <p className="type-mono-micro text-by-text-tertiary">
        Insight confidence and sample size unavailable; behavioral summaries are withheld.
      </p>
      <p className="type-ui-small text-by-text-tertiary">
        {visible.length} of {calls.length} loaded calls.{" "}
        {sort === "Coaching value"
          ? "Sorted by shared coaching value; unavailable values appear last."
          : "Sorted by call date."}{" "}
        Saved-view counts are supplied by the shared source; they may differ from loaded results.
      </p>
      {panel && (
        <ContextPanel>
          <div className="flex items-center justify-between">
            <h2 className="type-ui-title">Filters</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(emptyFilters());
                setSelected(null);
              }}
            >
              Clear all
            </Button>
          </div>
          <FilterControls calls={safeCalls} filters={filters} change={change} />
          <p className="type-ui-small text-by-text-secondary">
            Behavior and review-status filters are unavailable. Transcript search isn’t supported
            here.
          </p>
          <Button onClick={save}>Save as view</Button>
        </ContextPanel>
      )}
    </section>
  );
}
function FilterControls({
  calls,
  filters,
  change,
}: {
  calls: Call[];
  filters: LocalCallFilters;
  change: <K extends keyof LocalCallFilters>(key: K, value: LocalCallFilters[K]) => void;
}) {
  const reps = [...new Map(calls.map((call) => [call.repId, call.repName])).entries()];
  const group = (label: string, key: "outcomes" | "types" | "stages", options: string[]) => (
    <LocalFilterChoices
      label={label}
      options={options}
      selected={filters[key]}
      onSelect={(value) =>
        change(
          key,
          filters[key].includes(value)
            ? filters[key].filter((item) => item !== value)
            : [...filters[key], value],
        )
      }
    />
  );
  return (
    <>
      <LocalFilterChoices
        label="Date"
        options={["All dates", "Today", "7 days", "30 days", "90 days"]}
        selected={[filters.days]}
        onSelect={(value) => change("days", value)}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="type-ui-label mb-3 text-by-text-secondary">Rep</legend>
        <div className="flex flex-wrap gap-1.5">
          <Choice selected={!filters.rep} onClick={() => change("rep", "")}>
            All
          </Choice>
          {reps.map(([id, name]) => (
            <Choice key={id} selected={filters.rep === id} onClick={() => change("rep", id)}>
              {name}
            </Choice>
          ))}
        </div>
      </fieldset>
      {group("Outcome", "outcomes", [
        ...new Set(calls.flatMap((call) => (call.outcome ? [call.outcome] : []))),
      ])}
      {group("Call type", "types", [...new Set(calls.map((call) => call.type))])}
      <div>
        <h3 className="type-ui-label mb-3 text-by-text-secondary">Behavior</h3>
        <p className="type-ui-small text-by-text-tertiary">Unavailable — no filter contract.</p>
      </div>
      {group("Methodology stage", "stages", [
        ...new Set(calls.flatMap((call) => (call.stageAtCall ? [call.stageAtCall] : []))),
      ])}
      <div>
        <h3 className="type-ui-label mb-3 text-by-text-secondary">Review status</h3>
        <p className="type-ui-small text-by-text-tertiary">Unavailable — no review-state field.</p>
      </div>
      <LocalSelect
        label="Duration"
        value={filters.duration}
        options={["Any length", "Under 15 min", "15–60 min", "Over 60 min"]}
        onChange={(value) => change("duration", value)}
      />
    </>
  );
}
function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "type-ui-small rounded-by-pill border px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
        selected
          ? "border-by-surface-control-dark bg-by-surface-control-dark text-by-text-on-control"
          : "border-by-border-control bg-by-surface-raised text-by-text-secondary",
      )}
    >
      {children}
    </button>
  );
}
function LocalFilterChoices({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="type-ui-label mb-3 text-by-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Choice
            key={option}
            selected={selected.includes(option)}
            onClick={() => onSelect(option)}
          >
            {option}
          </Choice>
        ))}
      </div>
    </fieldset>
  );
}
function CallTable({
  calls,
  compact = false,
  mine = false,
}: {
  calls: Call[];
  compact?: boolean;
  mine?: boolean;
}) {
  if (!calls.length)
    return (
      <StateEmpty title="No calls match these filters." body="Clear a filter to see more calls." />
    );
  return (
    <LocalSettingsTable
      headings={
        mine
          ? ["CALL", "WHY", "MOMENT", "STATUS"]
          : compact
            ? ["CALL", "REP", "WHY", "OUTCOME", "LENGTH"]
            : ["CALL", "REP", "WHY IT MATTERS", "OUTCOME", "LENGTH", "BEHAVIORS", "REVIEW"]
      }
    >
      {calls.map((call) => (
        <tr key={call.id} className="hover:bg-by-surface-hover">
          <td className={cell}>
            <Link
              to="/app/calls/$callId"
              params={{ callId: call.id }}
              search={true}
              className="type-ui-body-strong underline-offset-4 hover:underline"
            >
              {call.account.name}
            </Link>
            <p className="type-mono-micro mt-1 text-by-text-tertiary">
              {call.type} ·{" "}
              {new Date(call.startedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </td>
          {!mine && (
            <td className={cell}>
              <div className="flex items-center gap-1.5">
                <Avatar name={call.repName} size={22} />
                <span>{call.repName}</span>
              </div>
            </td>
          )}
          <td className={cn(cell, "text-by-text-secondary")}>
            <p>
              {call.status === "ready"
                ? "Insight unavailable"
                : call.status === "partial"
                  ? "Partial analysis"
                  : call.status === "processing"
                    ? "Processing"
                    : "Analysis failed"}
            </p>
          </td>
          {mine ? (
            <>
              <td className={cn(cell, "type-mono-data text-by-text-secondary")}>
                {call.topMoment?.timestamp ?? "—"}
              </td>
              <td className={cell}>
                <Tag>{call.status}</Tag>
              </td>
            </>
          ) : (
            <>
              <td className={cell}>
                <Tag>{call.outcome ?? "—"}</Tag>
              </td>
              <td className={cn(cell, "type-mono-data text-by-text-secondary")}>
                {durationLabel(call.durationSec)}
              </td>
              {!compact && (
                <>
                  <td className={cn(cell, "text-by-text-tertiary")}>Unavailable</td>
                  <td className={cn(cell, "text-by-text-tertiary")}>Unavailable</td>
                </>
              )}
            </>
          )}
        </tr>
      ))}
    </LocalSettingsTable>
  );
}
function OwnIndex({ viewer }: { viewer: Viewer }) {
  const query = useMyCalls();
  return (
    <CallsBoundary query={query}>
      {(calls) => <OwnContent calls={ownCalls(calls, viewer)} />}
    </CallsBoundary>
  );
}
function OwnContent({ calls }: { calls: Call[] }) {
  const [tab, setTab] = useState("All");
  const [notice, setNotice] = useState("");
  const filters = emptyFilters();
  if (tab === "Won" || tab === "Lost") filters.outcomes = [tab.toLowerCase()];
  const visible = sortCalls(filterCalls(calls, filters), "Coaching value");
  const recent = filterCalls(calls, { ...emptyFilters(), days: "30 days" });
  const median = medianDuration(recent);
  return (
    <section className="flex min-w-0 flex-col gap-5 px-9 py-7 max-lg:px-4">
      <div>
        <h1 className="type-editorial-h1">My calls</h1>
        <p className="type-ui-small mt-2 text-by-text-secondary">
          Only your calls. Sorted by shared coaching value.
        </p>
      </div>
      <nav
        aria-label="My call views"
        className="flex flex-wrap gap-4 border-b border-by-border-engraved"
      >
        {["Worth a listen", "All", "Shared with me", "Won", "Lost"].map((label) => (
          <button
            key={label}
            className={cn(
              "type-ui-body py-2 text-by-text-secondary",
              tab === label && "border-b-2 border-by-text-primary text-by-text-primary",
            )}
            onClick={() => {
              if (label === "Worth a listen" || label === "Shared with me") {
                setNotice(
                  `${label} is unavailable — no shared selection or sharing contract. Your own calls remain visible.`,
                );
                return;
              }
              setTab(label);
              setNotice("");
            }}
          >
            {label}
            {label === "All" && <span className="type-mono-micro ml-1">{calls.length}</span>}
          </button>
        ))}
      </nav>
      {notice && (
        <p role="status" className="type-ui-small text-by-text-secondary">
          {notice}
        </p>
      )}
      <CallTable calls={visible} mine />
      <p className="type-mono-micro text-by-text-tertiary">
        Insight confidence and sample size unavailable; behavioral summaries are withheld.
      </p>
      <div className="rounded-by-card border border-by-border-engraved bg-by-surface-inset p-4">
        <h2 className="type-mono-micro mb-1 text-by-text-tertiary">SHARED WITH ME</h2>
        <p className="type-ui-small">
          Shared clips are unavailable. This view only opens your own calls.
        </p>
      </div>
      <ContextPanel title="YOUR NUMBERS · 30 DAYS">
        <dl>
          {[
            ["Calls loaded", String(recent.length)],
            ["Median length", median === null ? "—" : durationLabel(Math.round(median))],
            ["Talk / listen", "Unavailable"],
            ["Objections faced", "Unavailable"],
            ["Held control", "Unavailable"],
            ["Next step booked", "Unavailable"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-by-border-engraved py-2.5">
              <dt className="type-mono-micro flex-1 text-by-text-tertiary">{label}</dt>
              <dd className="type-ui-small flex-1">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="type-mono-micro text-by-text-tertiary">
          Based on loaded calls only. Self-comparison is unavailable.
        </p>
        <p className="type-ui-small text-by-text-secondary">
          No team rankings here. This view is only about you.
        </p>
      </ContextPanel>
    </section>
  );
}
