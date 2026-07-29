/**
 * saveToMemory — writes every tool result into the org's memory system so it
 * becomes queryable through the Memory / Ask AI tab.
 *
 * Three writes (all fire-and-forget, never throw to the caller):
 *  1. Upsert a memory_sources row for the tool (one per org+tool)
 *  2. Insert a memory_artifacts row with the output
 *  3. Insert a tool_events row for feedback-loop tracking
 */
import { supabase } from "@/integrations/supabase/client";

export interface SaveToMemoryParams {
  orgId: string;
  userId: string;
  toolName: string;
  /** The primary text the user typed (used as artifact title + event summary). */
  input: string;
  /** Full AI output, serialised to a string. */
  output: string;
}

export async function saveToMemory(params: SaveToMemoryParams): Promise<void> {
  const { orgId, userId, toolName, input, output } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  try {
    // 1. Find or create a memory source row for this tool
    const { data: existing } = await db
      .from("memory_sources")
      .select("id")
      .eq("org_id", orgId)
      .eq("source_type", "tool")
      .eq("source_label", toolName)
      .limit(1);

    let sourceId: string | null = null;
    if (existing && existing.length > 0) {
      sourceId = existing[0].id as string;
      await db
        .from("memory_sources")
        .update({ last_synced_at: new Date().toISOString(), status: "indexed" })
        .eq("id", sourceId);
    } else {
      const { data: created } = await db
        .from("memory_sources")
        .insert({
          org_id: orgId,
          user_id: userId,
          source_type: "tool",
          source_label: toolName,
          source_url: null,
          status: "indexed",
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      sourceId = (created?.id as string) ?? null;
    }

    // 2. Insert the output as a memory artifact
    const truncated = input.length > 120 ? `${input.slice(0, 120)}…` : input;
    const title = `${toolName}: ${truncated}`;
    const contentPreview = output.slice(0, 500);

    await db.from("memory_artifacts").insert({
      org_id: orgId,
      user_id: userId,
      source_id: sourceId,
      source_type: "tool",
      source_label: toolName,
      title,
      content_preview: contentPreview,
      status: "indexed",
      metadata: { tool: toolName, input_summary: input.slice(0, 300) },
    });

    // 3. Log a tool_events row for the feedback loop (table created in migration)
    const inputHash = await sha256Short(input);
    await db.from("tool_events").insert({
      org_id: orgId,
      user_id: userId,
      tool_name: toolName,
      input_hash: inputHash,
      input_summary: input.slice(0, 500),
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal — memory saving must never break tool runs
    console.warn("[saveToMemory] non-fatal error:", err);
  }
}

async function sha256Short(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
