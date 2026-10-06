import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  Button,
  cn,
  DataBoundary,
  InsightCard,
  StateEmpty,
  StateError,
  SystemState,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useBrief,
  useCalls,
  useRoom,
  useRoomInsights,
  useRoomMessages,
  useViewer,
  type Room,
  type Viewer,
} from "@/lib/data";
import {
  LocalSettingsNote,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
import { roomAttachments, tabInsightAllowed } from "./roomTabModel";
type Tab = "insights" | "calls" | "reports" | "files" | "about";
function Denied() {
  return (
    <SystemState
      eyebrow="Y9 · ACCESS RESTRICTED"
      title="This room tab isn't available to your role."
      body="Personal views require scoped content supplied by the data layer."
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
function Tabs({ id, tab }: { id: string; tab: Tab }) {
  const cls = (value: string) => cn("pb-2", tab === value && "border-b-2 border-by-text-primary");
  return (
    <nav
      aria-label="Room tabs"
      className="flex gap-6 overflow-x-auto border-b border-by-border-engraved px-7 type-ui-body"
    >
      <Link to="/app/rooms/$roomId" params={{ roomId: id }} search={true}>
        Feed
      </Link>
      <Link
        className={cls("insights")}
        aria-current={tab === "insights" ? "page" : undefined}
        to="/app/rooms/$roomId/insights"
        params={{ roomId: id }}
        search={true}
      >
        Insights
      </Link>
      <Link
        className={cls("calls")}
        aria-current={tab === "calls" ? "page" : undefined}
        to="/app/rooms/$roomId/calls"
        params={{ roomId: id }}
        search={true}
      >
        Calls
      </Link>
      <Link
        className={cls("reports")}
        aria-current={tab === "reports" ? "page" : undefined}
        to="/app/rooms/$roomId/reports"
        params={{ roomId: id }}
        search={true}
      >
        Reports
      </Link>
      <Link
        className={cls("files")}
        aria-current={tab === "files" ? "page" : undefined}
        to="/app/rooms/$roomId/files"
        params={{ roomId: id }}
        search={true}
      >
        Files
      </Link>
      <Link
        className={cls("about")}
        aria-current={tab === "about" ? "page" : undefined}
        to="/app/rooms/$roomId/about"
        params={{ roomId: id }}
        search={true}
      >
        About
      </Link>
    </nav>
  );
}
function Insights({ room, viewer }: { room: Room; viewer: Viewer }) {
  const q = useRoomInsights(room.id);
  const [kind, setKind] = useState("all");
  return (
    <DataBoundary
      query={q}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
      empty={<StateEmpty title="No room insights yet." />}
    >
      {(items) => {
        const safe = items
          .filter((item) => item.state === "insight" && tabInsightAllowed(item.insight, viewer))
          .flatMap((item) => (item.state === "insight" ? [item.insight] : []));
        const visible = safe.filter((i) => kind === "all" || i.kind === kind);
        return (
          <>
            <div className="flex flex-wrap gap-2">
              {["all", "pattern", "regression", "improvement"].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={kind === value ? "primary" : "secondary"}
                  onClick={() => setKind(value)}
                >
                  {value} · {safe.filter((i) => value === "all" || i.kind === value).length}
                </Button>
              ))}
            </div>
            {visible.length ? (
              visible.map((i) => (
                <InsightCard
                  key={i.id}
                  kind={i.kind}
                  headline={i.headline}
                  body={viewer.role === "rep" ? undefined : (i.body ?? undefined)}
                  confidence={i.confidence}
                  sampleSize={i.sampleSize}
                  sampleLabel={viewer.role === "rep" ? undefined : (i.sampleLabel ?? undefined)}
                  causalTested={i.causalTested}
                />
              ))
            ) : (
              <StateEmpty
                title="No publishable insights in this view."
                body="Observations need enough analyzed calls, confidence and sample information."
              />
            )}
          </>
        );
      }}
    </DataBoundary>
  );
}
function Calls({ room }: { room: Room }) {
  const messages = useRoomMessages(room.id);
  const calls = useCalls();
  return (
    <DataBoundary
      query={messages}
      error={(e) => <ErrorState error={e} retry={() => void messages.refetch()} />}
      empty={<StateEmpty title="No calls shared here yet." />}
    >
      {(items) => (
        <DataBoundary
          query={calls}
          error={(e) => <ErrorState error={e} retry={() => void calls.refetch()} />}
          empty={<StateEmpty title="Shared calls unavailable." />}
        >
          {(all) => {
            const ids = new Set(
              roomAttachments(items, room.id, "call").flatMap((m) =>
                m.block?.type === "call" ? [m.block.callId] : [],
              ),
            );
            const list = all.filter((c) => ids.has(c.id));
            return list.length ? (
              list.map((c) => (
                <article
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4"
                >
                  <div>
                    <h2 className="type-ui-body-strong">
                      {c.repName} × {c.account.name}
                    </h2>
                    <p className="type-ui-small text-by-text-secondary">
                      {Math.round(c.durationSec / 60)} min · {c.startedAt.slice(0, 10)}
                    </p>
                  </div>
                  <Button asChild variant="secondary">
                    <Link to="/app/calls/$callId" params={{ callId: c.id }} search={true}>
                      Review call
                    </Link>
                  </Button>
                </article>
              ))
            ) : (
              <StateEmpty title="No accessible call attachments." />
            );
          }}
        </DataBoundary>
      )}
    </DataBoundary>
  );
}
function ReportAttachment({ id, viewer }: { id: string; viewer: Viewer }) {
  const q = useBrief(id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Report unavailable." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(b) =>
        !b || b.id !== id || (viewer.role === "manager" && b.subjectId !== viewer.team?.id) ? (
          <StateEmpty title="Report unavailable for this scope." />
        ) : (
          <article className="flex items-center justify-between gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
            <div>
              <h2 className="type-ui-body-strong">{b.title}</h2>
              <p className="type-ui-small text-by-text-secondary">
                {b.period} · {b.readMinutes} min read
              </p>
            </div>
            {b.kind === "daily_manager" || b.kind === "weekly_manager" ? (
              <Button asChild variant="secondary">
                <Link
                  to={b.kind === "daily_manager" ? "/app/reports/daily" : "/app/reports/weekly"}
                  search={(previous) => ({ ...previous, reportId: b.id })}
                >
                  Open
                </Link>
              </Button>
            ) : (
              <Button disabled variant="secondary">
                Open
              </Button>
            )}
          </article>
        )
      }
    </DataBoundary>
  );
}
function Reports({ room, viewer }: { room: Room; viewer: Viewer }) {
  const q = useRoomMessages(room.id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="No reports shared here yet." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(items) => {
        const ids = [
          ...new Set(
            roomAttachments(items, room.id, "report").flatMap((m) =>
              m.block?.type === "report" ? [m.block.reportId] : [],
            ),
          ),
        ];
        return ids.length ? (
          ids.map((id) => <ReportAttachment key={id} id={id} viewer={viewer} />)
        ) : (
          <StateEmpty title="No reports shared here yet." />
        );
      }}
    </DataBoundary>
  );
}
function Files() {
  return (
    <>
      <h2 className="type-ui-label">FILES & CLIPS</h2>
      <LocalSettingsTable headings={["File", "Type", "Shared by", "Date"]}>
        <tr>
          <td colSpan={4} className={cell}>
            Room files and clip attachments aren't supplied yet.
          </td>
        </tr>
      </LocalSettingsTable>
      <StateEmpty title="Files unavailable." body="No file contract exists for this room." />
    </>
  );
}
function About({ room }: { room: Room }) {
  return (
    <>
      <h2 className="type-editorial-h2">About #{room.name}</h2>
      <p className="type-ui-body">{room.topic}</p>
      <dl className="divide-y divide-by-border-engraved">
        {[
          ["Kind", room.kind],
          ["Members", String(room.memberCount)],
          ["Membership", room.isMember ? "Joined" : "Not joined"],
          ["Created", "Unavailable"],
          ["Visibility", "Unavailable"],
          ["Watched behaviors", "Unavailable"],
          ["Delivery", "Unavailable"],
          ["Notifications", "Unavailable"],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[160px_1fr] gap-4 py-3">
            <dt className="type-mono-micro text-by-text-tertiary">{label}</dt>
            <dd className="type-ui-small">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button disabled variant="secondary">
          Edit room
        </Button>
        <Button disabled variant="secondary">
          Manage what Bylda posts
        </Button>
        <Button disabled variant="ghost">
          Leave room
        </Button>
      </div>
    </>
  );
}
function Loaded({ id, tab, viewer }: { id: string; tab: Tab; viewer: Viewer }) {
  const q = useRoom(id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Room not found." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(room) =>
        !room || !room.isMember ? (
          <Denied />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 px-7 py-4">
              <div>
                <h1 className="type-ui-body-strong">
                  {viewer.role === "rep" ? "Your room insights" : `# ${room.name}`}
                </h1>
                {viewer.role !== "rep" && (
                  <p className="type-ui-small text-by-text-secondary">{room.topic}</p>
                )}
              </div>
              <Button disabled variant="secondary">
                Share
              </Button>
            </header>
            <Tabs id={room.id} tab={tab} />
            <div className="flex flex-col gap-5 px-7 py-[18px]">
              {tab === "insights" ? (
                <Insights room={room} viewer={viewer} />
              ) : tab === "calls" ? (
                <Calls room={room} />
              ) : tab === "reports" ? (
                <Reports room={room} viewer={viewer} />
              ) : tab === "files" ? (
                <Files />
              ) : (
                <About room={room} />
              )}
              <LocalSettingsNote title="ROOM DATA">
                Thread context, publishing and room settings need additional shared contracts.
              </LocalSettingsNote>
            </div>
          </>
        )
      }
    </DataBoundary>
  );
}
export function LocalRoomTabs({ tab }: { tab: Tab }) {
  const viewer = useViewer();
  const { roomId } = useParams({ strict: false });
  return (
    <main className="min-h-full text-by-text-primary">
      <DataBoundary
        query={viewer}
        empty={<StateEmpty title="Sign in to view this room." />}
        error={(e) => <ErrorState error={e} retry={() => void viewer.refetch()} />}
      >
        {(person) =>
          roomId &&
          (["owner", "admin", "manager"].includes(person.role) ||
            (person.role === "rep" && tab === "insights")) ? (
            <Loaded key={roomId} id={roomId} tab={tab} viewer={person} />
          ) : (
            <Denied />
          )
        }
      </DataBoundary>
    </main>
  );
}
