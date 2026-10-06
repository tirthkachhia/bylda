import type { ReactNode } from "react";
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

export function ConnectionsAccess({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        person.role !== "owner" && person.role !== "admin" ? (
          <SystemState
            {...systemStates.permissionDenied()}
            title="Workspace connections are managed by your owner."
            body="Ask your workspace owner to manage data sources and delivery channels."
            actions={[]}
          />
        ) : (
          children
        )
      }
    </DataBoundary>
  );
}
export function ConnectionsHeader({
  active,
  sources,
  channels,
}: {
  active: "sources" | "channels";
  sources?: number;
  channels?: number;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-editorial-h1">Integrations</h1>
        <p className="type-ui-small text-by-text-secondary">
          {active === "sources"
            ? "Data sources feed Bylda. Delivery channels carry Bylda’s intelligence out. They’re managed separately on purpose."
            : "Where Bylda delivers briefs, alerts and coaching."}
        </p>
      </div>
      <nav
        aria-label="Integration areas"
        className="flex gap-[18px] border-b border-by-border-engraved"
      >
        <Link
          to="/app/connections"
          aria-current={active === "sources" ? "page" : undefined}
          className={cn(
            "type-ui-body flex items-start gap-1.5 py-2",
            active === "sources"
              ? "border-b-[1.5px] border-by-text-primary text-by-text-primary"
              : "text-by-text-secondary",
          )}
        >
          Data sources
          {sources !== undefined && (
            <span className="type-mono-micro text-by-text-tertiary">{sources}</span>
          )}
        </Link>
        <Link
          to="/app/connections/channels"
          aria-current={active === "channels" ? "page" : undefined}
          className={cn(
            "type-ui-body flex items-start gap-1.5 py-2",
            active === "channels"
              ? "border-b-[1.5px] border-by-text-primary text-by-text-primary"
              : "text-by-text-secondary",
          )}
        >
          Delivery channels
          {channels !== undefined && (
            <span className="type-mono-micro text-by-text-tertiary">{channels}</span>
          )}
        </Link>
      </nav>
    </header>
  );
}
export function Monogram({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="type-mono-micro flex size-8 shrink-0 items-center justify-center rounded-by-badge border border-by-border-engraved bg-by-surface-inset text-by-text-secondary"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function InsetNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
      <h2 className="type-mono-micro mb-1 text-by-text-tertiary">{title}</h2>
      <div className="type-ui-small">{children}</div>
    </section>
  );
}
export function FeatureNotice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-4 py-3"
    >
      <p className="type-ui-small">{message}</p>
      <Button variant="ghost" size="sm" onClick={onClose}>
        Dismiss
      </Button>
    </div>
  );
}
export function ConnectionsEmpty({ channels = false }: { channels?: boolean }) {
  return (
    <StateEmpty
      title={channels ? "No delivery channels yet." : "No data sources yet."}
      body={
        channels
          ? "Your owner can connect a channel to deliver briefs and coaching."
          : "Connect a call source to start analyzing conversations."
      }
    />
  );
}
