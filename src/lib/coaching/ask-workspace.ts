import { invokeEdgeStream } from "@/lib/invokeEdge";

export type QuestionScope = {
  kind: "workspace" | "calls" | "reports" | "call" | "report" | "personal";
  id?: string;
};

export async function readWorkspaceAnswer(response: Response, onText?: (answer: string) => void) {
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const result = await response.json();
    if (result.scope_applied !== true) throw new Error("Scoped coaching answers are unavailable.");
    return {
      answer: String(result.answer ?? ""),
      sources_searched: Number(result.sources_searched) || 0,
    };
  }
  if (response.headers.get("x-bylda-scope") !== "applied" || !response.body)
    throw new Error("Scoped coaching answers are unavailable.");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let answer = "";
  let finished = false;
  try {
    while (!finished) {
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
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.type === "error") throw new Error("The answer was interrupted. Try again.");
        if (event.type === "message_stop") {
          finished = true;
          break;
        }
        if (event.type === "content_block_delta" && typeof event.delta?.text === "string") {
          answer += event.delta.text;
          onText?.(answer);
        }
      }
    }
    if (!finished) throw new Error("The answer was interrupted. Try again.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return {
    answer: answer || "Bylda did not return an answer.",
    sources_searched: Number(response.headers.get("x-bylda-sources")) || 0,
  };
}

export async function askWorkspace(
  orgId: string,
  query: string,
  scope: QuestionScope,
  signal?: AbortSignal,
  onText?: (answer: string) => void,
) {
  const response = await invokeEdgeStream(
    "memory-query",
    { orgId, query, scope, stream: true },
    { timeoutMs: 90000, signal },
  );
  return readWorkspaceAnswer(response, onText);
}
