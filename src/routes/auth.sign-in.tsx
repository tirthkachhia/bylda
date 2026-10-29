import { type SearchSchemaInput, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Inactive } from "@/components/app/FigmaPrimitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (s: Record<string, unknown> & SearchSchemaInput) => ({
    redirect:
      typeof s.redirect === "string" && /^\/app(?:\/|\?|$)/.test(s.redirect)
        ? s.redirect
        : undefined,
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (redirect) window.location.replace(redirect);
    else void navigate({ to: "/app" });
  };
  return (
    <AuthShell title="Sign in" subtitle="Welcome back.">
      <div className="grid gap-2">
        <Inactive>Continue with Google</Inactive>
        <Inactive>Continue with Microsoft</Inactive>
      </div>
      <p className="my-5 text-center text-[11px] text-by-text-secondary">OR</p>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Work email">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl border-black/[0.1] bg-white"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 rounded-xl border-black/[0.1] bg-white"
          />
        </Field>
        <Button
          className="mt-2 h-11 w-full rounded-xl bg-[#111318] text-white hover:bg-[#292e36]"
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-[11px]">
        <Link to="/auth/forgot-password" className="text-[#737982] hover:text-black">
          Forgot password?
        </Link>
        <Link to="/auth/sign-up" className="text-by-text-primary">
          Create a workspace →
        </Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="figma-auth figma-surface" data-design-screen="authentication">
      <section className="figma-auth-art" aria-label="Bylda">
        <Link to="/auth/sign-in" className="figma-auth-wordmark">
          B Y L D A
        </Link>
        <div className="figma-auth-orbits" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => {
            const size = 120 + i * 70;
            return (
              <img
                key={i}
                src={`/figma/auth-${i}.svg`}
                alt=""
                style={{
                  position: "absolute",
                  left: `calc(50% - ${size / 2}px)`,
                  top: `calc(50.78% - ${size / 2}px)`,
                  maxWidth: "none",
                }}
              />
            );
          })}
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="figma-auth-spoke"
              style={{ transform: `rotate(${-15 * i}deg)` }}
            />
          ))}
          <img
            src="/figma/auth-9.svg"
            alt=""
            style={{
              position: "absolute",
              left: "calc(50% - 27.7128px)",
              top: "47.85%",
              maxWidth: "none",
            }}
          />
        </div>
        <p className="figma-auth-message">
          Understand your sales team without listening to every call.
        </p>
      </section>
      <main className="figma-auth-main">
        <div className="figma-auth-form">
          <h1>{title}</h1>
          <p className="mb-6 mt-3 text-xs text-by-text-secondary">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="figma-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
