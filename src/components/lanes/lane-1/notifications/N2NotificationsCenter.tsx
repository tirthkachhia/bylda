import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  ContextPanel,
  DataBoundary,
  StateEmpty,
  StateLoading,
  Tag,
  cn,
  type TagTone,
} from "@/components/bylda";
import {
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  type Notification,
} from "@/lib/data";
import { NotificationRow } from "./NotificationRow";
import { countFor, matches, quietHoursLabel, whenOf, type FilterKey } from "./model";
import { useNow } from "./useNow";

/**
 * N2 · Notifications — Center
 * Figma 31:1258 (page 1:15) · Lane 1 — Ansh · route /app/notifications
 * Hooks: useNotifications, useMarkNotificationRead (+ useNotificationPreferences for the panel)
 *
 * Everything Bylda wants the viewer to know, in one list. Own notifications only.
 */
const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_you", label: "Needs you" },
  { key: "behavior", label: "Behavior" },
  { key: "coaching", label: "Coaching" },
  { key: "reports", label: "Reports" },
  { key: "system", label: "System" },
];

export function N2NotificationsCenter() {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const [filter, setFilter] = useState<FilterKey>("all");
  const now = useNow();

  const open = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
  };

  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">
      <SeverityPanel />
      <DataBoundary
        query={now === null ? { ...query, isLoading: true } : query}
        loading={
          <>
            <Header />
            <StateLoading />
          </>
        }
        empty={
          <>
            <Header />
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
                onMarkAll={
                  unread.length > 0 ? () => unread.forEach((n) => markRead.mutate(n.id)) : undefined
                }
              />
              <div
                role="tablist"
                aria-label="Filter notifications"
                className="flex gap-4.5 overflow-x-auto border-b border-by-border-engraved"
              >
                {TABS.map((t) => {
                  const count = countFor(all, t.key);
                  const active = filter === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(t.key)}
                      className={cn(
                        "-mb-px flex shrink-0 items-start gap-1.5 border-b-[1.5px] py-2 transition-colors duration-200 ease-out",
                        active
                          ? "type-ui-body-strong border-by-text-primary text-by-text-primary"
                          : "type-ui-body border-transparent text-by-text-secondary hover:text-by-text-primary",
                      )}
                    >
                      {t.label}
                      {count > 0 ? (
                        <span className="type-mono-micro text-by-text-tertiary">{count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {rows.length === 0 ? (
                <StateEmpty
                  eyebrow="NOTIFICATIONS"
                  title={
                    filter === "needs_you"
                      ? "Nothing needs you right now."
                      : "Nothing in this view."
                  }
                  body={
                    filter === "needs_you"
                      ? "Nothing that asks for action is unread."
                      : "New notifications of this kind will show up here."
                  }
                />
              ) : (
                <div className="flex w-full flex-col overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
                  {rows.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      when={whenOf(n.createdAt, now ?? 0)}
                      onOpen={open}
                      className="border-b border-by-border-engraved px-4 py-3 last:border-b-0"
                    />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </DataBoundary>
    </div>
  );
}

function Header({ onMarkAll }: { onMarkAll?: () => void }) {
  return (
    <header className="flex w-full items-end gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="type-editorial-h1 text-by-text-primary">Notifications</h1>
        <p className="type-ui-small text-by-text-secondary">
          Anything Bylda wants you to know, in one place. Most of this also arrives in your brief.
        </p>
      </div>
      <Button variant="secondary" onClick={onMarkAll} disabled={!onMarkAll}>
        Mark all read
      </Button>
    </header>
  );
}

const SEVERITY: { tone: TagTone; label: string; meaning: string }[] = [
  { tone: "regress", label: "Regression", meaning: "A behavior got meaningfully worse" },
  { tone: "attention", label: "Needs review", meaning: "Worth a look today" },
  { tone: "info", label: "Pattern", meaning: "Something is forming" },
  { tone: "improve", label: "Improvement", meaning: "Something got better" },
  { tone: "neutral", label: "Info", meaning: "FYI only" },
];

/** Context panel — the severity legend, quiet hours and a way to the settings (31:1349). */
function SeverityPanel() {
  const prefs = useNotificationPreferences();
  return (
    <ContextPanel>
      <div className="flex flex-col gap-4.5 py-1">
        <PanelHeading>SEVERITY</PanelHeading>
        <div className="flex flex-col">
          {SEVERITY.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 border-b border-by-border-engraved py-1.5"
            >
              <Tag tone={s.tone}>{s.label}</Tag>
              <span className="type-ui-small flex-1 text-by-text-secondary">{s.meaning}</span>
            </div>
          ))}
        </div>
        <PanelHeading>QUIET HOURS</PanelHeading>
        {prefs.data ? (
          <div className="flex flex-col">
            <PanelRow label="Push">{quietHoursLabel(prefs.data.quietHours)}</PanelRow>
          </div>
        ) : null}
        <Button variant="secondary" asChild className="w-full justify-start">
          <Link to="/app/workspace/notifications">Notification settings</Link>
        </Button>
      </div>
    </ContextPanel>
  );
}

const PanelHeading = ({ children }: { children: ReactNode }) => (
  <p className="type-ui-label text-by-text-primary">{children}</p>
);

const PanelRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start gap-2.5 border-b border-by-border-engraved py-2">
    <span className="type-mono-micro w-20 shrink-0 text-by-text-tertiary">{label}</span>
    <span className="type-ui-small flex-1 text-by-text-primary">{children}</span>
  </div>
);
