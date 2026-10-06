import { useState } from "react";
import { Button, DataBoundary } from "@/components/bylda";
import { useWorkspaceSettings, type WorkspaceSettings } from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsAccess,
  LocalSettingsHeading,
  LocalField,
  LocalSettingRow,
  LocalSelect,
  LocalSettingsNote,
  LocalUnavailable,
} from "./LocalSettings";

export function E1SettingsWorkspaceGeneral() {
  const query = useWorkspaceSettings();
  return (
    <LocalSettingsLayout active="General">
      <LocalSettingsAccess ownerOnly>
        <DataBoundary query={query}>
          {(settings) => <WorkspaceForm key={settings.id} settings={settings} />}
        </DataBoundary>
      </LocalSettingsAccess>
    </LocalSettingsLayout>
  );
}
function WorkspaceForm({ settings }: { settings: WorkspaceSettings }) {
  const [name, setName] = useState(settings.name);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [week, setWeek] = useState(settings.weekStartsOn === "monday" ? "Monday" : "Sunday");
  const [notice, setNotice] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <LocalSettingsHeading
        title="Workspace"
        subtitle={`Applies to everyone in ${settings.name}.`}
      />
      <LocalField label="WORKSPACE NAME" value={name} onChange={(e) => setName(e.target.value)} />
      <LocalField
        label="DOMAIN"
        placeholder="Not available"
        disabled
        hint="Domain and join-request settings aren't available yet."
      />
      <LocalSettingRow label="Time zone" hint="Briefs and “yesterday” use this.">
        <LocalSelect
          label="Time zone"
          value={timezone}
          options={[
            ...new Set([
              settings.timezone,
              "UTC",
              "America/New_York",
              "America/Los_Angeles",
              "Europe/London",
              "Asia/Kolkata",
            ]),
          ]}
          onChange={setTimezone}
        />
      </LocalSettingRow>
      <LocalSettingRow label="Week starts on" hint="Weekly reports use the selected start day.">
        <LocalSelect
          label="Week starts on"
          value={week}
          options={["Monday", "Sunday"]}
          onChange={setWeek}
        />
      </LocalSettingRow>
      <LocalSettingRow
        label="Default language for analysis"
        hint="Transcription and behavior detection."
      >
        <span className="type-ui-small text-by-text-tertiary">Not available</span>
      </LocalSettingRow>
      <LocalSettingRow label="Allow join requests from domain">
        <span className="type-ui-small text-by-text-tertiary">Not available</span>
      </LocalSettingRow>
      <div>
        <Button onClick={() => setNotice(true)}>Save changes</Button>
        {notice && (
          <p role="status" className="type-ui-small mt-2">
            Workspace saving isn't connected yet. These changes are unsaved drafts.
          </p>
        )}
      </div>
      <LocalSettingsNote title="DANGER ZONE">
        <LocalSettingRow
          label="Delete workspace"
          hint="Workspace deletion isn't connected yet. Owner only."
        >
          <LocalUnavailable action="Delete workspace" />
        </LocalSettingRow>
      </LocalSettingsNote>
    </div>
  );
}
