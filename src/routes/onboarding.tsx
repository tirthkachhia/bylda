import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Field } from "./auth.sign-in";
import { invokeEdge } from "@/lib/invokeEdge";
import { Inactive } from "@/components/app/FigmaPrimitives";
export const Route = createFileRoute("/onboarding")({ component: WorkspaceSetup });
function WorkspaceSetup() {
  const { user, currentOrgId, currentOrg, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!name.trim() || !user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await invokeEdge("complete-onboarding", {
        mode: "operate",
        answers: {
          business_name: name.trim(),
          team_size: teamSize.trim(),
          industry: industry.trim(),
        },
      });
      await refreshProfile();
      await navigate({ to: "/app/integrations" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace could not be created");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="figma-onboarding figma-surface">
      <aside>
        <p className="text-xl tracking-[.25em]">BYLDA</p>
        <ol className="mt-10 space-y-4 text-xs">
          {[
            "Your workspace",
            "Teach Bylda how you sell",
            "Connect calls",
            "Invite your team",
            "First analysis",
          ].map((t, i) => (
            <li key={t} className={i === 0 ? "text-white" : "text-white/40"}>
              {String(i + 1).padStart(2, "0")} {t}
            </li>
          ))}
        </ol>
        <p className="mt-auto text-xs text-white/40">Setup your workspace, then connect calls.</p>
      </aside>
      <main>
        <p className="text-xs uppercase">Step 1 of 5</p>
        <h1 className="mt-5 text-xl">Tell us about your team.</h1>
        <p className="my-4 text-xs text-by-text-secondary">
          This sets up your workspace. Nothing here is permanent.
        </p>
        {loading ? (
          <p role="status">Loading your account…</p>
        ) : !user ? (
          <Link className="figma-button" to="/auth/sign-in">
            Sign in to continue
          </Link>
        ) : currentOrgId && (profile?.onboarding_complete || currentOrg?.owner_id !== user.id) ? (
          <>
            <p className="mb-5 text-sm">Your workspace is ready.</p>
            <Link className="figma-button figma-button-primary" to="/app/integrations">
              Connect calls →
            </Link>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="Company">
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Team size">
                <input
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  placeholder="Team size"
                />
              </Field>
              <Field label="Industry">
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Industry"
                />
              </Field>
            </div>
            <Field label="Primary sales motion">
              <div className="flex flex-wrap gap-2">
                {[
                  "Inbound",
                  "Outbound",
                  "Mid-market",
                  "Enterprise",
                  "Transactional",
                  "Renewal / expansion",
                ].map((t) => (
                  <Inactive key={t}>{t}</Inactive>
                ))}
              </div>
            </Field>
            <Field label="Your role">
              <div className="flex flex-wrap gap-2">
                {[
                  "Sales manager",
                  "VP / Head of sales",
                  "RevOps / enablement",
                  "Founder",
                  "Rep",
                ].map((t) => (
                  <Inactive key={t}>{t}</Inactive>
                ))}
              </div>
            </Field>
            {error && (
              <p role="alert" className="my-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <button type="submit" className="figma-button figma-button-primary" disabled={busy}>
              {busy ? "Creating…" : "Create workspace"}
            </button>
            <div className="mt-4">
              <Inactive reason="Create a workspace before inviting users">Invite team</Inactive>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
