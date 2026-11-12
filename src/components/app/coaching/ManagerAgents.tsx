import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/invokeEdge";
import type { Team } from "@/lib/coaching/workspace";

export function ManagerAgents({
  organizationId,
  teams,
}: {
  organizationId: string;
  teams: Team[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedTeam = teams.find((t) => t.id === teamId)?.id ?? teams[0]?.id ?? "";
  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !selectedTeam) return;
    setBusy(true);
    setError("");
    try {
      const result = await invokeEdge<{ status: string }>(
        "team-invite",
        {
          organizationId,
          teamId: selectedTeam,
          name: name.trim(),
          email: email.trim(),
          role: "member",
        },
        { retries: 0 },
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coaching-teams", organizationId] }),
        qc.invalidateQueries({ queryKey: ["reps", organizationId] }),
        qc.invalidateQueries({ queryKey: ["org-members", organizationId] }),
        qc.invalidateQueries({ queryKey: ["behavior-manager-home", organizationId] }),
      ]);
      setName("");
      setEmail("");
      toast.success(
        result.status === "added_existing"
          ? "Agent added to your team"
          : "Agent invited to your team",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent could not be added.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border p-4 space-y-3" aria-label="Add an agent">
      <h2>Add an agent</h2>
      <p className="text-xs text-by-text-secondary">
        Invite an agent to sign in and link their calls, coaching and reports to your team. Existing
        accounts keep their password.
      </p>
      {!teams.length ? (
        <p className="text-xs">Create your team first, then add its agents here.</p>
      ) : (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void invite(event)}>
          <label className="figma-field">
            Agent name
            <input
              required
              maxLength={120}
              autoComplete="name"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="figma-field">
            Work email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="figma-field">
            Team
            <select
              value={selectedTeam}
              disabled={busy}
              onChange={(e) => setTeamId(e.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="figma-button figma-button-primary mb-[18px]"
            disabled={busy || !name.trim() || !email.trim()}
          >
            {busy ? "Adding agent…" : "Add agent"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
