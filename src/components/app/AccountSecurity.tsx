import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
export function AccountSecurity() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["account-mfa", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string } | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Bylda authenticator",
      });
      if (error) throw error;
      setEnrollment({ id: data.id, qr: data.totp.qr_code });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!enrollment) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      });
      if (error) throw error;
      setEnrollment(null);
      setCode("");
      await q.refetch();
      setMessage("Authenticator verified.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2>Account security</h2>
      {q.error ? (
        <p role="alert">
          Security settings could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        q.data?.totp
          .filter((f) => f.status === "verified")
          .map((f) => (
            <div key={f.id} className="flex gap-3 text-sm">
              <span>Authenticator enabled</span>
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Remove this authenticator?"))
                    void supabase.auth.mfa
                      .unenroll({ factorId: f.id })
                      .then(({ error }) => {
                        if (error) throw error;
                        return q.refetch();
                      })
                      .catch((e) => setMessage(e.message));
                }}
              >
                Remove
              </button>
            </div>
          ))
      )}
      {!q.data?.totp.some((f) => f.status === "verified") && !enrollment && (
        <button
          className="figma-button"
          disabled={busy || q.isPending || !!q.error}
          onClick={() => void enable()}
        >
          Set up authenticator
        </button>
      )}
      {enrollment && (
        <div>
          <p className="text-sm">
            Scan this code in your authenticator, then enter its six-digit code.
          </p>
          <img
            alt="Authenticator enrollment QR code"
            src={
              enrollment.qr.startsWith("data:")
                ? enrollment.qr
                : `data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.qr)}`
            }
            width={180}
            height={180}
          />
          <input
            aria-label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="figma-button"
            disabled={busy || code.length !== 6}
            onClick={() => void verify()}
          >
            Verify
          </button>
        </div>
      )}
      <button
        className="figma-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void supabase.auth
            .signOut({ scope: "others" })
            .then(({ error }) => {
              if (error) throw error;
              setMessage(
                "Other refresh sessions signed out. Existing access tokens expire according to your session policy.",
              );
            })
            .catch((e) => setMessage(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Sign out other sessions
      </button>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
