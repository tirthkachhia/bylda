import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { cn, DataBoundary, Tag } from "@/components/bylda";
import { useMethodology, type Methodology } from "@/lib/data";
import { LocalField, LocalSettingsHeading, LocalSettingRow } from "./LocalSettings";
import {
  LocalBreadcrumb,
  LocalMethodologyAction,
  LocalMethodologyEmpty,
  LocalMethodologyLayout,
  LocalMethodologyTabs,
} from "./LocalMethodology";
import { LocalDraftNotice, LocalMissingPreference } from "./LocalPreferences";
export function E10MethodologyDetail() {
  const { methodologyId } = useParams({ from: "/app/methodology/$methodologyId/" });
  const query = useMethodology(methodologyId);
  return (
    <LocalMethodologyLayout methodologyId={methodologyId}>
      <DataBoundary query={query} empty={<LocalMethodologyEmpty />}>
        {(methodology) =>
          methodology ? (
            <StageEditor key={methodology.id} methodology={methodology} />
          ) : (
            <LocalMethodologyEmpty />
          )
        }
      </DataBoundary>
    </LocalMethodologyLayout>
  );
}
function StageEditor({ methodology }: { methodology: Methodology }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const stages = [...methodology.stages].sort((a, b) => a.order - b.order);
  const [selected, setSelected] = useState(
    stages.find((stage) => stage.key === "pricing")?.key ?? stages[0]?.key,
  );
  const stage = stages.find((item) => item.key === selected);
  return (
    <>
      <LocalBreadcrumb />
      <LocalSettingsHeading
        title={methodology.name}
        subtitle={`${methodology.behaviors.length} behaviors · Team assignments and objection counts aren't available.`}
        action={
          <div className="flex gap-2">
            <LocalMethodologyAction label="Duplicate" variant="secondary" />
            <LocalMethodologyAction label="Save changes" />
          </div>
        }
      />
      <LocalMethodologyTabs methodology={methodology} active="Stages" />
      <div className="flex min-h-42 items-start overflow-x-auto">
        {stages.map((item, index) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected === item.key}
            onClick={() => setSelected(item.key)}
            className={cn(
              "flex min-h-36 min-w-32 flex-1 flex-col gap-2 rounded-by-card border p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
              selected === item.key
                ? "border-by-text-primary bg-by-surface-raised"
                : "border-by-border-engraved bg-by-surface-inset",
            )}
          >
            <span className="type-mono-micro text-by-text-tertiary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="type-ui-body-strong">{names[item.key] ?? item.name}</span>
            <div className="flex flex-wrap gap-1">
              {item.exitCriteria.map((criterion, i) => (
                <Tag key={`${criterion}-${i}`}>{criterion}</Tag>
              ))}
            </div>
          </button>
        ))}
      </div>
      {stage ? (
        <>
          <h2 className="type-ui-label">STAGE EDITOR · {names[stage.key] ?? stage.name}</h2>
          <div className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
            <LocalField
              label="STAGE NAME"
              value={names[stage.key] ?? stage.name}
              onChange={(e) => setNames({ ...names, [stage.key]: e.target.value })}
            />
            <LocalField
              label="HOW BYLDA DETECTS IT"
              value="Not available"
              readOnly
              hint="Detection rules aren't supplied. Editable phrases are LATER."
            />
            <h3 className="type-ui-label">BEHAVIORS THAT MATTER IN THIS STAGE</h3>
            <LocalSettingRow
              label="Stage behavior assignments"
              hint="This methodology doesn't supply stage-specific behavior settings."
            >
              <LocalMissingPreference />
            </LocalSettingRow>
          </div>
        </>
      ) : (
        <LocalSettingsEmptyStages />
      )}
      <LocalDraftNotice
        changed={Object.entries(names).some(
          ([key, name]) => name !== stages.find((s) => s.key === key)?.name,
        )}
        message={null}
      />
    </>
  );
}
function LocalSettingsEmptyStages() {
  return <p className="type-ui-small text-by-text-secondary">No stages configured.</p>;
}
