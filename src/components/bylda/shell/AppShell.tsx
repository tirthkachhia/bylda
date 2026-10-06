import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "../kit/Avatar";
import { Wordmark } from "../kit/ByldaGlyph";
import { Icon, type IconName } from "../kit/Icon";
import { SidebarItem } from "../kit/SidebarItem";

const navigation: { label: string; to: string; icon: IconName }[] = [
  { label: "Today", to: "/app", icon: "home" },
  { label: "Calls", to: "/app/crm/calls", icon: "calls" },
  { label: "Deal memory", to: "/app/memory", icon: "file" },
  { label: "Context beta", to: "/app/context-memory", icon: "intelligence" },
  { label: "CRM records", to: "/app/contacts", icon: "user" },
  { label: "Forecast", to: "/app/bylda/reports", icon: "reports" },
  { label: "CRM intelligence", to: "/app/crm/setup", icon: "plug" },
];

/** Presentation only: identity comes from the existing auth provider. */
export function AppShell({
  children,
  title,
  sidebarExtra,
  headerExtra,
}: {
  children: ReactNode;
  title?: string;
  sidebarExtra?: ReactNode;
  headerExtra?: ReactNode;
}) {
  const { user, profile, currentOrg } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [path]);
  const name = profile?.full_name || user?.email?.split("@")[0] || "Sales rep";
  const sidebar = (
    <nav
      aria-label="Main navigation"
      className="flex h-full w-by-sidebar flex-col gap-1 overflow-y-auto bg-by-surface-sidebar px-3 py-5"
    >
      <Link to="/app" className="mb-5 px-3 text-by-text-on-dark">
        <Wordmark />
      </Link>
      <div className="mb-4 px-3">
        <p className="type-ui-body-strong text-by-text-on-dark">
          {currentOrg?.name || "Bylda workspace"}
        </p>
        <p className="type-ui-small text-by-text-on-dark-muted">Revenue workspace</p>
      </div>
      {navigation.map((item) => (
        <SidebarItem
          key={item.to}
          {...item}
          state={
            path === item.to || (item.to !== "/app" && path.startsWith(`${item.to}/`))
              ? "active"
              : "default"
          }
          onClick={() => setDrawer(false)}
        />
      ))}
      <div onClick={() => setDrawer(false)}>{sidebarExtra}</div>
      <div className="min-h-5 flex-1" />
      <SidebarItem
        to="/app/integrations"
        label="Integrations"
        icon="plug"
        onClick={() => setDrawer(false)}
      />
      <SidebarItem
        to="/app/settings"
        label="Settings"
        icon="settings"
        onClick={() => setDrawer(false)}
      />
      <div className="mt-4 flex items-center gap-3 border-t border-by-border-rail px-3 pt-4">
        <Avatar name={name} size={34} />
        <p className="type-ui-small truncate text-by-text-on-dark">{name}</p>
      </div>
    </nav>
  );
  return (
    <div className="bylda flex h-screen min-h-0 overflow-hidden bg-by-surface-canvas text-by-text-primary">
      <aside className="flex w-by-rail shrink-0 flex-col items-center gap-4 bg-by-surface-rail py-4">
        <button
          aria-label="Toggle navigation"
          aria-expanded={drawer}
          onClick={() => setDrawer((v) => !v)}
          className="type-brand-logo flex size-9 items-center justify-center rounded-by-control bg-by-surface-raised text-by-text-primary"
        >
          B
        </button>
        <Link to="/app" aria-label="Today" className="text-by-text-on-dark">
          <Icon name="home" size={19} />
        </Link>
        <Link to="/app/crm/calls" aria-label="Calls" className="text-by-text-on-dark-muted">
          <Icon name="calls" size={19} />
        </Link>
        <div className="flex-1" />
        <Link to="/app/settings" aria-label="Settings" className="text-by-text-on-dark-muted">
          <Icon name="settings" size={19} />
        </Link>
        <Avatar name={name} size={34} />
      </aside>
      <div className="hidden shrink-0 min-[1025px]:block">{sidebar}</div>
      {drawer && (
        <div className="fixed inset-0 z-40 flex min-[1025px]:hidden">
          <div className="ml-by-rail h-full">{sidebar}</div>
          <button
            aria-label="Close navigation"
            className="flex-1 bg-by-surface-scrim"
            onClick={() => setDrawer(false)}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-by-topbar shrink-0 items-center justify-between gap-3 border-b border-by-border-engraved bg-by-surface-raised px-5">
          <p className="type-ui-small min-w-0 truncate text-by-text-secondary">
            {title ?? navigation.find((n) => n.to === path)?.label ?? "Revenue workspace"}
          </p>
          {headerExtra}
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
