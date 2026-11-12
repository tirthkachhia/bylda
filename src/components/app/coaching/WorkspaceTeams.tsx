import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  repsQuery,
  playbooksQuery,
  organizationMembersQuery,
  coachingManagerPermissionQuery,
} from "@/lib/queries";
import { teamsQuery, saveTeam, type Team } from "@/lib/coaching/workspace";
import { ManagerAgents } from "./ManagerAgents";
import { useWorkspaceView } from "@/lib/workspace-view";
export function WorkspaceTeams() {
  const managerView = useWorkspaceView() === "manager";
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const q = useQuery(teamsQuery(org)),
    reps = useQuery(repsQuery(org)),
    books = useQuery(playbooksQuery(org)),
    members = useQuery(organizationMembersQuery(org)),
    permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? "")),
    qc = useQueryClient();
  const [editing, setEditing] = useState<Team | undefined>(),
    [form, setForm] = useState(false),
    [name, setName] = useState(""),
    [manager, setManager] = useState(""),
    [repIds, setRepIds] = useState<string[]>([]),
    [playbook, setPlaybook] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveTeam(
        org,
        {
          name: name.trim(),
          manager_id: manager || null,
          rep_ids: repIds,
          playbook_id: playbook || null,
        },
        editing,
      );
      await qc.invalidateQueries({ queryKey: ["coaching-teams", org] });
      setForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Team could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="figma-panel space-y-4">
      <div className="flex justify-between gap-3">
        <h1>Teams</h1>
        {permission.data && (
          <button
            className="figma-button"
            onClick={() => {
              setEditing(undefined);
              setName("");
              setManager(user?.id ?? "");
              setRepIds([]);
              setPlaybook("");
              setForm(true);
            }}
          >
            New team
          </button>
        )}
      </div>
      {managerView && permission.data && !q.isPending && !q.error && (
        <ManagerAgents key={org} organizationId={org} teams={q.data ?? []} />
      )}
      {form && (
        <section className="rounded-xl border p-4 space-y-3">
          <label className="figma-field">
            Name
            <input value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="figma-field">
            Manager
            <select
              value={manager}
              disabled={
                !members.data?.some(
                  (m) => m.user_id === user?.id && ["owner", "admin"].includes(m.role),
                )
              }
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.data
                ?.filter((m) => ["owner", "admin", "manager"].includes(m.role))
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email ?? m.user_id}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Reps</legend>
            {reps.data?.map((r) => (
              <label key={r.id} className="flex gap-2 text-xs mt-2">
                <input
                  type="checkbox"
                  checked={repIds.includes(r.id)}
                  onChange={(e) =>
                    setRepIds((ids) =>
                      e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </fieldset>
          <label className="figma-field">
            Reference methodology
            <select value={playbook} onChange={(e) => setPlaybook(e.target.value)}>
              <option value="">None</option>
              {books.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs">Team reference does not overwrite each rep's assigned playbook.</p>
          <button
            className="figma-button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            Save team
          </button>
          <button className="figma-button ml-2" onClick={() => setForm(false)}>
            Cancel
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {q.error ? (
        <p role="alert">
          Teams could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : q.isPending ? (
        <p>Loading teams…</p>
      ) : q.data?.length ? (
        q.data.map((team) => (
          <article key={team.id} className="rounded-lg border p-4">
            <h2>{team.name}</h2>
            <p className="mt-2 text-xs">
              {members.data?.find((m) => m.user_id === team.manager_id)?.full_name ??
                "Manager unassigned"}{" "}
              · {team.rep_ids.length} reps ·{" "}
              {books.data?.find((b) => b.id === team.playbook_id)?.name ??
                "No reference methodology"}
            </p>
            <div className="my-3 flex flex-wrap gap-3">
              {team.rep_ids.map((id) => (
                <Link
                  key={id}
                  className="text-xs underline"
                  to="/app/crm/calls"
                  search={{ view: "people", repId: id }}
                >
                  {reps.data?.find((r) => r.id === id)?.name ?? "Archived rep"}
                  {reps.data?.find((r) => r.id === id)?.user_id
                    ? " · Login linked"
                    : " · No login yet"}
                </Link>
              ))}
            </div>
            {permission.data && (
              <button
                className="figma-button"
                onClick={() => {
                  setEditing(team);
                  setName(team.name);
                  setManager(team.manager_id ?? "");
                  setRepIds(team.rep_ids);
                  setPlaybook(team.playbook_id ?? "");
                  setForm(true);
                }}
              >
                Edit team
              </button>
            )}
          </article>
        ))
      ) : (
        <p className="figma-empty">No teams yet. Create a team and select its reps.</p>
      )}
    </section>
  );
}
