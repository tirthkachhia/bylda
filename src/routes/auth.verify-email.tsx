import { type SearchSchemaInput, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "./auth.sign-in";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: (s: Record<string, unknown> & SearchSchemaInput) => ({
    email: typeof s.email === "string" ? s.email.trim() : "",
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!email || code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: failure } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (failure) throw failure;
      if (!data.session)
        throw new Error("No session was returned. Open your confirmation link or sign in.");
      await navigate({ to: "/onboarding" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The code could not be verified.");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!email || busy || cooldown) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: failure } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (failure) throw failure;
      setCooldown(60);
      setMessage("Confirmation email sent. Check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The email could not be resent.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        email
          ? `Confirm your email address: ${email}.`
          : "Return to signup to enter your email address."
      }
    >
      <p className="mb-4 text-xs text-by-text-secondary">
        Open the confirmation link in your email. If your email includes a verification code, enter
        it below.
      </p>
      <form onSubmit={(event) => void verify(event)}>
        <label className="figma-verification-code">
          <span className="sr-only">Email verification code</span>
          <input
            ref={input}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            minLength={6}
            maxLength={10}
            required
            disabled={!email || busy}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
            aria-describedby="verification-help"
          />
          <span
            aria-hidden="true"
            className="figma-code-slots"
            onClick={() => input.current?.focus()}
          >
            {Array.from({ length: Math.max(6, code.length) }, (_, i) => (
              <span key={i} className={i === code.length ? "is-current" : ""}>
                {code[i] ?? ""}
              </span>
            ))}
          </span>
        </label>
        <p id="verification-help" className="sr-only">
          Enter the code exactly as it appears in your confirmation email.
        </p>
        <button
          type="submit"
          className="figma-button figma-button-primary w-full mt-4"
          disabled={!email || code.length < 6 || busy}
        >
          {busy ? "Please wait…" : "Verify"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs">
          {message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span>Didn’t get it?</span>
        <button
          type="button"
          className="figma-auth-text-action"
          onClick={() => void resend()}
          disabled={!email || busy || cooldown > 0}
        >
          {cooldown
            ? `Resend in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`
            : "Resend email"}
        </button>
        <Link to="/auth/sign-up">Wrong email?</Link>
      </div>
      <Link className="mt-5 inline-block text-xs underline" to="/auth/sign-in">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
