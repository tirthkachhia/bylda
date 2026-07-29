import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PlanKey = "starter" | "launch" | "operate" | "scale";
const PLANS: { key: PlanKey; label: string; price: string; tagline: string; highlight?: string }[] =
  [
    { key: "starter", label: "Starter", price: "$0", tagline: "Free to begin" },
    {
      key: "launch",
      label: "Launch",
      price: "$49",
      tagline: "Validate + launch",
      highlight: "Most popular",
    },
    { key: "operate", label: "Operate", price: "$149", tagline: "Run the business" },
    { key: "scale", label: "Scale", price: "$299", tagline: "Full Bylda OS" },
  ];

function normalizePlan(p?: string): PlanKey {
  const v = (p || "starter").toLowerCase();
  return PLANS.find((x) => x.key === v)?.key ?? "starter";
}

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  component: SignupPage,
});

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#f87171" };
  if (score <= 2) return { score, label: "Fair", color: "#fbbf24" };
  if (score <= 3) return { score, label: "Good", color: "#34d399" };
  return { score, label: "Strong", color: "#10b981" };
}

function SignupPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/signup" });
  const [plan, setPlan] = useState<PlanKey>(normalizePlan(search.plan));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const strength = password ? passwordStrength(password) : null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))
      e.email = "Invalid email address";
    if (password.length < 8) e.password = "Min 8 characters";
    if (password !== confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { full_name: fullName },
        },
      });
      if (signUpErr) throw signUpErr;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? signUpData.user?.id;

      if (session && userId) {
        // The handle_new_user() DB trigger already provisioned an
        // organization + membership + starter subscription for this user.
        // Adopt that org here and apply the plan/name the user picked.
        const { data: member } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (member) {
          const orgName = `${fullName.trim()}'s Business`;
          await supabase
            .from("organizations")
            .update({ name: orgName })
            .eq("id", member.organization_id);

          await supabase
            .from("subscriptions")
            .update({ plan })
            .eq("organization_id", member.organization_id);
        }

        toast.success("Account created — welcome to Bylda!");
        navigate({ to: "/onboarding" });
      } else {
        toast.success("Check your email to confirm your account");
        navigate({ to: "/auth/sign-in" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between border-r border-border bg-muted/30 p-10">
        <Logo />
        <div>
          <div className="text-3xl font-display font-semibold tracking-tight max-w-md">
            Build. Launch. Operate.
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            One operating system for the full founder journey.
          </p>
          <ul className="mt-6 space-y-2">
            {[
              "AI tools for every stage of your startup",
              "CRM, lead capture, and automation built-in",
              "From idea to revenue in one platform",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">© Bylda</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <Logo className="mb-6 lg:hidden" />

          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a plan — upgrade or downgrade anytime.
          </p>

          {/* Plan selector */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {PLANS.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => setPlan(p.key)}
                aria-pressed={plan === p.key}
                className={cn(
                  "relative rounded-md border p-3 text-left transition",
                  plan === p.key ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-2 left-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                    {p.highlight}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{p.label}</div>
                  {plan === p.key && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.price}/mo · {p.tagline}
                </div>
              </button>
            ))}
          </div>

          <form className="mt-5 space-y-3" onSubmit={onSubmit} noValidate>
            <Field label="Full name" error={errors.fullName} htmlFor="full-name">
              <Input
                id="full-name"
                autoFocus
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                aria-invalid={!!errors.fullName}
              />
            </Field>
            <Field label="Work email" error={errors.email} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field label="Password" error={errors.password} htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && strength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: i <= strength.score ? strength.color : "var(--border)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </Field>
            <Field label="Confirm password" error={errors.confirm} htmlFor="confirm-password">
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pr-10"
                  aria-invalid={!!errors.confirm}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Creating account…"
                : `Start with ${PLANS.find((p) => p.key === plan)?.label} · ${PLANS.find((p) => p.key === plan)?.price}/mo`}
            </Button>
          </form>

          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            By signing up you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>

          <p className="mt-4 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/sign-in" className="text-foreground hover:underline font-medium">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      </label>
      {children}
      {error && (
        <div className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
