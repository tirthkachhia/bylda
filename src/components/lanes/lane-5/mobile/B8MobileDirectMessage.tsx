import { useParams } from "@tanstack/react-router";
import { useDmThreads, useDmMessages, useViewer } from "@/lib/data";
import { LocalBoundary, LocalMobileFrame, LocalRestricted } from "./LocalMobile";
import { LocalMobileHeader, LocalReadOnlyComposer, LocalMessageList } from "./LocalMobileMessages";
export function B8MobileDirectMessage() {
  const { threadId } = useParams({ strict: false }) as { threadId: string };
  const viewer = useViewer();
  return (
    <LocalMobileFrame coach>
      <LocalBoundary query={viewer}>
        {(v) => <LocalThread threadId={threadId} viewerId={v.id} />}
      </LocalBoundary>
    </LocalMobileFrame>
  );
}
function LocalThread({ threadId, viewerId }: { threadId: string; viewerId: string }) {
  const threads = useDmThreads();
  const id = threadId === "coach" ? "dm_coach" : threadId;
  return (
    <LocalBoundary query={threads} emptyTitle="No message threads yet.">
      {(all) => {
        const t = all.find((t) => t.id === id);
        if (!t || t.isCoach || !t.participantIds.includes(viewerId)) return <LocalRestricted />;
        return (
          <>
            <LocalMobileHeader title={t.title} subtitle="Direct message" />
            <LocalThreadMessages threadId={t.id} />
            <LocalReadOnlyComposer />
          </>
        );
      }}
    </LocalBoundary>
  );
}
function LocalThreadMessages({ threadId }: { threadId: string }) {
  const query = useDmMessages(threadId);
  return (
    <LocalBoundary query={query} emptyTitle="No direct messages yet.">
      {(messages) => (
        <LocalMessageList messages={messages.filter((m) => m.threadId === threadId)} />
      )}
    </LocalBoundary>
  );
}
