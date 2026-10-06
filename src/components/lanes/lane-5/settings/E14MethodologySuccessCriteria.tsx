import { useState } from "react";
import { DataBoundary } from "@/components/bylda";
import { useSuccessCriteria, type SuccessCriterion } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsNote,
  LocalSettingsTable,
  LocalSettingRow,
} from "./LocalSettings";
import { LocalMethodologyLayout } from "./LocalMethodology";
import {
  LocalDraftNotice,
  LocalMissingPreference,
  LocalPreferenceSwitch,
} from "./LocalPreferences";
const outcomeNames: Record<SuccessCriterion["outcome"], string> = {
  next_step_booked: "Next step booked",
  stage_advanced: "Stage advanced",
  closed_won_lost: "Closed-won / lost",
  meeting_held: "Meeting held",
};
export function E14MethodologySuccessCriteria() {
  const query = useSuccessCriteria();
  return (
    <LocalMethodologyLayout active="Success criteria">
      <LocalSettingsHeading
        title="Success criteria"
        subtitle="What a good call and outcome mean for this team. Bylda learns behavior ↔ outcome associations against these."
      />
      <h2 className="type-ui-label">A GOOD CALL</h2>
      <div className="[&>div]:py-6">
        {[
          "Ends with a next step (date + owner)",
          "Prospect talk share in discovery",
          "Economic buyer identified",
          "Recap before pricing",
        ].map((label) => (
          <LocalSettingRow key={label} label={label}>
            <LocalMissingPreference />
          </LocalSettingRow>
        ))}
      </div>
      <h2 className="type-ui-label">OUTCOMES TO LEARN FROM</h2>
      <DataBoundary query={query} empty={<LocalSettingsEmpty noun="success criteria" />}>
        {(criteria) => (
          <OutcomeSettings key={criteria.map((item) => item.id).join(":")} criteria={criteria} />
        )}
      </DataBoundary>
      <LocalSettingsNote title="WHY NEXT STEPS FIRST">
        Near-term outcomes can provide earlier feedback while deals progress. Associations with
        outcomes require enough evidence; they don't establish cause. Custom scoring weights are
        LATER.
      </LocalSettingsNote>
    </LocalMethodologyLayout>
  );
}
function OutcomeSettings({ criteria }: { criteria: SuccessCriterion[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  return (
    <>
      <LocalSettingsTable
        headings={["OUTCOME", "SOURCE", "WINDOW", "WEIGHT", "ON"]}
        columnClasses={["w-[27%]", "w-[24%]", "w-[17%]", "w-[17%]", "w-[15%]"]}
      >
        {criteria.map((item) => (
          <tr key={item.id}>
            <td className={cell}>{outcomeNames[item.outcome]}</td>
            <td className={cell}>{item.source === "call" ? "Call" : "CRM"}</td>
            <td className={cell}>—</td>
            <td className={cell}>—</td>
            <td className={cell}>
              <LocalPreferenceSwitch
                label={outcomeNames[item.outcome]}
                checked={enabled[item.id] ?? item.enabled}
                onChange={(value) => setEnabled({ ...enabled, [item.id]: value })}
              />
            </td>
          </tr>
        ))}
      </LocalSettingsTable>
      <LocalDraftNotice
        changed={criteria.some((item) => (enabled[item.id] ?? item.enabled) !== item.enabled)}
        message={null}
      />
    </>
  );
}
