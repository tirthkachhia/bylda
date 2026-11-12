import {
  type SearchSchemaInput,
  createFileRoute,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { OAuthSignIn } from "@/components/app/OAuthSignIn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { configureLoginWorkspace } from "@/lib/manager-access";
import { setWorkspaceView } from "@/lib/workspace-view-session";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (s: Record<string, unknown> & SearchSchemaInput) => ({
    redirect:
      typeof s.redirect === "string" && /^\/app(?:\/|\?|$)/.test(s.redirect)
        ? s.redirect
        : undefined,
  }),
  component: () => <SignIn />,
});

export function SignIn({ manager = false }: { manager?: boolean }) {
  const rawRedirect = useRouterState({
    select: (state) => (state.location.search as { redirect?: string }).redirect,
  });
  const redirect =
    typeof rawRedirect === "string" && /^\/app(?:\/|\?|$)/.test(rawRedirect)
      ? rawRedirect
      : undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-in could not be verified.");
      await configureLoginWorkspace(data.user.id, manager);
      setWorkspaceView(data.user.id, manager ? "manager" : "agent");
      // Reload so AuthProvider reads the verified workspace preference, including
      // when an existing agent already has a personal workspace.
      window.location.replace(
        manager
          ? (redirect ?? "/app/manager")
          : redirect?.startsWith("/app/manager")
            ? "/app"
            : (redirect ?? "/app"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell
      title={manager ? "Manager sign in" : "Sign in"}
      subtitle={manager ? "Review your agents, calls and coaching." : "Welcome back."}
    >
      {!manager && (
        <>
          <div className="grid gap-2">
            <OAuthSignIn provider="google" redirect={redirect} />
            <OAuthSignIn provider="azure" redirect={redirect} />
          </div>
          <p className="page30-auth-divider">Or sign in with email</p>
        </>
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Work email">
          <Input
            type="email"
            autoComplete="email"
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 rounded-xl border-black/[0.1] bg-white"
          />
        </Field>
        <Button
          className="figma-button page30-primary mt-2 w-full"
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
      <Link
        className="mt-5 block text-center text-xs underline"
        to={manager ? "/auth/sign-in" : "/auth/manager-sign-in"}
      >
        {manager ? "Agent sign in" : "Manager sign in"}
      </Link>
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
    <div className="page30-entry" data-design-screen="authentication">
      <Link to="/auth/sign-in" className="page30-wordmark">
        BYLDA
      </Link>
      <section className="page30-entry-message" aria-label="Bylda">
        <p>Understand your sales team without listening to every call.</p>
      </section>
      <main className="page30-glass page30-entry-panel">
        <h1>{title}</h1>
        <p className="page30-muted mb-5">{subtitle}</p>
        {children}
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
