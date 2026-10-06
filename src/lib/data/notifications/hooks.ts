import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { useDataCtx } from "../session/hooks";
import { NOTIFICATIONS, REP_NOTIFICATIONS } from "../mocks/collab";
import type { Notification, PushRegistration } from "../types";
import { fetchNotifications, markRead } from "./fetchers";
import { mapNotificationRows } from "./map";
import { notificationKeys } from "./queryKeys";
import { SOURCE } from "./source";

/**
 * Mock inbox for the viewer. Rep scoping is by whose row it is, never by type: a rep sees their
 * own regression rows, and team-level alerts and other reps' rows stay hidden (CLAUDE.md §4,
 * "Reps never see peer comparisons or team rankings"; rules per LANE_REQUESTS #72). There is no backend
 * guarantee (RLS is org-wide), so the data layer enforces it. Ownership is the recipient, the
 * real table's `user_id`; `Notification` has no owner field, so it is the inbox a row sits in
 * (mocks/collab.ts). Fail-closed: a rep with no inbox sees nothing, and neither does a role the
 * visibility doc doesn't define. Real mode is already
 * scoped to the viewer by `user_id` + RLS.
 */
function mockInbox(ctx: DataCtx): Notification[] {
  switch (ctx.role) {
    case "owner":
    case "admin":
    case "manager":
      return NOTIFICATIONS;
    case "rep":
      return REP_NOTIFICATIONS[ctx.userId] ?? [];
    default:
      // coach, viewer, and any role added later: docs/notification-visibility.md defines no
      // visibility for them, so they see nothing until it does (default-deny).
      return [];
  }
}

/** Mock-mode write-through: ids marked read this session, so a refetch can't un-read a row. */
const mockRead = new Set<string>();

/** Tests only — forget every mock-mode "mark read". */
export function resetMockNotificationState() {
  mockRead.clear();
}

/** N1/N2/B5 — only ever the viewer's own notifications. */
export async function loadNotifications(ctx: DataCtx): Promise<Notification[]> {
  if (resolveSource(SOURCE) === "mock") {
    return mockInbox(ctx).map((n) => (mockRead.has(n.id) && !n.read ? { ...n, read: true } : n));
  }
  return mapNotificationRows(await fetchNotifications(ctx.userId));
}

export const useNotifications = () =>
  useCtxQuery(notificationKeys.list(), loadNotifications, isEmptyArray);

type Rollback = { id: string; wasRead: boolean };

/** Flip one row in every cached list (one per viewer/role key). Other rows are left alone. */
function setRead(qc: QueryClient, id: string, read: boolean) {
  qc.setQueriesData<Notification[]>({ queryKey: notificationKeys.list() }, (rows) =>
    rows?.map((n) => (n.id === id ? { ...n, read } : n)),
  );
}

/**
 * Optimistic: the row reads as read at once, so every count derived from the list updates with it.
 * Rollback is per row, not a whole-cache snapshot, so "mark all" fired as N parallel mutations
 * can't have one failure resurrect rows whose own mutations succeeded. Real mode still
 * refetches once the write settles; mock mode doesn't, because there is nothing to re-read
 * (the loader folds `mockRead` in anyway).
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const ctx = useDataCtx();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (resolveSource(SOURCE) === "mock") {
        // Same authorization as the read (docs/notification-visibility.md): only a row in the
        // viewer's own inbox can be marked. One someone else owns fails exactly like one that
        // doesn't exist, so the error never confirms it is there.
        if (!ctx || !mockInbox(ctx).some((n) => n.id === id))
          throw new Error("NOTIFICATION_NOT_FOUND");
        mockRead.add(id);
        return;
      }
      await markRead(id);
    },
    onMutate: async (id): Promise<Rollback | null> => {
      await qc.cancelQueries({ queryKey: notificationKeys.list() });
      const row = qc
        .getQueriesData<Notification[]>({ queryKey: notificationKeys.list() })
        .flatMap(([, rows]) => rows ?? [])
        .find((n) => n.id === id);
      setRead(qc, id, true);
      return row ? { id, wasRead: row.read } : null;
    },
    onError: (_err, id, context) => {
      const prior = context as Rollback | null | undefined;
      if (prior && !prior.wasRead) setRead(qc, id, false);
    },
    onSettled: () => {
      if (resolveSource(SOURCE) !== "mock")
        void qc.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

/** B1/B2/B4/B5 — mobile push registration. GAP: push_subscriptions (C-36) — mock in every mode. */
export async function loadPushRegistration(ctx: DataCtx): Promise<PushRegistration> {
  void ctx;
  return { platform: "web", enabled: false, registeredAt: null };
}
export const usePushRegistration = () =>
  useCtxQuery(["notifications", "push"], loadPushRegistration, () => false);
