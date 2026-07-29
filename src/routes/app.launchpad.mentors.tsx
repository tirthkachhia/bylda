/**
 * AI MENTORS — /app/launchpad/mentors
 *
 * Multi-persona advisory system. Roster of five AI mentors (Strategist,
 * Operator, Growth Hacker, Builder, Closer); selecting one opens a streaming
 * chat backed by the `mentor-chat` edge function, which injects the org's
 * business context and persists the transcript to mentor_agent_sessions.
 * The Insights tab reads mentor_insights for the org.
 *
 * Plan gate: mentor access requires plan_tier 149 / 299 (master build spec).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Send, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeStream } from "@/lib/invokeEdge";

export const Route = createFileRoute("/app/launchpad/mentors")({ component: MentorsPage });

// The six curriculum mentors — the same roster that owns the founder's
// lessons (src/lib/mentors.ts). agent_id matches mentor-chat personas.
import { MENTOR_ROSTER } from "@/lib/mentors";

type AgentId = string;

type Mentor = {
  id: AgentId;
  name: string;
  title: string;
  persona: string;
  stages: string[];
  quickPrompts: string[];
};

const MENTORS: Mentor[] = MENTOR_ROSTER.map((m) => ({
  id: m.id,
  name: m.name,
  title: `${m.domain} Mentor`,
  persona: m.voice,
  stages: m.stages,
  quickPrompts: m.prompts,
}));

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .replace(/^The /, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type ChatMessage = { role: "user" | "assistant"; content: string; pending?: boolean };

type Insight = {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  detail: string;
  priority: string;
  read: boolean;
  created_at: string;
};

function MentorsPage() {
  const { user, currentOrgId } = useAuth();
  const [tab, setTab] = useState<"mentors" | "insights">("mentors");
  const [selected, setSelected] = useState<Mentor | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Mentors require the Operate/Scale tiers (master build: plan_tier 149/299).
  const locked = plan !== null && ["starter", "launch"].includes(plan);

  // Resolve the org's plan for the gate (subscriptions.plan is the canonical source).
  useEffect(() => {
    if (!currentOrgId) return;
    let active = true;
    void supabase
      .from("subscriptions")
      .select("plan")
      .eq("organization_id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPlan((data?.plan as string) ?? "starter");
      });
    return () => {
      active = false;
    };
  }, [currentOrgId]);

  // Load insights for the org.
  useEffect(() => {
    if (!currentOrgId) return;
    let active = true;
    void supabase
      .from("mentor_insights")
      .select("id, agent_id, type, title, detail, priority, read, created_at")
      .eq("org_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active) setInsights((data as Insight[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [currentOrgId]);

  const unreadCount = useMemo(() => insights.filter((i) => !i.read).length, [insights]);

  async function markRead(id: string) {
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from("mentor_insights").update({ read: true }).eq("id", id);
  }

  return (
    <div className="min-h-full bg-[--background] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--foreground]">
            AI Mentors
          </h1>
          <p className="mt-1 text-sm text-[--muted-foreground]">
            A panel of specialist advisors that know your business context.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-[--border]">
          <TabButton active={tab === "mentors"} onClick={() => setTab("mentors")}>
            Mentors
          </TabButton>
          <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
            Insights
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-[--accent] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </TabButton>
        </div>

        {tab === "mentors" ? (
          selected ? (
            <MentorChat
              mentor={selected}
              orgId={currentOrgId ?? null}
              onBack={() => setSelected(null)}
            />
          ) : (
            <MentorRoster locked={locked} onSelect={setSelected} />
          )
        ) : (
          <InsightsFeed
            insights={insights}
            onMarkRead={markRead}
            onAsk={(agentId) => {
              const m = MENTORS.find((x) => x.id === agentId);
              if (m) {
                setSelected(m);
                setTab("mentors");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-[--accent] text-[--accent]"
          : "border-b-2 border-transparent text-[--muted-foreground] hover:text-[--foreground]"
      }`}
    >
      {children}
    </button>
  );
}

function MentorAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg" ? "w-11 h-11 text-sm" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColor(name)} ${dim}`}
    >
      {initials(name)}
    </div>
  );
}

function MentorRoster({ locked, onSelect }: { locked: boolean; onSelect: (m: Mentor) => void }) {
  return (
    <div>
      {locked && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-[--border] bg-[--primary-soft] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-[--accent]" />
            <div>
              <p className="text-sm font-semibold text-[--foreground]">
                Mentors are a Growth feature
              </p>
              <p className="text-xs text-[--muted-foreground]">
                Upgrade to unlock the full advisory panel with your business context.
              </p>
            </div>
          </div>
          <Link
            to="/app/billing"
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--primary-hover]"
          >
            Upgrade
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MENTORS.map((m) => (
          <button
            key={m.id}
            onClick={() => !locked && onSelect(m)}
            disabled={locked}
            className={`group flex flex-col items-start gap-3 rounded-2xl border border-[--border] bg-[--surface] p-5 text-left shadow-sm transition-all duration-150 ${
              locked
                ? "cursor-not-allowed opacity-60"
                : "hover:border-[--border-strong] hover:shadow-md"
            }`}
          >
            <div className="flex w-full items-center gap-3">
              <MentorAvatar name={m.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[--foreground]">{m.name}</p>
                <p className="truncate text-xs text-[--text-faint]">{m.title}</p>
              </div>
              {locked && <Lock className="ml-auto h-4 w-4 text-[--text-faint]" />}
            </div>
            <p className="text-sm leading-relaxed text-[--muted-foreground]">{m.persona}</p>
            <div className="flex flex-wrap gap-1.5">
              {m.stages.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[--primary-soft] px-2.5 py-0.5 text-xs font-semibold text-[--accent]"
                >
                  {s}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MentorChat({
  mentor,
  orgId,
  onBack,
}: {
  mentor: Mentor;
  orgId: string | null;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load persisted transcript for this mentor.
  useEffect(() => {
    if (!orgId) {
      setLoadingHistory(false);
      return;
    }
    let active = true;
    void supabase
      .from("mentor_agent_sessions")
      .select("messages")
      .eq("org_id", orgId)
      .eq("agent_id", mentor.id)
      .eq("session_key", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const msgs = Array.isArray(data?.messages) ? (data!.messages as ChatMessage[]) : [];
        setMessages(msgs);
        setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [orgId, mentor.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);

    try {
      const resp = await invokeEdgeStream("mentor-chat", {
        agent_id: mentor.id,
        message,
        org_id: orgId,
        session_key: "default",
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              acc += parsed.text;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: acc };
                return next;
              });
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
      if (!acc) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "I couldn't generate a response just now. Try again in a moment.",
          };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong reaching your mentor. Please try again.",
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[--border] bg-[--surface] shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[--border] px-5 py-3.5">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-[--text-faint] hover:bg-[--surface-2] hover:text-[--foreground]"
          aria-label="Back to mentors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <MentorAvatar name={mentor.name} size="md" />
        <div>
          <p className="text-sm font-semibold text-[--foreground]">{mentor.name}</p>
          <p className="text-xs text-[--text-faint]">{mentor.title}</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-[--text-faint]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[--success]" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {loadingHistory ? (
          <div className="space-y-3">
            <div className="h-16 w-2/3 animate-pulse rounded-xl bg-[--surface-2]" />
            <div className="ml-auto h-12 w-1/2 animate-pulse rounded-xl bg-[--surface-2]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <MentorAvatar name={mentor.name} size="lg" />
            <p className="mt-3 text-sm font-semibold text-[--foreground]">{mentor.name} is ready</p>
            <p className="mt-1 max-w-xs text-xs text-[--text-faint]">
              {mentor.persona} Ask anything, or start with a prompt below.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && <MentorAvatar name={mentor.name} size="sm" />}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[--accent] text-white"
                    : "border border-[--border] bg-[--surface-2] text-[--foreground]"
                }`}
              >
                {m.content || (m.pending ? <TypingDots /> : null)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && !loadingHistory && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {mentor.quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => void send(p)}
              className="rounded-full border border-[--border] px-3 py-1.5 text-xs font-medium text-[--muted-foreground] transition-colors hover:border-[--border-strong] hover:text-[--foreground]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[--border] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Ask ${mentor.name}…`}
            className="max-h-32 flex-1 resize-none rounded-xl border border-[--border] bg-[--surface] px-4 py-3 text-sm text-[--foreground] placeholder:text-[--text-faint] focus:border-[--focus-ring] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          <button
            onClick={() => void send(input)}
            disabled={!input.trim() || streaming}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[--accent] text-white shadow-[0_2px_8px_var(--accent-glow)] transition-colors hover:bg-[--primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[--text-faint] [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[--text-faint] [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[--text-faint] [animation-delay:300ms]" />
    </span>
  );
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-[--destructive] border-[color-mix(in_oklab,var(--destructive)_30%,transparent)]",
  medium:
    "bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] text-[--warning] border-[color-mix(in_oklab,var(--warning)_30%,transparent)]",
  low: "bg-[color-mix(in_oklab,var(--info)_12%,transparent)] text-[--info] border-[color-mix(in_oklab,var(--info)_30%,transparent)]",
};

function InsightsFeed({
  insights,
  onMarkRead,
  onAsk,
}: {
  insights: Insight[];
  onMarkRead: (id: string) => void;
  onAsk: (agentId: AgentId) => void;
}) {
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--surface] px-8 py-16 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-[--accent]" />
        <p className="mb-1 text-sm font-semibold text-[--foreground]">No insights yet</p>
        <p className="mb-4 max-w-xs text-xs text-[--text-faint]">
          Your mentors will surface proactive insights here as your business context grows.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((ins) => {
        const mentor = MENTORS.find((m) => m.id === ins.agent_id);
        const name = mentor?.name ?? "Mentor";
        return (
          <div
            key={ins.id}
            className={`flex gap-3 rounded-2xl border border-[--border] p-5 shadow-sm ${
              ins.read ? "bg-[--surface-2]" : "bg-[--surface]"
            }`}
          >
            <MentorAvatar name={name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[--foreground]">{ins.title}</p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    PRIORITY_BADGE[ins.priority] ?? PRIORITY_BADGE.low
                  }`}
                >
                  {ins.priority}
                </span>
                {!ins.read && <span className="h-2 w-2 rounded-full bg-[--accent]" />}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[--muted-foreground]">{ins.detail}</p>
              <div className="mt-3 flex items-center gap-3">
                {mentor && (
                  <button
                    onClick={() => onAsk(mentor.id)}
                    className="text-xs font-semibold text-[--accent] hover:underline"
                  >
                    Ask {name} →
                  </button>
                )}
                {!ins.read && (
                  <button
                    onClick={() => onMarkRead(ins.id)}
                    className="text-xs font-medium text-[--text-faint] hover:text-[--muted-foreground]"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
