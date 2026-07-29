import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X, Send, RotateCcw, ArrowUpRight, Zap, ChevronDown, Check } from "lucide-react";
import { invokeEdge, invokeEdgeStream } from "@/lib/invokeEdge";
import { useAuth } from "@/lib/auth";
import { buildAgentContext } from "@/lib/agent-context";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  actionId?: string;
};

type ByldaActionStatus = "pending" | "working" | "executed" | "failed" | "skipped";

type ByldaProposedAction = {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  plain_english: string;
  status: ByldaActionStatus;
  error?: string;
};

// Page-context greetings Bylda sends on first open
const PAGE_GREETINGS: Record<string, string> = {
  "/app/mission-control":
    "Hey — looking at your command center. What stage are you focused on today, and what's the highest-leverage thing I can help you move forward?",
  "/app/launchpad":
    "You're in Bylda — 18 AI-powered tools to take your idea from concept to traction. Which phase are you in: validating, planning, or acquiring customers?",
  "/app/contacts":
    "Your CRM. A clean contact list is the backbone of revenue. Need help with outreach strategy, lead scoring, or following up on cold contacts?",
  "/app/memory":
    "Company Memory is where your business knowledge lives. Connect your docs, URLs, or Notion workspace and I'll use it to give you sharper advice.",
  "/app/automations":
    "Automations run your business while you sleep. What do you want to automate first — lead follow-up, appointment setting, or CRM updates?",
  "/app/integrations":
    "Integrations connect your stack. The more data sources you connect to Memory, the smarter my answers get. What tools are you using?",
  "/app/settings":
    "Settings — if you need to update your workspace, plan, or profile, I can help you figure out what's worth changing.",
  "/app/billing":
    "Billing. If you're thinking about upgrading, tell me what you're trying to unlock and I'll tell you if it's worth it for your stage.",
};

const DEFAULT_GREETING =
  "What are you working on? I have context on your workspace and can give you a specific recommendation.";

const QUICK_PROMPTS = [
  "What should I do next?",
  "What's my highest-leverage move?",
  "How do I get my first 10 customers?",
  "Analyse my progress so far",
];

function renderText(text: string): React.ReactNode {
  return text.split("\n").map((line, j, arr) => {
    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    const content = isBullet ? line.slice(2) : line;
    const boldParts = content.split(/(\*\*[^*]+\*\*)/g);
    const rendered = boldParts.map((bp, k) => {
      const bold = bp.match(/\*\*([^*]+)\*\*/);
      return bold ? <strong key={k}>{bold[1]}</strong> : <span key={k}>{bp}</span>;
    });
    return (
      <span key={j}>
        {isBullet && (
          <span
            style={{ display: "inline-block", width: 12, color: "var(--primary)", opacity: 0.8 }}
          >
            ›
          </span>
        )}
        {rendered}
        {j < arr.length - 1 && <br />}
      </span>
    );
  });
}

function renderContent(text: string, onNavigate: (path: string) => void): React.ReactNode[] {
  const ALL_RE = /(\[→\s*TOOL:\s*([^|]+)\|\s*([^\]]+)\])|(\*\*\[(.+?)\]\((.+?)\)\*\*)/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ALL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        <span key={`t-${match.index}`}>{renderText(text.slice(lastIndex, match.index))}</span>,
      );
    }
    if (match[1]) {
      const toolKey = match[2].trim();
      const label = match[3].trim();
      segments.push(
        <button
          key={`chip-${match.index}`}
          onClick={() => onNavigate(`/app/launchpad/${toolKey}`)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 9px",
            borderRadius: 20,
            border: "1px solid rgba(255,107,26,0.4)",
            background: "rgba(255,107,26,0.08)",
            color: "var(--primary)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            margin: "1px 2px",
            transition: "all 0.1s",
            verticalAlign: "middle",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,107,26,0.14)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,107,26,0.08)";
          }}
        >
          <Zap style={{ width: 9, height: 9 }} />
          {label}
        </button>,
      );
    } else if (match[4]) {
      const label = match[5];
      const path = match[6];
      segments.push(
        <button
          key={`link-${match.index}`}
          onClick={() => onNavigate(path)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontWeight: 600,
            color: "var(--primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
            padding: 0,
            verticalAlign: "middle",
          }}
        >
          {label}
          <ArrowUpRight style={{ width: 10, height: 10 }} />
        </button>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(<span key="tail">{renderText(text.slice(lastIndex))}</span>);
  }
  return segments;
}

function renderActionCard(
  action: ByldaProposedAction,
  onDecision: (actionId: string, decision: "approve" | "skip") => void,
): React.ReactNode {
  const isPending = action.status === "pending";
  const isWorking = action.status === "working";
  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,107,26,0.35)",
        background: "rgba(255,107,26,0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 8 }}>
        {action.plain_english}
      </div>
      {isPending || isWorking ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={isWorking}
            onClick={() => onDecision(action.id, "approve")}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isWorking ? "default" : "pointer",
              opacity: isWorking ? 0.6 : 1,
              fontFamily: "inherit",
            }}
          >
            {isWorking ? "Executing…" : "Yes, do it"}
          </button>
          <button
            disabled={isWorking}
            onClick={() => onDecision(action.id, "skip")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted-foreground)",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isWorking ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Skip
          </button>
        </div>
      ) : action.status === "executed" ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            color: "#22c55e",
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          <Check style={{ width: 12, height: 12 }} /> Done
        </div>
      ) : action.status === "skipped" ? (
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Skipped</div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#ef4444" }}>
          Failed{action.error ? `: ${action.error}` : ""}
        </div>
      )}
    </div>
  );
}

interface IntelligenceRailProps {
  open: boolean;
  onClose: () => void;
}

export function IntelligenceRail({ open, onClose }: IntelligenceRailProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Record<string, ByldaProposedAction>>({});
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [greeted, setGreeted] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Load workspace context once
  useEffect(() => {
    if (!user?.id) return;
    buildAgentContext(user.id).then((ctx) => setContext(ctx as unknown as Record<string, unknown>));
  }, [user?.id]);

  // Send Bylda's opening greeting when rail first opens
  useEffect(() => {
    if (!open || greeted) return;
    setGreeted(true);
    const greeting =
      Object.entries(PAGE_GREETINGS).find(([p]) => path.startsWith(p))?.[1] ?? DEFAULT_GREETING;
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: greeting,
      },
    ]);
  }, [open, greeted, path]);

  // When page changes while rail is open, add a context note
  const prevPath = useRef(path);
  useEffect(() => {
    if (!open || prevPath.current === path) return;
    prevPath.current = path;
    const greeting = Object.entries(PAGE_GREETINGS).find(([p]) => path.startsWith(p))?.[1] ?? null;
    if (greeting) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: greeting },
      ]);
    }
  }, [path, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && expanded) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, expanded]);

  // Reset expanded to true whenever opened
  useEffect(() => {
    if (open) setExpanded(true);
  }, [open]);

  const handleNavigate = useCallback(
    (navPath: string) => {
      navigate({ to: navPath as never });
    },
    [navigate],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const history = [...messages, userMsg];
    const ctxAny = context as Record<string, unknown>;

    try {
      const abort = new AbortController();
      abortRef.current = abort;

      const resp = await invokeEdgeStream(
        "bylda-chat",
        {
          message: trimmed,
          conversation_history: history
            .slice(0, -1) // exclude the message we just added
            .map((m) => ({ role: m.role, content: m.content })),
          session_id: sessionIdRef.current,
          org_id: (ctxAny.organization_id as string) || undefined,
        },
        { signal: abort.signal, timeoutMs: 45_000 },
      );

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed.text === "string" && parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: accumulated, pending: false } : m,
                ),
              );
            }
            if (parsed.action) {
              const proposed = parsed.action as {
                id: string;
                action_type: string;
                payload: Record<string, unknown>;
                plain_english: string;
              };
              setActions((prev) => ({
                ...prev,
                [proposed.id]: { ...proposed, status: "pending" },
              }));
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, actionId: proposed.id } : m)),
              );
            }
          } catch {
            // skip non-JSON SSE lines
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accumulated || "No response generated.", pending: false }
            : m,
        ),
      );
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        const errText = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: `Error: ${errText}`, pending: false } : m,
          ),
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleActionDecision = async (actionId: string, decision: "approve" | "skip") => {
    setActions((prev) => ({
      ...prev,
      [actionId]: { ...prev[actionId], status: decision === "skip" ? "skipped" : "working" },
    }));
    if (decision === "skip") {
      await invokeEdge("bylda-action", { action_id: actionId, decision: "skip" }).catch(() => {});
      return;
    }
    try {
      await invokeEdge("bylda-action", { action_id: actionId, decision: "approve" });
      setActions((prev) => ({ ...prev, [actionId]: { ...prev[actionId], status: "executed" } }));
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [actionId]: {
          ...prev[actionId],
          status: "failed",
          error: err instanceof Error ? err.message : "Action failed",
        },
      }));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setInput("");
    setGreeted(false);
    setMessages([]);
    setActions({});
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}

      {/* Bottom center drawer */}
      <div
        className={cn("fixed bottom-0 left-0 right-0 z-50 flex justify-center")}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 700,
            pointerEvents: "all",
            background: "var(--background)",
            borderTop: "1px solid var(--border)",
            borderLeft: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            borderRight: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -8px 48px rgba(0,0,0,0.35), 0 -1px 0 rgba(255,107,26,0.12)",
            display: "flex",
            flexDirection: "column",
            height: expanded ? "min(55vh, 520px)" : "52px",
            transition: "height 0.28s cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
          }}
        >
          {/* Drag handle pill */}
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "color-mix(in oklab, var(--border) 150%, transparent)",
              margin: "10px auto 0",
              flexShrink: 0,
              cursor: "pointer",
            }}
            onClick={() => setExpanded((e) => !e)}
          />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-2 shrink-0"
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded((e) => !e)}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, #ff8c42 100%)",
                  boxShadow: "0 0 12px rgba(255,107,26,0.45)",
                }}
              >
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>
                Bylda AI
              </span>
              {streaming && (
                <span
                  className="text-[9px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--primary)" }}
                >
                  thinking…
                </span>
              )}
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {messages.length > 1 && (
                <button
                  onClick={resetChat}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                    (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                  }}
                  title="New conversation"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((x) => !x);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                }}
              >
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform duration-200"
                  style={{ transform: expanded ? "rotate(0deg)" : "rotate(180deg)" }}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-5 py-2 space-y-3"
            style={{
              opacity: expanded ? 1 : 0,
              transition: "opacity 0.12s",
              pointerEvents: expanded ? "all" : "none",
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-2 items-start", msg.role === "user" && "flex-row-reverse")}
              >
                {msg.role === "assistant" && (
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: "linear-gradient(135deg, var(--primary) 0%, #ff8c42 100%)",
                    }}
                  >
                    <Zap className="h-3 w-3 text-white" />
                  </div>
                )}
                <div
                  className="px-3 py-2 text-[12.5px] leading-relaxed"
                  style={{
                    maxWidth: "calc(100% - 36px)",
                    background: msg.role === "user" ? "var(--primary)" : "var(--surface-2)",
                    color: msg.role === "user" ? "#fff" : "var(--foreground)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  }}
                >
                  {msg.pending && !msg.content ? (
                    <span className="flex gap-1 items-center" style={{ color: "var(--primary)" }}>
                      <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>●</span>
                      <span style={{ animation: "pulse 1.2s ease-in-out 0.2s infinite" }}>●</span>
                      <span style={{ animation: "pulse 1.2s ease-in-out 0.4s infinite" }}>●</span>
                    </span>
                  ) : msg.role === "assistant" ? (
                    renderContent(msg.content, handleNavigate)
                  ) : (
                    msg.content
                  )}
                  {msg.actionId &&
                    actions[msg.actionId] &&
                    renderActionCard(actions[msg.actionId], handleActionDecision)}
                </div>
              </div>
            ))}

            {/* Quick prompts when chat is fresh */}
            {messages.length <= 1 && !streaming && (
              <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="rounded-full px-3 py-1.5 text-[11.5px] transition-colors"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,107,26,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="px-5 pb-4 shrink-0"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
              opacity: expanded ? 1 : 0,
              transition: "opacity 0.12s",
              pointerEvents: expanded ? "all" : "none",
            }}
          >
            <div
              className="flex items-end gap-2 rounded-2xl px-3 py-2"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
              onFocusCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,107,26,0.4)";
              }}
              onBlurCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Bylda anything about your business…"
                rows={1}
                disabled={streaming}
                className="flex-1 bg-transparent text-[13px] outline-none resize-none"
                style={{
                  color: "var(--foreground)",
                  maxHeight: 80,
                  overflowY: "auto",
                  lineHeight: 1.5,
                  caretColor: "var(--primary)",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all"
                style={{
                  background:
                    input.trim() && !streaming
                      ? "linear-gradient(135deg, var(--primary), #ff8c42)"
                      : "transparent",
                  color: input.trim() && !streaming ? "#fff" : "var(--muted-foreground)",
                  cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
                  boxShadow: input.trim() && !streaming ? "0 2px 8px rgba(255,107,26,0.4)" : "none",
                }}
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
            <p
              className="mt-1.5 text-center text-[10px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Bylda AI · verify critical decisions
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
