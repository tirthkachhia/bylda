import { useNavigate } from "@tanstack/react-router";
import {
  Avatar,
  ContextPanel,
  DataBoundary,
  SkeletonBlock,
  StateError,
  SystemState,
  Tag,
  systemStates,
} from "@/components/bylda";
import { usePatterns, useTeamMembers, type Pattern } from "@/lib/data";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { PatternCard } from "./shared/PatternCard";
import { TabsHeader } from "./shared/TabsHeader";
import { useIntelligenceContext } from "./shared/useIntelligenceContext";
import { isForbidden } from "./shared/model";
import { firstName, repSummaries } from "./shared/tabsModel";

const EYEBROW = "INTELLIGENCE · REP PATTERNS";

/**
 * I10 · Intelligence — Rep patterns
 * Figma 51:2196 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/reps
 *
 * Patterns that belong to one rep: one card per pattern (confidence + n; Low = observation only,
 * no action; resolved = no live evidence), and a BY REP panel. Names reps and compares them, so
 * it is manager-only: usePatterns refuses a rep → restricted state (§4). Below ~50 analyzed team
 * calls it shows the "not enough calls" state. Hooks: usePatterns (+ useTeamMembers for names,
 * and the shared tab context).
 * GAP (LANE_REQUESTS L1-4): Figma's per-card actions differ by kind ("See result" for a coaching
 * result, none for a model rep) and its panel tags read "1 regression" / "model rep"; a Pattern
 * carries neither a kind nor a direction, so every card offers "Open profile" and the panel
 * counts by lifecycle status.
 */
export function I10IntelligenceRepPatterns() {
  const ctx = useIntelligenceContext();
  const patterns = usePatterns("rep");
  const members = useTeamMembers();

  if (isForbidden(patterns)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  const names = new Map((members.data ?? []).map((p) => [p.id, p.name]));

  return (
    <IntelligenceFrame>
      <TabsHeader eyebrow={ctx.eyebrow} counts={ctx.counts} />

      {ctx.tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={ctx.analyzed ?? 0} />
      ) : (
        <DataBoundary
          query={patterns}
          loading={<CardsSkeleton />}
          error={() => (
            <StateError
              eyebrow={EYEBROW}
              body="Bylda couldn’t load the rep patterns. Your calls are safe — try again."
              onRetry={() => void patterns.refetch()}
            />
          )}
          empty={<SystemState {...systemStates.noPatternYet()} />}
        >
          {(all) => (
            <>
              <div className="flex flex-col gap-5">
                {all.map((p) => (
                  <RepCard key={p.id} pattern={p} names={names} />
                ))}
              </div>
              <ByRepPanel patterns={all} names={names} />
            </>
          )}
        </DataBoundary>
      )}
    </IntelligenceFrame>
  );
}

function RepCard({ pattern: p, names }: { pattern: Pattern; names: Map<string, string> }) {
  const navigate = useNavigate();
  // A rep pattern names exactly one rep; anything else has no single profile to open.
  const repId = p.affectedRepIds.length === 1 ? p.affectedRepIds[0] : null;
  const who = p.affectedRepIds.map((id) => names.get(id)).filter(Boolean) as string[];
  return (
    <PatternCard
      pattern={p}
      eyebrow={who.length > 0 ? `REP PATTERN · ${who.join(", ").toUpperCase()}` : "REP PATTERN"}
      actions={
        repId
          ? [
              {
                label: "Open profile",
                onClick: () => void navigate({ to: "/app/team/reps/$repId", params: { repId } }),
              },
            ]
          : []
      }
    />
  );
}

/** Figma 51:2432: BY REP — avatar · first name · what Bylda is watching for them. */
function ByRepPanel({ patterns, names }: { patterns: Pattern[]; names: Map<string, string> }) {
  const rows = repSummaries(patterns).filter((r) => names.has(r.repId));
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <h2 className="type-ui-label text-by-text-primary">BY REP</h2>
        {rows.length === 0 ? (
          <p className="type-ui-small text-by-text-secondary">No rep has an open pattern.</p>
        ) : (
          <ul>
            {rows.map((r) => {
              const name = names.get(r.repId) ?? "";
              return (
                <li
                  key={r.repId}
                  className="flex items-center gap-2 border-b border-by-border-engraved py-[9px] last:border-b-0"
                >
                  <Avatar name={name} size={24} />
                  <span className="type-ui-small min-w-0 flex-1 text-by-text-primary">
                    {firstName(name)}
                  </span>
                  <Tag tone={r.tone}>{r.label}</Tag>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ContextPanel>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function CardsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5" aria-busy="true" aria-label="Loading rep patterns">
      <SkeletonBlock height={150} className="rounded-by-card" />
      <SkeletonBlock height={150} className="rounded-by-card" />
    </div>
  );
}
