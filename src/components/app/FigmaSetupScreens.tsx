import { Link } from "@tanstack/react-router";
import { FigmaField, FigmaRow, Inactive, UnavailableValue } from "./FigmaPrimitives";
import { PlaybooksPanel } from "./coaching/PlaybooksPanel";

const setupSteps = [
  ["workspace", "Your workspace"],
  ["methodology", "Teach Bylda how you sell"],
  ["connect", "Connect calls"],
  ["invite", "Invite your team"],
  ["analysis", "First analysis"],
] as const;

export function FigmaSetupScreen({ step }: { step: string }) {
  const index = setupSteps.findIndex(([key]) => key === step);
  const firstInsight = step === "insight";
  const titles: Record<string, string> = {
    methodology: "Teach Bylda how your team sells.",
    connect: "Where do your calls live?",
    invite: "Invite your team.",
    analysis: "Bylda is listening to your calls.",
    insight: "Here’s the first thing Bylda noticed about your team.",
  };
  if (!titles[step])
    return (
      <div className="figma-panel">
        <h1>Workspace setup</h1>
        <Link to="/onboarding">Open workspace setup</Link>
      </div>
    );
  return (
    <div
      className="figma-onboarding figma-surface figma-setup-pages"
      data-design-screen={`setup-${step}`}
    >
      <aside>
        <Link to="/app" className="text-xl tracking-[.25em]">
          BYLDA
        </Link>
        <ol>
          {setupSteps.map(([key, name], i) => (
            <li key={key} aria-current={key === step ? "step" : undefined}>
              {key === "workspace" ? (
                <Link to="/onboarding">01 {name}</Link>
              ) : (
                <Link to="/setup/$step" params={{ step: key }}>
                  {String(i + 1).padStart(2, "0")} {name}
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-auto text-xs text-white/50">Set up your workspace, then connect calls.</p>
      </aside>
      <main>
        <p className="text-xs uppercase">
          {firstInsight ? "First insight" : `Step ${index + 1} of 5`}
        </p>
        <h1>{titles[step]}</h1>
        <p className="figma-view-status">
          Controls without an available backend stay inactive. Navigation does not save or start
          analysis.
        </p>
        {step === "methodology" ? (
          <>
            <p>Bylda judges behavior against your process. You can change this later.</p>
            <div className="figma-setup-choices">
              {["Start from a template", "Answer 6 questions", "Upload your playbook"].map((t) => (
                <Inactive key={t}>{t}</Inactive>
              ))}
            </div>
            <h2>Methodology</h2>
            <div className="flex flex-wrap gap-2">
              {["MEDDIC", "SPIN", "Challenger", "Sandler", "BANT", "Our own"].map((t) => (
                <Inactive key={t}>{t}</Inactive>
              ))}
            </div>
            <h2>Stages on your calls</h2>
            <div className="figma-stage-preview">
              {["Opening", "Discovery", "Demo", "Pricing", "Next steps"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <h2>Behaviors that matter to you</h2>
            {[
              "Discovery depth",
              "Objection handling",
              "Interruptions",
              "Talk / listen balance",
              "Economic buyer identified",
              "Next step booked",
              "Filler words",
            ].map((t) => (
              <FigmaRow key={t} label={t}>
                <input type="checkbox" disabled aria-label={t} />
              </FigmaRow>
            ))}
            <h2>Objections you hear most</h2>
            <div className="flex flex-wrap gap-2">
              {[
                "Price / budget",
                "Timing",
                "Already have a tool",
                "Implementation risk",
                "Need to check with team",
                "+ Add",
              ].map((t) => (
                <Inactive key={t}>{t}</Inactive>
              ))}
            </div>
            <h2>Outcomes Bylda should learn from</h2>
            <div className="flex flex-wrap gap-2">
              {["Next step booked", "Stage advanced", "Closed-won / lost", "Meeting held"].map(
                (t) => (
                  <Inactive key={t}>{t}</Inactive>
                ),
              )}
            </div>
            <details className="mt-6 rounded-lg border bg-white p-4">
              <summary>Use your existing playbook editor</summary>
              <div className="mt-5">
                <PlaybooksPanel />
              </div>
            </details>
          </>
        ) : step === "connect" ? (
          <>
            <p>Connect a supported call source, or upload a recording or transcript.</p>
            <h2>Call source</h2>
            <div className="figma-source-preview">
              {["Zoom", "Gong", "Aircall", "Google Meet"].map((t) => (
                <FigmaRow key={t} label={t} detail="Not available yet">
                  <Inactive>Connect</Inactive>
                </FigmaRow>
              ))}
              <FigmaRow label="Upload files">
                <Link
                  className="figma-button"
                  to="/app/crm/calls"
                  search={{ upload: true, view: "calls" }}
                >
                  Upload
                </Link>
              </FigmaRow>
            </div>
            <h2>CRM connections</h2>
            <Link className="figma-button" to="/app/integrations">
              Manage supported connections
            </Link>
            <FigmaRow label="Outcome CSV">
              <Inactive>Import</Inactive>
            </FigmaRow>
          </>
        ) : step === "invite" ? (
          <>
            <p>Invite teammates using your workspace’s supported account roles.</p>
            <div className="overflow-x-auto">
              <table className="figma-table">
                <thead>
                  <tr>
                    {["Person", "Calls", "Role", "Team", "Invite"].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="text-by-text-secondary">
                      No recorder-matched team roster is available.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <FigmaField label="Or add by email">
              <input disabled placeholder="Invite teammates in Users" />
            </FigmaField>
            <FigmaRow label="Rep privacy default">
              <Inactive>—</Inactive>
            </FigmaRow>
            <Link
              to="/app/settings"
              search={{ tab: "users" }}
              className="figma-button figma-button-primary"
            >
              Manage users and invitations
            </Link>
            <Inactive className="ml-2">Send invites</Inactive>
          </>
        ) : step === "analysis" ? (
          <>
            <p>Your available call processing status remains visible in Calls.</p>
            <div className="figma-form-card">
              {[
                "Import calls",
                "Transcribe calls",
                "Detect behavioral events",
                "Match calls to CRM outcomes",
                "Find patterns",
              ].map((t) => (
                <FigmaRow key={t} label={t}>
                  <span className="text-by-text-secondary">—</span>
                </FigmaRow>
              ))}
            </div>
            <div className="figma-progress-track" aria-label="Analysis progress unavailable" />
            <p className="my-3 text-xs">Workspace-wide progress is not available yet.</p>
            <Link className="figma-button" to="/app/crm/calls">
              View existing call status
            </Link>
            <Inactive className="ml-2">Email me when ready</Inactive>
            <Link className="figma-button mt-3" to="/app/settings" search={{ tab: "users" }}>
              Invite team while you wait
            </Link>
          </>
        ) : (
          <>
            <div className="figma-form-card">
              <h2>Your first insight</h2>
              <p>No team insight is available yet.</p>
              <div className="my-5 grid gap-3 sm:grid-cols-3">
                {["Pause before responding", "Next step booked", "Price objections"].map((t) => (
                  <UnavailableValue key={t} label={t} />
                ))}
              </div>
              <div className="figma-answer-empty">Source evidence —</div>
              <p className="my-4 text-xs">Confidence —</p>
              <Inactive>See who this affects</Inactive>
              <Inactive className="ml-2">Hear examples</Inactive>
            </div>
          </>
        )}
        <footer className="figma-setup-footer">
          {firstInsight ? (
            <Link to="/setup/$step" params={{ step: "analysis" }} className="figma-button">
              Back
            </Link>
          ) : index <= 1 ? (
            <Link to="/onboarding" className="figma-button">
              Back
            </Link>
          ) : (
            <Link
              to="/setup/$step"
              params={{ step: setupSteps[index - 1][0] }}
              className="figma-button"
            >
              Back
            </Link>
          )}
          {firstInsight ? (
            <Link to="/app" className="figma-button figma-button-primary">
              Go to my Home
            </Link>
          ) : (
            <Link
              to="/setup/$step"
              params={{ step: index < 4 ? setupSteps[index + 1][0] : "insight" }}
              className="figma-button figma-button-primary"
            >
              Continue — {index < 4 ? setupSteps[index + 1][1].toLowerCase() : "first insight"}
            </Link>
          )}
        </footer>
      </main>
    </div>
  );
}
