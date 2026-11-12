import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";
import { askWorkspace } from "@/lib/coaching/ask-workspace";

type SearchResult =
  | { kind: "call" | "note"; id: string; callId: string; title: string }
  | { kind: "rep"; id: string; title: string }
  | { kind: "report"; id: string; repId: string; title: string };

export function WorkspaceSearch({
  ask = false,
  embedded = false,
}: {
  ask?: boolean;
  embedded?: boolean;
}) {
  const { currentOrgId } = useAuth();
  const access = useCoachingWorkspaceAccess();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const repId = access.rep?.id;
  const q = useQuery({
    queryKey: ["workspace-search", currentOrgId, access.manager, repId, query],
    enabled: !!currentOrgId && query.length >= 2 && !ask && Boolean(access.manager || repId),
    queryFn: async (): Promise<SearchResult[]> => {
      // The generated types predate the coaching tables.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      let reports = db
        .from("coaching_reports")
        .select("id,rep_id,headline:report->>headline")
        .eq("organization_id", currentOrgId)
        .eq("status", "completed")
        .ilike("report->>headline", pattern);
      let calls = db
        .from("call_insights")
        .select("call_id,summary,calls!inner(rep_id)")
        .eq("organization_id", currentOrgId)
        .ilike("summary", pattern);
      let notes = db
        .from("coaching_call_notes")
        .select("id,call_id,body,calls!inner(rep_id)")
        .eq("organization_id", currentOrgId)
        .ilike("body", pattern);
      if (repId) {
        reports = reports.eq("rep_id", repId);
        calls = calls.eq("calls.rep_id", repId);
        notes = notes.eq("calls.rep_id", repId);
      }
      const [repRows, callRows, reportRows, noteRows] = await Promise.all([
        access.manager
          ? db
              .from("reps")
              .select("id,name")
              .eq("organization_id", currentOrgId)
              .ilike("name", pattern)
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        calls.limit(20),
        reports.limit(20),
        notes.limit(20),
      ]);
      for (const response of [repRows, callRows, reportRows, noteRows]) {
        if (response.error) throw response.error;
      }
      return [
        ...(repRows.data as { id: string; name: string }[]).map(
          (row): SearchResult => ({ kind: "rep", id: row.id, title: row.name }),
        ),
        ...(callRows.data as { call_id: string; summary: string }[]).map(
          (row): SearchResult => ({
            kind: "call",
            id: row.call_id,
            callId: row.call_id,
            title: row.summary || "Call review",
          }),
        ),
        ...(reportRows.data as { id: string; rep_id: string; headline: string }[]).map(
          (row): SearchResult => ({
            kind: "report",
            id: row.id,
            repId: row.rep_id,
            title: row.headline || "Saved coaching report",
          }),
        ),
        ...(noteRows.data as { id: string; call_id: string; body: string }[]).map(
          (row): SearchResult => ({
            kind: "note",
            id: row.id,
            callId: row.call_id,
            title: row.body.slice(0, 180),
          }),
        ),
      ];
    },
  });
  async function submit() {
    const text = draft.trim();
    if (!currentOrgId || busy || text.length < 2) return;
    setError("");
    if (!ask) {
      setQuery(text);
      return;
    }
    setBusy(true);
    setAnswer("");
    try {
      const response = await askWorkspace(
        currentOrgId,
        text,
        { kind: access.manager ? "workspace" : "personal" },
        undefined,
        setAnswer,
      );
      setAnswer(response.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Question could not be answered.");
    } finally {
      setBusy(false);
    }
  }
  const disabled = access.pending || Boolean(access.error) || (!access.manager && !repId);
  return (
    <section
      className={
        embedded ? "page30-search-results space-y-4" : "figma-panel page30-search-results space-y-4"
      }
      data-design-screen={ask ? "ask-bylda" : "search-overlay"}
    >
      <header>
        <p className="page30-label">
          {access.manager ? "Manager workspace" : "Personal workspace"}
        </p>
        <h1>{ask ? "Ask Bylda" : "Search workspace"}</h1>
      </header>
      <form
        className="page30-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Search size={17} aria-hidden="true" />
        <input
          autoFocus={embedded}
          aria-label={ask ? "Question for Bylda" : "Search workspace"}
          value={draft}
          maxLength={ask ? 2000 : 240}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={ask ? "What should I focus on next?" : "Search calls, reports and notes…"}
        />
        <button
          type="submit"
          className="figma-button page30-primary"
          disabled={disabled || busy || draft.trim().length < 2}
        >
          {ask ? "Ask" : "Search"}
        </button>
      </form>
      {access.pending && (
        <p role="status" className="page30-pending">
          Checking workspace access…
        </p>
      )}
      {access.error && (
        <p role="alert">
          Workspace access could not load.{" "}
          <button className="underline" onClick={() => void access.retry()}>
            Retry
          </button>
        </p>
      )}
      {!access.pending && !access.error && !access.manager && !repId && (
        <p>Link your rep profile to search your coaching records.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {ask ? (
        busy && !answer ? (
          <p role="status" className="page30-pending">
            Reading sources…
          </p>
        ) : (
          answer && (
            <p aria-busy={busy} aria-live={busy ? "off" : "polite"} className="whitespace-pre-wrap">
              {answer}
            </p>
          )
        )
      ) : q.isFetching ? (
        <p role="status" className="page30-pending">
          Searching workspace…
        </p>
      ) : q.error ? (
        <p role="alert">
          Search could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : q.data ? (
        q.data.length ? (
          <ul className="page30-home-list" aria-label="Search results">
            {q.data.map((row) => (
              <li key={`${row.kind}:${row.id}`}>
                <Link
                  className="page30-result-link"
                  to="/app/crm/calls"
                  search={
                    row.kind === "rep"
                      ? { view: "people", repId: row.id }
                      : row.kind === "report"
                        ? { view: "report", repId: row.repId, reportId: row.id }
                        : { callId: row.callId, ...(row.kind === "note" ? { tab: "notes" } : {}) }
                  }
                >
                  <span>{row.title}</span>
                  <span className="page30-chip">{row.kind}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">No matching records for “{query}”.</p>
        )
      ) : (
        <p className="page30-muted">
          {access.manager
            ? "Search team calls, reports, reps and notes."
            : "Search your calls, reports and notes."}
        </p>
      )}
    </section>
  );
}
