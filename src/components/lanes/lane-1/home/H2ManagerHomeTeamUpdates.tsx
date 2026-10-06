import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar, ConfidenceMeter, StateEmpty, Tag } from "@/components/bylda";
import { useCoachingFoci, useTeamMembers, type HomeFeed } from "@/lib/data";
import { HomeTab } from "./shared/HomeTab";
import { ListCard, ListRow, ROW_LIST, SectionLabel } from "./shared/List";
import { dayBucket, whenLabel, type DayBucket } from "./shared/format";
import { focusUpdates, insightUpdates, type TeamUpdate } from "./team-updates/events";

/**
 * H2 · Manager Home — Team Updates
 * Figma 43:692 (page 1:6) · Lane 1 — Ansh · route /app/home/team-updates
 * Hooks: useHomeFeed (tab insights) + useCoachingFoci / useTeamMembers (activity).
 *
 * A timeline of what the team did — grouped Today / Yesterday / Earlier. Only events the data
 * layer can state are shown; "reviewed 3 calls" and "shared a call to a room" need an activity
 * stream that doesn't exist yet (LANE_REQUESTS #22).
 */
export function H2ManagerHomeTeamUpdates() {
  return <HomeTab eyebrow="HOME · TEAM UPDATES">{(feed) => <TeamUpdates feed={feed} />}</HomeTab>;
}

const GROUPS: { bucket: DayBucket; label: string }[] = [
  { bucket: "today", label: "TODAY" },
  { bucket: "yesterday", label: "YESTERDAY" },
  { bucket: "earlier", label: "EARLIER" },
];

function TeamUpdates({ feed }: { feed: HomeFeed }) {
  const foci = useCoachingFoci();
  const people = useTeamMembers();
  // Clock-dependent grouping renders after mount — the server's clock isn't the viewer's.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const updates = [
    ...focusUpdates(foci.data ?? []),
    ...insightUpdates(
      feed.items.filter((f) => f.tab === "team_updates").map((f) => f.insight),
      people.data ?? [],
    ),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  if (now === null) return null;
  if (updates.length === 0) {
    return (
      <StateEmpty
        eyebrow="HOME · TEAM UPDATES"
        title="No team updates yet."
        body="Pattern changes across the team will post here as soon as Bylda has enough calls to see them."
      />
    );
  }

  return (
    <>
      {GROUPS.map(({ bucket, label }) => {
        const rows = updates.filter((u) => dayBucket(u.at, now) === bucket);
        if (rows.length === 0) return null;
        return (
          <section key={bucket} className="flex w-full flex-col gap-3.5">
            <SectionLabel>{label}</SectionLabel>
            <ListCard className={ROW_LIST}>
              {rows.map((u) => (
                <UpdateRow key={u.id} update={u} now={now} />
              ))}
            </ListCard>
          </section>
        );
      })}
    </>
  );
}

function UpdateRow({ update: u, now }: { update: TeamUpdate; now: number }) {
  const body = (
    <>
      <Avatar name={u.who} size={32} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-ui-body text-by-text-primary">{u.text}</span>
        {u.insight ? (
          <ConfidenceMeter
            level={u.insight.confidence}
            sampleSize={u.insight.sampleSize}
            sampleLabel={u.insight.sampleLabel ?? undefined}
          />
        ) : null}
      </span>
      {u.tag ? <Tag tone={u.tag.tone}>{u.tag.label}</Tag> : null}
      <span className="type-ui-small whitespace-nowrap text-by-text-tertiary">
        {whenLabel(u.at, now)}
      </span>
    </>
  );
  const row = "-mx-2 rounded-by-control px-2 transition-colors duration-200 ease-out";
  return u.href.to === "/app/coaching/$focusId" ? (
    <Link to="/app/coaching/$focusId" params={{ focusId: u.href.focusId }} className="block">
      <ListRow className={`${row} hover:bg-by-surface-hover`}>{body}</ListRow>
    </Link>
  ) : (
    <ListRow className={row}>{body}</ListRow>
  );
}
