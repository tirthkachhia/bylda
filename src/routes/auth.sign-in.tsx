import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/sign-in")({ component: SignIn });

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // /app resolves the mode-aware product home (Launchpad vs Bylda).
    navigate({ to: "/app" });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your operating system.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Email">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 bg-surface-2"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 bg-surface-2"
          />
        </Field>
        <Button className="w-full h-11 mt-2" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-[12.5px]">
        <Link to="/auth/forgot-password" className="text-muted-foreground hover:text-foreground">
          Forgot password?
        </Link>
        <Link to="/auth/sign-up" className="text-muted-foreground hover:text-foreground">
          Don't have an account? <span className="text-primary">Sign up free</span>
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
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background relative overflow-hidden">
      {/* Subtle ambient glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/3 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />

      {/* Left: brand statement */}
      <div className="relative hidden lg:flex flex-col justify-between border-r border-border p-12 bg-grid-faint">
        <Logo className="[&_span]:text-[15px] [&_span]:tracking-tight" />

        <div className="max-w-lg">
          <h2 className="font-display text-[clamp(2.5rem,4vw,3.75rem)] font-semibold leading-[1.05] tracking-tight">
            <span className="text-brand-cycle">Build.</span>
            <br />
            <span className="text-brand-cycle">Launch.</span>
            <br />
            <span className="text-brand-cycle">Operate.</span>
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The AI operating system founders use to go from first idea to automated company —
            without stitching ten tools together.
          </p>
          <div className="mt-8 flex items-center gap-6 text-[12px] text-muted-foreground">
            <Stat n="17" label="AI tools" />
            <Stat n="6" label="Operating systems" />
            <Stat n="1" label="Source of truth" />
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground">© Bylda · Built for founders</div>
      </div>

      {/* Right: form card */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <Logo className="lg:hidden mb-8 [&_span]:text-[15px]" />
          <h1 className="font-display text-[26px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[22px] font-semibold leading-none">{n}</div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
