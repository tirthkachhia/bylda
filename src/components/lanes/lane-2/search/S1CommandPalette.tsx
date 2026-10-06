import { LocalPalette, LocalSearchGate } from "./LocalSearch";
export function S1CommandPalette({ onClose }: { onClose: () => void }) {
  return (
    <LocalSearchGate>
      {(viewer) => <LocalPalette viewer={viewer} onClose={onClose} />}
    </LocalSearchGate>
  );
}
