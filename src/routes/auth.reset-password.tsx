import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "./auth.sign-in";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset-password")({ component: Reset });

function Reset() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      navigate({ to: "/auth/sign-in" });
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose something you'll remember.">
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link to="/auth/sign-in" className="text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
