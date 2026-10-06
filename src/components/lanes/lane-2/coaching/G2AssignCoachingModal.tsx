import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Avatar, Button, DataBoundary, StateEmpty } from "@/components/bylda";
import {
  useAssignCoaching,
  useBehaviors,
  useTeamMembers,
  useViewer,
  type Behavior,
  type Person,
} from "@/lib/data";
import { LocalField, LocalSelect } from "@/components/lanes/lane-5/settings/LocalSettings";
import { LocalTextarea } from "@/components/lanes/lane-5/settings/LocalMethodology";
import { LocalCoachingError, LocalCoachingDenied, LocalMissing } from "./LocalCoaching";
import { canAssign, assignmentProblem } from "./coachingModel";

/** G2 — saved 14:24; manager-selected input, no inferred recommendation. */
export function G2AssignCoachingModal() {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        canAssign(person.role) ? (
          <AssignmentData key={`${person.id}:${person.role}`} />
        ) : (
          <LocalCoachingDenied />
        )
      }
    </DataBoundary>
  );
}
function AssignmentData() {
  const members = useTeamMembers();
  const behaviors = useBehaviors();
  return (
    <DataBoundary
      query={members}
      error={(error) => <LocalCoachingError error={error} retry={() => void members.refetch()} />}
      empty={<StateEmpty title="No team members available." />}
    >
      {(people) => (
        <DataBoundary
          query={behaviors}
          error={(error) => (
            <LocalCoachingError error={error} retry={() => void behaviors.refetch()} />
          )}
          empty={<StateEmpty title="No behaviors available." />}
        >
          {(rows) => (
            <LocalAssignmentModal
              members={people.filter((p) => p.role === "rep")}
              behaviors={rows.filter((b) => b.enabled)}
            />
          )}
        </DataBoundary>
      )}
    </DataBoundary>
  );
}
function LocalAssignmentModal({
  members,
  behaviors,
}: {
  members: Person[];
  behaviors: Behavior[];
}) {
  const navigate = useNavigate();
  const mutation = useAssignCoaching();
  const [repId, setRepId] = useState(members[0]?.id ?? "");
  const [behaviorKey, setBehaviorKey] = useState(behaviors[0]?.key ?? "");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState("");
  const [calls, setCalls] = useState("");
  const [problem, setProblem] = useState("");
  const [returnedId, setReturnedId] = useState("");
  const member = members.find((p) => p.id === repId);
  const behavior = behaviors.find((b) => b.key === behaviorKey);
  const dismiss = () => {
    if (!mutation.isPending) void navigate({ to: "/app/coaching", search: true });
  };
  if (!members.length || !behaviors.length)
    return (
      <StateEmpty
        title="Assignment unavailable."
        body="An eligible rep and an enabled behavior are required."
      />
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || returnedId) return;
    const invalid = assignmentProblem(
      { repId, behaviorKey, note, target, calls },
      members,
      behaviors,
    );
    setProblem(invalid ?? "");
    if (invalid) return;
    try {
      const result = await mutation.mutateAsync({
        repId,
        behaviorKey,
        note: note.trim(),
        target: Number(target),
        judgeAfterCalls: Number(calls),
        evidence: [],
      });
      if (!result.id || result.repId !== repId || result.behaviorKey !== behaviorKey) {
        setProblem("The returned focus doesn’t match this assignment. Saving is unconfirmed.");
        return;
      }
      setReturnedId(result.id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Assignment failed. Try again.");
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-by-surface-rail/40" />
        <Dialog.Content
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-28 z-50 max-h-[calc(100dvh-8rem)] w-[600px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-y-auto rounded-by-card border border-by-border-strong bg-by-surface-canvas text-by-text-primary shadow-by-float"
        >
          <header className="flex items-center gap-3 border-b border-by-border-engraved px-6 py-4">
            {member && <Avatar name={member.name} src={member.avatarUrl} size={32} />}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="type-ui-title">
                Assign coaching{member ? ` to ${member.name}` : ""}
              </Dialog.Title>
              <Dialog.Description className="type-mono-micro text-by-text-tertiary">
                MANAGER-SELECTED FOCUS · NO AUTOMATED RECOMMENDATION
              </Dialog.Description>
            </div>
            <Button
              variant="ghost"
              aria-label="Close assignment"
              className="outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring"
              disabled={mutation.isPending}
              onClick={dismiss}
            >
              ×
            </Button>
          </header>
          <form noValidate onSubmit={(e) => void submit(e)}>
            <fieldset
              disabled={mutation.isPending || !!returnedId}
              className="flex min-w-0 flex-col gap-4 px-6 py-5 disabled:opacity-60"
            >
              <label className="flex flex-col gap-1.5">
                <span className="type-ui-label text-by-text-secondary">REP</span>
                <LocalSelect
                  label="Rep"
                  value={member?.name ?? ""}
                  options={members.map((p) => p.name)}
                  onChange={(name) => setRepId(members.find((p) => p.name === name)?.id ?? "")}
                />
              </label>
              <div className="flex flex-col gap-2 rounded-by-control border border-by-focus-ring bg-by-surface-raised px-3.5 py-3">
                <h2 className="type-ui-label text-by-text-secondary">BEHAVIOR FOCUS</h2>
                <LocalSelect
                  label="Behavior focus"
                  value={behavior?.name ?? ""}
                  options={behaviors.map((b) => b.name)}
                  onChange={(name) =>
                    setBehaviorKey(behaviors.find((b) => b.name === name)?.key ?? "")
                  }
                />
                <p className="type-editorial-insight">{behavior?.definition}</p>
                <p className="type-mono-micro text-by-text-tertiary">
                  Active-focus limit unavailable. This preview cannot verify capacity.
                </p>
              </div>
              <section className="flex flex-col gap-2">
                <h2 className="type-ui-label text-by-text-secondary">EVIDENCE ATTACHED · 0</h2>
                <LocalMissing>
                  Clip selection isn’t available from this assignment contract. No evidence is
                  attached.
                </LocalMissing>
              </section>
              <LocalTextarea
                label="Your note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
              />
              <section className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-3.5 py-3">
                <h2 className="type-ui-label text-by-text-secondary">
                  HOW BYLDA WILL MEASURE THIS
                </h2>
                <p className="type-ui-small text-by-text-secondary">
                  Metric units and a measured baseline aren’t supplied. Enter a target in the
                  behavior’s metric units; no baseline is inferred.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <LocalField
                    label="Target"
                    type="number"
                    step="any"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                  />
                  <LocalField
                    label="Judge after calls"
                    type="number"
                    min="1"
                    step="1"
                    value={calls}
                    onChange={(e) => setCalls(e.target.value)}
                    required
                  />
                </div>
              </section>
              <div className="grid grid-cols-2 gap-3">
                <LocalField label="Check-in" value="Unavailable" disabled />
                <LocalField label="Also post to" value="Unavailable" disabled />
              </div>
            </fieldset>
            <div className="px-6 pb-4" aria-live="polite">
              {mutation.error ? (
                <LocalCoachingError error={mutation.error} />
              ) : (
                problem && (
                  <p role="alert" className="type-ui-small text-by-feedback-error">
                    {problem}
                  </p>
                )
              )}
              {returnedId && (
                <p role="status" className="type-ui-small">
                  Hook returned focus ID: <span className="type-mono-data">{returnedId}</span>.
                  Persistence and delivery are unconfirmed. The current mock contract returns a
                  local preview; it won’t appear after reload.
                </p>
              )}
            </div>
            <footer className="flex items-center gap-2 border-t border-by-border-engraved px-6 py-4">
              <p className="type-mono-micro flex-1 text-by-text-tertiary">
                Preview only · no saved assignment or delivery.
              </p>
              <Button variant="ghost" onClick={dismiss} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || !!returnedId}>
                {mutation.isPending ? "Assigning…" : "Assign focus"}
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
