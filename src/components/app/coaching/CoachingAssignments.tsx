import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { repsQuery, coachingManagerPermissionQuery } from "@/lib/queries";
import {
  coachingAssignmentsQuery,
  createCoachingAssignment,
  updateCoachingAssignment,
  type CoachingAssignment,
} from "@/lib/coaching/collaboration";

export function AssignmentForm({
  presetRepId,
  callId = null,
  runId = null,
  onSaved,
}: {
  presetRepId?: string;
  callId?: string | null;
  runId?: string | null;
  onSaved?: () => void;
}) {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const reps = useQuery(repsQuery(org)),
    permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? "")),
    qc = useQueryClient();
  const [repId, setRepId] = useState(presetRepId ?? ""),
    [focus, setFocus] = useState(""),
    [note, setNote] = useState(""),
    [date, setDate] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await createCoachingAssignment({
        organization_id: org,
        rep_id: repId,
        call_id: callId,
        run_id: runId,
        focus,
        note,
        check_in_at: date,
      });
      await qc.invalidateQueries({ queryKey: ["coaching-assignments", org] });
      setFocus("");
      setNote("");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="figma-panel space-y-3" aria-label="Assign coaching">
      <h2>Assign coaching</h2>
      {permission.isPending ? (
        <p>Checking permission…</p>
      ) : !permission.data ? (
        <p>Only workspace managers can assign coaching.</p>
      ) : (
        <>
          <label className="figma-field">
            Rep
            <select
              value={repId}
              disabled={!!presetRepId}
              onChange={(e) => setRepId(e.target.value)}
            >
              <option value="">Choose a rep</option>
              {reps.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="figma-field">
            Focus behavior
            <input
              value={focus}
              maxLength={300}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. Clarify sensitive application questions"
            />
          </label>
          <label className="figma-field">
            Coaching note
            <textarea
              rows={3}
              value={note}
              maxLength={10000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="figma-field">
            Check-in date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {callId && (
            <p className="text-xs">
              This call{runId ? " and its retained analysis" : ""} will be attached as evidence.
            </p>
          )}
          <p className="text-xs text-by-text-secondary">
            Assignment is saved in the workspace. A check-in records manager follow-through;
            completion is not proof of improved sales.
          </p>
          <button
            className="figma-button"
            type="button"
            disabled={busy || !repId || !focus.trim() || !date}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Assign focus"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function AssignmentCard({
  row,
  name,
  manager,
  onChange,
}: {
  row: CoachingAssignment;
  name: string;
  manager: boolean;
  onChange: () => Promise<unknown>;
}) {
  const [note, setNote] = useState(row.check_in_note),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(status: CoachingAssignment["status"]) {
    setBusy(true);
    setError("");
    try {
      await updateCoachingAssignment(row, { status, check_in_note: note });
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border border-by-border-engraved p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <h3>
          {name} · {row.focus}
        </h3>
        <span className="text-xs">
          {row.status} · Check-in {row.check_in_at}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{row.note}</p>
      {row.call_id && (
        <Link
          className="text-xs underline"
          to="/app/crm/calls"
          search={{
            callId: row.call_id,
            repId: row.rep_id,
            ...(row.run_id ? { runId: row.run_id } : {}),
          }}
        >
          Open source call
        </Link>
      )}
      {manager ? (
        <>
          <label className="figma-field">
            Check-in notes
            <textarea
              value={note}
              maxLength={10000}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="figma-button" disabled={busy} onClick={() => void save(row.status)}>
              Save check-in
            </button>
            {row.status !== "completed" && (
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => void save("completed")}
              >
                Complete
              </button>
            )}
            {row.status === "completed" && (
              <button className="figma-button" disabled={busy} onClick={() => void save("active")}>
                Reopen
              </button>
            )}
            {row.status === "active" && (
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => void save("cancelled")}
              >
                Cancel assignment
              </button>
            )}
          </div>
        </>
      ) : (
        row.check_in_note && (
          <p className="whitespace-pre-wrap text-sm">Check-in: {row.check_in_note}</p>
        )
      )}
      {error && (
        <p role="alert" className="text-red-700 text-sm">
          {error}
        </p>
      )}
    </article>
  );
}
export function CoachingAssignments({
  initialFilter = "active",
}: {
  initialFilter?: "active" | "follow_up" | "completed";
}) {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const q = useQuery(coachingAssignmentsQuery(org)),
    reps = useQuery(repsQuery(org)),
    permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? ""));
  const [filter, setFilter] = useState(initialFilter),
    [form, setForm] = useState(false);
  const names = new Map(reps.data?.map((r) => [r.id, r.name]));
  const today = new Date().toLocaleDateString("en-CA");
  const rows = (q.data ?? []).filter((r) =>
    filter === "completed"
      ? r.status === "completed"
      : r.status === "active" && (filter !== "follow_up" || r.check_in_at <= today),
  );
  return (
    <section className="figma-panel space-y-5">
      <div className="flex justify-between gap-3">
        <h1>Coaching</h1>
        {permission.data && (
          <button className="figma-button" onClick={() => setForm((v) => !v)}>
            Assign coaching
          </button>
        )}
      </div>
      <p className="text-xs text-by-text-secondary">
        Saved focus, source calls and manager check-ins.
      </p>
      {form && <AssignmentForm onSaved={() => setForm(false)} />}
      <nav className="figma-tabs" aria-label="Coaching status">
        {(["active", "follow_up", "completed"] as const).map((t) => (
          <button key={t} aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {t.replaceAll("_", " ")}
          </button>
        ))}
      </nav>
      {q.isPending ? (
        <p>Loading assignments…</p>
      ) : q.error ? (
        <p role="alert">
          Assignments could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : rows.length ? (
        rows.map((row) => (
          <AssignmentCard
            key={`${row.id}:${row.updated_at}`}
            row={row}
            name={names.get(row.rep_id) ?? "Rep"}
            manager={!!permission.data}
            onChange={() => q.refetch()}
          />
        ))
      ) : (
        <p className="figma-empty">
          No {filter.replaceAll("_", " ")} coaching assignments. Assign a focus from a call or the
          button above.
        </p>
      )}
    </section>
  );
}
