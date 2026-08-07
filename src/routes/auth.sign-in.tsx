import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Database, FileText, Mail } from "lucide-react";
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
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/app/crm/calls" });
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your revenue workspace.">
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
        <Link to="/auth/sign-up" className="font-semibold text-[#3275d8]">
          Start a pilot
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
    <div className="grid min-h-screen bg-[#f4f4ef] text-[#111318] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#111318] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -right-32 top-12 h-96 w-96 rounded-full bg-[#3275d8]/20 blur-[100px]" />
        <Link to="/">
          <Logo className="relative text-white" />
        </Link>
        <div className="relative max-w-xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#78a9f2]">
            After the call
          </div>
          <h2 className="mt-5 text-[48px] font-bold leading-[1.02] tracking-[-0.055em] xl:text-[62px]">
            The conversation becomes the work.
          </h2>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <AuthBenefit icon={FileText} label="Review" />
            <AuthBenefit icon={Database} label="Write back" />
            <AuthBenefit icon={Mail} label="Follow up" />
          </div>
        </div>
        <p className="relative max-w-md text-[11px] leading-5 text-[#727b88]">
          Bylda works on top of the dialer and CRM your team already uses.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[410px]">
          <div className="mb-12 flex items-center justify-between lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
            <Link to="/" className="flex items-center gap-1 text-[11px] text-[#737982]">
              <ArrowLeft className="h-3 w-3" />
              Home
            </Link>
          </div>
          <h1 className="text-[32px] font-bold tracking-[-0.045em]">{title}</h1>
          <p className="mt-2 text-[13px] text-[#737982]">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-10 flex items-center gap-2 text-[9px] text-[#92969d]">
            <Check className="h-3 w-3 text-[#3275d8]" />
            Human-approved CRM updates
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthBenefit({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4">
      <Icon className="h-4 w-4 text-[#78a9f2]" />
      <div className="mt-5 text-[11px] font-semibold text-[#c7cdd6]">{label}</div>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold text-[#5f656d]">{label}</div>
      {children}
    </label>
  );
}
