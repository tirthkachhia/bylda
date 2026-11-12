import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Page30SetupLayout } from "@/components/app/Page30SetupLayout";
import { Field } from "./auth.sign-in";
import { invokeEdge } from "@/lib/invokeEdge";
export const Route = createFileRoute("/onboarding")({ component: WorkspaceSetup });
function WorkspaceSetup() {
  const { user, currentOrgId, currentOrg, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [salesMotion, setSalesMotion] = useState("");
  const [salesRole, setSalesRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(next: "upload" | "setup") {
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
          sales_motion: salesMotion,
          sales_role: salesRole,
        },
      });
      await refreshProfile();
      if (next === "setup") await navigate({ to: "/setup/$step", params: { step: "methodology" } });
      else await navigate({ to: "/app/crm/calls", search: { upload: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace could not be created");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page30SetupLayout
      active="workspace"
      unlocked={Boolean(currentOrgId && profile?.onboarding_complete)}
    >
      <section className="page30-glass page30-setup-panel">
        <p className="page30-label">First use</p>
        <h1>Name your workspace</h1>
        <p className="page30-muted">
          Add your workspace name, then upload your first call recordings.
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
            <div className="page30-home-actions">
              <Link
                className="figma-button page30-primary"
                to="/app/crm/calls"
                search={{ upload: true }}
              >
                Upload recordings
              </Link>
              <Link className="figma-button" to="/setup/$step" params={{ step: "methodology" }}>
                Coaching and team setup
              </Link>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const button = (e.nativeEvent as SubmitEvent).submitter;
              void submit(button?.getAttribute("value") === "setup" ? "setup" : "upload");
            }}
          >
            <Field label="Company">
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <details className="page30-disclosure page30-spring-disclosure">
              <summary>Optional team details</summary>
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
                    <button
                      type="button"
                      key={t}
                      className="figma-button"
                      aria-pressed={salesMotion === t}
                      onClick={() => setSalesMotion(t)}
                    >
                      {t}
                    </button>
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
                    <button
                      type="button"
                      key={t}
                      className="figma-button"
                      aria-pressed={salesRole === t}
                      onClick={() => setSalesRole(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            </details>
            {error && (
              <p role="alert" className="my-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <div className="page30-home-actions">
              <button
                type="submit"
                value="upload"
                className="figma-button page30-primary"
                disabled={busy}
              >
                {busy ? "Creating workspace…" : "Upload recordings"}
              </button>
              <button type="submit" value="setup" className="figma-button" disabled={busy}>
                Coaching and team setup
              </button>
            </div>
            <div className="mt-4">
              {currentOrgId ? (
                <Link className="figma-button" to="/app/settings" search={{ tab: "users" }}>
                  Invite team
                </Link>
              ) : (
                <p className="text-xs">
                  After creating your workspace, invite teammates under Settings → Users.
                </p>
              )}
            </div>
          </form>
        )}
      </section>
    </Page30SetupLayout>
  );
}
