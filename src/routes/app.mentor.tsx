/**
 * ASK BYLDA — full-page AI chat
 * Route: /app/mentor
 *
 * A straightforward chat with Bylda, your AI chief of staff. Streams
 * responses from the bylda-chat edge function, with workspace context
 * (idea, stage, recent tool runs) baked into every request and inline
 * action chips / links for jumping straight into a recommended tool.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Send, RotateCcw, ArrowUpRight, Zap } from "lucide-react";
import { invokeEdgeStream } from "@/lib/invokeEdge";
import { useAuth } from "@/lib/auth";
import { buildAgentContext } from "@/lib/agent-context";
import { ByldaAvatar } from "@/components/bylda/ByldaAvatar";
import { useCurriculum } from "@/hooks/use-curriculum";
import { mentorById } from "@/lib/mentors";
import { MentorAvatar } from "@/components/app/MentorAvatar";

export const Route = createFileRoute("/app/mentor")({ component: MentorPage });

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

function buildQuickPrompts(idea: string | null, stage: string, toolRunCount: number): string[] {
  const prompts: string[] = [];
  if (idea) {
    prompts.push(
      `What's the #1 thing I should do today for ${idea.split(" ").slice(0, 4).join(" ")}?`,
    );
  }
  if (stage === "Validate" || toolRunCount < 3) {
    prompts.push("Have I validated this idea enough to move forward?");
    prompts.push("What assumptions am I making that could kill this?");
  } else if (stage === "Plan") {
    prompts.push("What's missing from my go-to-market plan?");
    prompts.push("How do I price this to maximize early conversions?");
  } else {
    prompts.push("How do I get my first 10 customers this week?");
    prompts.push("What should I automate first?");
  }
  prompts.push("What's my highest-leverage move right now?");
  return prompts.slice(0, 5);
}

function renderText(text: string): ReactNode {
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
            style={{ display: "inline-block", width: 14, color: "var(--primary)", opacity: 0.8 }}
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

function renderContent(text: string, onNavigate: (path: string) => void): ReactNode[] {
  const ALL_RE = /(\[→\s*TOOL:\s*([^|]+)\|\s*([^\]]+)\])|(\*\*\[(.+?)\]\((.+?)\)\*\*)/g;
  const segments: ReactNode[] = [];
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
          className="inline-flex items-center gap-1.5 rounded-full transition-colors"
          style={{
            padding: "4px 10px",
            border: "1px solid var(--primary-border)",
            background: "var(--primary-soft)",
            color: "var(--primary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            margin: "2px 3px",
            verticalAlign: "middle",
          }}
        >
          <Zap style={{ width: 10, height: 10 }} />
          {label}
        </button>,
      );
    } else if (match[4]) {
      const label = match[5];
      const path = match[6];
      segments.push(
        <Link
          key={`link-${match.index}`}
          to={path as never}
          className="inline-flex items-center gap-1"
          style={{
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            verticalAlign: "middle",
          }}
        >
          {label}
          <ArrowUpRight style={{ width: 11, height: 11 }} />
        </Link>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(<span key="tail">{renderText(text.slice(lastIndex))}</span>);
  }
  return segments;
}

function MentorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Route the guidance page to whichever mentor owns the active lesson.
  const { activeLesson } = useCurriculum();
  const activeMentor = activeLesson ? mentorById(activeLesson.mentor_id) : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    buildAgentContext(user.id).then((ctx) => setContext(ctx as unknown as Record<string, unknown>));
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ctxAny = context as Record<string, unknown>;
  const profile =
    (ctxAny.profile as { full_name?: string; idea?: string; challenge?: string }) ?? {};
  const currentMissionObj = (ctxAny.current_mission as { title?: string; id?: string }) ?? {};
  const recentRunsRaw =
    (ctxAny.recent_tool_runs as Array<{ tool_key?: string; status?: string }>) ?? [];

  const displayName =
    profile.full_name || (ctxAny.name as string) || user?.email?.split("@")[0] || "Founder";
  const planTier = (ctxAny.plan as string) || "starter";
  const currentIdea = profile.idea?.trim() || null;
  const currentChallenge = profile.challenge?.trim() || null;
  const currentMission = currentMissionObj.title || null;
  const stage = (ctxAny.stage as string) || "Validate";
  const lane = (ctxAny.lane as string) || "Idea";
  const recentRuns = recentRunsRaw.map((r) => ({ toolKey: r.tool_key, status: r.status }));
  const toolRunCount = recentRuns.length;

  const resetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

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

    const updatedHistory = [...messages, userMsg];

    try {
      const abort = new AbortController();
      abortRef.current = abort;

      // With an active lesson, the founder talks to that lesson's mentor —
      // persona, memory, and voice — not a generic assistant.
      const resp = await invokeEdgeStream(
        activeMentor ? "mentor-chat" : "bylda-chat",
        activeMentor
          ? {
              agent_id: activeMentor.id,
              message: trimmed,
              org_id: (ctxAny.organization_id as string) || undefined,
              session_key: "guidance",
            }
          : {
              message: trimmed,
              conversation_history: updatedHistory
                .slice(0, -1)
                .map((m) => ({ role: m.role, content: m.content })),
              user_context: {
                ...(profile.full_name ? { name: profile.full_name } : {}),
                ...(currentIdea ? { idea: currentIdea } : {}),
                ...(currentChallenge ? { challenge: currentChallenge } : {}),
                ...(stage ? { stage } : {}),
                ...(lane ? { lane } : {}),
                ...(planTier ? { plan: planTier } : {}),
                ...(currentMission ? { current_mission: currentMission } : {}),
                ...(toolRunCount > 0 ? { tools_completed: String(toolRunCount) } : {}),
                ...(recentRuns.length > 0
                  ? {
                      recent_tools: recentRuns
                        .map((r) => r.toolKey)
                        .filter(Boolean)
                        .join(", "),
                    }
                  : {}),
              },
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
            // mentor-chat streams {text}; bylda-chat streams raw Anthropic deltas.
            const delta =
              typeof parsed.text === "string"
                ? parsed.text
                : parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta"
                  ? parsed.delta.text
                  : "";
            if (delta) {
              accumulated += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: accumulated, pending: false } : m,
                ),
              );
            }
          } catch {
            // non-JSON SSE line, skip
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
      const errMsg =
        err instanceof Error && err.name === "AbortError"
          ? null
          : `Error: ${err instanceof Error ? err.message : "Unknown"}`.trim();

      setMessages((prev) =>
        prev
          .map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errMsg ?? "", pending: false } : m,
          )
          .filter((m) => m.id !== assistantMsg.id || errMsg),
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const quickPrompts = activeMentor
    ? activeMentor.prompts
    : buildQuickPrompts(currentIdea, stage, toolRunCount);
  const lastTool = recentRuns[0]?.toolKey?.replace(/-/g, " ") || null;

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 160px)", minHeight: 520 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          {activeMentor && <MentorAvatar mentor={activeMentor} size="lg" />}
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                fontWeight: 800,
                color: "var(--foreground)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {activeMentor ? activeMentor.name : "Ask Bylda"}
            </h1>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                color: "var(--muted-foreground)",
              }}
            >
              {activeMentor
                ? `${activeMentor.domain} — your mentor for the current lesson${activeLesson ? `: "${activeLesson.title}"` : ""}.`
                : "Your AI chief of staff — full visibility into your workspace, ready with a plan."}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={resetChat}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg transition-colors shrink-0"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 500,
              padding: "8px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-border)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            New chat
          </button>
        )}
      </div>

      {/* Chat panel */}
      <div
        className="flex flex-1 min-h-0 flex-col rounded-2xl border"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 flex flex-col gap-4">
          {messages.length === 0 ? (
            <EmptyState
              displayName={displayName}
              idea={currentIdea}
              stage={stage}
              toolRunCount={toolRunCount}
              lastTool={lastTool}
              quickPrompts={quickPrompts}
              onSend={sendMessage}
            />
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-3"
                style={{ flexDirection: msg.role === "user" ? "row-reverse" : "row" }}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-0.5">
                    <ByldaAvatar size="sm" mood={msg.pending ? "thinking" : "active"} />
                  </div>
                )}
                <div
                  className="rounded-2xl px-4 py-2.5"
                  style={{
                    maxWidth: "78%",
                    background: msg.role === "user" ? "var(--primary)" : "var(--surface-2)",
                    color: msg.role === "user" ? "var(--primary-foreground)" : "var(--foreground)",
                    border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none",
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    lineHeight: 1.65,
                  }}
                >
                  {msg.pending && !msg.content ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: "var(--primary)" }}
                    >
                      <span style={{ animation: "bylda-pulse 1.4s ease-in-out infinite" }}>●</span>
                      <span style={{ animation: "bylda-pulse 1.4s ease-in-out 0.2s infinite" }}>
                        ●
                      </span>
                      <span style={{ animation: "bylda-pulse 1.4s ease-in-out 0.4s infinite" }}>
                        ●
                      </span>
                    </span>
                  ) : msg.role === "assistant" ? (
                    renderContent(msg.content, (path) => navigate({ to: path as never }))
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 sm:p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div
            className="flex items-end gap-2 rounded-xl"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              background: "var(--surface-offset)",
              transition: "border-color 0.15s",
            }}
            onFocusCapture={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor = "var(--primary-border)")
            }
            onBlurCapture={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")
            }
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Bylda anything… Enter to send, Shift+Enter for newline"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-transparent outline-none"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--foreground)",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex items-center justify-center rounded-lg shrink-0 transition-colors"
              style={{
                width: 34,
                height: 34,
                border: "none",
                background: input.trim() && !streaming ? "var(--primary)" : "var(--surface-2)",
                color:
                  input.trim() && !streaming
                    ? "var(--primary-foreground)"
                    : "var(--muted-foreground)",
                cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
              }}
            >
              <Send style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <p
            className="mt-2 text-center"
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-faint)" }}
          >
            Bylda is AI-generated — always verify critical decisions.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bylda-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function EmptyState({
  displayName,
  idea,
  stage,
  toolRunCount,
  lastTool,
  quickPrompts,
  onSend,
}: {
  displayName: string;
  idea: string | null;
  stage: string;
  toolRunCount: number;
  lastTool: string | null;
  quickPrompts: string[];
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      <ByldaAvatar size="lg" mood="active" />

      <div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--foreground)",
            marginBottom: 6,
          }}
        >
          Good to see you, {displayName}.
        </p>
        {idea ? (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--muted-foreground)",
              lineHeight: 1.7,
            }}
          >
            Building: <span style={{ color: "var(--primary)", fontWeight: 600 }}>{idea}</span>
            <br />
            {toolRunCount > 0
              ? `${toolRunCount} tool${toolRunCount !== 1 ? "s" : ""} completed${lastTool ? ` — last ran ${lastTool}` : ""}.`
              : "No tools run yet — let's get started."}
          </p>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--muted-foreground)",
              lineHeight: 1.6,
            }}
          >
            I have full visibility into your workspace. What's the mission today?
          </p>
        )}
      </div>

      {stage && (
        <span
          className="inline-flex items-center gap-2 rounded-full"
          style={{
            padding: "4px 12px",
            border: "1px solid var(--primary-border)",
            background: "var(--primary-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--primary)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <Sparkles style={{ width: 11, height: 11 }} />
          {stage} stage
        </span>
      )}

      <div className="flex flex-wrap justify-center gap-2" style={{ maxWidth: 520 }}>
        {quickPrompts.map((p) => (
          <button
            key={p}
            onClick={() => onSend(p)}
            className="rounded-full transition-colors"
            style={{
              padding: "7px 14px",
              border: "1px solid var(--border)",
              background: "var(--surface-offset)",
              color: "var(--foreground)",
              fontFamily: "var(--font-body)",
              fontSize: "12.5px",
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--primary-soft)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--surface-offset)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
