import { Link } from "@tanstack/react-router";
import { Avatar, Button, Icon, StateEmpty, Tag, type TagTone } from "@/components/bylda";
import { useCalls, type Call } from "@/lib/data";
import { worthYourTime } from "./calls/worthYourTime";
import { HomeTab } from "./shared/HomeTab";
import { ListCard, ListRow, ROW_LIST, SectionLabel } from "./shared/List";
import { DAY_MS, callsAnalyzedSince, firstNameOf, minutesOf } from "./shared/format";

/**
 * H3 · Manager Home — Calls
 * Figma 43:1176 (page 1:6) · Lane 1 — Ansh · route /app/home/calls
 * Hooks: useHomeFeed (via HomeTab) + useCalls.
 *
 * Calls ranked by `coachingValue` (Dev Handoff `Call`) — the ones worth a manager's time.
 * The rule lives in `calls/worthYourTime.ts`.
 */
export function H3ManagerHomeCalls() {
  return <HomeTab eyebrow="HOME · CALLS">{() => <WorthYourTime />}</HomeTab>;
}

function tagFor(c: Call): { tone: TagTone; label: string } | null {
  if (!c.topMoment) return null;
  switch (c.topMoment.tone) {
    case "improve":
      return { tone: "improve", label: "Example" };
    case "regress":
      return { tone: "regress", label: "Needs review" };
    case "attention":
      return { tone: "attention", label: "Needs review" };
    default:
      return { tone: "neutral", label: "Review" };
  }
}

function WorthYourTime() {
  const calls = useCalls();
  const all = calls.data ?? [];
  const ranked = worthYourTime(all);
  const since = callsAnalyzedSince(all, Date.now() - DAY_MS);

  if (calls.isLoading) return null;
  if (ranked.length === 0) {
    return (
      <StateEmpty
        eyebrow="HOME · CALLS"
        title="No calls worth your time yet."
        body="Bylda ranks analyzed calls by how much there is to coach. They’ll show here as soon as one finishes."
      />
    );
  }

  return (
    <>
      <SectionLabel>
        {since} {since === 1 ? "CALL" : "CALLS"} SINCE YESTERDAY · {ranked.length} WORTH YOUR TIME
      </SectionLabel>
      <ListCard className={ROW_LIST}>
        {ranked.map((c) => {
          const tag = tagFor(c);
          return (
            <Link key={c.id} to="/app/calls/$callId" params={{ callId: c.id }} className="block">
              <ListRow className="-mx-2 rounded-by-control px-2 transition-colors duration-200 ease-out hover:bg-by-surface-hover">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-by-pill bg-by-surface-control-dark text-by-text-on-control">
                  <Icon name="play" size={12} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="type-ui-body text-by-text-primary">
                    {c.account.name} · {firstNameOf(c.repName)}
                  </span>
                  <span className="type-ui-small text-by-text-tertiary">
                    {minutesOf(c.durationSec)}
                    {c.topMoment ? ` · ${c.topMoment.label}` : ""}
                  </span>
                </span>
                <Avatar name={c.repName} size={24} />
                {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
              </ListRow>
            </Link>
          );
        })}
      </ListCard>
      <Button asChild variant="secondary" className="self-start">
        <Link to="/app/calls">Open all calls</Link>
      </Button>
    </>
  );
}
