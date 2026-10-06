import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, DataBoundary, StateEmpty, StateError, SystemState, Tag } from "@/components/bylda";
import { useRooms, useViewer } from "@/lib/data";
import {
  LocalSettingsNote,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
function DirectoryRows({ personal }: { personal: boolean }) {
  const rooms = useRooms();
  const [joined, setJoined] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={joined ? "secondary" : "primary"}
          onClick={() => setJoined(false)}
        >
          All rooms
        </Button>
        <Button
          size="sm"
          variant={joined ? "primary" : "secondary"}
          onClick={() => setJoined(true)}
        >
          My rooms
        </Button>
      </div>
      <DataBoundary
        query={rooms}
        empty={<StateEmpty title="No rooms yet." />}
        error={() => (
          <StateError body="Rooms couldn't be loaded." onRetry={() => void rooms.refetch()} />
        )}
      >
        {(items) => {
          const visible = items.filter((r) => (!personal || r.isMember) && (!joined || r.isMember));
          return visible.length ? (
            <LocalSettingsTable
              headings={["Room", "What Bylda posts", "Members", "Unread", "Membership"]}
              columnClasses={["w-[200px]", "w-auto", "w-[120px]", "w-[100px]", "w-[110px]"]}
            >
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className={cell}>
                    <Link
                      to="/app/rooms/$roomId"
                      params={{ roomId: r.id }}
                      search={true}
                      className="type-ui-body-strong underline-offset-4 hover:underline"
                    >
                      # {r.name}
                    </Link>
                  </td>
                  <td className={cell}>{r.topic}</td>
                  <td className={cell}>{r.memberCount}</td>
                  <td className={cell}>{r.unread}</td>
                  <td className={cell}>
                    <Tag tone="neutral">{r.isMember ? "Joined" : "Not joined"}</Tag>
                  </td>
                </tr>
              ))}
            </LocalSettingsTable>
          ) : (
            <StateEmpty title="No rooms match this view." />
          );
        }}
      </DataBoundary>
    </>
  );
}
export function LocalRoomDirectory() {
  const viewer = useViewer();
  return (
    <main className="flex min-h-full flex-col gap-5 px-9 py-7 text-by-text-primary max-sm:px-5">
      <DataBoundary
        query={viewer}
        empty={<StateEmpty title="Sign in to view rooms." />}
        error={() => (
          <StateError
            body="Your access couldn't be checked."
            onRetry={() => void viewer.refetch()}
          />
        )}
      >
        {(person) =>
          ["owner", "admin", "manager", "rep"].includes(person.role) ? (
            <>
              <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <h1 className="type-editorial-h1">Rooms</h1>
                  <p className="type-ui-small text-by-text-secondary">
                    Where Bylda posts intelligence and your team discusses it.
                  </p>
                </div>
                {person.role !== "rep" && (
                  <Button asChild>
                    <Link to="/app/rooms/new" search={true}>
                      New room
                    </Link>
                  </Button>
                )}
              </header>
              <DirectoryRows personal={person.role === "rep"} />
              <LocalSettingsNote title="ROOM PURPOSE">
                Rooms exist to act on insight. Joining, room creation and Slack delivery need shared
                contracts. Rep room feeds remain restricted until messages carry subject scope.
              </LocalSettingsNote>
            </>
          ) : (
            <SystemState
              eyebrow="Y9 · ACCESS RESTRICTED"
              title="Rooms aren't available to your role."
            />
          )
        }
      </DataBoundary>
    </main>
  );
}
