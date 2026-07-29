import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell } from "./auth.sign-in";

export const Route = createFileRoute("/auth/invite")({
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();

  // Read invite params from URL directly (route not yet in routeTree.gen.ts)
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const search = {
    token: searchParams.get("token") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  };

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Verify the invite token from the URL hash or query param on mount
  useEffect(() => {
    const verifyInvite = async () => {
      // Supabase sends invite links with the token in the URL hash as
      // #access_token=...&type=invite  (handled automatically by the client)
      // or as ?token=...&type=invite (older format)
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = new URLSearchParams(hash.replace("#", ""));
      const hashType = hashParams.get("type");
      const hashToken = hashParams.get("access_token");

      const isInviteHash = hashType === "invite" && !!hashToken;
      const isInviteQuery = search.type === "invite" && !!search.token;

      if (!isInviteHash && !isInviteQuery) {
        setTokenValid(false);
        setVerifying(false);
        return;
      }

      if (isInviteHash) {
        // Supabase client auto-processes the hash — check if we have a session
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          setTokenValid(false);
        } else {
          setTokenValid(true);
          const meta = data.session.user.user_metadata;
          if (meta?.full_name) setFullName(meta.full_name as string);
        }
      } else if (isInviteQuery && search.token) {
        // Verify OTP token from query string
        const { error } = await supabase.auth.verifyOtp({
          token_hash: search.token,
          type: "invite",
        });
        if (error) {
          setTokenValid(false);
        } else {
          setTokenValid(true);
        }
      }

      setVerifying(false);
    };

    verifyInvite();
  }, [search.token, search.type]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName },
      });
      if (error) throw error;
      toast.success("Welcome to Bylda! Your account is ready.");
      // /app resolves the mode-aware product home (Launchpad vs Bylda).
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <AuthShell
        title="Verifying invite…"
        subtitle="Please wait while we validate your invite link."
      >
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthShell title="Invalid invite link" subtitle="This invite link is invalid or has expired.">
        <p className="text-sm text-muted-foreground">
          Please ask your team admin to resend the invitation.
        </p>
        <Button
          className="mt-4 w-full"
          variant="outline"
          onClick={() => navigate({ to: "/auth/sign-in" })}
        >
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Join your team on Bylda" subtitle="Set up your account to accept the invite.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Full name</Label>
          <Input
            id="invite-name"
            autoFocus
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-xs text-destructive" role="alert">
              {errors.fullName}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-password">Password</Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.password}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Setting up account…" : "Accept invite"}
        </Button>
      </form>
    </AuthShell>
  );
}
