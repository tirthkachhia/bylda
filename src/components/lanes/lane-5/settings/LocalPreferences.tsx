import { type ReactNode } from "react";
import { cn, DataBoundary, SystemState, systemStates } from "@/components/bylda";
import { useViewer } from "@/lib/data";

/** TODO(#38): fold-into-kit — keyboard-accessible editable settings switch. */
export function LocalPreferenceSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[18px] w-8 shrink-0 items-center rounded-by-pill p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
        checked ? "justify-end bg-by-surface-control-dark" : "bg-by-surface-muted",
      )}
    >
      <span className="size-3.5 rounded-by-pill bg-by-surface-raised" />
    </button>
  );
}
export function LocalPreferenceAccess({
  owner = false,
  children,
}: {
  owner?: boolean;
  children: ReactNode;
}) {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        (owner ? person.role === "owner" : ["owner", "admin"].includes(person.role)) ? (
          children
        ) : (
          <SystemState
            {...systemStates.permissionDenied()}
            eyebrow="SETTINGS · PERMISSION DENIED"
            title="These settings are restricted."
            body={
              owner
                ? "Only workspace owners can view retention and privacy settings."
                : "Only workspace owners and admins can view analysis preferences."
            }
            actions={[]}
          />
        )
      }
    </DataBoundary>
  );
}
export function LocalMissingPreference() {
  return <span className="type-ui-small shrink-0 text-by-text-tertiary">Not available</span>;
}
export function LocalDraftNotice({
  changed,
  message,
}: {
  changed: boolean;
  message: string | null;
}) {
  if (!changed && !message) return null;
  return (
    <p role="status" className="type-ui-small text-by-text-secondary">
      {message ?? "Unsaved draft. Saving isn't connected; reloading restores the shared settings."}
    </p>
  );
}
