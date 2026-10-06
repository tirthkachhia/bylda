import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { DEV_ROLES, mocksForced, setDevRole, useTeams, useViewer, useWorkspaces } from "@/lib/data";
import { Avatar } from "../kit/Avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "./Menu";
import { newMenuFor } from "../shell/nav";

const go = (navigate: ReturnType<typeof useNavigate>, to: string) =>
  void navigate({ to: to as never });

/** Workspace switcher (50:27315). */
export function WorkspaceSwitcher({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const teams = useTeams();
  const viewer = useViewer();
  const ws = viewer.data?.workspace?.name ?? "Workspace";
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent>
        <MenuLabel>Workspaces</MenuLabel>
        {(workspaces.data ?? []).map((w) => (
          <MenuItem key={w.id} leading={<Avatar name={w.name} size={22} />} selected={w.isCurrent}>
            {w.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuLabel>Teams in {ws}</MenuLabel>
        {(teams.data ?? []).map((t) => (
          <MenuItem
            key={t.id}
            leading={<Avatar name={t.short} size={22} />}
            meta={t.status === "setup" ? "set up" : `${t.repCount} reps`}
            onSelect={() => go(navigate, `/app/team/${t.id}`)}
          >
            {t.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon="plus" onSelect={() => go(navigate, "/welcome/workspace")}>
          Create workspace
        </MenuItem>
        <MenuItem icon="settings" onSelect={() => go(navigate, "/app/workspace")}>
          Workspace settings
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** + New (50:27367). */
export function NewMenu({ children, onAsk }: { children: ReactNode; onAsk: () => void }) {
  const navigate = useNavigate();
  const viewer = useViewer();
  const items = viewer.data ? newMenuFor(viewer.data.role) : [];
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="end">
        {items.map((i) => (
          <MenuItem
            key={i.key}
            icon={i.icon}
            meta={i.shortcut}
            onSelect={() => (i.action === "ask" ? onAsk() : i.to && go(navigate, i.to))}
          >
            {i.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Profile menu (50:27407). In mock mode it also offers "View as" for the demo. */
export function ProfileMenu({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const viewer = useViewer();
  const auth = useAuth();
  const v = viewer.data;
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent side="right" align="end">
        {v ? (
          <div className="flex items-center gap-2.5 p-2.5">
            <Avatar name={v.name} src={v.avatarUrl} size={36} />
            <div className="flex min-w-0 flex-col">
              <span className="type-ui-body-strong truncate text-by-text-primary">{v.name}</span>
              <span className="type-ui-small truncate text-by-text-tertiary">{v.subtitle}</span>
            </div>
          </div>
        ) : null}
        <MenuSeparator />
        <MenuItem
          leading={<span className="size-2 rounded-by-pill bg-by-signal-improve" aria-hidden />}
          meta="Change"
        >
          Active
        </MenuItem>
        <MenuItem icon="bell" meta="1 h ⌄">
          Pause notifications
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon="user" onSelect={() => go(navigate, "/app/workspace/profile")}>
          Profile
        </MenuItem>
        <MenuItem icon="settings" onSelect={() => go(navigate, "/app/workspace/analysis")}>
          Preferences
        </MenuItem>
        <MenuItem icon="bell" onSelect={() => go(navigate, "/app/workspace/notifications")}>
          Notification settings
        </MenuItem>
        <MenuItem icon="external">Help &amp; shortcuts</MenuItem>
        {mocksForced() ? (
          <>
            <MenuSeparator />
            <MenuLabel>Demo · view as</MenuLabel>
            {DEV_ROLES.map((r) => (
              <MenuItem key={r} selected={v?.role === r} onSelect={() => setDevRole(r)}>
                {r[0].toUpperCase() + r.slice(1)}
              </MenuItem>
            ))}
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem onSelect={() => void auth.signOut().then(() => go(navigate, "/auth/sign-in"))}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Call row · more menu (50:27460) — exported for Lane 2 call rows. */
export function CallMoreMenu({ callId, children }: { callId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const viewer = useViewer();
  const canCoach = viewer.data && viewer.data.role !== "rep" && viewer.data.role !== "viewer";
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon="calls" onSelect={() => go(navigate, `/app/calls/${callId}`)}>
          Open call review
        </MenuItem>
        {canCoach ? (
          <MenuItem
            icon="coaching"
            onSelect={() => go(navigate, `/app/coaching/assign?callId=${callId}`)}
          >
            Assign coaching from this call
          </MenuItem>
        ) : null}
        <MenuItem icon="rooms">Share to a room</MenuItem>
        {canCoach ? <MenuItem icon="user">Share clip with rep</MenuItem> : null}
        <MenuItem icon="reports">Add to report</MenuItem>
        <MenuItem icon="lock">Mark private</MenuItem>
      </MenuContent>
    </Menu>
  );
}
