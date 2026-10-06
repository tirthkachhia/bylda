import { Link } from "@tanstack/react-router";
import { Avatar, Button, StateEmpty } from "@/components/bylda";
import { useDmThreads } from "@/lib/data";
import { HomeTab } from "./shared/HomeTab";
import { ListCard, SectionLabel } from "./shared/List";
import { useMentions, type Mention } from "./mentions/useMentions";

/**
 * H6 · Manager Home — Mentions
 * Figma 43:2612 (page 1:6) · Lane 1 — Ansh · route /app/home/mentions
 * Hooks: useHomeFeed (via HomeTab) + local `useMentions` (no mentions source yet — see it).
 */
export function H6ManagerHomeMentions() {
  return <HomeTab eyebrow="HOME · MENTIONS">{() => <Mentions />}</HomeTab>;
}

const whenOf = (hoursAgo: number) => (hoursAgo < 24 ? `${hoursAgo} h ago` : "Yesterday");

function Mentions() {
  const mentions = useMentions();
  const list = mentions.data ?? [];
  if (mentions.isLoading) return null;
  if (list.length === 0) {
    return (
      <StateEmpty
        eyebrow="HOME · MENTIONS"
        title="No mentions."
        body="When someone @-mentions you in a room or a message, it lands here."
      />
    );
  }
  const unread = list.filter((m) => m.unread).length;
  return (
    <>
      <SectionLabel>
        {list.length} {list.length === 1 ? "MENTION" : "MENTIONS"} · {unread} UNREAD
      </SectionLabel>
      <ListCard className="gap-0 divide-y divide-by-border-engraved">
        {list.map((m) => (
          <MentionRow key={m.id} mention={m} />
        ))}
      </ListCard>
    </>
  );
}

function MentionRow({ mention: m }: { mention: Mention }) {
  const dms = useDmThreads();
  const dm = m.where.kind === "dm" ? dms.data?.find((t) => t.title === m.fromName) : null;
  const place = m.where.kind === "room" ? `in #${m.where.slug}` : "in DM";

  // Both actions open the same conversation; the composer lives there.
  const open =
    m.where.kind === "room"
      ? { to: "/app/rooms/$roomId" as const, params: { roomId: m.where.slug }, label: "Open room" }
      : dm
        ? {
            to: "/app/dm/$threadId" as const,
            params: { threadId: dm.id },
            label: "Open conversation",
          }
        : null;

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar name={m.fromName} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="type-ui-body-strong text-by-text-primary">{m.fromName}</span>
          <span className="type-ui-small text-by-text-tertiary">{place}</span>
          <span className="type-ui-small text-by-text-tertiary">{whenOf(m.hoursAgo)}</span>
        </div>
        <p className="type-ui-body text-by-text-primary">{m.body}</p>
        {open ? (
          <div className="flex items-start gap-1.5">
            <Button asChild variant="secondary">
              <Link to={open.to} params={open.params as never}>
                Reply
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to={open.to} params={open.params as never}>
                {open.label}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
      {m.unread ? (
        <span
          className="mt-2 size-2 shrink-0 rounded-by-pill bg-by-text-primary"
          role="img"
          aria-label="Unread"
        />
      ) : null}
    </div>
  );
}
