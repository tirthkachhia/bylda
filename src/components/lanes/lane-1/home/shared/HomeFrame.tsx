import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, cn, type IconName } from "@/components/bylda";
import { useCalls, useViewer } from "@/lib/data";
import { callsAnalyzedSince, firstNameOf, greetingFor, DAY_MS } from "./format";

/**
 * Manager Home frame — greeting + the six-tab segmented bar (Figma 7:2 → 39:675, 39:678).
 * H1–H6 are tabs of one screen; each tab is its own route so the URL is shareable and the
 * page-19 prototype links (`For You · Team Updates · Calls · Coaching · Reports · Mentions`)
 * land on the right tab.
 */
const TABS = [
  { to: "/app/home", label: "For You", icon: "home" },
  { to: "/app/home/team-updates", label: "Team Updates", icon: "team" },
  { to: "/app/home/calls", label: "Calls", icon: "calls" },
  { to: "/app/home/coaching", label: "Coaching", icon: "coaching" },
  { to: "/app/home/reports", label: "Reports", icon: "reports" },
  { to: "/app/home/mentions", label: "Mentions", icon: "at" },
] as const satisfies readonly { to: string; label: string; icon: IconName }[];

export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-3.5 px-9 pb-7 pt-[26px] max-[1024px]:px-6">
      <Greeting />
      <HomeTabs />
      {children}
    </div>
  );
}

function Greeting() {
  const viewer = useViewer();
  const calls = useCalls();
  // Clock-dependent copy renders after mount — the server's clock/timezone isn't the viewer's.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const name = viewer.data ? firstNameOf(viewer.data.name) : null;
  const analyzed = calls.data && now !== null ? callsAnalyzedSince(calls.data, now - DAY_MS) : null;

  return (
    <header className="flex w-full flex-col gap-1">
      <h1 className="type-editorial-h1 text-by-text-primary">
        {now === null ? "Hello" : greetingFor(new Date(now))}
        {name ? `, ${name}` : ""}.
      </h1>
      <p className="type-ui-body text-by-text-secondary">
        Here’s what’s happening with your team today
        {analyzed === null
          ? "."
          : analyzed === 0
            ? " — no new calls analyzed since yesterday."
            : ` — ${analyzed} ${analyzed === 1 ? "call" : "calls"} analyzed since yesterday.`}
      </p>
    </header>
  );
}

function HomeTabs() {
  return (
    <nav
      aria-label="Home tabs"
      className="flex max-w-full items-start gap-0.5 overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-inset p-1"
    >
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: true }}
          className="group flex shrink-0 items-center gap-[7px] rounded-by-tile border border-transparent px-3 py-[7px] text-by-text-secondary transition-colors duration-200 ease-out hover:text-by-text-primary data-[status=active]:border-by-border-engraved data-[status=active]:bg-by-surface-raised data-[status=active]:text-by-text-primary"
        >
          <Icon name={t.icon} size={14} />
          <span
            className={cn(
              "type-ui-small whitespace-nowrap",
              "group-data-[status=active]:type-ui-body-strong",
            )}
          >
            {t.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
