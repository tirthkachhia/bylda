import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "./auth.sign-in";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/sign-up")({ component: SignUp });

function SignUp() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: fullName, email_updates: emailUpdates },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      data.session ? "Account created" : "Check your email to confirm your account, then sign in.",
    );
    navigate({ to: data.session ? "/onboarding" : "/auth/sign-in" });
  };

  return (
    <AuthShell title="Start your pilot" subtitle="Evaluate Bylda on real calls with a small team.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Full name">
          <Input
            value={fullName}
            placeholder="Alex Chen"
            onChange={(e) => setFullName(e.target.value)}
            required
            className="h-11 bg-surface-2"
          />
        </Field>
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
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="h-11 bg-surface-2"
          />
        </Field>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={emailUpdates}
            onChange={(e) => setEmailUpdates(e.target.checked)}
          />
          Send me Bylda product updates and tips. Optional; unsubscribe anytime.
        </label>
        <Button className="w-full h-11 mt-2" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create pilot workspace"}
        </Button>
      </form>
      <p className="mt-5 text-[12.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        By signing up you agree to our terms of service and privacy policy.
      </p>
    </AuthShell>
  );
}
