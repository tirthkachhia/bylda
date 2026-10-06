import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  StateEmpty,
  StateError,
  SystemState,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useBrief,
  useRoom,
  useRoomMessages,
  useViewer,
  type Message,
  type Room,
  type RoomKind,
  type Viewer,
} from "@/lib/data";
import { LocalSettingsNote } from "@/components/lanes/lane-5/settings/LocalSettings";
function Denied() {
  return (
    <SystemState
      eyebrow="Y9 · ACCESS RESTRICTED"
      title="This room isn't available to your role."
      body="Scoped room messages and membership are required for personal access."
    />
  );
}
function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <Denied />
  ) : (
    <StateError body="Room data couldn't be loaded." onRetry={retry} />
  );
}
function ReportPost({ id, viewer }: { id: string; viewer: Viewer }) {
  const q = useBrief(id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Shared report unavailable." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(b) =>
        !b || b.id !== id || (viewer.role === "manager" && b.subjectId !== viewer.team?.id) ? (
          <StateEmpty title="Report unavailable for this scope." />
        ) : (
          <article className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-5">
            <p className="type-mono-micro text-by-text-tertiary">BYLDA · SHARED REPORT</p>
            <h2 className="type-editorial-insight">{b.title}</h2>
            <p className="type-ui-small text-by-text-secondary">
              {b.period} · {b.readMinutes} min read
            </p>
            {b.kind === "daily_manager" || b.kind === "weekly_manager" ? (
              <Button asChild className="self-start">
                <Link
                  to={b.kind === "daily_manager" ? "/app/reports/daily" : "/app/reports/weekly"}
                  search={(previous) => ({ ...previous, reportId: b.id })}
                >
                  Open report
                </Link>
              </Button>
            ) : (
              <Button disabled className="self-start">
                Open report
              </Button>
            )}
            <p className="type-ui-small text-by-text-secondary">
              Report summary and room pin state aren't supplied.
            </p>
          </article>
        )
      }
    </DataBoundary>
  );
}
function Posts({ room, viewer }: { room: Room; viewer: Viewer }) {
  const q = useRoomMessages(room.id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="No messages in this room yet." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(messages) => {
        const scoped = messages.filter((m) => m.roomId === room.id && m.threadId === null);
        return scoped.length ? (
          scoped.map((m) => <KindPost key={m.id} message={m} viewer={viewer} />)
        ) : (
          <StateEmpty title="No messages in this room yet." />
        );
      }}
    </DataBoundary>
  );
}
function KindPost({ message, viewer }: { message: Message; viewer: Viewer }) {
  return (
    <div className="flex gap-3">
      <Avatar name={message.authorName} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="type-ui-body-strong">{message.authorName}</p>
        {message.block?.type === "report" ? (
          <ReportPost id={message.block.reportId} viewer={viewer} />
        ) : message.isApp ? (
          <p className="type-ui-small text-by-text-secondary">
            This app post needs typed confidence, sample and subject information.
          </p>
        ) : (
          <p className="type-ui-body whitespace-pre-wrap">{message.body}</p>
        )}
        {message.block && message.block.type !== "report" && (
          <p className="type-ui-small text-by-text-tertiary">
            Attachment details require a scoped room attachment contract.
          </p>
        )}
      </div>
    </div>
  );
}
function KindTabs({ room }: { room: Room }) {
  return (
    <nav
      aria-label="Room tabs"
      className="flex items-center gap-6 overflow-x-auto border-b border-by-border-engraved pb-3 type-ui-body"
    >
      <span aria-current="page" className="border-b-2 border-by-text-primary">
        Feed
      </span>
      {room.kind === "coaching" ? (
        <>
          <Button disabled variant="ghost">
            Active focuses
          </Button>
          <Button disabled variant="ghost">
            Results
          </Button>
        </>
      ) : (
        <>
          <Link to="/app/rooms/$roomId/calls" params={{ roomId: room.id }} search={true}>
            Calls
          </Link>
          <Link to="/app/rooms/$roomId/reports" params={{ roomId: room.id }} search={true}>
            Reports
          </Link>
          <Link to="/app/rooms/$roomId/insights" params={{ roomId: room.id }} search={true}>
            Insights
          </Link>
        </>
      )}
      {room.kind === "brief" && (
        <Button disabled variant="ghost">
          Pinned
        </Button>
      )}
      {room.kind === "deal" && (
        <Button disabled variant="ghost">
          Stakeholders
        </Button>
      )}
      <Link to="/app/rooms/$roomId/about" params={{ roomId: room.id }} search={true}>
        About
      </Link>
    </nav>
  );
}
function KindBody({ room, viewer }: { room: Room; viewer: Viewer }) {
  const [details, setDetails] = useState(true);
  return (
    <>
      <div className="flex min-h-[900px] flex-col gap-5 p-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="type-ui-body-strong"># {room.name}</h1>
            <p className="type-ui-small text-by-text-secondary">{room.topic}</p>
          </div>
          <Button variant="secondary" onClick={() => setDetails((v) => !v)}>
            {details ? "Hide details" : "Room details"}
          </Button>
        </header>
        <KindTabs room={room} />
        <Posts room={room} viewer={viewer} />
        <LocalSettingsNote title={room.kind === "deal" ? "DEAL CONTEXT" : "ROOM CONTEXT"}>
          {room.kind === "deal"
            ? "Deal amount, stakeholders, stage and behavior across calls haven't been supplied."
            : room.kind === "coaching"
              ? "Room-linked coaching lifecycle and result trends haven't been supplied."
              : room.kind === "team"
                ? "Team progress, room-linked calls and brief summaries haven't been supplied."
                : "Posting schedules, report summaries and pin metadata haven't been supplied."}
        </LocalSettingsNote>
        <footer className="mt-auto border-t border-by-border-engraved pt-4">
          <Button disabled variant="secondary" className="w-full justify-start">
            Message #{room.name}
          </Button>
          <p className="type-ui-small mt-2 text-by-text-tertiary">
            Sending and attachments aren't connected yet.
          </p>
        </footer>
      </div>
      {details && (
        <ContextPanel title={room.kind === "deal" ? "Deal" : "Room details"}>
          <h2 className="type-ui-body-strong"># {room.name}</h2>
          <p className="type-ui-small text-by-text-secondary">{room.topic}</p>
          <p className="type-ui-small">{room.memberCount} members</p>
          <Button disabled variant="secondary">
            Add people
          </Button>
          <LocalSettingsNote title="PINNED INSIGHT">No pin metadata supplied.</LocalSettingsNote>
          <h3 className="type-ui-label">Members</h3>
          <p className="type-ui-small text-by-text-secondary">
            Member names and presence are unavailable.
          </p>
          <h3 className="type-ui-label">Room links</h3>
          <p className="type-ui-small text-by-text-secondary">No curated room links supplied.</p>
          <Button variant="ghost" onClick={() => setDetails(false)}>
            Close details
          </Button>
        </ContextPanel>
      )}
    </>
  );
}
function Loaded({ id, kind, viewer }: { id: string; kind: RoomKind; viewer: Viewer }) {
  const q = useRoom(id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Room not found." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(room) =>
        !room || room.kind !== kind ? (
          <StateEmpty title="Room kind doesn't match this view." />
        ) : !room.isMember ? (
          <Denied />
        ) : (
          <KindBody key={room.id} room={room} viewer={viewer} />
        )
      }
    </DataBoundary>
  );
}
export function LocalKindRoom({ kind }: { kind: RoomKind }) {
  const q = useViewer();
  const { roomId } = useParams({ strict: false });
  return (
    <main className="min-h-full text-by-text-primary">
      <DataBoundary
        query={q}
        empty={<StateEmpty title="Sign in to view rooms." />}
        error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
      >
        {(viewer) =>
          roomId && ["manager", "owner", "admin"].includes(viewer.role) ? (
            <Loaded id={roomId} kind={kind} viewer={viewer} />
          ) : (
            <Denied />
          )
        }
      </DataBoundary>
    </main>
  );
}
