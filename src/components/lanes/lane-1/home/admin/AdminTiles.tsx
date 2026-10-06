import type { ReactNode } from "react";
import { SkeletonBar, cn } from "@/components/bylda";
import { useCalls, useCoachingFoci, useDataSources, useTeams } from "@/lib/data";
import { callsTile, focusAckTile, sourcesTile, teamsTile } from "./summary";

/**
 * The five health tiles (Figma 31:10014). Each reads its own hook, so one slow or failed
 * source degrades one tile to an em dash instead of blanking the screen. Problem lines carry
 * a dot and a word — never a signal colour (§3: signals are behavioral direction only).
 */
export function AdminTiles({ now }: { now: number | null }) {
  const calls = useCalls();
  const teams = useTeams();
  const sources = useDataSources();
  const foci = useCoachingFoci();

  const callsT = calls.data && now !== null ? callsTile(calls.data, now) : null;
  const teamsT = teams.data ? teamsTile(teams.data) : null;
  const sourcesT = sources.data ? sourcesTile(sources.data) : null;
  const focusT = foci.data ? focusAckTile(foci.data) : null;
  const firstBroken = sourcesT?.broken[0];

  return (
    <div className="flex overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
      <Tile
        label="CALLS IN · 7D"
        loading={calls.isLoading}
        value={callsT ? String(callsT.total) : "—"}
        sub={
          callsT?.analyzedPct != null
            ? `${callsT.analyzedPct}% analyzed`
            : callsT
              ? "No calls yet"
              : null
        }
      />
      <Tile
        label="TEAMS"
        loading={teams.isLoading}
        value={teamsT ? `${teamsT.active} of ${teamsT.total}` : "—"}
        sub={
          teamsT?.unset.length
            ? teamsT.unset.length === 1
              ? `${teamsT.unset[0].name} not set up`
              : `${teamsT.unset.length} not set up`
            : teamsT
              ? "All set up"
              : null
        }
        flag={!!teamsT?.unset.length}
      />
      <Tile
        label="SOURCES"
        loading={sources.isLoading}
        value={sourcesT ? `${sourcesT.connected} of ${sourcesT.total}` : "—"}
        sub={
          sourcesT && sourcesT.broken.length > 1
            ? `${sourcesT.broken.length} need attention`
            : firstBroken
              ? `${firstBroken.name} ${firstBroken.status === "error" ? "not syncing" : "disconnected"}`
              : sourcesT
                ? "All connected"
                : null
        }
        flag={!!sourcesT?.broken.length}
      />
      {/* GAP: no brief-open analytics in @/lib/data — LANE_REQUESTS #52. */}
      <Tile label="BRIEFS OPENED" value="—" sub="Not tracked yet" />
      <Tile
        label="FOCUSES ACK’D"
        loading={foci.isLoading}
        value={focusT && focusT.total > 0 ? `${focusT.within24h} of ${focusT.total}` : "—"}
        sub={focusT ? (focusT.total > 0 ? "within 24h" : "No focuses yet") : null}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  flag = false,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  sub?: string | null;
  flag?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 border-r border-by-border-engraved px-4 py-3 last:border-r-0">
      <span className="type-mono-micro text-by-text-tertiary">{label}</span>
      {loading ? (
        <SkeletonBar width={48} height={15} />
      ) : (
        <span className="type-ui-title text-by-text-primary">{value}</span>
      )}
      {loading ? (
        <SkeletonBar width={90} height={10} />
      ) : sub ? (
        <span
          className={cn(
            "type-mono-micro inline-flex items-center gap-1.5 break-words",
            flag ? "text-by-text-primary" : "text-by-text-secondary",
          )}
        >
          {flag ? (
            <span className="size-1.5 shrink-0 rounded-by-pill bg-by-text-primary" aria-hidden />
          ) : null}
          {sub}
        </span>
      ) : null}
    </div>
  );
}
