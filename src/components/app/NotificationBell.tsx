/**
 * NotificationBell — topbar bell wired to the notifications table. Shows an
 * unread count badge and a dropdown feed; live via a realtime subscription on
 * the user's notifications. Created by the CRM event triggers (new lead, deal
 * won, appointment booked, inbound message).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Notif = {
  id: string;
  type: string;
  message: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_LINK: Record<string, string> = {
  new_lead: "/app/bylda/crm",
  deal_won: "/app/bylda/crm",
  appointment_booked: "/app/crm/calendar",
  message_received: "/app/crm/conversations",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, message, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAll() {
    if (!user || unread === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
            <span className="text-sm font-semibold text-[var(--foreground)]">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-[var(--muted-foreground)]" />
                <p className="text-xs text-[var(--muted-foreground)]">You're all caught up.</p>
              </div>
            ) : (
              items.map((n) => {
                const to = TYPE_LINK[n.type];
                const inner = (
                  <div className="flex items-start gap-2.5">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                    )}
                    <div className={`min-w-0 flex-1 ${n.read ? "pl-[18px]" : ""}`}>
                      <p
                        className={`text-sm ${n.read ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}
                      >
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          void markOne(n.id);
                        }}
                        title="Mark read"
                        className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
                return to ? (
                  <Link
                    key={n.id}
                    to={to}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read) void markOne(n.id);
                    }}
                    className="block border-b border-[var(--border)] px-4 py-3 last:border-b-0 hover:bg-[var(--surface-2)]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={n.id}
                    className="border-b border-[var(--border)] px-4 py-3 last:border-b-0"
                  >
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
