import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatWhen } from "@/lib/coaching/calls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
export function FigmaNotifications({ variant = "page" }: { variant?: "page" | "drawer" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "reports" | "calls">("all");
  const [openId, setOpenId] = useState<string | null>(null);
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
  const callNotice = (type: string | null) => type === "call_feedback" || type === "call_analysis";
  const rows = (q.data ?? []).filter((row) =>
    filter === "unread"
      ? !row.read
      : filter === "reports"
        ? row.type === "coaching_report"
        : filter === "calls"
          ? callNotice(row.type)
          : true,
  );
  const selected = q.data?.find((row) => row.id === openId);
  return (
    <section
      className={`figma-surface ${variant === "drawer" ? "figma-notification-drawer-content" : "figma-panel min-h-[calc(100dvh-72px)]"}`}
      data-design-screen="notifications"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {variant === "page" && <p className="page30-label">Inbox</p>}
          <h1>{variant === "page" ? "Your intelligence" : "Notifications"}</h1>
        </div>
        <button
          className="figma-button"
          disabled={busy || !q.data?.some((r) => !r.read)}
          onClick={() => void mark()}
        >
          Mark all read
        </button>
      </div>
      <div className="figma-tabs" role="tablist" aria-label="Notification filter">
        <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
          All
        </button>
        <button role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>
          Unread
        </button>
        <button role="tab" aria-selected={filter === "calls"} onClick={() => setFilter("calls")}>
          Calls
        </button>
        <button
          role="tab"
          aria-selected={filter === "reports"}
          onClick={() => setFilter("reports")}
        >
          Reports
        </button>
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      >
        <DialogContent className="page30-dialog">
          <DialogTitle>
            {selected?.type === "coaching_report"
              ? "Saved coaching report"
              : callNotice(selected?.type ?? null)
                ? "Call feedback"
                : "Workspace update"}
          </DialogTitle>
          <DialogDescription>{selected ? formatWhen(selected.created_at) : ""}</DialogDescription>
          <p>{selected?.message ?? "Workspace notification"}</p>
          {selected?.type === "coaching_report" && (
            <Link
              className="figma-button page30-primary"
              to="/app/reports"
              onClick={() => setOpenId(null)}
            >
              Open reports
            </Link>
          )}
          {callNotice(selected?.type ?? null) && (
            <Link
              className="figma-button page30-primary"
              to="/app/crm/calls"
              onClick={() => setOpenId(null)}
            >
              Open calls
            </Link>
          )}
          {selected && !selected.read && (
            <button className="figma-button" disabled={busy} onClick={() => void mark(selected.id)}>
              Mark read
            </button>
          )}
        </DialogContent>
      </Dialog>
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
                <button
                  type="button"
                  className="page30-source-link text-left"
                  onClick={() => setOpenId(r.id)}
                >
                  {r.message ?? "Workspace notification"}
                </button>
                <p className="mt-2 text-xs text-by-text-secondary">{formatWhen(r.created_at)}</p>
                {r.type === "coaching_report" && (
                  <Link className="page30-source-link mt-2" to="/app/reports">
                    Open reports
                  </Link>
                )}
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
        <p className="figma-empty">
          {filter === "reports"
            ? "No report notifications."
            : filter === "unread"
              ? "No unread notifications."
              : filter === "calls"
                ? "No call notifications."
                : "No notifications."}
        </p>
      )}
      <div className="mt-6">
        <Link className="figma-button" to="/app/settings" search={{ tab: "notifications" }}>
          Notification preferences
        </Link>
      </div>
      <p className="mt-3 text-xs text-by-text-secondary">
        Shows the latest 100 notifications available to your account. Behavioral alert categories
        are shown when the corresponding saved events exist.
      </p>
    </section>
  );
}
