import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar, ContextPanel, Icon, SkeletonBar, cn } from "@/components/bylda";
import {
  useCalls,
  useCoachingFoci,
  useTeamMembers,
  type Call,
  type HomeFeed,
  type Person,
  type Presence,
} from "@/lib/data";
import { DAY_MS, callsAnalyzedSince, clockTime, firstNameOf } from "../shared/format";

/**
 * Context panel (7:132): TODAY AT A GLANCE · COACH TODAY · TEAM ACTIVITY · RECENT CALLS.
 * Every number is counted from a hook — none are typed in.
 */
export function TodayPanel({ feed }: { feed: HomeFeed }) {
  return (
    <ContextPanel>
      <div className="flex flex-col gap-5">
        <Glance feed={feed} />
        <CoachToday feed={feed} />
        <TeamActivity />
        <RecentCalls />
      </div>
    </ContextPanel>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="type-ui-label text-by-text-secondary">{children}</p>;
}

function Tile({
  value,
  label,
  sub,
  subTone = "neutral",
}: {
  value: ReactNode;
  label: string;
  sub?: string | null;
  subTone?: "improve" | "regress" | "neutral";
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px] rounded-by-card border border-by-border-engraved bg-by-surface-raised px-3.5 py-3">
      <span className="type-editorial-h2 text-by-text-primary">{value}</span>
      <span className="type-ui-small text-by-text-secondary">{label}</span>
      {sub ? (
        <span
          className={cn(
            "type-ui-small",
            subTone === "improve" && "text-by-signal-improve",
            subTone === "regress" && "text-by-signal-regress",
            subTone === "neutral" && "text-by-text-tertiary",
          )}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

const ACTIVE_FOCUS = ["assigned", "acknowledged", "measuring"] as const;

function Glance({ feed }: { feed: HomeFeed }) {
  const calls = useCalls();
  const foci = useCoachingFoci();
  const now = Date.now();

  const insights = feed.items.map((f) => f.insight);
  const newToday = insights.filter((i) => Date.parse(i.createdAt) >= now - DAY_MS).length;
  const regressions = insights.filter((i) => i.tone === "regress").length;

  const analyzedToday = calls.data ? callsAnalyzedSince(calls.data, now - DAY_MS) : null;
  const processing = calls.data?.filter((c) => c.status === "processing").length ?? 0;

  const active = foci.data?.filter((f) =>
    (ACTIVE_FOCUS as readonly string[]).includes(f.status),
  ).length;
  const held = foci.data?.filter((f) => f.status === "held").length ?? 0;

  return (
    <section className="flex flex-col gap-2.5">
      <Label>TODAY AT A GLANCE</Label>
      <div className="flex gap-2.5">
        <Tile
          value={analyzedToday ?? <SkeletonBar width={32} height={22} />}
          label="Calls analyzed"
          sub={processing > 0 ? `${processing} processing` : null}
        />
        <Tile
          value={insights.length}
          label="Key insights"
          sub={newToday > 0 ? `↑ ${newToday} new` : null}
          subTone="improve"
        />
      </div>
      <div className="flex gap-2.5">
        <Tile
          value={active ?? <SkeletonBar width={32} height={22} />}
          label="Coaching items"
          sub={held > 0 ? `✓ ${held} held` : null}
          subTone="improve"
        />
        <Tile
          value={regressions}
          label={regressions === 1 ? "Regression" : "Regressions"}
          sub={regressions > 0 ? "Needs attention" : null}
          subTone="regress"
        />
      </div>
    </section>
  );
}

function CoachToday({ feed }: { feed: HomeFeed }) {
  if (feed.coachQueue.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <Label>COACH TODAY</Label>
      {feed.coachQueue.map((q) => (
        <Link
          key={`${q.repId}-${q.behaviorName}`}
          to="/app/team/reps/$repId/overview"
          params={{ repId: q.repId }}
          className="-mx-2 flex items-center gap-2.5 rounded-by-control px-2 py-1.5 transition-colors duration-200 ease-out hover:bg-by-surface-hover"
        >
          <Avatar name={q.repName} size={30} />
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="type-ui-body-strong truncate text-by-text-primary">
              {firstNameOf(q.repName)} — {q.behaviorName.toLowerCase()}
            </span>
            <span className="type-ui-small truncate text-by-text-secondary">{q.reason}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

const PRESENCE: Record<Presence, string> = {
  on_call: "On a call",
  active: "Active",
  away: "Away",
  paused: "Paused",
};

function TeamActivity() {
  const members = useTeamMembers();
  const people: Person[] = (members.data ?? []).filter(
    (p) => p.role === "rep" && p.presence !== null,
  );
  if (members.isLoading || people.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <Label>TEAM ACTIVITY</Label>
      {people.map((p) => (
        <Link
          key={p.id}
          to="/app/team/reps/$repId/overview"
          params={{ repId: p.id }}
          className="-mx-2 flex items-center gap-2.5 rounded-by-control px-2 py-[5px] transition-colors duration-200 ease-out hover:bg-by-surface-hover"
        >
          <Avatar name={p.name} src={p.avatarUrl} size={28} />
          <span className="type-ui-body-strong text-by-text-primary">{p.firstName}</span>
          <span className="type-ui-small min-w-0 flex-1 truncate text-by-text-tertiary">
            {p.presence ? PRESENCE[p.presence] : ""}
          </span>
        </Link>
      ))}
    </section>
  );
}

function RecentCalls() {
  const calls = useCalls();
  const recent: Call[] = (calls.data ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 3);
  if (calls.isLoading || recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <Label>RECENT CALLS</Label>
      {recent.map((c) => (
        <Link
          key={c.id}
          to="/app/calls/$callId"
          params={{ callId: c.id }}
          className="-mx-2 flex items-center gap-2.5 rounded-by-control px-2 py-1.5 transition-colors duration-200 ease-out hover:bg-by-surface-hover"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-by-pill bg-by-surface-control-dark text-by-text-on-control">
            <Icon name="play" size={12} />
          </span>
          <span className="type-ui-body-strong min-w-0 flex-1 truncate text-by-text-primary">
            {c.account.name}
          </span>
          <span className="type-ui-small text-by-text-secondary">{firstNameOf(c.repName)}</span>
          <span className="type-ui-small text-by-text-tertiary">{clockTime(c.startedAt)}</span>
        </Link>
      ))}
    </section>
  );
}
