import type { ReactNode } from "react";

/** A rendered Figma affordance with no action, request or fabricated value. */
export function Inactive({
  children,
  className = "",
  reason = "Not available yet",
}: {
  children: ReactNode;
  className?: string;
  reason?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      className={`figma-button figma-inactive ${className}`}
      data-unavailable="true"
    >
      {children}
    </button>
  );
}

export function UnavailableValue({ label }: { label: string }) {
  return (
    <div className="figma-metric">
      <span>{label}</span>
      <strong aria-label={`${label}: not available`}>—</strong>
      <small>Not available yet</small>
    </div>
  );
}

export function FigmaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="figma-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function FigmaRow({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="figma-row">
      <div>
        <p>{label}</p>
        {detail && <small>{detail}</small>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function InactivePanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="figma-panel">
      <h2>{title}</h2>
      <div className="figma-empty" data-unavailable="true">
        {children ?? "Not available yet"}
      </div>
    </section>
  );
}
