import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { callsSearchFromSource } from "@/lib/coaching/calls-search";
import { BehaviorManagerBrief } from "./BehaviorManagerBrief";
import { repsQuery, coachingManagerPermissionQuery } from "@/lib/queries";
import {
  coachingAssignmentsQuery,
  assignmentPracticeQuery,
  saveAssignmentPractice,
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
  detailed = false,
}: {
  row: CoachingAssignment;
  name: string;
  manager: boolean;
  onChange: () => Promise<unknown>;
  detailed?: boolean;
}) {
  const { user } = useAuth();
  const practice = useQuery(
    assignmentPracticeQuery(detailed ? row.id : "", user?.id ?? "", manager),
  );
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [tab, setTab] = useState("Overview");
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
  async function record(patch: { practiced?: boolean; useful?: boolean | null }) {
    if (practiceBusy) return;
    setPracticeBusy(true);
    setError("");
    try {
      await saveAssignmentPractice(row.id, patch);
      await practice.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Practice could not be saved.");
    } finally {
      setPracticeBusy(false);
    }
  }
  if (!detailed)
    return (
      <article className="page30-status-card">
        <div className="page30-section-header">
          <h3>
            {name} · {row.focus}
          </h3>
          <span className="page30-chip">{row.status}</span>
        </div>
        <p>{row.note}</p>
        <span className="page30-muted">Check-in {row.check_in_at}</span>
        <Link className="figma-button" to="/app/coaching" search={{ assignment: row.id }}>
          Open coaching focus
        </Link>
      </article>
    );
  return (
    <article className="page30-glass page30-setup-panel space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="page30-label">Coaching · {name}</p>
          <h1>{row.focus}</h1>
        </div>
        <span className="text-xs">
          {row.status} · Check-in {row.check_in_at}
        </span>
      </div>
      <nav className="figma-tabs" aria-label="Coaching detail">
        {["Overview", "Evidence", "Progress", "Check-in"].map((item) => (
          <button type="button" key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>
      {tab === "Overview" && (
        <section className="page30-status-card">
          <h2>{manager ? "Focus" : "Practice"}</h2>
          <p className="whitespace-pre-wrap">{row.note || row.focus}</p>
          <p className="page30-muted">Check-in {row.check_in_at}</p>
          {!manager && (
            <div className="page30-home-actions">
              {practice.error ? (
                <p role="alert">
                  Practice status could not load.{" "}
                  <button className="underline" onClick={() => void practice.refetch()}>
                    Retry
                  </button>
                </p>
              ) : (
                <>
                  <span>
                    {practice.data?.practiced ? "Practice recorded" : "Practice unconfirmed"}
                  </span>
                  <button
                    className="figma-button"
                    type="button"
                    disabled={practiceBusy || practice.isLoading}
                    onClick={() => void record({ practiced: !practice.data?.practiced })}
                  >
                    {practice.data?.practiced ? "Undo practice" : "I tried this"}
                  </button>
                  {practice.data?.useful != null ? (
                    <button
                      className="figma-button"
                      type="button"
                      disabled={practiceBusy}
                      onClick={() => void record({ useful: null })}
                    >
                      Undo feedback
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Was this useful?</span>
                      <button
                        className="figma-button"
                        type="button"
                        disabled={practiceBusy || practice.isLoading}
                        onClick={() => void record({ useful: true })}
                      >
                        Yes
                      </button>
                      <button
                        className="figma-button"
                        type="button"
                        disabled={practiceBusy || practice.isLoading}
                        onClick={() => void record({ useful: false })}
                      >
                        No
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
      {tab === "Evidence" && row.call_id && (
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
      {tab === "Evidence" && !row.call_id && <p>No source call is attached to this focus.</p>}
      {tab === "Progress" && (
        <section className="page30-status-card">
          <h2>Coaching progress</h2>
          <p>
            {practice.data?.practiced
              ? "Rep reported trying this focus."
              : "Practice has not been recorded."}
          </p>
          <p className="page30-muted">
            Compare retained observations across calls when enough comparable evidence is available.
          </p>
          <Link
            className="figma-button"
            to="/app/coaching"
            search={{ view: "progress", assignment: row.id }}
          >
            Open progress
          </Link>
        </section>
      )}
      {tab === "Check-in" &&
        (manager ? (
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
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => void save(row.status)}
              >
                Save check-in
              </button>
              {row.status !== "completed" && (
                <button
                  className="figma-button"
                  disabled={busy}
                  onClick={() => void save("completed")}
                >
                  Mark as coached
                </button>
              )}
              {row.status === "completed" && (
                <button
                  className="figma-button"
                  disabled={busy}
                  onClick={() => void save("active")}
                >
                  Undo completion
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
          <p className="whitespace-pre-wrap text-sm">
            {row.check_in_note || "No manager check-in is saved yet."}
          </p>
        ))}
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
  assignmentId,
  progress = false,
}: {
  initialFilter?: "active" | "follow_up" | "completed";
  assignmentId?: string;
  progress?: boolean;
}) {
  const { currentOrgId } = useAuth(),
    org = currentOrgId ?? "";
  const access = useCoachingWorkspaceAccess();
  const navigate = useNavigate();
  const q = useQuery(coachingAssignmentsQuery(org)),
    reps = useQuery(repsQuery(org));
  const [filter, setFilter] = useState(initialFilter),
    [form, setForm] = useState(false);
  const names = new Map(reps.data?.map((r) => [r.id, r.name]));
  const today = new Date().toLocaleDateString("en-CA");
  const scoped = (q.data ?? []).filter((row) => access.manager || row.rep_id === access.rep?.id);
  const selected = scoped.find((row) => row.id === assignmentId);
  const rows = scoped.filter((r) =>
    filter === "completed"
      ? r.status === "completed"
      : r.status === "active" && (filter !== "follow_up" || r.check_in_at <= today),
  );
  if (access.pending)
    return (
      <p role="status" className="page30-pending">
        Checking coaching access…
      </p>
    );
  if (access.error)
    return (
      <p role="alert">
        Coaching access could not load.{" "}
        <button className="underline" onClick={() => void access.retry()}>
          Retry
        </button>
      </p>
    );
  const targetRep = selected?.rep_id ?? access.rep?.id;
  if (progress)
    return (
      <section
        className="page30-glass page30-setup-panel space-y-4"
        data-design-screen="coaching-progress"
      >
        <header className="page30-section-header">
          <div>
            <p className="page30-label">Coaching / Progress</p>
            <h1>{access.manager ? "Rep coaching progress" : "My coaching progress"}</h1>
          </div>
          <Link className="figma-button" to="/app/coaching" search={{ assignment: selected?.id }}>
            Back to coaching
          </Link>
        </header>
        {selected && (
          <p>
            {selected.focus} · {selected.status}
          </p>
        )}
        {targetRep ? (
          <BehaviorManagerBrief
            repId={targetRep}
            initialTab="Trends"
            onOpenCall={(callId, at) =>
              void navigate({
                to: "/app/crm/calls",
                search: { callId, repId: targetRep, at: at ?? undefined },
              })
            }
            onOpenSource={(source) =>
              navigate({ to: "/app/crm/calls", search: callsSearchFromSource(source) })
            }
          />
        ) : (
          <p>Select a coaching focus with a linked rep to review progress.</p>
        )}
      </section>
    );
  if (assignmentId && !q.isPending && !q.error)
    return (
      <section className="space-y-4" data-design-screen="coaching-detail">
        <Link className="figma-button" to="/app/coaching">
          Back to coaching
        </Link>
        {selected ? (
          <AssignmentCard
            key={selected.id + selected.updated_at}
            row={selected}
            name={names.get(selected.rep_id) ?? "Rep"}
            manager={access.manager}
            detailed
            onChange={() => q.refetch()}
          />
        ) : (
          <p role="alert">This coaching focus is unavailable.</p>
        )}
      </section>
    );
  return (
    <section
      className="page30-glass page30-setup-panel space-y-5"
      data-design-screen="coaching-list"
    >
      <div className="flex justify-between gap-3">
        <h1>{access.manager ? "Coaching follow-up" : "My coaching"}</h1>
        {access.manager && (
          <button className="figma-button" onClick={() => setForm((v) => !v)}>
            Assign coaching
          </button>
        )}
      </div>
      <p className="text-xs text-by-text-secondary">
        Saved focus, source calls and manager check-ins.
      </p>
      <Dialog open={form} onOpenChange={setForm}>
        <DialogContent
          className="page30-dialog max-h-[85dvh] overflow-auto"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Assign coaching</DialogTitle>
          <AssignmentForm onSaved={() => setForm(false)} />
        </DialogContent>
      </Dialog>
      {!access.manager && access.rep && (
        <Link className="figma-button" to="/app/coaching" search={{ view: "progress" }}>
          My coaching progress
        </Link>
      )}
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
            manager={access.manager}
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
