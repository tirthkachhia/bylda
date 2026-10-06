import { momentKey } from "./mobile-evidence";
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  cn,
  DataBoundary,
  EvidenceBlock,
  StateError,
  StateEmpty,
  SystemState,
  systemStates,
  Wordmark,
  type QueryLike,
} from "@/components/bylda";
import {
  useViewer,
  useMyCalls,
  useAcknowledgeCoaching,
  ForbiddenForRoleError,
  type EvidenceRef,
  type CoachingFocus,
} from "@/lib/data";

export function LocalRestricted() {
  return (
    <SystemState
      {...systemStates.permissionDenied()}
      title="This view is restricted."
      body="Your mobile brief, coaching, and evidence are only about you."
      actions={[]}
    />
  );
}
export function LocalBoundary<T>({
  query,
  children,
  emptyTitle = "Nothing here yet.",
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  emptyTitle?: string;
}) {
  return (
    <DataBoundary
      query={query}
      empty={<StateEmpty title={emptyTitle} />}
      error={(err) =>
        err instanceof ForbiddenForRoleError ||
        (err instanceof Error && err.message.includes("FORBIDDEN_FOR_ROLE")) ? (
          <LocalRestricted />
        ) : (
          <StateError body="We couldn’t load this view." onRetry={() => void query.refetch?.()} />
        )
      }
    >
      {children}
    </DataBoundary>
  );
}
export function LocalRepOnly({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  return (
    <LocalBoundary query={viewer}>
      {(v) => (v.role === "rep" ? children : <LocalRestricted />)}
    </LocalBoundary>
  );
}
export function LocalMobileFrame({
  children,
  active,
  coach = false,
}: {
  children: ReactNode;
  active?: string;
  coach?: boolean;
}) {
  const viewer = useViewer().data;
  return (
    <main
      className={cn(
        "relative mx-auto flex min-h-dvh w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] border border-by-border-control bg-by-surface-canvas text-by-text-primary",
        !coach && "gap-4 px-5 pb-24",
      )}
    >
      {!coach && (
        <header className="flex items-start justify-end pt-4">
          <Wordmark className="text-by-text-secondary" />
        </header>
      )}
      {children}
      {!coach && (
        <nav
          aria-label="Mobile navigation"
          className={cn(
            "fixed bottom-0 left-1/2 flex h-[72px] w-full max-w-[390px] -translate-x-1/2 items-center justify-between rounded-b-[28px] border-t border-by-border-engraved bg-by-surface-raised px-8",
            active === "Brief" && "items-start pt-3",
          )}
        >
          {[
            ["Brief", viewer?.role === "rep" ? "/m/brief" : "/m/manager-brief"],
            ["Calls", viewer?.role === "rep" ? "/app/calls/mine" : "/app/calls"],
            ["Coaching", viewer?.role === "rep" ? "/app/coaching/mine" : "/app/coaching"],
            ["Alerts", "/m/alerts"],
          ].map(([name, to]) => (
            <Link
              key={name}
              to={to as never}
              search={true}
              aria-current={active === name ? "page" : undefined}
              className={
                active === name
                  ? "type-ui-body-strong text-by-text-primary"
                  : "type-ui-small text-by-text-tertiary"
              }
            >
              {name}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
export function LocalCard({
  children,
  dark = false,
  className,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-by-card p-[18px]",
        dark
          ? "bg-by-surface-rail text-by-text-on-dark"
          : "border border-by-border-engraved bg-by-surface-inset",
        className,
      )}
    >
      {children}
    </section>
  );
}
export function LocalLabel({ children }: { children: ReactNode }) {
  return <p className="type-mono-micro text-by-text-tertiary">{children}</p>;
}
export function LocalEvidence({ evidence }: { evidence: EvidenceRef }) {
  const calls = useMyCalls();
  const viewer = useViewer().data;
  if (!calls.data?.some((c) => c.id === evidence.callId && c.repId === viewer?.id)) return null;
  return (
    <Link
      to="/m/moments/$momentId"
      params={{ momentId: momentKey(evidence) }}
      search={true}
      aria-label={`Hear moment at ${evidence.timestamp}`}
    >
      <EvidenceBlock
        evidence={{
          timestamp: evidence.timestamp,
          speaker: evidence.speakerLabel,
          quote: evidence.quote,
        }}
      />
    </Link>
  );
}
export function LocalAcknowledge({ focus }: { focus: CoachingFocus }) {
  const mutation = useAcknowledgeCoaching();
  const [confirmed, setConfirmed] = useState(false);
  const acknowledged = !!focus.acknowledgedAt || focus.status !== "assigned" || confirmed;
  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full justify-start"
        disabled={acknowledged || mutation.isPending}
        onClick={() =>
          mutation.mutate(focus.id, {
            onSuccess: (result) => {
              if (result?.id === focus.id && result.acknowledgedAt) setConfirmed(true);
            },
          })
        }
      >
        {acknowledged
          ? "Acknowledged"
          : mutation.isPending
            ? "Acknowledging…"
            : "Got it — I’ll try this"}
      </Button>
      {mutation.isError && (
        <p role="alert" className="type-ui-small">
          Couldn’t acknowledge. Try again.
        </p>
      )}
      {confirmed && (
        <p role="status" className="type-ui-small">
          Focus acknowledged.
        </p>
      )}
    </div>
  );
}
