import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery, integrationsQuery } from "@/lib/queries";
import { Page30SetupLayout } from "./Page30SetupLayout";
import { PlaybooksPanel } from "./coaching/PlaybooksPanel";
import { WorkspaceTeams } from "./coaching/WorkspaceTeams";
import { Users } from "@/routes/app.settings";
import { RecordingStatus } from "./coaching/RecordingStatus";

const priorities = [
  "Understand why deals are lost",
  "Improve discovery conversations",
  "Handle objections more effectively",
  "Improve closing and next steps",
  "Identify reps who need coaching",
  "Find patterns across the team",
];
const criteria = [
  "Discovery quality",
  "Problem impact",
  "Objection handling",
  "Conversation control",
  "Next-step execution",
];

export function FigmaSetupScreen({ step }: { step: string }) {
  const { currentOrgId, user, loading } = useAuth();
  const active = step === "insight" ? "analysis" : step;
  return (
    <Page30SetupLayout active={active} unlocked={Boolean(currentOrgId)}>
      {loading ? (
        <p role="status" className="page30-glass page30-setup-panel">
          Loading workspace…
        </p>
      ) : !user || !currentOrgId ? (
        <section className="page30-glass page30-setup-panel">
          <h1>Set up your workspace</h1>
          <Link className="figma-button page30-primary" to={user ? "/onboarding" : "/auth/sign-in"}>
            {user ? "Name your workspace" : "Sign in to continue"}
          </Link>
        </section>
      ) : step === "methodology" ? (
        <MethodologySetup />
      ) : step === "invite" ? (
        <TeamSetup />
      ) : step === "connect" ? (
        <ConnectSetup />
      ) : step === "analysis" || step === "insight" ? (
        <RecordingStatus organizationId={currentOrgId} first />
      ) : (
        <section className="page30-glass page30-setup-panel">
          <h1>Workspace setup</h1>
          <p>This setup step is unavailable.</p>
          <Link className="figma-button" to="/onboarding">
            Back to setup
          </Link>
        </section>
      )}
    </Page30SetupLayout>
  );
}

function MethodologySetup() {
  const { currentOrgId, user } = useAuth();
  const access = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState("");
  const [editor, setEditor] = useState<"recommended" | "custom" | null>(null);
  const [draft, setDraft] = useState("");
  const [fileError, setFileError] = useState("");
  return (
    <div className="page30-setup-columns">
      <section className="page30-glass page30-setup-panel">
        <p className="page30-label">Step 2 of 5</p>
        <h1>Tell Bylda what good selling looks like.</h1>
        <p className="page30-muted">
          Start with suggested criteria or create a playbook from your team’s process.
        </p>
        {access.isLoading ? (
          <p role="status">Checking workspace access…</p>
        ) : access.data ? (
          <>
            <fieldset className="page30-setup-options">
              <legend>Choose up to two coaching priorities</legend>
              {priorities.map((priority) => (
                <label key={priority}>
                  <input
                    type="checkbox"
                    checked={selected.includes(priority)}
                    disabled={selected.length >= 2 && !selected.includes(priority)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, priority]
                          : previous.filter((item) => item !== priority),
                      )
                    }
                  />
                  {priority}
                </label>
              ))}
            </fieldset>
            <label className="figma-field">
              <span>Sales methodology (optional)</span>
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="">None</option>
                {["MEDDIC", "SPIN", "Challenger", "Sandler", "BANT", "Custom"].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            {!editor && (
              <div className="page30-home-actions">
                <button
                  className="figma-button"
                  type="button"
                  onClick={() => {
                    setDraft(
                      [
                        ...selected.map((item) => `Priority: ${item}.`),
                        ...(method ? [`Methodology: ${method}.`] : []),
                        ...criteria.map(
                          (criterion) =>
                            `Review ${criterion.toLowerCase()} when applicable to the call.`,
                        ),
                      ].join("\n"),
                    );
                    setEditor("recommended");
                  }}
                >
                  Review recommended criteria
                </button>
                <button
                  className="figma-button"
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setEditor("custom");
                  }}
                >
                  Add your sales playbook
                </button>
              </div>
            )}
            {!editor && (
              <label className="figma-field">
                <span>Import a text playbook</span>
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setFileError("");
                    try {
                      if (file.size > 48000 || !/\.(txt|md)$/i.test(file.name))
                        throw new Error(
                          "Choose a TXT or Markdown playbook up to 12,000 characters.",
                        );
                      const content = (await file.text()).trim();
                      if (!content || content.length > 12000)
                        throw new Error("Choose a nonempty playbook up to 12,000 characters.");
                      setDraft(content);
                      setEditor("custom");
                    } catch (error) {
                      setFileError(
                        error instanceof Error ? error.message : "Could not read the playbook.",
                      );
                    }
                  }}
                />
              </label>
            )}
            {fileError && <p role="alert">{fileError}</p>}
            {editor && (
              <PlaybooksPanel
                draft={{
                  name: editor === "recommended" ? "Coaching criteria" : "",
                  content: draft,
                }}
              />
            )}
          </>
        ) : (
          <p role={access.error ? "alert" : undefined}>
            {access.error
              ? "Workspace access could not be verified."
              : "Workspace managers can edit coaching criteria."}
          </p>
        )}
        <div className="page30-home-actions">
          <Link className="figma-button" to="/onboarding">
            Back
          </Link>
          <Link
            className="figma-button page30-primary"
            to="/setup/$step"
            params={{ step: "invite" }}
          >
            Continue to team setup
          </Link>
        </div>
      </section>
      <aside className="page30-glass page30-setup-panel">
        <h2>Recommended criteria</h2>
        <ul className="page30-home-list">
          {criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        <p className="page30-muted mt-3">
          Criteria apply where the call provides relevant evidence.
        </p>
      </aside>
    </div>
  );
}

function TeamSetup() {
  const [structure, setStructure] = useState<"team" | "agency">("team");
  return (
    <section className="page30-glass page30-setup-panel">
      <p className="page30-label">Step 3 of 5</p>
      <h1>Build your team.</h1>
      <p className="page30-muted">Organize your reps and invite teammates to the workspace.</p>
      <div className="page30-setup-options" aria-label="Team structure">
        <button
          className="figma-button"
          aria-pressed={structure === "team"}
          onClick={() => setStructure("team")}
        >
          Simple sales team
        </button>
        <button
          className="figma-button"
          aria-pressed={structure === "agency"}
          onClick={() => setStructure("agency")}
        >
          Agency teams
        </button>
      </div>
      <p className="page30-muted">
        {structure === "team"
          ? "Create a team and assign its manager and reps."
          : "Create one team per group and assign its manager. Workspace membership governs access."}
      </p>
      <WorkspaceTeams />
      <details className="page30-disclosure">
        <summary>People and invitations</summary>
        <Users rolesOnly={false} bulk />
      </details>
      <div className="page30-home-actions">
        <Link className="figma-button" to="/setup/$step" params={{ step: "methodology" }}>
          Back
        </Link>
        <Link
          className="figma-button page30-primary"
          to="/setup/$step"
          params={{ step: "connect" }}
        >
          Continue to call sources
        </Link>
      </div>
    </section>
  );
}

function ConnectSetup() {
  const { user } = useAuth();
  const sources = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  return (
    <section className="page30-glass page30-setup-panel">
      <p className="page30-label">Step 4 of 5</p>
      <h1>Where do your calls live?</h1>
      <p className="page30-muted">
        Connect a source or upload a recording or transcript. A CRM connection is optional.
      </p>
      {sources.isLoading && <p role="status">Checking call sources…</p>}
      {sources.error && (
        <p role="alert">
          Sources could not load.{" "}
          <button className="underline" onClick={() => void sources.refetch()}>
            Retry
          </button>
        </p>
      )}
      <ul className="page30-home-list">
        {[
          ["close_io", "Close"],
          ["readymode", "ReadyMode"],
          ["hubspot", "HubSpot"],
          ["salesforce", "Salesforce"],
          ["zoom", "Zoom"],
          ["gong", "Gong"],
          ["aircall", "Aircall"],
          ["googlemeet", "Google Meet"],
        ].map(([key, label]) => (
          <li key={key}>
            <strong>{label}</strong>
            <Link className="figma-button" to="/app/integrations" search={{ tab: "sources" }}>
              {sources.data?.some((item) => item.integration_key === key && item.is_connected)
                ? "Manage connection"
                : "Setup options"}
            </Link>
          </li>
        ))}
        <li>
          <strong>Upload recordings or transcripts</strong>
          <Link
            className="figma-button page30-primary"
            to="/app/crm/calls"
            search={{ upload: true }}
          >
            Upload
          </Link>
        </li>
      </ul>
      <div className="page30-home-actions">
        <Link className="figma-button" to="/setup/$step" params={{ step: "invite" }}>
          Back
        </Link>
        <Link className="figma-button" to="/setup/$step" params={{ step: "analysis" }}>
          Check first analysis
        </Link>
      </div>
    </section>
  );
}
