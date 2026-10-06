import { Button } from "@/components/bylda";
import { LocalSearchGate, LocalSearchScreen } from "./LocalSearch";
export function S3AskByldaPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 p-5 text-by-text-primary">
      <header className="flex items-center justify-between">
        <h2 className="type-ui-title">✦ Ask Bylda</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <LocalSearchGate>{(viewer) => <LocalSearchScreen viewer={viewer} compact />}</LocalSearchGate>
    </div>
  );
}
