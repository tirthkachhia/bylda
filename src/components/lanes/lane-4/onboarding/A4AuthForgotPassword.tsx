import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/bylda";
import { useAuthActions } from "@/lib/data";
import { AuthField, AuthLayout, AuthLead, AuthNote, AuthTitle } from "./AuthLayout";
import { EMAIL_RE, errorMessage } from "./authForm";

/**
 * A4 · Auth — Forgot password
 * Figma 26:184 (page 1:5) · Lane 4 — Dravin · route /welcome/forgot · Flow 0
 */
export function A4AuthForgotPassword() {
  const { sendReset } = useAuthActions();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError("That doesn’t look like a full email address.");
      return;
    }
    setEmailError(null);
    setPending(true);
    try {
      await sendReset(value);
      setSentTo(value);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthTitle>Reset your password</AuthTitle>
      <AuthLead>
        Enter your work email and we’ll send a reset link. It expires in 30 minutes.
      </AuthLead>
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-[18px]">
        <AuthField
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          autoFocus
        />
        <Button type="submit" className="w-full justify-start" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      {sentTo ? (
        <AuthNote label="Sent">Reset link sent to {sentTo}. You can close this tab.</AuthNote>
      ) : null}
      {formError ? <AuthNote label="Couldn’t send">{formError}</AuthNote> : null}
      <Link
        to="/welcome/sign-in"
        className="type-ui-small text-by-text-secondary hover:text-by-text-primary"
      >
        ← Back to sign in
      </Link>
    </AuthLayout>
  );
}
