import {
  ContextPanel,
  DataBoundary,
  SkeletonBlock,
  StateError,
  SystemState,
  cn,
} from "@/components/bylda";
import { patternShowsConfidence, usePatterns, type Pattern } from "@/lib/data";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { PatternCard } from "./shared/PatternCard";
import { TabsHeader } from "./shared/TabsHeader";
import { useIntelligenceContext } from "./shared/useIntelligenceContext";
import { CONFIDENCE_SHORT, isForbidden, isOpenPattern } from "./shared/model";

const EYEBROW = "INTELLIGENCE · PROSPECT PATTERNS";

const COLS = "grid grid-cols-[minmax(200px,1fr)_70px_230px_80px] items-center";

/**
 * I11 · Intelligence — Prospect patterns
 * Figma 51:2556 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/prospects
 *
 * What prospects do on calls and what tends to follow — aggregate only, never a profile of one
 * prospect. The strongest open prospect pattern leads as a card; the table lists them all with
 * calls and confidence (§4). Manager-only (usePatterns refuses a rep → restricted state); below
 * ~50 analyzed team calls it shows the "not enough calls" state. Hook: usePatterns (+ the shared
 * tab context).
 * GAP (LANE_REQUESTS L1-4): the card's persona line ("CFOs") and the BY PERSONA panel have no
 * field. WHAT FOLLOWS is the pattern's associated outcome (`selected.associatedOutcome`).
 */
export function I11IntelligenceProspectPatterns() {
  const ctx = useIntelligenceContext();
  const patterns = usePatterns("prospect");

  if (isForbidden(patterns)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  return (
    <IntelligenceFrame>
      <TabsHeader eyebrow={ctx.eyebrow} counts={ctx.counts} />

      {ctx.tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={ctx.analyzed ?? 0} />
      ) : (
        <DataBoundary
          query={patterns}
          loading={<Skeleton />}
          error={() => (
            <StateError
              eyebrow={EYEBROW}
              body="Bylda couldn’t load the prospect patterns. Your calls are safe — try again."
              onRetry={() => void patterns.refetch()}
            />
          )}
          empty={<NoProspectPattern />}
        >
          {(all) => {
            const lead = leadPattern(all);
            return (
              <>
                {lead ? <PatternCard pattern={lead} eyebrow="PROSPECT PATTERN" /> : null}
                <SignalsTable patterns={all} />
              </>
            );
          }}
        </DataBoundary>
      )}

      <ContextPanel>
        <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
          <p className="type-mono-micro text-by-text-tertiary">PRIVACY</p>
          <p className="type-ui-small text-by-text-primary">
            Prospect patterns are aggregate. Bylda doesn’t build profiles of individual prospects.
          </p>
        </aside>
      </ContextPanel>
    </IntelligenceFrame>
  );
}

const RANK = { high: 3, medium: 2, low: 1 } as const;

/** The card: the open pattern Bylda is surest of, most calls breaking ties. */
function leadPattern(list: Pattern[]): Pattern | null {
  return (
    list
      .filter((p) => isOpenPattern(p) && patternShowsConfidence(p))
      .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || b.sampleSize - a.sampleSize)[0] ??
    null
  );
}

/** Figma 51:2831: WHAT PROSPECTS DO — AND WHAT FOLLOWS. */
function SignalsTable({ patterns }: { patterns: Pattern[] }) {
  return (
    <section
      aria-label="What prospects do and what follows"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[600px]">
        <header className="border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label text-by-text-primary">
            WHAT PROSPECTS DO — AND WHAT FOLLOWS
          </h2>
        </header>
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>PROSPECT SIGNAL</span>
          <span>CALLS</span>
          <span>WHAT FOLLOWS</span>
          <span>CONF.</span>
        </div>
        {patterns.map((p) => (
          <div
            key={p.id}
            className={cn(COLS, "border-b border-by-border-engraved px-4 py-2.5 last:border-b-0")}
          >
            <span className="type-ui-body-strong pr-3 text-by-text-primary">{p.headline}</span>
            <span className="type-mono-data text-by-text-secondary">{p.sampleSize}</span>
            <span className="type-ui-small pr-3 text-by-text-primary">
              {p.selected?.associatedOutcome ?? "—"}
            </span>
            <span className="type-mono-data text-by-text-secondary">
              {patternShowsConfidence(p) ? CONFIDENCE_SHORT[p.confidence] : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoProspectPattern() {
  return (
    <SystemState
      eyebrow={EYEBROW}
      tag={{ tone: "neutral", label: "Empty" }}
      title="No prospect patterns yet."
      body="They show up once the same prospect signal — who joins, what they say — keeps coming back across calls."
    />
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function Skeleton() {
  return (
    <div
      className="flex w-full flex-col gap-5"
      aria-busy="true"
      aria-label="Loading prospect patterns"
    >
      <SkeletonBlock height={130} className="rounded-by-card" />
      <SkeletonBlock height={300} className="rounded-by-card" />
    </div>
  );
}
