import { Link } from "@tanstack/react-router";
import { Button, ConfidenceMeter, Icon } from "@/components/bylda";
import { usePatterns, useTeamMembers } from "@/lib/data";
import { crossTeamPattern } from "./summary";

/**
 * Owner-only cross-team pattern (Figma 31:10045). Renders only when a team pattern really spans
 * two or more teams; otherwise nothing — never a single-team pattern dressed up as cross-team.
 * Confidence + sample size always show; low confidence is observation only, no action.
 */
export function CrossTeamPattern() {
  const patterns = usePatterns("team");
  const people = useTeamMembers();
  const pattern = crossTeamPattern(patterns.data ?? [], people.data ?? []);
  if (!pattern) return null;

  return (
    <section className="flex w-full flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
      <p className="type-mono-micro flex items-center gap-2 text-by-text-secondary">
        <Icon name="intelligence" size={11} />
        CROSS-TEAM PATTERN · OWNER ONLY
      </p>
      <p className="type-editorial-insight text-by-text-primary">{pattern.headline}</p>
      <ConfidenceMeter level={pattern.confidence} sampleSize={pattern.sampleSize} />
      {pattern.confidence === "low" ? (
        <p className="type-mono-micro text-by-text-tertiary">
          OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
        </p>
      ) : (
        <div className="flex">
          <Button asChild variant="secondary">
            <Link to="/app/intelligence/patterns">Open in Intelligence</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
