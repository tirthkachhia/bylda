import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  callNotesQuery,
  saveCallNote,
  deleteCallNote,
  type CallNote,
} from "@/lib/coaching/collaboration";
export function CallNotes({ callId }: { callId: string }) {
  const { currentOrgId, user } = useAuth();
  const org = currentOrgId ?? "";
  const q = useQuery(callNotesQuery(org, callId)),
    qc = useQueryClient();
  const [body, setBody] = useState(""),
    [editing, setEditing] = useState<CallNote | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await saveCallNote(org, callId, body, editing);
      setBody("");
      setEditing(undefined);
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ["call-notes", org, callId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(note: CallNote) {
    if (!window.confirm("Delete this note?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteCallNote(note);
      if (editing?.id === note.id) {
        setEditing(undefined);
        setBody("");
      }
      await qc.invalidateQueries({ queryKey: ["call-notes", org, callId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note could not be deleted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border border-by-border-engraved p-4"
      aria-label="Call notes"
    >
      <h2 className="text-base">Notes</h2>
      <p className="text-xs text-by-text-secondary">
        Shared with this workspace. You can edit or delete your own notes. Notes do not change the
        retained AI analysis.
      </p>
      <label className="block text-sm">
        {editing ? "Edit your note" : "Add a note"}
        <textarea
          autoFocus
          value={body}
          maxLength={10000}
          disabled={busy || !org || !user}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          rows={5}
          className="mt-2 w-full rounded-md border border-by-border-control p-3"
          placeholder="Write your observations and coaching follow-up…"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className="figma-button"
          disabled={busy || !body.trim() || !org || !user || !!q.error}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save note"}
        </button>
        {editing && (
          <button
            type="button"
            className="figma-button"
            disabled={busy}
            onClick={() => {
              setEditing(undefined);
              setBody("");
            }}
          >
            Cancel edit
          </button>
        )}
      </div>
      {saved && (
        <p role="status" className="text-xs text-emerald-700">
          Note saved.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {q.isPending ? (
        <p role="status">Loading notes…</p>
      ) : q.error ? (
        <p role="alert">
          Notes could not load.{" "}
          <button type="button" className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : !q.data?.length ? (
        <p className="text-sm text-by-text-secondary">No saved notes on this call.</p>
      ) : (
        q.data.map((note) => (
          <article key={note.id} className="rounded-lg border border-by-border-engraved p-3">
            <p className="text-[11px] text-by-text-secondary">
              {note.author_id === user?.id ? "You" : "Workspace member"} ·{" "}
              {new Date(note.created_at).toLocaleString()}
              {note.updated_at !== note.created_at ? " · edited" : ""}
            </p>
            <p className="my-3 whitespace-pre-wrap break-words text-sm">{note.body}</p>
            {note.author_id === user?.id && (
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="underline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(note);
                    setBody(note.body);
                    setSaved(false);
                  }}
                >
                  Edit note
                </button>
                <button
                  type="button"
                  className="underline text-red-700"
                  disabled={busy}
                  onClick={() => void remove(note)}
                >
                  Delete note
                </button>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
}
