import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/bylda";
import { useAuthActions } from "@/lib/data";
import { AuthField, AuthLayout, AuthLead, AuthMicro, AuthNote, AuthTitle } from "./AuthLayout";
import { EMAIL_RE, errorMessage } from "./authForm";

const MIN_PASSWORD = 12;

/**
 * A2 · Auth — Sign up
 * Figma 26:91 (page 1:5) · Lane 4 — Dravin · route /welcome/sign-up · Flow 4
 */
export function A2AuthSignUp() {
  const { signUp } = useAuthActions();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const domain = email.includes("@") ? email.split("@")[1]?.trim() : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Add your name so your team knows who you are.";
    if (!EMAIL_RE.test(email.trim())) next.email = "That doesn’t look like a full email address.";
    if (password.length < MIN_PASSWORD) next.password = `Use ${MIN_PASSWORD}+ characters.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      await signUp(email.trim(), password, name.trim());
      await navigate({ to: "/welcome/verify", search: { email: email.trim() } });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthTitle>Create your workspace</AuthTitle>
      <AuthLead>
        Free for 14 days. No card. Bylda analyzes your last 90 days of calls on day one.
      </AuthLead>
      <Button
        variant="secondary"
        className="w-full justify-start"
        // GAP: useAuthActions has no OAuth action yet (LANE_REQUESTS.md #15).
        onClick={() =>
          setFormError("Google sign-up isn’t connected yet. Use your work email for now.")
        }
      >
        Continue with Google
      </Button>
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-[18px]">
        <AuthField
          label="Full name"
          autoComplete="name"
          placeholder="First and last name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />
        <AuthField
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          hint={
            domain
              ? `Use your work domain — teammates on @${domain} can request to join.`
              : "Use your work domain — teammates on it can request to join."
          }
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`${MIN_PASSWORD}+ characters`}
        />
        <Button type="submit" className="w-full justify-start" disabled={pending}>
          {pending ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
      {formError ? <AuthNote label="Couldn’t create workspace">{formError}</AuthNote> : null}
      <AuthMicro>By continuing you agree to the Terms and the Data Processing Addendum.</AuthMicro>
    </AuthLayout>
  );
}
