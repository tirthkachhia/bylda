/**
 * UNIFIED INBOX — /app/crm/conversations
 *
 * All inbound/outbound messages across channels (conversations table, Phase 1).
 * Split layout: thread list (grouped by contact) + message view. "Bylda Draft"
 * calls the conversation-ai edge function (Phase 2) to draft a reply.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Send, Mail, MessageSquare, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { CustomersNav } from "@/components/app/CustomersNav";

export const Route = createFileRoute("/app/crm/conversations")({ component: ConversationsPage });

type Message = {
  id: string;
  contact_id: string | null;
  channel: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  status: string;
  created_at: string;
};

type Contact = { id: string; first_name: string | null; last_name: string | null };

type Thread = {
  key: string;
  contactId: string | null;
  name: string;
  channel: string;
  last: Message;
  unread: boolean;
  messages: Message[];
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  webchat: MessageSquare,
  whatsapp: MessageSquare,
  instagram: MessageSquare,
  facebook: MessageSquare,
};

function ConversationsPage() {
  const { currentOrgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "email" | "sms">("all");
  const [showConnect, setShowConnect] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data: msgs } = await supabase
      .from("conversations")
      .select("id, contact_id, channel, direction, subject, body, status, created_at")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: true })
      .limit(1000);
    const list = (msgs as Message[]) ?? [];
    setMessages(list);

    const ids = [...new Set(list.map((m) => m.contact_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: cts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .in("id", ids);
      const map: Record<string, Contact> = {};
      for (const c of (cts as Contact[]) ?? []) map[c.id] = c;
      setContacts(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  // Live updates: reload when a conversation row for this org changes (e.g. an
  // inbound message arrives via receive-message). conversations is in the
  // realtime publication.
  useEffect(() => {
    if (!currentOrgId) return;
    const channel = supabase
      .channel(`conversations:${currentOrgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${currentOrgId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Message[]>();
    for (const m of messages) {
      const key = m.contact_id ?? `solo:${m.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const out: Thread[] = [];
    for (const [key, msgs] of map) {
      const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = sorted[sorted.length - 1];
      const c = last.contact_id ? contacts[last.contact_id] : null;
      const name = c
        ? [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contact"
        : "Unknown";
      const unread = sorted.some((m) => m.direction === "inbound" && m.status === "open");
      out.push({
        key,
        contactId: last.contact_id,
        name,
        channel: last.channel,
        last,
        unread,
        messages: sorted,
      });
    }
    return out.sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [messages, contacts]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filter === "unread") return t.unread;
      if (filter === "email") return t.channel === "email";
      if (filter === "sms") return t.channel === "sms";
      return true;
    });
  }, [threads, filter]);

  const active = useMemo(
    () => threads.find((t) => t.key === activeKey) ?? null,
    [threads, activeKey],
  );

  return (
    <div className="flex h-[calc(100vh-72px)] min-h-[560px] flex-col bg-[--bg-page]">
      <div className="border-b border-[--border] px-4 py-2">
        <CustomersNav />
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Thread list */}
        <aside className="flex w-full max-w-[300px] flex-col border-r border-[--border] bg-[--bg-surface]">
          <div className="border-b border-[--border] p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <h1 className="text-[15px] font-semibold text-[--text-primary]">Inbox</h1>
              <button
                onClick={() => setShowConnect((s) => !s)}
                className="text-xs font-semibold text-[--accent] hover:underline"
              >
                Connect
              </button>
            </div>
            {showConnect && <ConnectChannelPanel orgId={currentOrgId ?? null} />}
            <div className="flex gap-1">
              {(["all", "unread", "email", "sms"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    filter === f
                      ? "bg-[--accent-light] text-[--accent]"
                      : "text-[--text-muted] hover:text-[--text-primary]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[--bg-surface-2]" />
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Inbox className="mb-2 h-7 w-7 text-[--text-muted]" />
                <p className="text-sm font-semibold text-[--text-primary]">No conversations</p>
                <p className="mt-1 text-xs text-[--text-muted]">
                  Inbound messages across channels land here.
                </p>
              </div>
            ) : (
              filteredThreads.map((t) => {
                const Icon = CHANNEL_ICON[t.channel] ?? MessageSquare;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveKey(t.key)}
                    className={`flex w-full items-start gap-2.5 border-b border-[--border] px-3 py-3 text-left transition-colors hover:bg-[--bg-surface-2] ${
                      activeKey === t.key ? "bg-[--bg-surface-2]" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[--accent-light] text-xs font-semibold text-[--accent]">
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[--text-primary]">
                          {t.name}
                        </span>
                        <Icon className="h-3 w-3 shrink-0 text-[--text-muted]" />
                        {t.unread && (
                          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[--accent]" />
                        )}
                      </div>
                      <p className="truncate text-xs text-[--text-muted]">{t.last.body}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread view */}
        <section className="flex flex-1 flex-col">
          {active ? (
            <ThreadView thread={active} orgId={currentOrgId ?? null} onSent={load} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <MessageSquare className="mb-3 h-9 w-9 text-[--text-muted]" />
              <p className="text-sm font-semibold text-[--text-primary]">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-[--text-muted]">
                Pick a thread on the left to read it and reply with help from Bylda.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadView({
  thread,
  orgId,
  onSent,
}: {
  thread: Thread;
  orgId: string | null;
  onSent: () => void;
}) {
  const [reply, setReply] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.key, thread.messages.length]);

  const lastInbound = useMemo(
    () => [...thread.messages].reverse().find((m) => m.direction === "inbound"),
    [thread.messages],
  );

  async function byldaDraft() {
    if (!lastInbound) return;
    setDrafting(true);
    try {
      const res = await invokeEdge<{ draft: string }>("conversation-ai", {
        conversation_id: lastInbound.id,
        save: false,
      });
      if (res.draft) setReply(res.draft);
    } catch {
      /* surfaced via disabled state; keep silent */
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!reply.trim() || !orgId || sending) return;
    setSending(true);
    await supabase.from("conversations").insert({
      organization_id: orgId,
      contact_id: thread.contactId,
      channel: thread.channel,
      direction: "outbound",
      body: reply.trim(),
      status: "replied",
    });
    setReply("");
    setSending(false);
    onSent();
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[--border] bg-[--bg-surface] px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[--accent-light] text-sm font-semibold text-[--accent]">
          {thread.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-[--text-primary]">{thread.name}</p>
          <p className="text-xs text-[--text-muted] capitalize">{thread.channel}</p>
        </div>
        {thread.contactId && (
          <Link
            to="/app/contacts"
            className="ml-auto text-xs font-semibold text-[--accent] hover:underline"
          >
            View Contact →
          </Link>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[--bg-page] px-5 py-5">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                m.direction === "outbound"
                  ? "bg-[--accent] text-white"
                  : "border border-[--border] bg-[--bg-surface] text-[--text-primary]"
              }`}
            >
              {m.subject && <p className="mb-1 text-xs font-semibold opacity-80">{m.subject}</p>}
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[--border] bg-[--bg-surface] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={byldaDraft}
            disabled={drafting || !lastInbound}
            className="flex items-center gap-1.5 rounded-lg border border-[--border] px-3 py-1.5 text-xs font-semibold text-[--accent] transition-colors hover:border-[--border-strong] disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {drafting ? "Drafting…" : "Bylda Draft"}
          </button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder={`Reply via ${thread.channel}…`}
            className="max-h-40 flex-1 resize-none rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          <button
            onClick={send}
            disabled={!reply.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[--accent] text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// Connect-a-channel panel: shows the org's inbound webhook URL (from
// get-inbound-url) for the founder to paste into their email/SMS provider so
// inbound messages flow into this inbox via receive-message.
function ConnectChannelPanel({ orgId }: { orgId: string | null }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; url: string }
    | { status: "unconfigured" }
    | { status: "error" }
  >({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    void invokeEdge<{ configured: boolean; url?: string }>("get-inbound-url", { org_id: orgId })
      .then((r) => {
        if (!active) return;
        setState(
          r.configured && r.url ? { status: "ready", url: r.url } : { status: "unconfigured" },
        );
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [orgId]);

  return (
    <div className="mb-2 rounded-xl border border-[--border] bg-[--bg-surface-2] p-3 text-xs">
      <p className="mb-1.5 font-semibold text-[--text-primary]">Inbound webhook</p>
      {state.status === "loading" && (
        <div className="h-8 animate-pulse rounded-lg bg-[--bg-surface]" />
      )}
      {state.status === "unconfigured" && (
        <p className="text-[--text-muted]">
          Inbound messaging isn’t configured yet. Add an INBOUND_WEBHOOK_SECRET in project settings
          to enable it.
        </p>
      )}
      {state.status === "error" && (
        <p className="text-[--danger]">Couldn’t load your webhook URL.</p>
      )}
      {state.status === "ready" && (
        <>
          <p className="mb-1.5 text-[--text-muted]">
            POST inbound emails/SMS here to land them in this inbox:
          </p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 truncate rounded-lg bg-[--bg-surface] px-2 py-1.5 font-mono text-[10px] text-[--text-secondary]">
              {state.url}
            </code>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(state.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg border border-[--border] px-2 py-1.5 font-medium text-[--text-secondary] hover:text-[--text-primary]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
