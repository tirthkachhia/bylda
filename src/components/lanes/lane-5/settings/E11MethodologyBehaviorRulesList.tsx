import { useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { DataBoundary } from "@/components/bylda";
import { useMethodology, useMethodologies, type Methodology } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsTable,
} from "./LocalSettings";
import {
  LocalMethodologyAction,
  LocalMethodologyEmpty,
  LocalMethodologyLayout,
} from "./LocalMethodology";
import { LocalDraftNotice, LocalPreferenceSwitch } from "./LocalPreferences";
export function E11MethodologyBehaviorRulesList() {
  const { methodologyId } = useParams({ from: "/app/methodology/$methodologyId/rules/" });
  const query = useMethodology(methodologyId);
  return (
    <LocalMethodologyLayout active="Behavior rules" methodologyId={methodologyId}>
      <DataBoundary query={query} empty={<LocalMethodologyEmpty />}>
        {(methodology) =>
          methodology ? (
            <BehaviorList key={methodology.id} methodology={methodology} />
          ) : (
            <LocalMethodologyEmpty />
          )
        }
      </DataBoundary>
    </LocalMethodologyLayout>
  );
}
function BehaviorList({ methodology }: { methodology: Methodology }) {
  const navigate = useNavigate();
  const methodologies = useMethodologies();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const isOn = (key: string, original: boolean) => enabled[key] ?? original;
  const count = methodology.behaviors.filter((b) => isOn(b.key, b.enabled)).length;
  return (
    <>
      <LocalSettingsHeading
        title="Behavior rules"
        subtitle={`${count} of ${methodology.behaviors.length} behaviors on in ${methodology.name}. Reps see only their own data.`}
        action={
          <div className="flex shrink-0 gap-2">
            <DataBoundary query={methodologies}>
              {(items) => (
                <select
                  aria-label="Methodology"
                  className="type-ui-small rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2 outline-none focus:ring-2 focus:ring-by-focus-ring"
                  value={methodology.id}
                  onChange={(e) =>
                    void navigate({
                      to: "/app/methodology/$methodologyId/rules",
                      params: { methodologyId: e.target.value },
                      search: true,
                    })
                  }
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </DataBoundary>
            <LocalMethodologyAction
              label="New rule · LATER"
              reason="Custom rule logic is LATER. No rule was created."
            />
          </div>
        }
      />
      {methodology.behaviors.length ? (
        <LocalSettingsTable
          headings={["BEHAVIOR", "DETECTED FROM", "DIRECTION", "REPS SEE", "ON", "ACTION"]}
          columnClasses={["w-[28%]", "w-[22%]", "w-[15%]", "w-[10%]", "w-[8%]", "w-[17%]"]}
        >
          {methodology.behaviors.map((behavior) => (
            <tr key={behavior.key}>
              <td className={cell}>
                <span className="type-ui-body-strong">{behavior.name}</span>
              </td>
              <td className={cell}>—</td>
              <td className={`${cell} type-mono-data text-by-text-secondary`}>
                {behavior.higherIsBetter ? "Higher is better" : "Lower is better"}
              </td>
              <td className={cell}>—</td>
              <td className={cell}>
                <LocalPreferenceSwitch
                  label={behavior.name}
                  checked={isOn(behavior.key, behavior.enabled)}
                  onChange={(value) => setEnabled({ ...enabled, [behavior.key]: value })}
                />
              </td>
              <td className={cell}>
                <Link
                  search={true}
                  to="/app/methodology/$methodologyId/rules/$ruleKey"
                  params={{ methodologyId: methodology.id, ruleKey: behavior.key }}
                  className="hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </LocalSettingsTable>
      ) : (
        <LocalSettingsEmpty noun="behaviors" />
      )}
      <LocalDraftNotice
        changed={methodology.behaviors.some((b) => isOn(b.key, b.enabled) !== b.enabled)}
        message={null}
      />
    </>
  );
}
