/**
 * TitleBlock — architectural drawing plate header for the Launchpad home.
 * Six cells: System / Project / Drawing № / Stage / Revision / Drafted by.
 * All values come from live data (business_context, org, profile) via props.
 *
 * One-time "foil sweep" light pass on initial page load only — gated by a
 * module-level flag so re-renders and route revisits within the session
 * don't replay it.
 */

import { useEffect, useRef, useState } from "react";

let sweepPlayed = false;

interface TitleBlockProps {
  /** Org / business name from business_context or organizations */
  projectName: string;
  /** Stable short drawing id — derived from org id upstream */
  drawingNo: string;
  /** Current stage from business_context / workspace (e.g. "Validate") */
  stage: string;
  /** business_context.version — bumped by DB trigger on every context change */
  revision: number;
  /** First name of the founder, for the "Drafted by" cell */
  founderName: string;
}

function Cell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 border-line px-3 py-2 sm:px-4 ${className}`}>
      <div className="font-bp-mono text-[9px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 truncate font-tech text-[13px] font-semibold text-ink">{children}</div>
    </div>
  );
}

export function TitleBlock({
  projectName,
  drawingNo,
  stage,
  revision,
  founderName,
}: TitleBlockProps) {
  const [sweep, setSweep] = useState(false);
  const [revPulse, setRevPulse] = useState(false);
  const prevRev = useRef(revision);

  // Foil sweep — once per page load, not per render
  useEffect(() => {
    if (!sweepPlayed) {
      sweepPlayed = true;
      setSweep(true);
    }
  }, []);

  // Revision up-tick pulse when the revision changes mid-session
  useEffect(() => {
    if (revision !== prevRev.current) {
      prevRev.current = revision;
      setRevPulse(true);
      const t = setTimeout(() => setRevPulse(false), 1600);
      return () => clearTimeout(t);
    }
  }, [revision]);

  return (
    <div className="relative overflow-hidden border-2 border-ink bg-panel">
      {/* Foil sweep light pass */}
      {sweep && (
        <div
          aria-hidden="true"
          className="animate-sweep pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-blueprint-brass-soft to-transparent opacity-60"
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-line lg:divide-y-0">
        <Cell label="System">
          <span className="font-tech font-bold tracking-[0.08em] text-blueprint-blue">
            LAUNCHPAD
          </span>
        </Cell>
        <Cell label="Project">{projectName}</Cell>
        <Cell label="Drawing №">
          <span className="font-bp-mono text-[12px]">{drawingNo}</span>
        </Cell>
        <Cell label="Stage">
          <span className="uppercase text-blueprint-signal">{stage}</span>
        </Cell>
        <Cell label="Revision">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-bp-mono text-[12px]">R{revision}</span>
            <span
              aria-hidden="true"
              className={`text-[10px] text-blueprint-seal transition-opacity duration-300 ${
                revPulse ? "animate-pulse opacity-100" : "opacity-0"
              }`}
            >
              ▲
            </span>
          </span>
        </Cell>
        <Cell label="Drafted by">
          <span className="font-bp-mono text-[11px] uppercase">BYLDA + {founderName}</span>
        </Cell>
      </div>
    </div>
  );
}
