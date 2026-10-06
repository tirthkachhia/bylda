import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { DataBoundary, StateEmpty } from "@/components/bylda";
import { useBehaviors, useMethodology, type Behavior } from "@/lib/data";
import {
  LocalField,
  LocalSelect,
  LocalSettingRow,
  LocalSettingsHeading,
  LocalSettingsNote,
} from "./LocalSettings";
import {
  LocalBreadcrumb,
  LocalMethodologyAction,
  LocalMethodologyEmpty,
  LocalMethodologyLayout,
} from "./LocalMethodology";
import { LocalDraftNotice, LocalMissingPreference } from "./LocalPreferences";
import { findMethodologyBehavior, ruleDescription } from "./methodologyModel";
export function E12MethodologyBehaviorRuleEditor() {
  const { methodologyId, ruleKey } = useParams({
    from: "/app/methodology/$methodologyId/rules/$ruleKey",
  });
  const query = useMethodology(methodologyId);
  const behaviors = useBehaviors();
  return (
    <LocalMethodologyLayout active="Behavior rules" methodologyId={methodologyId}>
      <DataBoundary query={query} empty={<LocalMethodologyEmpty />}>
        {(methodology) =>
          methodology ? (
            <DataBoundary query={behaviors}>
              {(catalog) => {
                const behavior = findMethodologyBehavior(methodology, catalog, ruleKey);
                return behavior ? (
                  <RuleEditor key={`${methodology.id}:${behavior.key}`} behavior={behavior} />
                ) : (
                  <StateEmpty
                    title="Behavior rule not found."
                    body="This rule isn't part of this methodology."
                    actions={[
                      {
                        label: "Back to behavior rules",
                        href: `/app/methodology/${encodeURIComponent(methodology.id)}/rules`,
                        variant: "secondary",
                      },
                    ]}
                  />
                );
              }}
            </DataBoundary>
          ) : (
            <LocalMethodologyEmpty />
          )
        }
      </DataBoundary>
    </LocalMethodologyLayout>
  );
}
function RuleEditor({ behavior }: { behavior: Behavior }) {
  const [definition, setDefinition] = useState(behavior.definition);
  const [higher, setHigher] = useState(behavior.higherIsBetter);
  return (
    <>
      <LocalBreadcrumb rules />
      <LocalSettingsHeading
        title={behavior.name}
        action={
          <div className="flex gap-2">
            <LocalMethodologyAction
              label="Test rule"
              variant="ghost"
              reason="Rule testing isn't connected. No calls were tested."
            />
            <LocalMethodologyAction label="Save rule" />
          </div>
        }
      />
      <LocalField
        label="DEFINITION (SHOWN TO USERS)"
        value={definition}
        onChange={(e) => setDefinition(e.target.value)}
      />
      <h2 className="type-ui-label">RULE</h2>
      <div className="flex min-h-52 flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-inset p-4">
        {ruleDescription(behavior.rule).map(([label, value]) => (
          <div key={label} className="flex items-center gap-5">
            <span className="type-mono-micro w-20 shrink-0 text-by-text-tertiary">{label}</span>
            <span className="type-ui-small rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2">
              {value}
            </span>
          </div>
        ))}
        <p className="type-ui-small text-by-text-secondary">
          Loaded rule · read only. Custom rule logic is LATER.
        </p>
      </div>
      <div className="[&>div]:py-6">
        <LocalSettingRow label="Direction" hint="Is more of this better or worse?">
          <LocalSelect
            label="Direction"
            value={higher ? "Higher is better" : "Lower is better"}
            options={["Higher is better", "Lower is better"]}
            onChange={(value) => setHigher(value === "Higher is better")}
          />
        </LocalSettingRow>
        <LocalSettingRow label="Stages" hint="Stage assignments aren't supplied.">
          <LocalMissingPreference />
        </LocalSettingRow>
        <LocalSettingRow
          label="Show to reps"
          hint="Visibility settings aren't supplied. Reps only see their own data."
        >
          <LocalMissingPreference />
        </LocalSettingRow>
      </div>
      <h2 className="type-ui-label">TEST RESULTS</h2>
      <div className="grid grid-cols-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised max-lg:grid-cols-2">
        {[
          "CALLS MATCHED",
          "OCCURRENCES",
          "AGREES WITH MANUAL REVIEW",
          "CHANGE VS CURRENT RULE",
        ].map((label) => (
          <div key={label} className="border-r border-by-border-engraved p-4 last:border-r-0">
            <h3 className="type-mono-micro text-by-text-tertiary">{label}</h3>
            <p className="type-ui-body-strong mt-2">—</p>
          </div>
        ))}
      </div>
      <LocalSettingsNote title="TESTING ISN'T AVAILABLE">
        No test results or matched-call evidence are supplied. Saving and testing aren't connected.
      </LocalSettingsNote>
      <LocalDraftNotice
        changed={definition !== behavior.definition || higher !== behavior.higherIsBetter}
        message={null}
      />
    </>
  );
}
