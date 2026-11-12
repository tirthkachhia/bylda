import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

const steps = [
  ["workspace", "Your workspace"],
  ["methodology", "Coaching setup"],
  ["invite", "Build your team"],
  ["connect", "Connect calls"],
  ["analysis", "First analysis"],
] as const;

export function Page30SetupLayout({
  active,
  unlocked,
  children,
}: {
  active: string;
  unlocked: boolean;
  children: ReactNode;
}) {
  const body = useRef<HTMLElement>(null);
  useEffect(() => {
    const heading = body.current?.querySelector("h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [active]);
  return (
    <div className="page30-entry page30-setup" data-design-screen={`setup-${active}`}>
      <Link to="/app" className="page30-wordmark">
        BYLDA
      </Link>
      <nav className="page30-glass page30-setup-nav" aria-label="Workspace setup">
        <h2>Workspace setup</h2>
        <ol>
          {steps.map(([step, label], index) => (
            <li key={step}>
              {unlocked || step === "workspace" ? (
                <Link
                  to={step === "workspace" ? "/onboarding" : "/setup/$step"}
                  params={step === "workspace" ? undefined : { step }}
                  viewTransition
                  aria-current={active === step ? "step" : undefined}
                >
                  {index + 1}. {label}
                </Link>
              ) : (
                <span>
                  {index + 1}. {label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <main className="page30-setup-body" ref={body}>
        {children}
      </main>
    </div>
  );
}
