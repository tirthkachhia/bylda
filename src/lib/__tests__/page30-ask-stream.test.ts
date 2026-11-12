// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readWorkspaceAnswer } from "../coaching/ask-workspace";

function stream(frames: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("Page 30 coaching answers through the existing Bylda chat service", () => {
  it("streams text across chunk boundaries", async () => {
    const partial: string[] = [];
    const response = stream([
      'data: {"te',
      'xt":"Ask "}\n\n',
      'data: {"text":"a question."}\r\n\r\n',
    ]);
    await expect(readWorkspaceAnswer(response, (answer) => partial.push(answer))).resolves.toBe(
      "Ask a question.",
    );
    expect(partial).toEqual(["Ask ", "Ask a question."]);
  });

  it("rejects responses outside the streaming contract", async () => {
    await expect(readWorkspaceAnswer(Response.json({ answer: "Unexpected" }))).rejects.toThrow(
      "conversation stream",
    );
  });

  it("reports an interrupted frame or an empty stream", async () => {
    await expect(readWorkspaceAnswer(stream(['data: {"text":"Partial"']))).rejects.toThrow(
      "interrupted",
    );
    await expect(readWorkspaceAnswer(stream([]))).rejects.toThrow("interrupted");
  });
});
