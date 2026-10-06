import type { Behavior, Person, Role } from "@/lib/data";

export function canAssign(role: Role) {
  return ["owner", "admin", "manager", "coach"].includes(role);
}
export function assignmentProblem(
  input: { repId: string; behaviorKey: string; note: string; target: string; calls: string },
  members: Person[],
  behaviors: Behavior[],
) {
  if (!members.some((p) => p.id === input.repId && p.role === "rep"))
    return "Choose an available rep.";
  if (!behaviors.some((b) => b.key === input.behaviorKey && b.enabled))
    return "Choose an enabled behavior.";
  if (!input.note.trim()) return "Add a note for the rep.";
  if (!input.target.trim() || !Number.isFinite(Number(input.target)))
    return "Enter a finite numeric target.";
  if (!input.calls.trim() || !Number.isSafeInteger(Number(input.calls)) || Number(input.calls) < 1)
    return "Judge after calls must be a positive whole number.";
  return null;
}
