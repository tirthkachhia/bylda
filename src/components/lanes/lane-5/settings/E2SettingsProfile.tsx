import { useState } from "react";
import { Avatar, DataBoundary, Tag } from "@/components/bylda";
import { useProfile, useViewer, type Profile } from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsAccess,
  LocalSettingsHeading,
  LocalField,
  LocalSettingRow,
  LocalUnavailable,
} from "./LocalSettings";
export function E2SettingsProfile() {
  const profile = useProfile();
  const viewer = useViewer();
  return (
    <LocalSettingsLayout active="Profile">
      <LocalSettingsAccess profile>
        <DataBoundary query={profile}>
          {(person) => (
            <DataBoundary query={viewer}>
              {(viewer) => (
                <ProfileForm key={person.id} profile={person} subtitle={viewer.subtitle} />
              )}
            </DataBoundary>
          )}
        </DataBoundary>
      </LocalSettingsAccess>
    </LocalSettingsLayout>
  );
}
function ProfileForm({ profile, subtitle }: { profile: Profile; subtitle: string }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? "");
  return (
    <div className="flex flex-col gap-5">
      <LocalSettingsHeading title="Profile" />
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} src={profile.avatarUrl} size={64} />
        <LocalUnavailable action="Change photo" />
      </div>
      <LocalField label="NAME" value={name} onChange={(e) => setName(e.target.value)} />
      <LocalField
        label="EMAIL"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="Used to match you to calls in Zoom and Gong."
      />
      {(name !== profile.name || email !== (profile.email ?? "")) && (
        <p role="status" className="type-ui-small text-by-text-secondary">
          Unsaved draft. Profile saving isn't connected yet.
        </p>
      )}
      <LocalSettingRow label="Role" hint="Set by an owner.">
        <Tag>{subtitle}</Tag>
      </LocalSettingRow>
      <LocalSettingRow label="My daily brief">
        <LocalUnavailable action="Brief delivery preferences">Not available</LocalUnavailable>
      </LocalSettingRow>
      <LocalSettingRow label="Password" hint="Password-change history isn't available.">
        <LocalUnavailable action="Change password">Change</LocalUnavailable>
      </LocalSettingRow>
      <LocalSettingRow label="Two-factor authentication">
        <LocalUnavailable action="Two-factor authentication">Not available</LocalUnavailable>
      </LocalSettingRow>
      <LocalSettingRow label="Sessions" hint="Session details aren't available.">
        <LocalUnavailable action="Sign out others" />
      </LocalSettingRow>
    </div>
  );
}
