import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { WorkspaceInsights } from "./coaching/WorkspaceInsights";
export function FigmaSetupScreen({ step }: { step: string }) {
  const { currentOrgId } = useAuth();
  if (!currentOrgId)
    return (
      <section className="figma-panel">
        <h1>Set up your workspace</h1>
        <Link className="figma-button" to="/onboarding">
          Create workspace
        </Link>
      </section>
    );
  if (step === "insight" || step === "analysis") return <WorkspaceInsights />;
  const target =
    step === "methodology"
      ? "/app/crm/calls"
      : step === "invite"
        ? "/app/settings"
        : "/app/integrations";
  const search =
    step === "methodology" ? { view: "playbooks" } : step === "invite" ? { tab: "users" } : {};
  return (
    <section className="figma-panel space-y-5">
      <h1>
        {step === "methodology"
          ? "Teach Bylda how you sell"
          : step === "invite"
            ? "Invite your team"
            : "Connect or upload calls"}
      </h1>
      <p className="text-sm">
        Use your workspace’s saved settings and data. Uploaded recordings work without a connected
        recorder.
      </p>
      <Link className="figma-button" to={target} search={search as never}>
        Open{" "}
        {step === "methodology"
          ? "methodology"
          : step === "invite"
            ? "team invitations"
            : "integrations"}
      </Link>
      <Link className="figma-button" to="/app/crm/calls" search={{ upload: true }}>
        Upload recordings
      </Link>
      <Link className="figma-button" to="/app/insights">
        View analysis
      </Link>
    </section>
  );
}
