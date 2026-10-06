import { Avatar, Button, DataBoundary } from "@/components/bylda";
import { useTeams, useMembers, useViewer } from "@/lib/data";
import { useState } from "react";
import {
  LocalSettingsLayout,
  LocalSettingsAccess,
  LocalSettingsHeading,
  LocalSettingsTable,
  LocalSettingsEmpty,
  LocalSettingsNote,
  LocalUnavailable,
  cell,
} from "./LocalSettings";
export function E4SettingsTeams() {
  const teams = useTeams();
  const members = useMembers();
  const viewer = useViewer();
  const [notice, setNotice] = useState(false);
  return (
    <LocalSettingsLayout active="Teams">
      <LocalSettingsAccess>
        <DataBoundary query={teams} empty={<LocalSettingsEmpty noun="teams" />}>
          {(allTeams) => {
            const teams =
              viewer.data?.role === "manager"
                ? allTeams.filter((t) => t.id === viewer.data?.team?.id)
                : allTeams;
            return (
              <DataBoundary query={members}>
                {(members) => (
                  <div className="flex flex-col gap-5">
                    <LocalSettingsHeading
                      title="Teams"
                      subtitle="Each team has its own manager, methodology and delivery settings."
                      action={<Button onClick={() => setNotice(true)}>New team</Button>}
                    />
                    {notice && (
                      <p role="status" className="type-ui-small">
                        Team creation isn't connected yet. Nothing was saved.
                      </p>
                    )}
                    <LocalSettingsTable
                      headings={["TEAM", "MANAGER", "REPS", "METHODOLOGY", "BRIEF TIME", "ACTIONS"]}
                    >
                      {teams.map((team) => {
                        const manager = members.find(
                          (m) => m.teamId === team.id && m.role === "manager",
                        );
                        return (
                          <tr key={team.id}>
                            <td className={cell}>
                              <span className="type-ui-body-strong">{team.name}</span>
                            </td>
                            <td className={cell}>
                              {manager ? (
                                <div className="flex items-center gap-2">
                                  <Avatar name={manager.name} size={22} />
                                  {manager.name.split(" ")[0]}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className={cell}>
                              <span className="type-mono-data">{team.repCount}</span>
                            </td>
                            <td className={cell}>—</td>
                            <td className={cell}>—</td>
                            <td className={cell}>
                              <LocalUnavailable
                                compact
                                action={team.status === "setup" ? "Set up team" : "Edit team"}
                              >
                                {team.status === "setup" ? "Set up" : "Edit"}
                              </LocalUnavailable>
                            </td>
                          </tr>
                        );
                      })}
                    </LocalSettingsTable>
                    <LocalSettingsNote title="CROSS-TEAM">
                      Owners see patterns across teams in Intelligence. Managers see only their own
                      team.
                    </LocalSettingsNote>
                    <p className="type-ui-small text-by-text-secondary">
                      Methodology assignments and brief times aren't available.
                    </p>
                  </div>
                )}
              </DataBoundary>
            );
          }}
        </DataBoundary>
      </LocalSettingsAccess>
    </LocalSettingsLayout>
  );
}
