import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/bylda";
import { useAuthActions } from "@/lib/data";
import {
  AuthField,
  AuthLayout,
  AuthLead,
  AuthMicro,
  AuthNote,
  AuthTitle,
  OrDivider,
} from "./AuthLayout";
import { EMAIL_RE, errorMessage } from "./authForm";

/**
 * A1 · Auth — Sign in
 * Figma 26:40 (page 1:5) · Lane 4 — Dravin · route /welcome/sign-in · Flow 0
 */
export function A1AuthSignIn() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("That doesn’t look like a full email address.");
      return;
    }
    setEmailError(null);
    setPending(true);
    try {
      await signIn(email.trim(), password);
      await navigate({ to: "/app/home" });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // GAP: useAuthActions has no OAuth action yet (LANE_REQUESTS.md #15).
  const oauth = (provider: string) =>
    setFormError(`${provider} sign-in isn’t connected yet. Use your work email for now.`);

  return (
    <AuthLayout>
      <AuthTitle>Sign in</AuthTitle>
      <AuthLead>Welcome back.</AuthLead>
      <div className="flex w-full flex-col gap-2">
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => oauth("Google")}
        >
          Continue with Google
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => oauth("Microsoft")}
        >
          Continue with Microsoft
        </Button>
      </div>
      <OrDivider />
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
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <Link
              to="/welcome/forgot"
              className="type-mono-micro shrink-0 text-by-text-tertiary hover:text-by-text-primary"
            >
              Forgot?
            </Link>
          }
        />
        <Button type="submit" className="w-full justify-start" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {formError ? <AuthNote label="Couldn’t sign in">{formError}</AuthNote> : null}
      <Link
        to="/welcome/sign-up"
        className="type-ui-small text-by-text-secondary hover:text-by-text-primary"
      >
        New to Bylda? Create a workspace →
      </Link>
      <AuthMicro>SSO / SAML available on Scale plan</AuthMicro>
    </AuthLayout>
  );
}
