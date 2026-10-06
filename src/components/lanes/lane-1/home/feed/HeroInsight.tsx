import { Link, useNavigate } from "@tanstack/react-router";
import {
  AppBadge,
  Avatar,
  Button,
  ConfidenceMeter,
  Icon,
  Reactions,
  Tag,
  TrendChart,
  cn,
  type TagTone,
} from "@/components/bylda";
import { useRepScores, type Insight, type Person } from "@/lib/data";
import { lastChangePct, stamp } from "../shared/format";
import { useLocalReactions } from "./useLocalReactions";
import { behaviorKeyOf, evidenceCallIds, insightRoutes } from "./links";

/**
 * Feed / Hero insight (39:712) — the top Bylda post: INSIGHT → EVIDENCE → ACTION.
 * Hero card ⇒ the one soft shadow (CLAUDE.md §13.3). Radius card 10 (§13.5).
 * Confidence + n always; low confidence ⇒ observation only, no buttons (§4).
 */
export function HeroInsight({ insight, rep }: { insight: Insight; rep: Person | null }) {
  const navigate = useNavigate();
  const routes = insightRoutes(insight);
  const behaviorKey = behaviorKeyOf(insight);
  const callIds = evidenceCallIds(insight);
  const observationOnly = insight.confidence === "low";
  const reactions = useLocalReactions();

  return (
    <article className="animate-by-resolve flex w-full gap-[18px] rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[22px] py-5 shadow-by-float">
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-by-pill bg-by-surface-control-dark text-by-text-on-control">
        <Icon name="intelligence" size={18} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <span className="type-ui-label text-by-text-primary">BYLDA</span>
          <AppBadge />
          <span className="type-ui-small text-by-text-tertiary">{stamp(insight.createdAt)}</span>
          {insight.tag ? <Tag tone={insight.tone as TagTone}>{insight.tag}</Tag> : null}
        </div>

        <h2 className="type-editorial-h2 text-by-text-primary">
          {routes.behavior ? (
            <Link
              to="/app/intelligence/behaviors/$behaviorKey"
              params={{ behaviorKey: behaviorKey ?? "" }}
              className="hover:underline hover:decoration-by-border-control hover:underline-offset-4"
            >
              {insight.headline}
            </Link>
          ) : (
            insight.headline
          )}
        </h2>
        {insight.body ? (
          <p className="type-ui-body text-by-text-secondary">{insight.body}</p>
        ) : null}

        <ConfidenceMeter
          level={insight.confidence}
          sampleSize={insight.sampleSize}
          sampleLabel={insight.sampleLabel ?? undefined}
        />

        {observationOnly ? (
          <p className="type-mono-micro text-by-text-tertiary">
            OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-2 pt-0.5">
            {behaviorKey ? (
              <Button
                variant="primary"
                onClick={() =>
                  void navigate({
                    to: "/app/intelligence/behaviors/$behaviorKey",
                    params: { behaviorKey },
                  })
                }
              >
                View pattern
              </Button>
            ) : null}
            {callIds.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate({ to: "/app/calls/$callId", params: { callId: callIds[0] } })
                }
              >
                {callIds.length === 1 ? "View call" : `View calls (${callIds.length})`}
              </Button>
            ) : null}
            {insight.action?.type === "assign_coaching" ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate({
                    to: "/app/coaching/assign",
                    search: routes.assignSearch as never,
                  })
                }
              >
                {insight.action.label}
              </Button>
            ) : null}
          </div>
        )}

        <Reactions
          className="pt-1"
          reactions={reactions.list}
          onReact={reactions.toggle}
          onAdd={reactions.add}
        />
      </div>

      {rep && behaviorKey ? <RepTrend rep={rep} behaviorKey={behaviorKey} /> : null}
    </article>
  );
}

/** Right column (39:740): affected rep + their trend on this behavior, fixed y-range. */
function RepTrend({ rep, behaviorKey }: { rep: Person; behaviorKey: string }) {
  const scores = useRepScores(rep.id);
  const score = scores.data?.find((s) => s.behaviorKey === behaviorKey) ?? null;
  const pct = score ? lastChangePct(score.sparkline.points) : null;
  const tone =
    score?.direction === "regressing"
      ? "text-by-signal-regress"
      : score?.direction === "improving"
        ? "text-by-signal-improve"
        : "text-by-text-secondary";

  return (
    <Link
      to="/app/team/reps/$repId/overview"
      params={{ repId: rep.id }}
      className="flex w-[150px] shrink-0 flex-col items-center gap-1.5 rounded-by-tile py-1 transition-colors duration-200 ease-out hover:bg-by-surface-hover max-[1180px]:hidden"
    >
      <Avatar name={rep.name} src={rep.avatarUrl} size={64} />
      <span className="type-ui-body-strong text-by-text-primary">{rep.name}</span>
      {score ? (
        <>
          <span className="type-ui-small text-by-text-secondary">{score.name}</span>
          <span className={cn("flex items-center gap-1.5", tone)}>
            <TrendChart
              series={score.sparkline}
              width={60}
              height={18}
              strokeWidth={1.5}
              pad={1.5}
            />
            {pct !== null ? (
              <span className="type-ui-body-strong">
                {pct > 0 ? "↑" : pct < 0 ? "↓" : "→"} {Math.abs(pct)}%
              </span>
            ) : null}
          </span>
          <span className="type-ui-small text-by-text-tertiary">vs last week</span>
        </>
      ) : null}
    </Link>
  );
}
