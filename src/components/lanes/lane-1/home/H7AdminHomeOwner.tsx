import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  systemStates,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCalls,
  useDataSources,
  useTeams,
  useViewer,
  useWorkspaceHealth,
  type WorkspaceHealth,
} from "@/lib/data";
import { AdminPanel } from "./admin/AdminPanel";
import { AdminTiles } from "./admin/AdminTiles";
import { AdoptionTable } from "./admin/AdoptionTable";
import { CrossTeamPattern } from "./admin/CrossTeamPattern";
import { NeedsYou } from "./admin/NeedsYou";
import { headlineFor, needsYou, teamsTile, trackedSources } from "./admin/summary";

/**
 * H7 · Admin Home — Owner (workspace health)
 * Figma 31:9916 (page 1:6) · Lane 1 — Ansh · route /app/home/admin
 * Hooks: useWorkspaceHealth, useDataSources, useTeams, useCalls, useCoachingFoci, usePatterns,
 * usePlan, useMembers, useMethodologies, useDeliveryChannels (each section reads its own).
 *
 * Owners care whether Bylda is working and being used; team intelligence is one click away.
 * Owner/admin only — anyone else gets the restricted state, and the data layer refuses reps.
 * Not built on `HomeTab`: that hardwires the manager greeting, tab bar and "today" panel, none of
 * which this frame has.
 */
export function H7AdminHomeOwner() {
  const viewer = useViewer();
  const navigate = useNavigate();

  if (viewer.isLoading)
    return (
      <Frame>
        <OwnerSkeleton />
      </Frame>
    );
  const role = viewer.data?.role;
  if (role !== "owner" && role !== "admin") {
    return (
      <Frame>
        <Restricted
          onBack={() => void navigate({ to: role === "rep" ? "/app/rep" : "/app/home" })}
          home={role === "rep" ? "my home" : "Manager Home"}
        />
      </Frame>
    );
  }
  return (
    <Frame>
      <OwnerHome role={role} />
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">{children}</div>;
}

function Restricted({ onBack, home }: { onBack: () => void; home: string }) {
  return (
    <SystemState
      eyebrow="HOME · OWNER VIEW"
      tag={{ tone: "neutral", label: "Restricted" }}
      title="Admin Home is for workspace owners."
      body="Workspace health, adoption and billing are visible to owners and admins. Team intelligence lives on Manager Home."
      actions={[{ label: `Go to ${home}`, variant: "secondary", onClick: onBack }]}
    />
  );
}

function OwnerHome({ role }: { role: "owner" | "admin" }) {
  const health = useWorkspaceHealth();
  const navigate = useNavigate();

  if (health.isLoading) return <OwnerSkeleton />;
  if (health.error) {
    return health.error instanceof ForbiddenForRoleError ? (
      <Restricted onBack={() => void navigate({ to: "/app/home" })} home="Manager Home" />
    ) : (
      <StateError
        eyebrow="HOME · OWNER VIEW"
        body="Bylda couldn’t load workspace health. Your calls are safe — try again."
        onRetry={() => void health.refetch()}
      />
    );
  }
  if (!health.data) return <OwnerSkeleton />;
  return <Loaded health={health.data} role={role} />;
}

/** Nothing connected and no calls: say so, with the way to fix it (Y1), instead of a wall of zeros. */
function Loaded({ health, role }: { health: WorkspaceHealth; role: "owner" | "admin" }) {
  const navigate = useNavigate();
  const sources = useDataSources();
  const calls = useCalls();
  const teams = useTeams();
  const [now, setNow] = useState<number | null>(null);
  // Clock-dependent copy renders after mount — the server's clock isn't the viewer's.
  useEffect(() => setNow(Date.now()), []);

  if (sources.isLoading || calls.isLoading || teams.isLoading) return <OwnerSkeleton />;
  const nothingYet =
    trackedSources(sources.data ?? []).length === 0 && (calls.data ?? []).length === 0;
  if (nothingYet) {
    return (
      <SystemState
        {...systemStates.homeNoCalls({
          onConnect: () => void navigate({ to: "/app/connections" }),
          onUpload: () => void navigate({ to: "/app/calls/upload" }),
        })}
      />
    );
  }

  const broken = needsYou(health, sources.data ?? []).length;
  const unsetTeams = teamsTile(teams.data ?? []).unset.length;

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <p className="type-mono-micro text-by-text-tertiary">
          {now === null ? "" : `${dateLabel(now)} · `}
          {role.toUpperCase()} VIEW
        </p>
        <h1 className="type-editorial-h1 text-by-text-primary">
          {headlineFor({ broken, unsetTeams })}
        </h1>
      </header>
      <AdminTiles now={now} />
      <NeedsYou health={health} />
      <CrossTeamPattern />
      <AdoptionTable />
      <AdminPanel />
    </>
  );
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const dateLabel = (ms: number) => `${weekday.format(ms)} · ${monthDay.format(ms)}`.toUpperCase();

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function OwnerSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-5"
      aria-busy="true"
      aria-label="Loading workspace health"
    >
      <div className="flex flex-col gap-2">
        <SkeletonBar width={220} height={10} />
        <SkeletonBar width="85%" height={30} />
      </div>
      <SkeletonBlock height={78} className="rounded-by-card" />
      <SkeletonBlock height={110} className="rounded-by-card" />
      <SkeletonBlock height={200} className="rounded-by-card" />
    </div>
  );
}
