import { useParams } from "@tanstack/react-router";
import { DataBoundary, StateEmpty, StateError, SystemState } from "@/components/bylda";
import { useRoom, useViewer } from "@/lib/data";
import { O2RoomObjectionWatch } from "./O2RoomObjectionWatch";
import { O8RoomDailyBrief } from "./O8RoomDailyBrief";
import { O9RoomCoaching } from "./O9RoomCoaching";
import { O10RoomMidMarketTeam } from "./O10RoomMidMarketTeam";
import { O11RoomAcmeLogistics } from "./O11RoomAcmeLogistics";
function KindRoute({ id }: { id: string }) {
  const q = useRoom(id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Room not found." />}
      error={() => (
        <StateError body="Room data couldn't be loaded." onRetry={() => void q.refetch()} />
      )}
    >
      {(room) =>
        !room || !room.isMember ? (
          <SystemState eyebrow="Y9 · ACCESS RESTRICTED" title="Room unavailable." />
        ) : room.kind === "brief" ? (
          <O8RoomDailyBrief />
        ) : room.kind === "coaching" ? (
          <O9RoomCoaching />
        ) : room.kind === "team" ? (
          <O10RoomMidMarketTeam />
        ) : room.kind === "deal" ? (
          <O11RoomAcmeLogistics />
        ) : (
          <O2RoomObjectionWatch />
        )
      }
    </DataBoundary>
  );
}
export function LocalRoomKindRoute() {
  const q = useViewer();
  const { roomId } = useParams({ strict: false });
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Sign in to view rooms." />}
      error={() => (
        <StateError body="Access couldn't be checked." onRetry={() => void q.refetch()} />
      )}
    >
      {(viewer) =>
        roomId && ["manager", "owner", "admin"].includes(viewer.role) ? (
          <KindRoute id={roomId} />
        ) : (
          <SystemState
            eyebrow="Y9 · ACCESS RESTRICTED"
            title="This room isn't available to your role."
          />
        )
      }
    </DataBoundary>
  );
}
