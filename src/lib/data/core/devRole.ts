import { useSyncExternalStore } from "react";
import type { Role } from "../types/session";
import { mocksForced } from "./source";

/**
 * Mock-mode only: "view as" a role, so the demo can show Owner / Manager / Rep / Viewer /
 * Coach navs. Ignored entirely in real mode — a real user's role always comes from the DB.
 */
const KEY = "bylda.devRole";
const listeners = new Set<() => void>();

export const DEV_ROLES: Role[] = ["owner", "admin", "manager", "rep", "viewer", "coach"];

function read(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("as");
    const v = (fromUrl ?? window.localStorage.getItem(KEY)) as Role | null;
    return v && DEV_ROLES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function setDevRole(role: Role | null) {
  try {
    if (role) window.localStorage.setItem(KEY, role);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — ignore */
  }
  listeners.forEach((l) => l());
}

export function useDevRole(): Role | null {
  const role = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  return mocksForced() ? role : null;
}
