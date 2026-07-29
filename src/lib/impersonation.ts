// Admin "open any account" (impersonation). Client-side context switch only —
// the real security boundary is server-side: an admin's JWT satisfies the
// is_admin() RLS policies, so reads/writes against the target account succeed.
// A non-admin who forced this on would just hit RLS denials. Persisted in
// sessionStorage so a refresh keeps the impersonated context.
import { useSyncExternalStore } from "react";

export type ImpersonationState = {
  active: boolean;
  userId: string | null;
  orgId: string | null;
  label: string | null;
};

const STORAGE_KEY = "bylda-impersonation";
const EMPTY: ImpersonationState = { active: false, userId: null, orgId: null, label: null };

function load(): ImpersonationState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ImpersonationState;
  } catch {
    /* ignore */
  }
  return EMPTY;
}

let state: ImpersonationState = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    if (state.active) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const impersonationStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  start: (userId: string, orgId: string | null, label: string | null) => {
    state = { active: true, userId, orgId, label };
    persist();
    emit();
  },
  stop: () => {
    state = EMPTY;
    persist();
    emit();
  },
};

export function useImpersonation(): ImpersonationState {
  return useSyncExternalStore(
    impersonationStore.subscribe,
    impersonationStore.get,
    impersonationStore.get,
  );
}
