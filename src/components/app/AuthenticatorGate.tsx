import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Challenge enrolled authenticators after password or OAuth sign-in. */
export function AuthenticatorGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const level = useQuery({
    queryKey: ["session-authenticator-level", user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
  });
  const required = level.data?.nextLevel === "aal2" && level.data.currentLevel !== "aal2";
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const factor = factors.data.totp.find((f) => f.status === "verified");
      if (!factor) throw new Error("No verified authenticator found. Retry your session.");
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (result.error) throw result.error;
      setCode("");
      await level.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }
  if (level.isPending || level.error || required)
    return (
      <main className="figma-surface mx-auto max-w-sm space-y-4 p-8">
        <h1>Verify your sign-in</h1>
        {level.isPending ? (
          <p role="status">Checking account security…</p>
        ) : level.error ? (
          <p role="alert">
            Security could not be checked.{" "}
            <button className="underline" onClick={() => void level.refetch()}>
              Retry
            </button>
          </p>
        ) : (
          <form onSubmit={(e) => void verify(e)} className="space-y-3">
            <label className="block">
              Authenticator code
              <input
                className="figma-input"
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="figma-button" disabled={busy || code.length !== 6}>
              Verify
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="underline" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </main>
    );
  return <>{children}</>;
}
