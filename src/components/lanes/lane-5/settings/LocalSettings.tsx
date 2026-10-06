import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  cn,
  DataBoundary,
  StateEmpty,
  SystemState,
  systemStates,
} from "@/components/bylda";
import { useViewer } from "@/lib/data";

const areas = [
  [
    "WORKSPACE",
    [
      ["General", "/app/workspace"],
      ["Users", "/app/workspace/users"],
      ["Teams", "/app/workspace/teams"],
      ["Roles & permissions", "/app/workspace/roles"],
    ],
  ],
  [
    "INTELLIGENCE",
    [
      ["Analysis preferences", "/app/workspace/analysis"],
      ["Methodology", "/app/methodology"],
      ["Behavior rules", "/app/methodology"],
      ["Objection library", "/app/methodology/objections"],
      ["Success criteria", "/app/methodology/success-criteria"],
    ],
  ],
  [
    "DELIVERY",
    [
      ["Notifications", "/app/workspace/notifications"],
      ["Delivery channels", "/app/connections/channels"],
    ],
  ],
  [
    "DATA",
    [
      ["Integrations", "/app/connections"],
      ["Retention & privacy", "/app/workspace/retention"],
    ],
  ],
  [
    "ACCOUNT",
    [
      ["Profile", "/app/workspace/profile"],
      ["Billing & plan", "/app/workspace/billing"],
      ["Usage", "/app/workspace/usage"],
    ],
  ],
  [
    "DEVELOPER",
    [
      ["API keys", "/app/workspace/api-keys"],
      ["Audit log", "/app/workspace/audit-log"],
    ],
  ],
] as const;

/** TODO(#34): fold-into-kit — light settings navigation and form/list primitives. */
export function LocalSettingsLayout({
  active,
  children,
  methodologyId,
}: {
  active: string;
  children: ReactNode;
  methodologyId?: string;
}) {
  return (
    <div className="flex min-h-full text-by-text-primary">
      <nav
        aria-label="Settings"
        className="w-[232px] shrink-0 rounded-by-card border-r border-by-border-engraved bg-by-surface-raised px-4 py-6 max-md:w-40"
      >
        {areas.map(([heading, links]) => (
          <div key={heading} className="mb-3.5 flex flex-col gap-0.5">
            <h2 className="type-mono-micro text-by-text-tertiary">{heading}</h2>
            {links.map(([label, to]) =>
              label === "Behavior rules" && methodologyId ? (
                <Link
                  key={label}
                  search={true}
                  to="/app/methodology/$methodologyId/rules"
                  params={{ methodologyId }}
                  aria-current={active === label ? "page" : undefined}
                  className={cn(
                    "rounded-by-control px-2.5 py-1.5 hover:bg-by-surface-hover",
                    active === label
                      ? "type-ui-body-strong bg-by-surface-muted"
                      : "type-ui-small text-by-text-secondary",
                  )}
                >
                  {label}
                </Link>
              ) : (
                <Link
                  search={true}
                  key={label}
                  to={to}
                  aria-current={active === label ? "page" : undefined}
                  className={cn(
                    "rounded-by-control px-2.5 py-1.5 hover:bg-by-surface-hover",
                    active === label
                      ? "type-ui-body-strong bg-by-surface-muted"
                      : "type-ui-small text-by-text-secondary",
                  )}
                >
                  {label}
                </Link>
              ),
            )}
          </div>
        ))}
      </nav>
      <section className="flex min-w-0 flex-1 flex-col gap-5 px-10 py-8 max-lg:px-6">
        {children}
      </section>
    </div>
  );
}
export function LocalSettingsAccess({
  children,
  profile = false,
  ownerOnly = false,
}: {
  children: ReactNode;
  profile?: boolean;
  ownerOnly?: boolean;
}) {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        profile ||
        (ownerOnly
          ? ["owner", "admin"].includes(person.role)
          : ["owner", "admin", "manager"].includes(person.role)) ? (
          children
        ) : (
          <SystemState {...systemStates.permissionDenied()} actions={[]} />
        )
      }
    </DataBoundary>
  );
}
export function LocalSettingsHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-editorial-h2">{title}</h1>
        {subtitle && <p className="type-ui-small text-by-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function LocalField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-ui-label text-by-text-secondary">{label}</span>
      <input
        {...props}
        className="type-ui-body w-full rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2.5 outline-none focus:ring-2 focus:ring-by-focus-ring disabled:text-by-text-tertiary"
      />
      {hint && <span className="type-mono-micro text-by-text-tertiary">{hint}</span>}
    </label>
  );
}
export function LocalSettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-by-border-engraved py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="type-ui-body-strong">{label}</h2>
        {hint && <p className="type-ui-small text-by-text-secondary">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
export function LocalSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="type-ui-small rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2 outline-none focus:ring-2 focus:ring-by-focus-ring"
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}
export function LocalPolicySwitch({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-readonly="true"
      className={cn(
        "flex h-[18px] w-8 shrink-0 items-center rounded-by-pill p-0.5",
        checked ? "justify-end bg-by-surface-control-dark" : "bg-by-surface-muted",
      )}
    >
      <span className="size-3.5 rounded-by-pill bg-by-surface-raised" />
    </span>
  );
}
export function LocalSettingsNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex flex-col gap-1.5 rounded-by-card border border-by-border-engraved bg-by-surface-inset p-4">
      <h2 className="type-mono-micro text-by-text-tertiary">{title}</h2>
      <div className="type-ui-small">{children}</div>
    </aside>
  );
}
export function LocalUnavailable({
  action,
  children,
  compact = false,
}: {
  action: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const [message, setMessage] = useState(false);
  return (
    <div>
      <Button
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "sm" : "md"}
        className={compact ? "p-0" : undefined}
        onClick={() => setMessage(true)}
      >
        {children ?? action}
      </Button>
      {message && (
        <p role="status" className="type-ui-small mt-2 text-by-text-secondary">
          {action} isn't connected yet. Nothing was saved.
        </p>
      )}
    </div>
  );
}
export function LocalSettingsEmpty({ noun }: { noun: string }) {
  return <StateEmpty title={`No ${noun} yet.`} body="There is no shared data to display." />;
}
export function LocalSettingsTable({
  headings,
  columnClasses,
  children,
}: {
  headings: string[];
  columnClasses?: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised">
      <table className={cn("w-full text-left", columnClasses && "table-fixed")}>
        {columnClasses && (
          <colgroup>
            {columnClasses.map((className, index) => (
              <col key={index} className={className} />
            ))}
          </colgroup>
        )}
        <thead className="bg-by-surface-inset">
          <tr>
            {headings.map((h, index) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  "type-mono-micro whitespace-nowrap px-4 py-2.5 font-medium text-by-text-tertiary",
                  columnClasses?.[index],
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const cell = "type-ui-small border-t border-by-border-engraved px-4 py-2.5";
