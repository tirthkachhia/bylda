import { useNavigate } from "@tanstack/react-router";
import {
  CallBlock,
  CoachingBlock,
  Icon,
  InsightCard,
  Reactions,
  ReportBlock,
  type InsightAction as CardAction,
  type TagTone,
} from "@/components/bylda";
import type { AttentionItem } from "@/lib/data";
import { ago, clockTime, minutesOf, stamp } from "../shared/format";
import { behaviorKeyOf, evidenceCallIds } from "./links";
import { useLocalReactions } from "./useLocalReactions";
import type { Post } from "./posts";

/**
 * The For You stream under the hero: Bylda posts, newest first.
 * Insights → InsightCard (enforces confidence + n, low ⇒ no action). Reports, calls and
 * coaching results → the room message blocks (39:904 · 39:918 · 39:935). Reactions on
 * every Bylda post (39:956).
 */
export function FeedStream({ posts }: { posts: Post[] }) {
  return (
    <div className="flex w-full flex-col gap-3.5">
      {posts.map((p) => (
        <FeedPost key={p.id} post={p} />
      ))}
    </div>
  );
}

function FeedPost({ post }: { post: Post }) {
  const reactions = useLocalReactions();
  return (
    <div className="animate-by-resolve flex w-full flex-col gap-1.5">
      <PostBody post={post} />
      <Reactions reactions={reactions.list} onReact={reactions.toggle} onAdd={reactions.add} />
    </div>
  );
}

function PostBody({ post }: { post: Post }) {
  const navigate = useNavigate();
  switch (post.kind) {
    case "insight": {
      const i = post.insight;
      const behaviorKey = behaviorKeyOf(i);
      const callIds = evidenceCallIds(i);
      const actions: CardAction[] = [];
      if (behaviorKey) {
        actions.push({
          label: "View pattern",
          variant: "secondary",
          onClick: () =>
            void navigate({
              to: "/app/intelligence/behaviors/$behaviorKey",
              params: { behaviorKey },
            }),
        });
      }
      if (callIds.length > 0) {
        actions.push({
          label: callIds.length === 1 ? "View call" : `View calls (${callIds.length})`,
          variant: "secondary",
          onClick: () =>
            void navigate({ to: "/app/calls/$callId", params: { callId: callIds[0] } }),
        });
      }
      if (i.action?.type === "assign_coaching") {
        const { repId } = i.action;
        actions.push({
          label: i.action.label,
          variant: "secondary",
          onClick: () =>
            void navigate({
              to: "/app/coaching/assign",
              search: { repId, behaviorKey: behaviorKey ?? undefined } as never,
            }),
        });
      }
      if (i.action?.type === "open_report") {
        const { reportId } = i.action;
        actions.push({
          label: i.action.label,
          variant: "secondary",
          onClick: () => void navigate({ to: "/app/reports/daily", search: { reportId } }),
        });
      }
      return (
        <InsightCard
          kind={i.kind}
          headline={i.headline}
          body={i.body ?? undefined}
          confidence={i.confidence}
          sampleSize={i.sampleSize}
          sampleLabel={i.sampleLabel ?? undefined}
          time={stamp(i.createdAt).toUpperCase()}
          tag={i.tag ? { tone: i.tone as TagTone, label: i.tag } : undefined}
          evidence={i.evidence}
          actions={actions}
          causalTested={i.causalTested}
        />
      );
    }
    case "report": {
      const r = post.report;
      const daily = r.kind === "daily_manager" || r.kind === "daily_rep";
      return (
        <ReportBlock
          title={`Your ${r.title} is ready.`}
          meta={`Report · ${r.period} · ${clockTime(r.generatedAt)}`}
          onOpen={() =>
            void (daily
              ? navigate({ to: "/app/reports/daily", search: { reportId: r.id } })
              : navigate({ to: "/app/reports" }))
          }
        />
      );
    }
    case "call": {
      const c = post.call;
      return (
        <CallBlock
          title={`${c.repName.split(" ")[0]} × ${c.account.name}`}
          meta={[
            minutesOf(c.durationSec),
            stamp(c.startedAt),
            c.keyMoments > 0
              ? `${c.keyMoments} key ${c.keyMoments === 1 ? "moment" : "moments"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          moment={
            c.topMoment
              ? {
                  tone: c.topMoment.tone,
                  label: c.topMoment.label.includes(c.topMoment.timestamp)
                    ? c.topMoment.label
                    : `${c.topMoment.label} ${c.topMoment.timestamp}`,
                }
              : undefined
          }
          onReview={() => void navigate({ to: "/app/calls/$callId", params: { callId: c.id } })}
        />
      );
    }
    case "coaching": {
      const f = post.focus;
      const verdict = f.result?.verdict;
      const label =
        verdict === "held" ? "held" : verdict === "reverted" ? "reverted" : "not there yet";
      return (
        <CoachingBlock
          title={`${f.repName.split(" ")[0]}’s focus ${label}: ${f.behaviorName.toLowerCase()}`}
          meta={`${f.metric} · n = ${f.result?.sampleSize ?? 0} · ${ago(post.at)}`}
          actionLabel="Open"
          onAction={() =>
            void navigate({ to: "/app/coaching/$focusId", params: { focusId: f.id } })
          }
        />
      );
    }
  }
}

/** Workspace alerts (feed.attention) — a dot and a word, never a red badge (§4, 31:1197). */
export function AttentionRow({ item }: { item: AttentionItem }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => void navigate({ href: item.href })}
      className="flex w-full items-center gap-3.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-by-surface-hover"
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-by-pill bg-by-surface-inset text-by-text-secondary">
        <Icon name="alert" size={16} />
      </span>
      <span className="type-mono-micro rounded-by-badge border border-by-border-engraved bg-by-surface-inset px-[7px] py-[3px] text-by-text-secondary">
        ALERT
      </span>
      <span className="type-ui-body min-w-0 flex-1 text-by-text-primary">{item.title}</span>
      <span className="type-ui-small inline-flex items-center gap-1.5 text-by-text-secondary">
        <span className="size-1.5 rounded-by-pill bg-by-text-secondary" aria-hidden />
        Needs attention
      </span>
    </button>
  );
}
