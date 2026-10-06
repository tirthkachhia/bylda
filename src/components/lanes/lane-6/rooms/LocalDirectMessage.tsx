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
  useDmMessages,
  useDmThreads,
  useMyCoaching,
  useViewer,
  type DmThread,
  type Viewer,
} from "@/lib/data";
import { LocalSettingsNote } from "@/components/lanes/lane-5/settings/LocalSettings";
import { canReadThread, threadMessages } from "./dmModel";
function Denied() {
  return (
    <SystemState
      eyebrow="Y9 · ACCESS RESTRICTED"
      title="This conversation isn't available to you."
      body="Only participants can open a direct message."
    />
  );
}
function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <Denied />
  ) : (
    <StateError body="Conversation data couldn't be loaded." onRetry={retry} />
  );
}
function OwnFocus({ id, viewer }: { id: string; viewer: Viewer }) {
  const q = useMyCoaching();
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="No personal coaching focus available." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(items) => {
        const f = items.find((x) => x.id === id && x.repId === viewer.id);
        return f ? (
          <article className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
            <p className="type-mono-micro text-by-text-tertiary">ASSIGNED FOCUS</p>
            <h2 className="type-ui-body-strong">{f.behaviorName}</h2>
            <p className="type-ui-small text-by-text-secondary">{f.status}</p>
            <Button asChild variant="secondary" className="self-start">
              <Link to="/app/coaching/mine" search={true}>
                Open my coaching
              </Link>
            </Button>
            <p className="type-ui-small text-by-text-tertiary">
              Performance summaries and practice answers need confidence and sample metadata.
            </p>
          </article>
        ) : (
          <StateEmpty title="No personal coaching focus available." />
        );
      }}
    </DataBoundary>
  );
}
function Messages({ thread, viewer }: { thread: DmThread; viewer: Viewer }) {
  const q = useDmMessages(thread.id);
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="No messages yet." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(items) => {
        const safe = threadMessages(items, thread, viewer);
        return safe.length ? (
          safe.map((m) => (
            <article key={m.id} className="flex gap-3">
              <Avatar
                name={
                  m.authorId === viewer.id
                    ? viewer.name
                    : thread.isCoach
                      ? "BYLDA Coach"
                      : m.authorName
                }
                size={36}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <header className="flex gap-2">
                  <span className="type-ui-body-strong">
                    {m.authorId === viewer.id
                      ? viewer.name
                      : thread.isCoach
                        ? "BYLDA Coach"
                        : m.authorName}
                  </span>
                  <time className="type-ui-small text-by-text-tertiary" dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                  </time>
                </header>
                {thread.isCoach && m.block?.type === "coaching" ? (
                  <OwnFocus id={m.block.focusId} viewer={viewer} />
                ) : m.isApp || viewer.role === "rep" ? (
                  <p className="type-ui-small text-by-text-secondary">
                    Message text and attachments need verified subject scope and evidence metadata.
                  </p>
                ) : (
                  <p className="type-ui-body whitespace-pre-wrap">{m.body}</p>
                )}
                {!thread.isCoach && m.block && (
                  <p className="type-ui-small text-by-text-tertiary">
                    Shared attachment details are unavailable.
                  </p>
                )}
              </div>
            </article>
          ))
        ) : (
          <StateEmpty title="No scoped messages available." />
        );
      }}
    </DataBoundary>
  );
}
function Conversation({ thread, viewer }: { thread: DmThread; viewer: Viewer }) {
  const [details, setDetails] = useState(true);
  return (
    <>
      <main className="flex min-h-[980px] flex-col text-by-text-primary">
        <header className="flex items-start justify-between gap-4 px-7 py-4">
          <div>
            <h1 className="type-ui-body-strong">
              {thread.isCoach
                ? "BYLDA Coach"
                : viewer.role === "rep"
                  ? "Direct message"
                  : thread.title}
            </h1>
            <p className="type-ui-small text-by-text-secondary">
              {thread.isCoach ? "Your personal coaching conversation." : "Private conversation"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setDetails((v) => !v)}>
            {details ? "Hide details" : "Details"}
          </Button>
        </header>
        <nav
          aria-label="Conversation tabs"
          className="flex gap-5 border-b border-by-border-engraved px-7 pb-3"
        >
          <span className="type-ui-body border-b-2 border-by-text-primary" aria-current="page">
            {thread.isCoach ? "Chat" : "Messages"}
          </span>
          <Button variant="ghost" disabled>
            {thread.isCoach ? "Saved answers" : "Shared calls"}
          </Button>
          <Button variant="ghost" disabled>
            {thread.isCoach ? "Practice" : "Coaching"}
          </Button>
          {!thread.isCoach && (
            <Button variant="ghost" disabled>
              Files
            </Button>
          )}
        </nav>
        <div className="flex flex-1 flex-col gap-6 px-7 py-5">
          <Messages key={thread.id} thread={thread} viewer={viewer} />
          <LocalSettingsNote title="CONVERSATION DATA">
            Sending, attachment sharing and live Coach replies aren't connected. Personal message
            text is withheld until verified subject scope is supplied.
          </LocalSettingsNote>
        </div>
        <footer className="border-t border-by-border-engraved px-7 py-4">
          <Button disabled variant="secondary" className="w-full justify-start">
            {thread.isCoach ? "Ask BYLDA Coach…" : "Message…"}
          </Button>
          <p className="type-ui-small mt-2 text-by-text-tertiary">
            No messages are sent from this preview.
          </p>
        </footer>
      </main>
      {details && (
        <ContextPanel title={thread.isCoach ? "What I can do" : "Conversation"}>
          {thread.isCoach ? (
            <>
              <LocalSettingsNote title="EXPLAIN A CALL">
                Evidence-based answers need a scoped call-analysis contract.
              </LocalSettingsNote>
              <LocalSettingsNote title="TRACK PROGRESS">
                Personal progress requires confidence and sample information.
              </LocalSettingsNote>
              <LocalSettingsNote title="PRACTICE">
                Live role-play isn't available yet.
              </LocalSettingsNote>
            </>
          ) : (
            <>
              <h2 className="type-ui-body-strong">Private conversation</h2>
              <p className="type-ui-small text-by-text-secondary">
                Participant profiles, shared-item counts, presence and local time aren't supplied.
              </p>
              <Button disabled variant="secondary">
                Open profile
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setDetails(false)}>
            Close details
          </Button>
        </ContextPanel>
      )}
    </>
  );
}
function Loaded({ id, coach, viewer }: { id: string; coach: boolean; viewer: Viewer }) {
  const q = useDmThreads();
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Conversation not found." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(threads) => {
        const t = threads.find((x) => x.id === id);
        return t && canReadThread(t, viewer, coach) ? (
          <Conversation key={id} thread={t} viewer={viewer} />
        ) : (
          <Denied />
        );
      }}
    </DataBoundary>
  );
}
export function LocalDirectMessage({ coach = false }: { coach?: boolean }) {
  const q = useViewer();
  const { threadId } = useParams({ strict: false });
  return (
    <DataBoundary
      query={q}
      empty={<StateEmpty title="Sign in to view messages." />}
      error={(e) => <ErrorState error={e} retry={() => void q.refetch()} />}
    >
      {(viewer) =>
        ["manager", "owner", "admin", "rep"].includes(viewer.role) && (coach || threadId) ? (
          <Loaded id={coach ? "dm_coach" : threadId!} coach={coach} viewer={viewer} />
        ) : (
          <Denied />
        )
      }
    </DataBoundary>
  );
}
