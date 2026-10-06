import { useState } from "react";
import { Button, DataBoundary } from "@/components/bylda";
import { useRetentionPolicy, useAnalysisPreferences, type RetentionPolicy } from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsHeading,
  LocalSettingRow,
  LocalSelect,
  LocalSettingsNote,
} from "./LocalSettings";
import {
  LocalPreferenceAccess,
  LocalPreferenceSwitch,
  LocalMissingPreference,
  LocalDraftNotice,
} from "./LocalPreferences";

export function E8SettingsRetentionPrivacy() {
  const query = useRetentionPolicy();
  return (
    <LocalSettingsLayout active="Retention & privacy">
      <LocalPreferenceAccess owner>
        <DataBoundary query={query}>{(policy) => <RetentionForm policy={policy} />}</DataBoundary>
      </LocalPreferenceAccess>
    </LocalSettingsLayout>
  );
}
function RetentionForm({ policy }: { policy: RetentionPolicy }) {
  const [audio, setAudio] = useState(policy.recordingsDays);
  const [transcripts, setTranscripts] = useState(policy.transcriptsDays);
  const [message, setMessage] = useState<string | null>(null);
  const changed = audio !== policy.recordingsDays || transcripts !== policy.transcriptsDays;
  return (
    <div className="flex flex-col gap-5">
      <LocalSettingsHeading
        title="Retention & privacy"
        subtitle="Owner only. Changes are unsaved drafts; no calls are changed."
      />
      <LocalSettingRow
        label="Keep call audio for"
        hint="Audio retention period from the shared policy."
      >
        <LocalSelect
          label="Keep call audio for"
          value={`${audio} days`}
          options={[...new Set([policy.recordingsDays, 30, 90, 180, 365])].map((n) => `${n} days`)}
          onChange={(v) => {
            setAudio(Number.parseInt(v));
            setMessage(null);
          }}
        />
      </LocalSettingRow>
      <LocalSettingRow label="Keep transcripts for">
        <LocalSelect
          label="Keep transcripts for"
          value={`${transcripts} days`}
          options={[...new Set([policy.transcriptsDays, 90, 180, 365, 730])].map(
            (n) => `${n} days`,
          )}
          onChange={(v) => {
            setTranscripts(Number.parseInt(v));
            setMessage(null);
          }}
        />
      </LocalSettingRow>
      <LocalSettingRow
        label="Keep behavioral events & insights for"
        hint="Needed for trends and coaching results."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <RedactionPreference />
      <LocalSettingRow
        label="Recording consent notice"
        hint="Consent policy and recorder enforcement aren't available in the shared settings."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <LocalSettingRow
        label="Use data to train shared models"
        hint="Model-training policy isn't supplied by the shared settings."
      >
        <LocalMissingPreference />
      </LocalSettingRow>
      <LocalSettingRow
        label="Export all data"
        hint="Export format and delivery time aren't available yet."
      >
        <Button
          variant="secondary"
          onClick={() => setMessage("Data export isn't connected. No export was requested.")}
        >
          Request export
        </Button>
      </LocalSettingRow>
      <LocalSettingRow
        label="Delete a person’s data"
        hint={
          policy.deleteOnRequest
            ? "Deletion on request is enabled in the shared policy. Person selection and deletion aren't connected."
            : "Deletion on request is disabled in the shared policy."
        }
      >
        <Button
          variant="secondary"
          disabled={!policy.deleteOnRequest}
          onClick={() => setMessage("Person deletion isn't connected. No data was deleted.")}
        >
          Start deletion
        </Button>
      </LocalSettingRow>
      <LocalSettingsNote title="DPA & SUBPROCESSORS">
        DPA, subprocessor documents and storage-region details aren't available yet.
      </LocalSettingsNote>
      <div>
        <Button
          onClick={() =>
            setMessage("Retention saving isn't connected. Nothing was saved or deleted.")
          }
        >
          Save
        </Button>
      </div>
      <LocalDraftNotice changed={changed} message={message} />
    </div>
  );
}
function RedactionPreference() {
  const query = useAnalysisPreferences();
  return (
    <DataBoundary query={query}>
      {(preferences) => (
        <RedactionDraft key={String(preferences.redactPii)} initial={preferences.redactPii} />
      )}
    </DataBoundary>
  );
}
function RedactionDraft({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div>
      <LocalSettingRow
        label="Redact PII in transcripts"
        hint="Shared analysis preference. Redaction coverage isn't specified."
      >
        <LocalPreferenceSwitch
          label="Redact PII in transcripts"
          checked={checked}
          onChange={setChecked}
        />
      </LocalSettingRow>
      <LocalDraftNotice changed={checked !== initial} message={null} />
    </div>
  );
}
