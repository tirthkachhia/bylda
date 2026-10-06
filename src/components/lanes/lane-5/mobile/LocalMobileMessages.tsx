import { visibleInsight } from "./mobile-message-model";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Avatar,
  AppBadge,
  Button,
  ConfidenceMeter,
  EvidenceBlock,
  StateEmpty,
  Wordmark,
} from "@/components/bylda";
import { useViewer, useMyCalls, useMyCoaching, type Message } from "@/lib/data";
import { LocalBoundary, LocalRestricted } from "./LocalMobile";
export function LocalManagerOnly({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  return (
    <LocalBoundary query={viewer}>
      {(v) =>
        ["owner", "admin", "manager", "coach"].includes(v.role) ? children : <LocalRestricted />
      }
    </LocalBoundary>
  );
}
export function LocalMobileHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const viewer = useViewer().data;
  return (
    <header className="flex flex-col gap-1 border-b border-by-border-engraved bg-by-surface-raised px-[18px] py-3 min-h-[86px]">
      <Wordmark className="text-by-text-tertiary" />
      <div className="flex items-center gap-2">
        <Link
          to={(viewer?.role === "rep" ? "/m/brief" : "/m/manager-brief") as never}
          search={true}
          aria-label="Back to brief"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="type-ui-title break-words">{title}</h1>
          {subtitle && <p className="type-ui-small text-by-text-tertiary">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
export function LocalReadOnlyComposer() {
  return (
    <footer className="fixed bottom-0 left-1/2 flex w-full max-w-[390px] -translate-x-1/2 items-center gap-2.5 rounded-b-[28px] border-t border-by-border-engraved bg-by-surface-raised px-3.5 pb-7 pt-3">
      <input
        aria-label="Message"
        disabled
        placeholder="Messaging isn’t available yet"
        className="type-ui-small min-w-0 flex-1 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3 py-2"
      />
      <Button variant="ghost" disabled>
        Send
      </Button>
    </footer>
  );
}
export function LocalMessageList({
  messages,
  room = false,
}: {
  messages: Message[];
  room?: boolean;
}) {
  const viewer = useViewer().data;
  const ownCalls = useMyCalls();
  const ownFoci = useMyCoaching();
  if (!viewer) return null;
  const visible = messages.filter((m) => {
    const block = m.block;
    if (viewer.role !== "rep") return true;
    if (m.block?.type === "insight") return visibleInsight(m.block.insight, viewer);
    if (block?.type === "call")
      return ownCalls.data?.some((c) => c.id === block.callId && c.repId === viewer.id);
    if (block?.type === "coaching")
      return ownFoci.data?.some((f) => f.id === block.focusId && f.repId === viewer.id);
    if (room) return m.authorId === viewer.id && !m.block;
    return !m.block;
  });
  return (
    <section className="flex flex-1 flex-col gap-4 px-4 py-3.5 pb-28">
      {visible.length ? (
        visible.map((m) => (
          <article key={m.id} className="flex items-start gap-2.5">
            {m.isApp ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-by-control bg-by-surface-rail text-by-text-on-dark">
                B
              </span>
            ) : (
              <Avatar name={m.authorName} size={28} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="type-ui-body-strong">{m.authorName}</p>
                {m.isApp && <AppBadge />}
                <time className="type-ui-small text-by-text-tertiary" dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {(viewer.role !== "rep" || !m.block) &&
                m.block?.type !== "insight" &&
                m.block?.type !== "structured" && (
                  <p className="type-ui-body break-words">{m.body}</p>
                )}
              <LocalMessageBlock message={m} />
              {m.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Reactions">
                  {m.reactions.map((r) => (
                    <span
                      key={r.symbol}
                      className="type-ui-small rounded-by-control border border-by-border-engraved bg-by-surface-inset px-2 py-1"
                    >
                      {r.symbol} {r.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))
      ) : (
        <StateEmpty title="No messages available for you." />
      )}
    </section>
  );
}
function LocalMessageBlock({ message }: { message: Message }) {
  const viewer = useViewer().data;
  const ownCalls = useMyCalls();
  const b = message.block;
  if (!b || !viewer) return null;
  if (b.type === "insight") {
    const i = b.insight;
    if (!visibleInsight(i, viewer))
      return (
        <p className="type-ui-small text-by-text-secondary">
          More analyzed calls are needed before this insight can appear.
        </p>
      );
    return (
      <>
        <p className="type-ui-body">{i.headline}</p>
        {i.body && viewer.role !== "rep" && <p className="type-ui-small">{i.body}</p>}
        <ConfidenceMeter
          level={i.confidence}
          sampleSize={i.sampleSize}
          className="flex-wrap gap-2"
        />
        {i.evidence
          .filter(
            (e) =>
              viewer.role !== "rep" ||
              ownCalls.data?.some((c) => c.id === e.callId && c.repId === viewer.id),
          )
          .map((e) => (
            <EvidenceBlock
              key={e.callId + e.tSeconds}
              evidence={{ timestamp: e.timestamp, speaker: e.speakerLabel, quote: e.quote }}
            />
          ))}
        {i.confidence !== "low" && i.action?.type === "review_calls" && (
          <div className="flex flex-wrap gap-2">
            {i.action.callIds
              .filter(
                (id) =>
                  viewer.role !== "rep" ||
                  ownCalls.data?.some((c) => c.id === id && c.repId === viewer.id),
              )
              .map((callId) => (
                <Button key={callId} variant="secondary" size="sm" asChild>
                  <Link to="/m/calls/$callId" params={{ callId }} search={true}>
                    Review call
                  </Link>
                </Button>
              ))}
          </div>
        )}
      </>
    );
  }
  if (b.type === "call")
    return (
      <Link
        to="/m/calls/$callId"
        params={{ callId: b.callId }}
        search={true}
        className="flex flex-col gap-1 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3.5 py-3"
      >
        <p className="type-ui-body-strong">{b.title}</p>
        <p className="type-ui-small text-by-text-secondary">{b.meta}</p>
        {b.moment && <p className="type-ui-small">{b.moment.label}</p>}
      </Link>
    );
  if (b.type === "coaching")
    return (
      <Link
        to={(viewer.role === "rep" ? "/m/coaching/$focusId" : "/app/coaching/$focusId") as never}
        params={{ focusId: b.focusId } as never}
        search={true}
        className="flex flex-col gap-1 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3.5 py-3"
      >
        <p className="type-ui-body-strong">{b.title}</p>
        <p className="type-ui-small">{b.meta}</p>
      </Link>
    );
  if (b.type === "report")
    return (
      <Link to="/app/reports" search={true} className="type-ui-small underline">
        {b.title} · {b.meta}
      </Link>
    );
  return (
    <div className="rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3.5 py-3">
      <p className="type-ui-small text-by-text-secondary">
        This structured update needs confidence and analyzed-call sample metadata before its insight
        can appear.
      </p>
    </div>
  );
}
