import { useState } from "react";
import { Button, Icon } from "@/components/bylda";
import { useMethodologies, type Person, type Team } from "@/lib/data";
// Reused per CLAUDE.md §13 (existing `fold-into-kit` entries #34, #38 — Lane 5).
import { LocalField, LocalSelect, LocalSettingRow } from "../../lane-5/settings/LocalSettings";
import { LocalDraftNotice, LocalPreferenceSwitch } from "../../lane-5/settings/LocalPreferences";
import { TeamDetailFrame } from "./teamDetail";
import { activeMethodology } from "./teamData";
import { teamDemo } from "./teamDemo";

/**
 * T7 · Team Detail — Settings
 * Figma 52:3634 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId/settings
 * Hooks: useTeam — see src/lib/data/README.md
 *
 * There is no team-settings mutation in the data layer yet (LANE_REQUESTS L4-1): edits stay a
 * local draft and the page says so. Nothing is written.
 */
export function T7TeamDetailSettings() {
  return (
    <TeamDetailFrame tab="settings">
      {(v) => <SettingsForm key={v.team.id} team={v.team} people={v.people} />}
    </TeamDetailFrame>
  );
}

type Draft = {
  name: string;
  managerId: string;
  methodologyId: string;
  managerBrief: boolean;
  repBrief: boolean;
  teamRoom: boolean;
  repsSeeMedian: boolean;
};

function SettingsForm({ team, people }: { team: Team; people: Person[] }) {
  const methodologies = useMethodologies();
  const managers = people.filter((p) => p.role === "manager" || p.role === "owner");
  const delivery = teamDemo(team.id)?.delivery;
  const initial: Draft = {
    name: team.name,
    managerId: team.managerId ?? "",
    methodologyId: activeMethodology(methodologies.data)?.id ?? "",
    // GAP: per-team delivery + median-visibility settings (LANE_REQUESTS L4-1) — draft only
    managerBrief: true,
    repBrief: true,
    teamRoom: true,
    repsSeeMedian: true,
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const changed = (Object.keys(initial) as (keyof Draft)[]).some(
    (k) => k !== "methodologyId" && draft[k] !== initial[k],
  );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setMessage(null);
  };
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "";
  const methName = (id: string) => methodologies.data?.find((m) => m.id === id)?.name ?? "";
  const methId = draft.methodologyId || activeMethodology(methodologies.data)?.id || "";

  return (
    <form
      className="flex w-full flex-col gap-5 [&>div.border-b]:py-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(
          "Saving team settings isn’t connected yet. Nothing was changed; reloading restores the team.",
        );
      }}
    >
      <LocalField
        label="TEAM NAME"
        value={draft.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <Labeled label="MANAGER">
        <LocalSelect
          label="Manager"
          value={nameOf(draft.managerId)}
          options={managers.map((m) => m.name)}
          onChange={(name) => set("managerId", managers.find((m) => m.name === name)?.id ?? "")}
        />
      </Labeled>
      <Labeled label="METHODOLOGY">
        <LocalSelect
          label="Methodology"
          value={methName(methId)}
          options={(methodologies.data ?? []).map((m) => m.name)}
          onChange={(name) =>
            set("methodologyId", methodologies.data?.find((m) => m.name === name)?.id ?? "")
          }
        />
      </Labeled>
      <LocalSettingRow label="Manager brief" hint={delivery?.managerBrief}>
        <LocalPreferenceSwitch
          label="Manager brief"
          checked={draft.managerBrief}
          onChange={(v) => set("managerBrief", v)}
        />
      </LocalSettingRow>
      <LocalSettingRow label="Rep brief" hint={delivery?.repBrief}>
        <LocalPreferenceSwitch
          label="Rep brief"
          checked={draft.repBrief}
          onChange={(v) => set("repBrief", v)}
        />
      </LocalSettingRow>
      <LocalSettingRow label="Team room" hint={delivery?.teamRoom}>
        <LocalPreferenceSwitch
          label="Team room"
          checked={draft.teamRoom}
          onChange={(v) => set("teamRoom", v)}
        />
      </LocalSettingRow>
      <LocalSettingRow label="Reps see team median" hint="Context only — no names">
        <LocalPreferenceSwitch
          label="Reps see team median"
          checked={draft.repsSeeMedian}
          onChange={(v) => set("repsSeeMedian", v)}
        />
      </LocalSettingRow>
      <LocalDraftNotice changed={changed} message={message} />
      <div className="flex items-center gap-2">
        <Button type="submit">Save</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMessage("Archiving a team isn’t available yet. Nothing was changed.")}
        >
          Archive team
        </Button>
      </div>
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-ui-label text-by-text-secondary">{label}</span>
      {/* Figma 52:3634: full-width 14px select with a small tertiary chevron. */}
      <div className="relative [&_select]:type-ui-body [&_select]:w-full [&_select]:appearance-none [&_select]:py-2.5 [&_select]:pr-8">
        {children}
        <Icon
          name="chevron"
          size={12}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-by-text-tertiary"
        />
      </div>
    </div>
  );
}
