import { Link } from "@tanstack/react-router";
import { DataBoundary, Tag } from "@/components/bylda";
import { useMethodologies } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsNote,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalMethodologyAction, LocalMethodologyLayout } from "./LocalMethodology";
import { templateLabels } from "./methodologyModel";
export function E9MethodologyIndex() {
  const query = useMethodologies();
  return (
    <LocalMethodologyLayout>
      <LocalSettingsHeading
        title="Methodology"
        subtitle="How each team sells. Bylda judges behavior against this — not a generic playbook."
        action={<LocalMethodologyAction label="New methodology" />}
      />
      <DataBoundary query={query} empty={<LocalSettingsEmpty noun="methodologies" />}>
        {(items) => (
          <LocalSettingsTable
            headings={["METHODOLOGY", "BASED ON", "TEAMS", "STAGES", "BEHAVIORS", "STATUS"]}
            columnClasses={["w-[27%]", "w-[15%]", "w-[18%]", "w-[9%]", "w-[11%]", "w-[20%]"]}
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td className={cell}>
                  <Link
                    search={true}
                    to="/app/methodology/$methodologyId"
                    params={{ methodologyId: item.id }}
                    className="type-ui-body-strong hover:underline"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className={cell}>{templateLabels[item.template]} template</td>
                <td className={cell}>
                  <span title="Team assignments aren't available">—</span>
                </td>
                <td className={cell}>{item.stages.length}</td>
                <td className={cell}>{item.behaviors.length}</td>
                <td className={cell}>
                  <Tag>{item.isActive ? "Active" : "Draft"}</Tag>
                </td>
              </tr>
            ))}
          </LocalSettingsTable>
        )}
      </DataBoundary>
      <div className="flex flex-col gap-3">
        <h2 className="type-mono-micro text-by-text-tertiary">TEMPLATES</h2>
        <div className="flex flex-wrap gap-2">
          {[
            templateLabels.meddic,
            "MEDDPICC",
            templateLabels.spin,
            templateLabels.challenger,
            templateLabels.sandler,
            templateLabels.bant,
            templateLabels.custom,
          ].map((label) => (
            <LocalMethodologyAction
              key={label}
              compact
              label={label}
              variant="secondary"
              reason={`${label} template creation isn't connected yet. No methodology was created.`}
            />
          ))}
        </div>
      </div>
      <LocalSettingsNote title="V1 SCOPE">
        Pick a template, toggle behaviors, rename stages, edit the objection list. Custom rule logic
        and scoring weights are LATER. Changes here are unsaved drafts until saving is connected.
      </LocalSettingsNote>
    </LocalMethodologyLayout>
  );
}
