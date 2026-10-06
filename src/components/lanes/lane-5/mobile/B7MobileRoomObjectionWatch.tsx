import { useParams } from "@tanstack/react-router";
import { useRoom, useRoomMessages, useViewer } from "@/lib/data";
import { StateEmpty } from "@/components/bylda";
import { LocalBoundary, LocalMobileFrame, LocalRestricted } from "./LocalMobile";
import { LocalMobileHeader, LocalReadOnlyComposer, LocalMessageList } from "./LocalMobileMessages";
export function B7MobileRoomObjectionWatch() {
  const { roomId } = useParams({ strict: false }) as { roomId: string };
  const viewer = useViewer();
  return (
    <LocalMobileFrame coach>
      <LocalBoundary query={viewer}>{() => <LocalRoom roomId={roomId} />}</LocalBoundary>
    </LocalMobileFrame>
  );
}
function LocalRoom({ roomId }: { roomId: string }) {
  const room = useRoom(roomId);
  return (
    <LocalBoundary query={room} emptyTitle="Room not found.">
      {(r) =>
        !r ? (
          <StateEmpty title="Room not found." />
        ) : !r.isMember ? (
          <LocalRestricted />
        ) : (
          <>
            <LocalMobileHeader title={`# ${r.name}`} subtitle={`${r.memberCount} members`} />
            <LocalRoomMessages roomId={r.id} />
            <LocalReadOnlyComposer />
          </>
        )
      }
    </LocalBoundary>
  );
}
function LocalRoomMessages({ roomId }: { roomId: string }) {
  const query = useRoomMessages(roomId);
  return (
    <LocalBoundary query={query} emptyTitle="No room messages yet.">
      {(messages) => (
        <LocalMessageList room messages={messages.filter((m) => m.roomId === roomId)} />
      )}
    </LocalBoundary>
  );
}
