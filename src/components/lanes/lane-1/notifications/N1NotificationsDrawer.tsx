import { useState } from "react";
import { Icon, StateEmpty, StateLoading, cn, DataBoundary } from "@/components/bylda";
import { useMarkNotificationRead, useNotifications, type Notification } from "@/lib/data";
import { NotificationRow } from "./NotificationRow";
import { countFor, drawerBucket, matches, whenOf, type FilterKey } from "./model";
import { useNow } from "./useNow";

/**
 * N1 · Notifications — Drawer over Home
 * Figma 31:1101 (page 1:15) · Lane 1 — Ansh · mounted by the shell
 * Hooks: useNotifications, useMarkNotificationRead — see src/lib/data/README.md
 *
 * The shell owns the 400px geometry, scrim and slide; this is the content. Rows are the viewer's
 * own notifications only (the data layer scopes them) — nothing here compares people.
 */
const CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_you", label: "Needs you" },
  { key: "coaching", label: "Coaching" },
  { key: "system", label: "System" },
];

const GROUPS = [
  { bucket: "today", label: "TODAY" },
  { bucket: "earlier", label: "EARLIER" },
] as const;

export function N1NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const [filter, setFilter] = useState<FilterKey>("all");
  const now = useNow();

  const open = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    onClose();
  };

  return (
    <div className="flex min-h-full flex-col gap-3 bg-by-surface-canvas p-5.5">
      <DataBoundary
        query={now === null ? { ...query, isLoading: true } : query}
        loading={
          <>
            <Header onClose={onClose} />
            <StateLoading />
          </>
        }
        empty={
          <>
            <Header onClose={onClose} />
            <StateEmpty
              eyebrow="NOTIFICATIONS"
              title="You’re all caught up."
              body="Behavior changes, important calls and finished reports will land here."
            />
          </>
        }
      >
        {(all) => {
          const unread = all.filter((n) => !n.read);
          const rows = all.filter((n) => matches(n, filter));
          return (
            <>
              <Header
                onClose={onClose}
                onMarkAll={
                  unread.length > 0 ? () => unread.forEach((n) => markRead.mutate(n.id)) : undefined
                }
              />
              <div
                role="tablist"
                aria-label="Filter notifications"
                className="flex flex-wrap gap-1.5"
              >
                {CHIPS.map((c) => {
                  const count = c.key === "needs_you" ? countFor(all, c.key) : 0;
                  const active = filter === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(c.key)}
                      className={cn(
                        "type-ui-small rounded-by-pill border px-2.5 py-[5px] transition-colors duration-200 ease-out",
                        active
                          ? "border-by-surface-rail bg-by-surface-rail text-by-text-on-dark"
                          : "border-by-border-strong bg-by-surface-raised text-by-text-secondary hover:text-by-text-primary",
                      )}
                    >
                      {c.label}
                      {count > 0 ? ` · ${count}` : ""}
                    </button>
                  );
                })}
              </div>
              {rows.length === 0 ? (
                <p className="type-ui-small py-6 text-by-text-secondary">
                  {filter === "needs_you"
                    ? "Nothing needs you right now."
                    : "Nothing in this view yet."}
                </p>
              ) : (
                GROUPS.map(({ bucket, label }) => {
                  const group = rows.filter((n) => drawerBucket(n.createdAt, now ?? 0) === bucket);
                  if (group.length === 0) return null;
                  return (
                    <section key={bucket} className="flex flex-col gap-3">
                      <p className="type-mono-micro text-by-text-tertiary">{label}</p>
                      <div className="flex flex-col">
                        {group.map((n) => (
                          <NotificationRow
                            key={n.id}
                            notification={n}
                            when={whenOf(n.createdAt, now ?? 0)}
                            onOpen={open}
                            className="border-b border-by-border-engraved py-2.5"
                          />
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
              <p className="type-mono-micro text-by-text-tertiary">
                Severity is shown by a dot and a word, never by red badges or counts that pile up.
              </p>
            </>
          );
        }}
      </DataBoundary>
    </div>
  );
}

function Header({ onClose, onMarkAll }: { onClose: () => void; onMarkAll?: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <h2 className="type-ui-title flex-1 text-by-text-primary">Notifications</h2>
      <button
        type="button"
        onClick={onMarkAll}
        disabled={!onMarkAll}
        className="type-ui-small whitespace-nowrap text-by-text-secondary transition-colors duration-200 ease-out hover:text-by-text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        Mark all read
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notifications"
        className="text-by-text-secondary transition-colors duration-200 ease-out hover:text-by-text-primary"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
