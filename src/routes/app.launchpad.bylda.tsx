/**
 * BYLDA AI — /app/launchpad/bylda
 *
 * Full-page dedicated Bylda interface (master-build dream UI): a read-only
 * Business Snapshot Bar on top, a centered message history (Bylda = violet
 * left-border card, user = accent bubble), and a sticky input with stage-aware
 * quick-action pills. Streams from the bylda-chat edge function with business
 * context injected.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { invokeEdgeStream } from "@/lib/invokeEdge";
import { organizationQuery, businessContextQuery } from "@/lib/queries";

export const Route = createFileRoute("/app/launchpad/bylda")({ component: ByldaPage });

const STAGES = ["Clarify", "Validate", "Build", "Launch", "Operate", "Scale"];

const QUICK_BY_STAGE: Record<string, string[]> = {
  Clarify: [
    "Who exactly is my customer?",
    "What problem am I really solving?",
    "Is this worth pursuing?",
  ],
  Validate: [
    "Stress-test my pricing",
    "Validate this idea",
    "Find my first 10 customers",
    "Build my GTM path",
  ],
  Build: ["What's the smallest MVP?", "What should I cut?", "Plan my build sprint"],
  Launch: [
    "Which channel should I test first?",
    "Write my launch checklist",
    "Draft my landing page hero",
  ],
  Operate: ["Tighten my follow-up", "What should I automate first?", "Where am I losing deals?"],
  Scale: ["What's my growth lever?", "How do I lower CAC?", "What breaks at 10x?"],
};

function jsonText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return Object.values(v as Record<string, unknown>)
      .filter((x) => typeof x === "string" && x)
      .join(" · ");
  } catch {
    return "";
  }
}

type Message = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };

function ByldaPage() {
  const { user, currentOrgId, profile } = useAuth();
  const org = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const ctx = useQuery({ ...businessContextQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stage = (org.data?.stage as string) || jsonText(ctx.data?.stage) || "Validate";
  const stageKey =
    STAGES.find((s) => s.toLowerCase() === String(stage).toLowerCase()) ?? "Validate";
  const belief = jsonText(ctx.data?.identity) || (org.data?.offer as string) || "";
  const quickPrompts = QUICK_BY_STAGE[stageKey] ?? QUICK_BY_STAGE.Validate;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const userContext = useMemo(
    () => ({
      ...(profile?.full_name ? { name: profile.full_name as string } : {}),
      ...(belief ? { idea: belief } : {}),
      ...(stageKey ? { stage: stageKey } : {}),
    }),
    [profile, belief, stageKey],
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      pending: true,
    };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setStreaming(true);

    try {
      const resp = await invokeEdgeStream(
        "bylda-chat",
        {
          message: trimmed,
          conversation_history: messages.map((m) => ({ role: m.role, content: m.content })),
          user_context: userContext,
          org_id: currentOrgId || undefined,
        },
        { timeoutMs: 45_000 },
      );
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      for (;;) {
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
            // Handle both bylda-chat's {text} wrapper and raw Anthropic deltas.
            let chunk = "";
            if (typeof parsed.text === "string") chunk = parsed.text;
            else if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta")
              chunk = parsed.delta.text;
            if (chunk) {
              acc += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: acc, pending: false } : m,
                ),
              );
            }
          } catch {
            /* skip non-JSON SSE line */
          }
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: acc || "No response generated.", pending: false }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: "Something went wrong reaching Bylda. Please try again.",
                pending: false,
              }
            : m,
        ),
      );
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
    <div className="flex h-[calc(100vh-100px)] min-h-[520px] flex-col bg-[--background]">
      {/* Business Snapshot Bar (read-only) */}
      <div className="shrink-0 border-b border-[--border] bg-[--surface] px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <span className="text-sm font-semibold text-[--foreground]">
            {org.data?.name || "Your business"}
          </span>
          <span className="rounded-full border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[--primary-soft] px-2.5 py-0.5 text-xs font-semibold text-[--accent]">
            {stageKey}
          </span>
          {belief && <span className="truncate text-xs text-[--text-faint]">· {belief}</span>}
        </div>
      </div>

      {/* History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[--foreground]">
                Tell Bylda what you want to achieve
              </p>
              <p className="mt-1 max-w-sm text-xs text-[--text-faint]">
                Bylda knows your business context and your stage. Ask for a plan, a critique, or the
                next move.
              </p>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "assistant" ? (
                <div
                  key={m.id}
                  className="rounded-2xl border border-[--border] border-l-4 border-l-[--accent] bg-[--surface] p-4 shadow-sm"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[--accent]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[--accent]">
                      Bylda
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[--foreground]">
                    {m.content || (m.pending ? <TypingDots /> : null)}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-[--accent] px-4 py-2.5 text-sm leading-relaxed text-white">
                    {m.content}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[--border] bg-[--surface] px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Tell Bylda what you want to achieve…"
              className="max-h-40 flex-1 resize-none rounded-xl border border-[--border] bg-[--surface] px-4 py-3 text-sm text-[--foreground] placeholder:text-[--text-faint] focus:border-[--focus-ring] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
            />
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || streaming}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[--accent] text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--primary-hover] disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {messages.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((p) => (
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
