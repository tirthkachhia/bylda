import { useState } from "react";
import { Button, DataBoundary, Tag } from "@/components/bylda";
import {
  useAnalysisPreferences,
  REP_INSIGHT_MIN_CALLS,
  type AnalysisPreferences,
} from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsHeading,
  LocalSettingRow,
  LocalSelect,
} from "./LocalSettings";
import {
  LocalPreferenceAccess,
  LocalMissingPreference,
  LocalDraftNotice,
} from "./LocalPreferences";

export function E6SettingsAnalysisPreferences() {
  const query = useAnalysisPreferences();
  return (
    <LocalSettingsLayout active="Analysis preferences">
      <LocalPreferenceAccess>
        <DataBoundary query={query}>
          {(preferences) => <AnalysisForm preferences={preferences} />}
        </DataBoundary>
      </LocalPreferenceAccess>
    </LocalSettingsLayout>
  );
}
function AnalysisForm({ preferences }: { preferences: AnalysisPreferences }) {
  const [seconds, setSeconds] = useState(preferences.minCallSeconds);
  const [exclude, setExclude] = useState(preferences.excludeInternalCalls);
  const [message, setMessage] = useState<string | null>(null);
  const changed =
    seconds !== preferences.minCallSeconds || exclude !== preferences.excludeInternalCalls;
  return (
    <div className="flex flex-col gap-5">
      <LocalSettingsHeading
        title="Analysis preferences"
        subtitle="How Bylda decides what to tell you."
      />
      <LocalSettingRow
        label="Minimum calls before judging a rep"
        hint="Below this, Bylda shows “not enough data yet”. Fixed by the insight policy."
      >
        <Tag>{REP_INSIGHT_MIN_CALLS} calls · locked</Tag>
      </LocalSettingRow>
      <LocalSettingRow
        label="Minimum confidence for coaching suggestions"
        hint="Low-confidence patterns can’t be assigned. Configurable threshold unavailable."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <LocalSettingRow
        label="Baseline window"
        hint="Rep changes are measured against their own history."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <LocalSettingRow label="Exclude calls shorter than" hint="Voicemails and no-shows.">
        <LocalSelect
          label="Exclude calls shorter than"
          value={durationLabel(seconds)}
          options={[...new Set([preferences.minCallSeconds, 60, 120, 180, 300])].map(durationLabel)}
          onChange={(value) => {
            setSeconds(Number.parseInt(value) * (value.includes("minute") ? 60 : 1));
            setMessage(null);
          }}
        />
      </LocalSettingRow>
      <LocalSettingRow
        label="Internal calls"
        hint="Calls where every participant is internal. Workspace domain is unavailable."
      >
        <LocalSelect
          label="Internal calls"
          value={exclude ? "Exclude" : "Include"}
          options={["Exclude", "Include"]}
          onChange={(value) => {
            setExclude(value === "Exclude");
            setMessage(null);
          }}
        />
      </LocalSettingRow>
      <LocalSettingRow
        label="Outcome associations"
        hint="Link behavior to CRM outcomes once the sample is sufficient. Configurable setting unavailable."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <LocalSettingRow
        label="Language for relationships"
        hint="Bylda says “associated with”. Association alone does not establish causation."
      >
        <Tag>Locked</Tag>
      </LocalSettingRow>
      <div className="flex items-center gap-2">
        <Button onClick={() => setMessage("Analysis saving isn't connected. Nothing was saved.")}>
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            setMessage("Default preferences aren't available. Nothing was reset or saved.")
          }
        >
          Reset to defaults
        </Button>
      </div>
      <LocalDraftNotice changed={changed} message={message} />
    </div>
  );
}

function durationLabel(seconds: number) {
  return seconds % 60 === 0
    ? `${seconds / 60} ${seconds === 60 ? "minute" : "minutes"}`
    : `${seconds} seconds`;
}
