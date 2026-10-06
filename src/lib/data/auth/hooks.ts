import { useMemo } from "react";
import { resolveSource } from "../core/source";
import * as real from "./fetchers";
import { SOURCE } from "./source";

/**
 * A1–A5. Lanes never import src/lib/auth.tsx (frozen) — they call these.
 * Invite acceptance: sign up / sign in with the invited email; the team-invite
 * token is consumed server-side (existing flow in auth.invite.tsx).
 */
export function useAuthActions() {
  return useMemo(() => {
    const mock = resolveSource(SOURCE) === "mock";
    const ok = async () => undefined;
    return {
      signIn: mock ? ok : real.signIn,
      signUp: mock ? ok : real.signUp,
      sendReset: mock ? ok : real.sendReset,
      updatePassword: mock ? ok : real.updatePassword,
      resendVerification: mock ? ok : real.resendVerification,
    };
  }, []);
}
