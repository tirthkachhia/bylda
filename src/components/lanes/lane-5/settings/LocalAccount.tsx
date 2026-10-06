import { useState, type ReactNode } from "react";
import { Button, DataBoundary, SystemState, systemStates } from "@/components/bylda";
import { useViewer } from "@/lib/data";
import { LocalSettingsLayout } from "./LocalSettings";
/** TODO(#43): fold-into-kit — restricted settings access, metric strip and unavailable-action feedback. */
export function LocalAccountLayout({
  active,
  ownerOnly = false,
  children,
}: {
  active: string;
  ownerOnly?: boolean;
  children: ReactNode;
}) {
  const viewer = useViewer();
  return (
    <LocalSettingsLayout active={active}>
      <DataBoundary query={viewer}>
        {(person) =>
          (ownerOnly ? person.role === "owner" : ["owner", "admin"].includes(person.role)) ? (
            children
          ) : (
            <SystemState
              {...systemStates.permissionDenied()}
              eyebrow="SETTINGS · PERMISSION DENIED"
              title="These settings are restricted."
              body={
                ownerOnly
                  ? "Only workspace owners can view billing and plan settings."
                  : "Only workspace owners and admins can view these settings."
              }
              actions={[]}
            />
          )
        }
      </DataBoundary>
    </LocalSettingsLayout>
  );
}
export function LocalAccountAction({
  label,
  variant = "secondary",
  onUnavailable,
}: {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  onUnavailable?: () => void;
}) {
  const [message, setMessage] = useState(false);
  return (
    <div>
      <Button
        variant={variant}
        onClick={() => {
          setMessage(true);
          onUnavailable?.();
        }}
      >
        {label}
      </Button>
      {message && (
        <p role="status" className="type-ui-small mt-2 text-by-text-secondary">
          {label} isn't connected yet. Nothing was changed.
        </p>
      )}
    </div>
  );
}
export function LocalAccountMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 flex-1 border-r border-by-border-engraved px-4 py-3 last:border-r-0">
      <h2 className="type-mono-micro text-by-text-tertiary">{label}</h2>
      <p className="type-ui-body-strong mt-1">{value}</p>
      {hint && <p className="type-mono-micro mt-1 text-by-text-tertiary">{hint}</p>}
    </div>
  );
}
export function LocalAccountMissingRow({
  columns,
  children,
}: {
  columns: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="type-ui-small border-t border-by-border-engraved px-4 py-4 text-by-text-secondary"
      >
        {children}
      </td>
    </tr>
  );
}

export function LocalAccountSummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start border-b border-by-border-engraved py-2">
      <dt className="type-mono-micro w-35 shrink-0 pt-1 text-by-text-tertiary">{label}</dt>
      <dd className="type-ui-small min-w-0 flex-1">{children}</dd>
    </div>
  );
}
