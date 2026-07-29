import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "bylda-owner-mode";
const EVENT = "bylda:owner-mode-change";

export function getOwnerMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setOwnerMode(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch (_) {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function toggleOwnerMode() {
  setOwnerMode(!getOwnerMode());
}

// Verify the current user holds the 'admin' role in user_roles.
// If the check fails or the user is not an admin, localStorage is cleared.
async function verifyAdminRole(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setOwnerMode(false);
      return false;
    }
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (error || !data) {
      setOwnerMode(false);
      return false;
    }
    return true;
  } catch {
    setOwnerMode(false);
    return false;
  }
}

/** React hook — re-renders whenever owner mode changes in any tab/component.
 *  On mount, if localStorage claims owner mode is active, the hook
 *  verifies the claim against the server-side user_roles table and
 *  disables it if the user is not an admin.
 */
export function useOwnerMode(): boolean {
  const [active, setActive] = useState(getOwnerMode);

  useEffect(() => {
    // Server-side verification guard: if localStorage has owner mode enabled,
    // confirm the user actually has the admin role before honouring it.
    if (getOwnerMode()) {
      verifyAdminRole().then((isAdmin) => {
        if (!isAdmin) setActive(false);
      });
    }
  }, []);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      if (next) {
        // Re-verify whenever someone tries to enable owner mode
        verifyAdminRole().then((isAdmin) => {
          setActive(isAdmin ? next : false);
        });
      } else {
        setActive(false);
      }
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  return active;
}

/** Register the Ctrl+Shift+O keyboard shortcut. Call once at the app root (AppTopbar). */
export function useOwnerModeShortcut() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "O") {
        e.preventDefault();
        toggleOwnerMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
