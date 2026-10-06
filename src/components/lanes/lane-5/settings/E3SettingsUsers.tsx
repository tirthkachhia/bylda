import { useState } from "react";
import { Avatar, Button, DataBoundary, Tag } from "@/components/bylda";
import {
  mocksForced,
  useMembers,
  useTeams,
  useInviteMembers,
  useRoleDefinitions,
  useViewer,
} from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsAccess,
  LocalSettingsHeading,
  LocalField,
  LocalSelect,
  LocalUnavailable,
  LocalSettingsEmpty,
  LocalSettingsTable,
  cell,
} from "./LocalSettings";
export function E3SettingsUsers() {
  const members = useMembers();
  const teams = useTeams();
  const viewer = useViewer();
  const [inviting, setInviting] = useState(false);
  return (
    <LocalSettingsLayout active="Users">
      <LocalSettingsAccess>
        <DataBoundary query={members} empty={<LocalSettingsEmpty noun="members" />}>
          {(allPeople) => {
            const people =
              viewer.data?.role === "manager"
                ? allPeople.filter(
                    (p) => p.teamId === viewer.data?.team?.id || p.id === viewer.data?.id,
                  )
                : allPeople;
            return (
              <DataBoundary query={teams}>
                {(teams) => (
                  <div className="flex flex-col gap-5">
                    <LocalSettingsHeading
                      title="Users"
                      subtitle={`${people.length} members · ${people.filter((p) => p.status === "invited").length} pending invites`}
                      action={
                        <Button onClick={() => setInviting((v) => !v)}>
                          {inviting ? "Close invitation" : "Invite people"}
                        </Button>
                      }
                    />
                    {inviting &&
                      (viewer.data?.role === "manager" ? (
                        <p role="status" className="type-ui-small">
                          Ask an owner to invite people. Team-scoped invitations aren’t connected
                          yet.
                        </p>
                      ) : (
                        <InviteForm />
                      ))}
                    <LocalSettingsTable
                      headings={["PERSON", "ROLE", "TEAM", "CALLS", "LAST ACTIVE", "ACTIONS"]}
                    >
                      {people.map((person) => (
                        <tr key={person.id}>
                          <td className={cell}>
                            <div className="flex items-center gap-2">
                              <Avatar name={person.name} size={22} />
                              <span className="type-ui-body-strong">{person.name}</span>
                            </div>
                          </td>
                          <td className={cell}>
                            {person.role.charAt(0).toUpperCase() + person.role.slice(1)}
                          </td>
                          <td className={cell}>
                            {teams.find((t) => t.id === person.teamId)?.name ?? "—"}
                          </td>
                          <td className={cell}>—</td>
                          <td className={cell}>
                            {person.status === "invited" ? <Tag>Invited</Tag> : "—"}
                          </td>
                          <td className={cell}>
                            <LocalUnavailable
                              compact
                              action={
                                person.status === "invited"
                                  ? "Resend invitation"
                                  : `Manage ${person.name}`
                              }
                            >
                              {person.status === "invited" ? "Resend" : "Manage"}
                            </LocalUnavailable>
                          </td>
                        </tr>
                      ))}
                    </LocalSettingsTable>
                    <p className="type-ui-small text-by-text-secondary">
                      Call counts, last-active times and unmatched voices aren't available.
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
function InviteForm() {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("rep");
  const [status, setStatus] = useState("");
  const mutation = useInviteMembers();
  const roles = useRoleDefinitions();
  const submit = async () => {
    const addresses = emails.split(/[,;\s]+/).filter(Boolean);
    if (!addresses.length || addresses.some((email) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
      setStatus("Enter valid email addresses separated by commas.");
      return;
    }
    setStatus("");
    try {
      await mutation.mutateAsync({ emails: [...new Set(addresses)], role });
      setStatus(
        mocksForced()
          ? "Mock invitation checked. No email was sent and no member was saved."
          : "Invitation request completed. Refresh to check the member list.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invitation failed. Try again.");
    }
  };
  return (
    <DataBoundary query={roles}>
      {(roles) => (
        <form
          className="flex flex-col gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <LocalField
            label="EMAIL ADDRESSES"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="name@example.com"
          />
          <LocalSelect
            label="Invitation role"
            value={role}
            options={roles.map((r) => r.role)}
            onChange={setRole}
          />
          <Button variant="secondary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send invitations"}
          </Button>
          {status && (
            <p role="status" className="type-ui-small">
              {status}
            </p>
          )}
        </form>
      )}
    </DataBoundary>
  );
}
