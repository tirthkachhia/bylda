import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
export function WorkspaceSearch({ ask = false }: { ask?: boolean }) {
  const { currentOrgId } = useAuth();
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["workspace-search", currentOrgId, query],
    enabled: !!currentOrgId && query.length >= 2 && !ask,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      const [reps, calls, notes] = await Promise.all([
        db
          .from("reps")
          .select("id,name")
          .eq("organization_id", currentOrgId)
          .ilike("name", pattern)
          .limit(50),
        db
          .from("call_insights")
          .select("call_id,summary")
          .eq("organization_id", currentOrgId)
          .ilike("summary", pattern)
          .limit(50),
        db
          .from("coaching_call_notes")
          .select("id,call_id,body")
          .eq("organization_id", currentOrgId)
          .ilike("body", pattern)
          .limit(50),
      ]);
      for (const r of [reps, calls, notes]) if (r.error) throw r.error;
      return {
        reps: reps.data as { id: string; name: string }[],
        calls: calls.data as { call_id: string; summary: string }[],
        notes: notes.data as { id: string; call_id: string; body: string }[],
      };
    },
  });
  async function submit() {
    setError("");
    if (!ask) {
      setQuery(draft.trim());
      return;
    }
    if (!currentOrgId || !draft.trim()) return;
    setBusy(true);
    try {
      const r = await invokeEdge<{ answer: string; sources_searched: number }>(
        "memory-query",
        { orgId: currentOrgId, query: draft.trim() },
        { timeoutMs: 90000, retries: 0 },
      );
      setAnswer(r.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Question could not be answered.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="figma-panel space-y-4">
      <h1>{ask ? "Ask Bylda" : "Search workspace"}</h1>
      <p className="text-xs text-by-text-secondary">
        {ask
          ? "Ask a question against this workspace's indexed sources. Answers cannot verify outcomes that were never recorded."
          : "Search saved rep names, call summaries and workspace notes. Up to 50 matches per category."}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border p-3"
          aria-label={ask ? "Question for Bylda" : "Search workspace"}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={ask ? "What should I coach this week?" : "Search calls, reps or notes…"}
        />
        <button type="submit" className="figma-button" disabled={busy || draft.trim().length < 2}>
          {busy ? "Reading sources…" : ask ? "Ask" : "Search"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {ask ? (
        <p className="whitespace-pre-wrap text-sm leading-6">{answer}</p>
      ) : q.isFetching ? (
        <p>Searching…</p>
      ) : q.error ? (
        <p role="alert">
          Search could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : q.data ? (
        <div className="space-y-3">
          {q.data.reps.map((r) => (
            <p key={r.id}>
              <Link
                className="underline"
                to="/app/crm/calls"
                search={{ view: "people", repId: r.id }}
              >
                Rep · {r.name}
              </Link>
            </p>
          ))}
          {q.data.calls.map((c) => (
            <p key={c.call_id}>
              <Link className="underline" to="/app/crm/calls" search={{ callId: c.call_id }}>
                Call · {c.summary}
              </Link>
            </p>
          ))}
          {q.data.notes.map((n) => (
            <p key={n.id}>
              <Link
                className="underline"
                to="/app/crm/calls"
                search={{ callId: n.call_id, tab: "notes" }}
              >
                Note · {n.body.slice(0, 200)}
              </Link>
            </p>
          ))}
          {!q.data.reps.length && !q.data.calls.length && !q.data.notes.length && (
            <p>No matching records in this workspace.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
