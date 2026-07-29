// Bylda AI Chat — JARVIS-style full-screen overlay for Bylda Launchpad.
// Streams responses from the bylda-chat edge function with action chip support.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { invokeEdge, invokeEdgeStream } from "@/lib/invokeEdge";
import { useAuth } from "@/lib/auth";
import { buildAgentContext } from "@/lib/agent-context";
import { Sparkles, Send, X, RotateCcw, ArrowUpRight, Zap, Activity, Check } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

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

const QUICK_PROMPTS_BASE = [
  "What should I work on next?",
  "What's my highest-leverage move right now?",
  "How do I get my first 10 customers?",
  "What's the biggest risk to my idea?",
  "Build me a 30-day action plan",
];

function buildQuickPrompts(idea: string | null, stage: string, toolRunCount: number): string[] {
  const prompts: string[] = [];
  if (idea)
    prompts.push(
      `What's the #1 thing I should do today for ${idea.split(" ").slice(0, 4).join(" ")}?`,
    );
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

const BOOT_LINES = [
  "BYLDA CORE INITIALIZING...",
  "SCANNING WORKSPACE DATA...",
  "LOADING AI MODULES...",
  "ALL SYSTEMS ONLINE",
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
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            border: "1px solid rgba(249,115,22,0.5)",
            background: "rgba(249,115,22,0.1)",
            color: "#F97316",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            margin: "2px 3px",
            transition: "all 0.12s",
            verticalAlign: "middle",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.2)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.5)";
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontWeight: 600,
            color: "#F97316",
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
    segments.push(<span key={`tail`}>{renderText(text.slice(lastIndex))}</span>);
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
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(249,115,22,0.35)",
        background: "rgba(249,115,22,0.06)",
      }}
    >
      <div style={{ fontSize: 12.5, color: "var(--foreground)", marginBottom: 8 }}>
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
              background: "#F97316",
              color: "#fff",
              fontSize: 12,
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
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "var(--muted-foreground)",
              fontSize: 12,
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
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Check style={{ width: 13, height: 13 }} /> Done
        </div>
      ) : action.status === "skipped" ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Skipped</div>
      ) : (
        <div style={{ fontSize: 12, color: "#ef4444" }}>
          Failed{action.error ? `: ${action.error}` : ""}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function ByldaChatModal({ open, onClose, initialQuery }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Record<string, ByldaProposedAction>>({});
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [bootPhase, setBootPhase] = useState(0);
  const hasBooted = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch workspace context once on open
  useEffect(() => {
    if (!open || !user?.id) return;
    buildAgentContext(user.id).then((ctx) => setContext(ctx as unknown as Record<string, unknown>));
  }, [open, user?.id]);

  // Boot sequence animation
  useEffect(() => {
    if (!open) return;
    if (hasBooted.current) {
      setBootPhase(4);
      return;
    }
    setBootPhase(0);
    const timers = [
      setTimeout(() => setBootPhase(1), 480),
      setTimeout(() => setBootPhase(2), 960),
      setTimeout(() => setBootPhase(3), 1440),
      setTimeout(() => {
        setBootPhase(4);
        hasBooted.current = true;
        setTimeout(() => inputRef.current?.focus(), 80);
      }, 1900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  // Auto-focus + handle initialQuery
  useEffect(() => {
    if (open && hasBooted.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
      if (initialQuery && messages.length === 0) setInput(initialQuery);
    }
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setActions({});
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

      const resp = await invokeEdgeStream(
        "bylda-chat",
        {
          message: trimmed,
          conversation_history: updatedHistory
            .slice(0, -1) // exclude the message we just added
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

  // Extract telemetry from workspace context — field paths match buildAgentContext output
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

  if (typeof window === "undefined") return null;

  const content = open ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--modal-overlay)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          width: "min(94vw, 1080px)",
          height: "min(92vh, 780px)",
          borderRadius: 20,
          border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
          background: "var(--surface)",
          boxShadow:
            "0 32px 100px color-mix(in oklab, var(--background) 70%, transparent), 0 0 0 1px color-mix(in oklab, var(--primary) 6%, transparent) inset",
          display: "flex",
          overflow: "hidden",
          backgroundImage:
            "linear-gradient(rgba(249,115,22,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.025) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      >
        {/* ── Left Sidebar ── */}
        <div
          style={{
            width: 248,
            borderRight: "1px solid rgba(249,115,22,0.1)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 16px",
            gap: 20,
            flexShrink: 0,
            overflow: "hidden",
          }}
          className="bylda-sidebar"
        >
          {/* Bylda Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #F97316, #ea580c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: streaming
                  ? "0 0 0 3px rgba(249,115,22,0.25), 0 0 14px rgba(249,115,22,0.3)"
                  : "0 0 10px rgba(249,115,22,0.2)",
                transition: "box-shadow 0.4s",
              }}
            >
              <Sparkles style={{ width: 15, height: 15, color: "#fff" }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--foreground)",
                  letterSpacing: 0.5,
                }}
              >
                BYLDA
              </div>
              <div style={{ fontSize: 10, color: "#F97316", letterSpacing: 1.5, opacity: 0.8 }}>
                AI INTELLIGENCE
              </div>
            </div>
          </div>

          {/* System status */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(249,115,22,0.12)",
              background: "rgba(249,115,22,0.04)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "rgba(249,115,22,0.6)",
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              SYSTEM STATUS
            </div>
            {[
              { label: "AI Core", ok: true },
              { label: "Workspace", ok: Object.keys(context).length > 0 },
              { label: "Streaming", ok: true },
            ].map(({ label, ok }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: ok ? "#22c55e" : "#ef4444",
                    letterSpacing: 1,
                  }}
                >
                  {ok ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
            ))}
          </div>

          {/* Founder telemetry */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, color: "rgba(249,115,22,0.6)", letterSpacing: 1.5 }}>
              WORKSPACE INTEL
            </div>
            <TelemetryRow label="Operator" value={displayName} />
            <TelemetryRow label="Plan" value={planTier.toUpperCase()} accent />
            {currentIdea && <TelemetryRow label="Idea" value={currentIdea} truncate />}
            {currentMission && <TelemetryRow label="Mission" value={currentMission} truncate />}
            <TelemetryRow label="Tool Runs" value={String(toolRunCount || recentRuns.length)} />
          </div>

          {/* Recent tool runs */}
          {recentRuns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 9, color: "rgba(249,115,22,0.6)", letterSpacing: 1.5 }}>
                RECENT ACTIVITY
              </div>
              {recentRuns.slice(0, 4).map((run, i) => {
                const key = run.toolKey || "tool";
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px",
                      borderRadius: 7,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--surface)",
                    }}
                  >
                    <Activity style={{ width: 10, height: 10, color: "rgba(249,115,22,0.5)" }} />
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {key.replace(/-/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick nav */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "Tool Suite", path: "/app/launchpad" },
              { label: "Mentors", path: "/app/mentor" },
              { label: "Home", path: "/app" },
            ].map(({ label, path }) => (
              <Link
                key={path}
                to={path as never}
                onClick={handleClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--muted-foreground)",
                  fontSize: 11,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#F97316";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.2)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-2)";
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                }}
              >
                {label}
                <ArrowUpRight style={{ width: 10, height: 10 }} />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 20px",
              borderBottom: "1px solid rgba(249,115,22,0.1)",
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Ask Bylda
                {streaming && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: 1.5,
                      color: "#F97316",
                      animation: "bylda-pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    THINKING...
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                Chief of Staff · 30-tool suite · startup strategy
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {messages.length > 0 && (
                <HeaderBtn onClick={resetChat} title="New conversation">
                  <RotateCcw style={{ width: 12, height: 12 }} />
                </HeaderBtn>
              )}
              <HeaderBtn onClick={handleClose} title="Close (Esc)">
                <X style={{ width: 13, height: 13 }} />
              </HeaderBtn>
            </div>
          </div>

          {/* Boot screen OR messages */}
          {bootPhase < 4 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 40,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #F97316, #ea580c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 40px rgba(249,115,22,0.3)",
                  animation: "bylda-pulse 1.5s ease-in-out infinite",
                }}
              >
                <Sparkles style={{ width: 28, height: 28, color: "#fff" }} />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}
              >
                {BOOT_LINES.slice(0, bootPhase + 1).map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: i === bootPhase ? "#F97316" : "rgba(249,115,22,0.35)",
                      fontFamily: "monospace",
                      transition: "color 0.3s",
                    }}
                  >
                    {i < bootPhase ? "✓ " : ""}
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {messages.length === 0 && (
                <EmptyState
                  displayName={displayName}
                  idea={currentIdea}
                  stage={stage}
                  toolRunCount={toolRunCount}
                  recentRuns={recentRuns}
                  onSend={sendMessage}
                />
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #F97316, #ea580c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                        boxShadow: streaming ? "0 0 12px rgba(249,115,22,0.5)" : "none",
                        transition: "box-shadow 0.3s",
                      }}
                    >
                      <Sparkles style={{ width: 12, height: 12, color: "#fff" }} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "10px 14px",
                      borderRadius:
                        msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background:
                        msg.role === "user"
                          ? "linear-gradient(135deg, #F97316, #ea580c)"
                          : "var(--surface-2)",
                      border: msg.role === "assistant" ? "1px solid rgba(249,115,22,0.1)" : "none",
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: msg.role === "user" ? "#fff" : "var(--foreground)",
                    }}
                  >
                    {msg.pending && !msg.content ? (
                      <span
                        style={{
                          display: "inline-flex",
                          gap: 4,
                          alignItems: "center",
                          color: "#F97316",
                        }}
                      >
                        <span style={{ animation: "bylda-pulse 1.4s ease-in-out infinite" }}>
                          ●
                        </span>
                        <span style={{ animation: "bylda-pulse 1.4s ease-in-out 0.2s infinite" }}>
                          ●
                        </span>
                        <span style={{ animation: "bylda-pulse 1.4s ease-in-out 0.4s infinite" }}>
                          ●
                        </span>
                      </span>
                    ) : msg.role === "assistant" ? (
                      renderContent(msg.content, (path) => {
                        navigate({ to: path as never });
                        handleClose();
                      })
                    ) : (
                      msg.content
                    )}
                    {msg.actionId &&
                      actions[msg.actionId] &&
                      renderActionCard(actions[msg.actionId], handleActionDecision)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: "12px 20px 16px",
              borderTop: "1px solid rgba(249,115,22,0.1)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(249,115,22,0.2)",
                background: "var(--surface)",
                transition: "border-color 0.15s",
              }}
              onFocusCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.45)";
              }}
              onBlurCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.2)";
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask BYLDA anything… Enter to send, Shift+Enter for newline"
                rows={1}
                disabled={streaming || bootPhase < 4}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: 13,
                  color: "#fff",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflowY: "auto",
                  caretColor: "#F97316",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming || bootPhase < 4}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: "none",
                  background:
                    input.trim() && !streaming
                      ? "linear-gradient(135deg, #F97316, #ea580c)"
                      : "var(--surface-2)",
                  color: input.trim() && !streaming ? "#fff" : "var(--muted-foreground)",
                  cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                  boxShadow: input.trim() && !streaming ? "0 0 10px rgba(249,115,22,0.3)" : "none",
                }}
              >
                <Send style={{ width: 13, height: 13 }} />
              </button>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted-foreground)",
                marginTop: 6,
                textAlign: "center",
                letterSpacing: 0.5,
              }}
            >
              BYLDA AI · responses are AI-generated · always verify critical decisions
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bylda-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @media (max-width: 680px) {
          .bylda-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  ) : null;

  return createPortal(content, document.body);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function HeaderBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "1px solid var(--border-subtle)",
        background: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted-foreground)",
        transition: "all 0.12s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
        (e.currentTarget as HTMLElement).style.background = "none";
      }}
    >
      {children}
    </button>
  );
}

function TelemetryRow({
  label,
  value,
  accent,
  truncate,
}: {
  label: string;
  value: string;
  accent?: boolean;
  truncate?: boolean;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}
    >
      <span style={{ fontSize: 10, color: "var(--muted-foreground)", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: accent ? "var(--primary)" : "var(--foreground)",
          overflow: truncate ? "hidden" : undefined,
          textOverflow: truncate ? "ellipsis" : undefined,
          whiteSpace: truncate ? "nowrap" : undefined,
          textAlign: "right",
          maxWidth: truncate ? 120 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  displayName,
  idea,
  stage,
  toolRunCount,
  recentRuns,
  onSend,
}: {
  displayName: string;
  idea: string | null;
  stage: string;
  toolRunCount: number;
  recentRuns: Array<{ toolKey?: string; status?: string }>;
  onSend: (text: string) => void;
}) {
  const quickPrompts = buildQuickPrompts(idea, stage, toolRunCount);
  const lastTool = recentRuns[0]?.toolKey?.replace(/-/g, " ") || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        gap: 20,
        padding: "0 20px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          Good to see you, {displayName}.
        </div>
        {idea ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            Building: <span style={{ color: "#F97316", fontWeight: 500 }}>{idea}</span>
            <br />
            {toolRunCount > 0
              ? `${toolRunCount} tool${toolRunCount !== 1 ? "s" : ""} completed${lastTool ? ` — last ran ${lastTool}` : ""}.`
              : "No tools run yet — let's get started."}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            I have full visibility into your workspace.
            <br />
            What's the mission today?
          </div>
        )}
      </div>

      {/* Stage badge */}
      {stage && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 20,
            border: "1px solid rgba(249,115,22,0.25)",
            background: "rgba(249,115,22,0.06)",
            fontSize: 11,
            fontWeight: 600,
            color: "#F97316",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#F97316",
              display: "inline-block",
            }}
          />
          {stage} stage
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 7,
          justifyContent: "center",
          maxWidth: 480,
        }}
      >
        {quickPrompts.map((p) => (
          <button
            key={p}
            onClick={() => onSend(p)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: "1px solid rgba(249,115,22,0.2)",
              background: "rgba(249,115,22,0.05)",
              color: "var(--foreground)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.12)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.45)";
              (e.currentTarget as HTMLElement).style.color = "#F97316";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.05)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.2)";
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
