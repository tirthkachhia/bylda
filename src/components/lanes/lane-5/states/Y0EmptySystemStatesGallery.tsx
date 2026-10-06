import { STATE_CODES, SystemStatePreset } from "@/components/bylda";

/**
 * Y0 · Empty & System States — gallery of all 13 states (Y1–Y13)
 * Figma 19:2 (page 1:18) · Lane 5 — Mayur · route /app/states
 *
 * Foundation BUILT the 13 states (`SystemState` + `systemStates` presets in
 * @/components/bylda). Lane 5 reviews each against Figma 19:2 and logs any fix in
 * LANE_REQUESTS.md — the presets are frozen foundation code.
 */
export function Y0EmptySystemStatesGallery() {
  return (
    <div className="flex flex-col gap-7 px-16 py-14">
      <h1 className="type-editorial-h1 text-by-text-primary">Empty, loading &amp; system states</h1>
      <p className="type-ui-body text-by-text-secondary">
        Rule: when Bylda lacks evidence, it says so — with the number it needs. It never fills space
        with fake intelligence.
      </p>
      <div className="flex flex-wrap items-start gap-5">
        {STATE_CODES.map((s) => (
          <div key={s.code} className="flex w-[470px] flex-col gap-1.5">
            <span className="type-mono-micro text-by-text-tertiary">
              {s.code} · {s.node}
            </span>
            <SystemStatePreset id={s.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
