import { SystemState, StateLoading } from "./SystemState";
import { systemStates, type SystemStateId } from "./presets";

/** Render a preset by id with its Figma defaults (dev gallery, placeholders). */
export function SystemStatePreset({ id }: { id: SystemStateId | "skeleton" }) {
  if (id === "skeleton") return <StateLoading label="FEED · SKELETON (NO SHIMMER THEATRICS)" />;
  return <SystemState {...systemStates[id]()} />;
}
