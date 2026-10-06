import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  AppBadge,
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  InsightCard,
  StateEmpty,
  StateError,
  SystemState,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCalls,
  useRoom,
  useRoomMessages,
  useViewer,
  type Message,
  type Room,
} from "@/lib/data";
import { O8RoomDailyBrief } from "./O8RoomDailyBrief";
import { O9RoomCoaching } from "./O9RoomCoaching";
import { O10RoomMidMarketTeam } from "./O10RoomMidMarketTeam";
import { O11RoomAcmeLogistics } from "./O11RoomAcmeLogistics";
import { roomFeedInsightAllowed } from "./roomFeedModel";
export function RoomFeedDenied() {
  return (
    <SystemState
      eyebrow="Y9 · ACCESS RESTRICTED"
      title="Room content isn't available to your role."
      body="Room messages do not yet carry the subject scope needed for a personal view."
    />
  );
}
export function RoomFeedError({ error, retry }: { error: unknown; retry: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <RoomFeedDenied />
  ) : (
    <StateError body="Room data couldn't be loaded." onRetry={retry} />
  );
}
export function FeedTabs({ roomId }: { roomId: string }) {
  return (
    <nav
      aria-label="Room tabs"
      className="flex gap-6 overflow-x-auto border-b border-by-border-engraved px-7 pb-3 type-ui-body"
    >
      <Link
        to="/app/rooms/$roomId"
        params={{ roomId }}
        search={true}
        className="border-b-2 border-by-text-primary"
        aria-current="page"
      >
        Feed
      </Link>
      <Link to="/app/rooms/$roomId/insights" params={{ roomId }} search={true}>
        Insights
      </Link>
      <Link to="/app/rooms/$roomId/calls" params={{ roomId }} search={true}>
        Calls
      </Link>
      <Link to="/app/rooms/$roomId/reports" params={{ roomId }} search={true}>
        Reports
      </Link>
      <Link to="/app/rooms/$roomId/files" params={{ roomId }} search={true}>
        Files
      </Link>
      <Link to="/app/rooms/$roomId/about" params={{ roomId }} search={true}>
        About
      </Link>
    </nav>
  );
}
function CallAttachment({ message }: { message: Message }) {
  const calls = useCalls();
  if (message.block?.type !== "call") return null;
  const id = message.block.callId;
  return (
    <DataBoundary
      query={calls}
      error={(err) => <RoomFeedError error={err} retry={() => void calls.refetch()} />}
      empty={<StateEmpty title="Call attachment unavailable." />}
    >
      {(items) => {
        const call = items.find((item) => item.id === id);
        return call ? (
          <div className="flex items-center justify-between gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-3.5">
            <span className="type-ui-body-strong">
              {call.repName} × {call.account.name}
            </span>
            <Button asChild variant="secondary">
              <Link to="/app/calls/$callId" params={{ callId: id }} search={true}>
                Review call
              </Link>
            </Button>
          </div>
        ) : (
          <StateEmpty title="Call attachment unavailable." />
        );
      }}
    </DataBoundary>
  );
}
function MessageRow({ message, onThread }: { message: Message; onThread: () => void }) {
  const insight = message.block?.type === "insight" ? message.block.insight : null;
  return (
    <article className="flex gap-3">
      <Avatar name={message.authorName} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <header className="flex flex-wrap items-center gap-2">
          <span className="type-ui-body-strong">{message.authorName}</span>
          {message.isApp && <AppBadge />}
          <time dateTime={message.createdAt} className="type-ui-small text-by-text-tertiary">
            {new Date(message.createdAt).toLocaleString("en-US", {
              timeZone: "UTC",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            UTC
          </time>
        </header>
        {!message.isApp && <p className="type-ui-body whitespace-pre-wrap">{message.body}</p>}
        {insight && roomFeedInsightAllowed(message) ? (
          <InsightCard
            kind={insight.kind}
            headline={insight.headline}
            body={insight.body ?? undefined}
            confidence={insight.confidence}
            sampleSize={insight.sampleSize}
            sampleLabel={insight.sampleLabel ?? undefined}
            causalTested={insight.causalTested}
          />
        ) : (
          message.isApp && (
            <p className="type-ui-small text-by-text-secondary">
              This app post lacks publishable confidence, sample or subject information.
            </p>
          )
        )}
        {!message.isApp && message.block?.type === "call" && <CallAttachment message={message} />}
        {!message.isApp && message.block && message.block.type !== "call" && (
          <p className="type-ui-small text-by-text-secondary">
            Attachment details are unavailable.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 type-ui-small text-by-text-secondary">
          {message.reactions.map((r) => (
            <span
              key={r.symbol}
              className="rounded-by-pill border border-by-border-engraved px-2 py-1"
            >
              {r.symbol} {r.count}
            </span>
          ))}
          {message.replyCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onThread}>
              {message.replyCount} replies
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
function Messages({ room }: { room: Room }) {
  const query = useRoomMessages(room.id);
  const [thread, setThread] = useState<Message | null>(null);
  return (
    <div className="flex min-h-[650px] flex-col">
      <div className="flex-1 space-y-6 px-7 py-5">
        <DataBoundary
          query={query}
          empty={<StateEmpty title="No messages yet." />}
          error={(err) => <RoomFeedError error={err} retry={() => void query.refetch()} />}
        >
          {(messages) => {
            const scoped = messages.filter((m) => m.roomId === room.id && m.threadId === null);
            return scoped.length ? (
              scoped.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  onThread={() => setThread(message)}
                />
              ))
            ) : (
              <StateEmpty title="No messages yet." />
            );
          }}
        </DataBoundary>
      </div>
      {thread && (
        <ContextPanel title="Thread">
          <div className="flex justify-between">
            <h2 className="type-ui-body-strong">Thread</h2>
            <Button variant="ghost" onClick={() => setThread(null)}>
              Close thread
            </Button>
          </div>
          <p className="type-ui-small text-by-text-secondary">
            Replies and call context are not supplied by the current message contract.
          </p>
        </ContextPanel>
      )}
      <div className="flex flex-col gap-2 border-t border-by-border-engraved px-7 py-4">
        <Button disabled variant="secondary" className="justify-start">
          Message #{room.name}
        </Button>
        <p className="type-ui-small text-by-text-tertiary">
          Sending, attachments and reactions aren't connected yet.
        </p>
      </div>
    </div>
  );
}
function LoadedRoom({ roomId }: { roomId: string }) {
  const query = useRoom(roomId);
  return (
    <DataBoundary
      query={query}
      empty={<StateEmpty title="Room not found." />}
      error={(err) => <RoomFeedError error={err} retry={() => void query.refetch()} />}
    >
      {(room) =>
        !room || !room.isMember ? (
          <RoomFeedDenied />
        ) : room.kind === "brief" ? (
          <O8RoomDailyBrief />
        ) : room.kind === "coaching" ? (
          <O9RoomCoaching />
        ) : room.kind === "team" ? (
          <O10RoomMidMarketTeam />
        ) : room.kind === "deal" ? (
          <O11RoomAcmeLogistics />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 px-7 py-4">
              <div>
                <h1 className="type-ui-body-strong"># {room.name}</h1>
                <p className="type-ui-small text-by-text-secondary">{room.topic}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="type-ui-small text-by-text-tertiary">
                  {room.memberCount} members
                </span>
                <Button disabled variant="secondary">
                  Share
                </Button>
              </div>
            </header>
            <FeedTabs roomId={room.id} />
            <Messages key={room.id} room={room} />
          </>
        )
      }
    </DataBoundary>
  );
}
export function LocalRoomFeed() {
  const viewer = useViewer();
  const { roomId } = useParams({ strict: false });
  return (
    <section className="min-h-full text-by-text-primary">
      <DataBoundary
        query={viewer}
        error={(err) => <RoomFeedError error={err} retry={() => void viewer.refetch()} />}
        empty={<StateEmpty title="Sign in to view rooms." />}
      >
        {(person) =>
          ["owner", "admin", "manager"].includes(person.role) && roomId ? (
            <LoadedRoom roomId={roomId} />
          ) : (
            <RoomFeedDenied />
          )
        }
      </DataBoundary>
    </section>
  );
}
