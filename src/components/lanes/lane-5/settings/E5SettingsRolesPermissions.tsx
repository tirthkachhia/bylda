import { DataBoundary, Tag } from "@/components/bylda";
import { useRoleDefinitions } from "@/lib/data";
import { capabilities, permissionCell } from "./settingsModel";
import {
  LocalSettingsLayout,
  LocalSettingsAccess,
  LocalSettingsHeading,
  LocalSettingsTable,
  LocalSettingsEmpty,
  LocalSettingRow,
  LocalPolicySwitch,
  cell,
} from "./LocalSettings";
export function E5SettingsRolesPermissions() {
  const roles = useRoleDefinitions();
  return (
    <LocalSettingsLayout active="Roles & permissions">
      <LocalSettingsAccess>
        <DataBoundary query={roles} empty={<LocalSettingsEmpty noun="role definitions" />}>
          {(roles) => (
            <div className="flex flex-col gap-4">
              <LocalSettingsHeading
                title="Roles & permissions"
                subtitle="Fixed role definitions supplied by the workspace data layer."
              />
              <LocalSettingsTable
                headings={["CAPABILITY", ...roles.map((r) => r.name.toUpperCase())]}
              >
                {capabilities.map(([label, key]) => (
                  <tr key={key}>
                    <th scope="row" className={`${cell} type-ui-body-strong`}>
                      {label}
                    </th>
                    {roles.map((role) => (
                      <td
                        key={role.role}
                        className={`${cell} type-mono-data text-by-text-secondary`}
                      >
                        {permissionCell(role, key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </LocalSettingsTable>
              <p className="type-ui-small text-by-text-secondary">
                ● = explicit grant · — = not specified by the shared contract. This matrix describes
                grants; it does not enforce access. Privacy rules below remain fixed.
              </p>
              <h2 className="type-ui-label">REP PRIVACY</h2>
              <LocalSettingRow label="Reps can see their own calls">
                <LocalPolicySwitch label="Reps can see their own calls" checked />
              </LocalSettingRow>
              <LocalSettingRow
                label="Reps can see teammates’ calls"
                hint="Unavailable. Rep views are restricted to their own calls."
              >
                <LocalPolicySwitch label="Reps can see teammates’ calls" checked={false} />
              </LocalSettingRow>
              <LocalSettingRow
                label="Show reps team averages"
                hint="Anonymous team median on My progress only, when the team has at least 8 reps. Never names or ranks."
              >
                <Tag>Policy controlled</Tag>
              </LocalSettingRow>
              <LocalSettingRow label="Leaderboards" hint="Not available in V1, by design.">
                <Tag>Unavailable</Tag>
              </LocalSettingRow>
            </div>
          )}
        </DataBoundary>
      </LocalSettingsAccess>
    </LocalSettingsLayout>
  );
}
