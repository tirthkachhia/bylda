import { useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  cn,
  DataBoundary,
  StateEmpty,
  SystemState,
  systemStates,
} from "@/components/bylda";
import { useViewer, type Methodology } from "@/lib/data";
import { LocalSettingsLayout } from "./LocalSettings";

/** TODO(#40): fold-into-kit — methodology tabs, editable text area and action feedback. */
export function LocalMethodologyLayout({
  active = "Methodology",
  children,
  methodologyId,
}: {
  active?: string;
  methodologyId?: string;
  children: ReactNode;
}) {
  const viewer = useViewer();
  return (
    <LocalSettingsLayout active={active} methodologyId={methodologyId}>
      <DataBoundary query={viewer}>
        {(person) =>
          ["owner", "admin"].includes(person.role) ? (
            children
          ) : (
            <SystemState
              {...systemStates.permissionDenied()}
              eyebrow="METHODOLOGY · PERMISSION DENIED"
              title="Methodology settings are restricted."
              body="Only workspace owners and admins can manage methodology settings."
              actions={[]}
            />
          )
        }
      </DataBoundary>
    </LocalSettingsLayout>
  );
}
export function LocalMethodologyEmpty() {
  return (
    <StateEmpty
      title="Methodology not found."
      body="This methodology is unavailable or has been removed."
      actions={[{ label: "Back to methodologies", href: "/app/methodology", variant: "secondary" }]}
    />
  );
}
export function LocalMethodologyAction({
  label,
  variant = "primary",
  reason,
  compact = false,
}: {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  reason?: string;
  compact?: boolean;
}) {
  const [clicked, setClicked] = useState(false);
  return (
    <div>
      <Button
        size={compact ? "sm" : "md"}
        className={compact ? "rounded-by-pill type-ui-small" : undefined}
        variant={variant}
        onClick={() => setClicked(true)}
      >
        {label}
      </Button>
      {clicked && (
        <p role="status" className="type-ui-small mt-2 max-w-64 text-by-text-secondary">
          {reason ?? `${label} isn't connected yet. Nothing was saved.`}
        </p>
      )}
    </div>
  );
}
export function LocalTextarea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-ui-label text-by-text-secondary">{label}</span>
      <textarea
        {...props}
        className="type-ui-body min-h-20 w-full resize-y rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2.5 outline-none focus:ring-2 focus:ring-by-focus-ring"
      />
    </label>
  );
}
export function LocalMethodologyTabs({
  methodology,
  active,
}: {
  methodology: Methodology;
  active: "Stages" | "Behaviors";
}) {
  const tabClass = (label: string) =>
    cn(
      "type-ui-body px-0 py-2 border-b-2",
      active === label
        ? "border-by-text-primary text-by-text-primary"
        : "border-transparent text-by-text-secondary",
    );
  return (
    <nav
      aria-label="Methodology sections"
      className="flex flex-wrap gap-5 border-b border-by-border-engraved"
    >
      <Link
        search={true}
        to="/app/methodology/$methodologyId"
        params={{ methodologyId: methodology.id }}
        aria-current={active === "Stages" ? "page" : undefined}
        className={tabClass("Stages")}
      >
        Stages{" "}
        <sup className="type-mono-micro ml-1 text-by-text-tertiary">
          {methodology.stages.length}
        </sup>
      </Link>
      <Link
        search={true}
        to="/app/methodology/$methodologyId/rules"
        params={{ methodologyId: methodology.id }}
        aria-current={active === "Behaviors" ? "page" : undefined}
        className={tabClass("Behaviors")}
      >
        Behaviors{" "}
        <sup className="type-mono-micro ml-1 text-by-text-tertiary">
          {methodology.behaviors.length}
        </sup>
      </Link>
      <Link search={true} to="/app/methodology/objections" className={tabClass("Objections")}>
        Objections
      </Link>
      <Link
        search={true}
        to="/app/methodology/success-criteria"
        className={tabClass("Success criteria")}
      >
        Success criteria
      </Link>
      <LocalMethodologyAction
        label="Compliance · LATER"
        variant="ghost"
        reason="Compliance settings aren't available yet."
      />
    </nav>
  );
}
export function LocalBreadcrumb({ rules = false }: { rules?: boolean }) {
  return (
    <p className="type-mono-micro text-by-text-tertiary">
      <Link search={true} to="/app/workspace">
        SETTINGS
      </Link>{" "}
      /{" "}
      <Link search={true} to="/app/methodology">
        {rules ? "BEHAVIOR RULES" : "METHODOLOGY"}
      </Link>{" "}
      /
    </p>
  );
}
