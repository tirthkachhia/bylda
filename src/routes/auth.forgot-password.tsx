import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "./auth.sign-in";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/forgot-password")({ component: Forgot });

function Forgot() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Reset link sent");
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a recovery link.">
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
        <Button className="w-full h-11" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-5 text-[12.5px] text-muted-foreground">
        <Link to="/auth/sign-in" className="text-primary hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
