import { useNavigate } from "@tanstack/react-router";
import { Button, ConfidenceMeter, ContextPanel, EvidenceBlock } from "@/components/bylda";
import { patternShowsConfidence, type Insight, type Pattern } from "@/lib/data";
import { FactRow } from "../shared/IntelligenceFrame";
import { STATUS_LABEL, shortDate } from "../shared/model";

/**
 * I3 context panel (Figma 27:658): SELECTED · <pattern> → the insight → confidence + n → facts
 * → one evidence moment → "Create coaching focus for <rep>".
 *
 * The sentence and the evidence come from the insight that explains this pattern, when there is
 * one; otherwise the pattern's own headline and rule stand in. The facts compare a rep with the
 * team, so they exist only on a manager-only Pattern. The action needs exactly one rep and
 * Medium confidence or better: Low = observation only, a resolved pattern has nothing live to
 * coach, and a multi-rep pattern has no single focus to assign (CLAUDE.md §4).
 */
export function SelectedPanel({
  pattern,
  insight,
  repNames,
}: {
  pattern: Pattern;
  insight: Insight | null;
  repNames: Map<string, string>;
}) {
  const navigate = useNavigate();
  const sole = pattern.affectedRepIds.length === 1 ? pattern.affectedRepIds[0] : null;
  const soleName = sole ? repNames.get(sole) : undefined;
  const shows = patternShowsConfidence(pattern);
  const canAssign =
    shows && pattern.confidence !== "low" && !!sole && !!soleName && !!pattern.behaviorKey;
  const evidence = insight?.evidence[0] ?? null;
  const sel = pattern.selected;

  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <h2 className="type-ui-label text-by-text-primary">
          SELECTED · {pattern.headline.toUpperCase()}
        </h2>
        <p className="type-editorial-insight text-by-text-primary">
          {insight?.headline ?? pattern.headline}
        </p>

        {shows ? (
          <ConfidenceMeter
            level={pattern.confidence}
            sampleSize={pattern.sampleSize}
            sampleLabel={`n = ${pattern.sampleSize} ${pattern.sampleSize === 1 ? "call" : "calls"}`}
          />
        ) : (
          <p className="type-mono-micro text-by-text-tertiary">
            NO LIVE EVIDENCE —{" "}
            {pattern.status ? STATUS_LABEL[pattern.status].toUpperCase() : "NO CALLS"}
          </p>
        )}

        <div>
          {sel ? (
            <>
              <FactRow label="Frequency">{sel.frequency}</FactRow>
              {sel.associatedOutcome ? (
                <FactRow label="Associated">{sel.associatedOutcome}</FactRow>
              ) : null}
              <FactRow label="Trend">{sel.trend}</FactRow>
            </>
          ) : (
            <>
              {pattern.rule ? <FactRow label="Rule">{pattern.rule}</FactRow> : null}
              <FactRow label="First seen">{shortDate(pattern.firstSeenAt)}</FactRow>
              <FactRow label="Calls">{pattern.sampleSize}</FactRow>
            </>
          )}
        </div>

        {evidence ? (
          <EvidenceBlock
            evidence={{
              timestamp: evidence.timestamp,
              speaker: evidence.speakerLabel,
              quote: evidence.quote,
              href: `/app/calls/${evidence.callId}`,
            }}
          />
        ) : null}

        {canAssign && sole ? (
          <Button
            variant="primary"
            className="w-full justify-start"
            onClick={() =>
              void navigate({
                to: "/app/coaching/assign",
                search: { repId: sole, behaviorKey: pattern.behaviorKey } as never,
              })
            }
          >
            Create coaching focus for {soleName?.split(" ")[0]}
          </Button>
        ) : shows && pattern.confidence === "low" ? (
          <p className="type-mono-micro text-by-text-tertiary">
            OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
          </p>
        ) : null}
      </div>
    </ContextPanel>
  );
}
