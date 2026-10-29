import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatWhen } from "@/lib/coaching/calls";
import { Inactive } from "./FigmaPrimitives";
export function FigmaNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["figma-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,message,read,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  async function mark(id?: string) {
    if (!user) return;
    setBusy(true);
    try {
      let request = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
      request = id ? request.eq("id", id) : request.eq("read", false);
      const { error } = await request;
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["figma-notifications", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark notifications");
    } finally {
      setBusy(false);
    }
  }
  const rows = (q.data ?? []).filter((r) => !unread || !r.read);
  return (
    <section
      className="figma-surface figma-panel min-h-[calc(100dvh-72px)]"
      data-design-screen="notifications"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Notifications</h1>
        <button
          className="figma-button"
          disabled={busy || !q.data?.some((r) => !r.read)}
          onClick={() => void mark()}
        >
          Mark all read
        </button>
      </div>
      <div className="figma-tabs" role="tablist" aria-label="Notification filter">
        <button role="tab" aria-selected={!unread} onClick={() => setUnread(false)}>
          All
        </button>
        <button role="tab" aria-selected={unread} onClick={() => setUnread(true)}>
          Unread
        </button>
        {["Mentions", "Coaching", "Insights"].map((t) => (
          <button role="tab" key={t} disabled>
            {t}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <p role="status">Loading notifications…</p>
      ) : q.error ? (
        <p role="alert">
          Notifications could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : rows.length ? (
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start gap-4 border-b border-by-border-engraved py-4"
            >
              <span
                className={`mt-2 size-2 rounded-full ${r.read ? "bg-transparent" : "bg-by-surface-control-dark"}`}
              />
              <div className="min-w-0 flex-1">
                <p>{r.message ?? "Workspace notification"}</p>
                <p className="mt-2 text-xs text-by-text-secondary">{formatWhen(r.created_at)}</p>
              </div>
              {!r.read && (
                <button className="figma-button" disabled={busy} onClick={() => void mark(r.id)}>
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="figma-empty">No {unread ? "unread " : ""}notifications.</p>
      )}
      <div className="mt-6">
        <Inactive>Notification preferences</Inactive>
      </div>
      <p className="mt-3 text-xs text-by-text-secondary">
        Shows the latest 100 notifications available to your account. Behavioral alert categories
        remain unavailable.
      </p>
    </section>
  );
}
