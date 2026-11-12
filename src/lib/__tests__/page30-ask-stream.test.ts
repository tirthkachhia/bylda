// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readWorkspaceAnswer } from "../coaching/ask-workspace";

function stream(frames: string[], scoped = true) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "X-Bylda-Scope": scoped ? "applied" : "",
        "X-Bylda-Sources": "2",
      },
    },
  );
}

describe("Page 30 scoped coaching answers", () => {
  it("streams complete text fragments and handles chunk boundaries", async () => {
    const partial: string[] = [];
    const response = stream([
      'event: content_block_delta\ndata: {"type":"content_',
      'block_delta","delta":{"text":"Ask "}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"a question."}}\r\n\r\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
    await expect(readWorkspaceAnswer(response, (answer) => partial.push(answer))).resolves.toEqual({
      answer: "Ask a question.",
      sources_searched: 2,
    });
    expect(partial).toEqual(["Ask ", "Ask a question."]);
  });

  it("fails closed on an older endpoint that cannot confirm scope", async () => {
    await expect(
      readWorkspaceAnswer(Response.json({ answer: "Unscoped response" })),
    ).rejects.toThrow("Scoped coaching answers");
    await expect(readWorkspaceAnswer(stream([], false))).rejects.toThrow("Scoped coaching answers");
  });

  it("reports an interrupted stream instead of presenting a complete answer", async () => {
    await expect(
      readWorkspaceAnswer(
        stream(['data: {"type":"content_block_delta","delta":{"text":"Partial"}}\n\n']),
      ),
    ).rejects.toThrow("interrupted");
  });
});
