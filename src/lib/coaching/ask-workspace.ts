import { invokeEdge } from "@/lib/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import type { AskSource } from "../../../supabase/functions/_shared/coaching/ask-evidence";
export type { AskSource };

export type QuestionScope = {
  kind: "workspace" | "calls" | "reports" | "call" | "report" | "personal";
  id?: string;
};

export const askHistoryQuery = (
  org: string,
  user: string,
  scope: QuestionScope,
  repId?: string,
) => ({
  queryKey: ["coaching-ask-history", org, user, scope.kind, scope.id ?? "", repId ?? ""],
  enabled: !!org && !!user,
  queryFn: async (): Promise<
    Array<{
      id: string;
      question: string;
      answer: string;
      citations: AskSource[];
      created_at: string;
    }>
  > => {
    // The new table is guarded by user, workspace, source-call and MFA policies.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("coaching_ask_history")
      .select("id,question,answer,citations,created_at")
      .eq("organization_id", org)
      .eq("user_id", user)
      .eq("scope_key", `${scope.kind}:${scope.id ?? ""}:${repId ?? ""}`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },
});

export async function readWorkspaceAnswer(response: Response, onText?: (answer: string) => void) {
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body)
    throw new Error("Bylda did not return a conversation stream.");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let answer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        if (event.error) throw new Error("The answer was interrupted. Try again.");
        if (typeof event.text === "string") {
          answer += event.text;
          onText?.(answer);
        }
      }
    }
    if (buffer.trim() || !answer.trim()) throw new Error("The answer was interrupted. Try again.");
    return answer;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function askWorkspace(
  orgId: string,
  question: string,
  scope: QuestionScope,
  repId?: string,
  signal?: AbortSignal,
  onText?: (answer: string) => void,
) {
  const result = await invokeEdge<{
    answer: string;
    citations: AskSource[];
    sources_searched: number;
  }>(
    "coaching-ask",
    { organization_id: orgId, question, scope, rep_id: repId },
    { timeoutMs: 90000, retries: 0, signal },
  );
  onText?.(result.answer);
  return result;
}
