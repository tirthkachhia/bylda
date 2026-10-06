import { Link } from "@tanstack/react-router";
import {
  useNotifications,
  usePushRegistration,
  useViewer,
  useMyCalls,
  useMyCoaching,
} from "@/lib/data";
import { cn, StateEmpty } from "@/components/bylda";
import { LocalBoundary, LocalMobileFrame } from "./LocalMobile";
export function B5MobileAlerts() {
  return (
    <LocalMobileFrame active="Alerts">
      <h1 className="type-editorial-h2">Alerts</h1>
      <LocalAlerts />
    </LocalMobileFrame>
  );
}
function LocalAlerts() {
  const viewer = useViewer();
  return <LocalBoundary query={viewer}>{(v) => <LocalOwnAlerts viewer={v} />}</LocalBoundary>;
}
function LocalOwnAlerts({ viewer }: { viewer: { id: string; role: string } }) {
  const query = useNotifications();
  const push = usePushRegistration();
  const calls = useMyCalls();
  const foci = useMyCoaching();
  return (
    <LocalBoundary query={query} emptyTitle="No alerts yet.">
      {(notifications) => {
        const visible = notifications.filter(
          (n) =>
            viewer.role !== "rep" ||
            (n.type === "important_call" &&
              calls.data?.some((c) => c.repId === viewer.id && n.href === `/app/calls/${c.id}`)) ||
            ((n.type === "coaching_acknowledged" || n.type === "coaching_completed") &&
              foci.data?.some((f) => f.repId === viewer.id && n.href === `/app/coaching/${f.id}`)),
        );
        return (
          <>
            <div className="flex flex-col">
              {visible.map((n) => (
                <Link
                  key={n.id}
                  to={n.href as never}
                  search={true}
                  className="flex items-start gap-2.5 border-b border-by-border-engraved py-3"
                >
                  <span
                    aria-hidden
                    className={cn("mt-1 size-2 shrink-0 rounded-by-pill", {
                      "bg-by-signal-regress": n.severity === "regress",
                      "bg-by-signal-attention": n.severity === "attention",
                      "bg-by-signal-info": n.severity === "info",
                      "bg-by-signal-improve": n.severity === "improve",
                    })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="type-mono-micro text-by-text-secondary">{n.typeLabel}</p>
                    <p className="type-ui-small">{n.title}</p>
                  </div>
                  <time
                    className="type-mono-micro shrink-0 text-by-text-tertiary"
                    dateTime={n.createdAt}
                  >
                    {new Date(n.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </Link>
              ))}
            </div>
            {!visible.length && <StateEmpty title="No alerts available for you." />}
            <p className="type-mono-micro text-by-text-tertiary">
              Tap an alert to open its evidence.
            </p>
            <p className="type-ui-small text-by-text-tertiary">
              {push.data?.enabled ? "Push delivery registered." : "Push delivery isn’t registered."}
            </p>
          </>
        );
      }}
    </LocalBoundary>
  );
}
