import type { TagTone } from "@/components/bylda";
import type { CoachingFocus, Insight, Person } from "@/lib/data";
import { firstNameOf, weekdayShort } from "../shared/format";

/** One line of the Team Updates timeline. Built only from what the hooks return. */
export type TeamUpdate = {
  id: string;
  at: string;
  /** whose avatar to show — the rep the update is about, or Bylda */
  who: string;
  text: string;
  tag: { tone: TagTone; label: string } | null;
  href: { to: "/app/coaching/$focusId"; focusId: string } | { to: "/app/home/team-updates" };
  /** only insight rows carry these — confidence + sample size are never optional (§4) */
  insight: Pick<Insight, "confidence" | "sampleSize" | "sampleLabel"> | null;
};

/**
 * Coaching focus lifecycle → updates: acknowledged, resolved (held / not yet / reverted), and
 * assigned-but-not-opened (the "needs nudge" row). Pronouns are neutral — a name never implies one.
 */
export function focusUpdates(foci: CoachingFocus[]): TeamUpdate[] {
  const out: TeamUpdate[] = [];
  for (const f of foci) {
    const first = firstNameOf(f.repName);
    const href = { to: "/app/coaching/$focusId", focusId: f.id } as const;
    const base = { who: f.repName, href, insight: null };

    if (f.result) {
      const { verdict, measuredOn } = f.result;
      out.push({
        ...base,
        id: `${f.id}:result`,
        at: measuredOn,
        text:
          verdict === "held"
            ? `${first}’s coaching focus held: ${f.behaviorName.toLowerCase()}`
            : verdict === "reverted"
              ? `${first}’s coaching focus reverted: ${f.behaviorName.toLowerCase()}`
              : `${first}’s coaching focus isn’t there yet: ${f.behaviorName.toLowerCase()}`,
        tag: {
          tone: verdict === "held" ? "improve" : verdict === "reverted" ? "regress" : "attention",
          label: "Result",
        },
      });
    }
    if (f.acknowledgedAt) {
      out.push({
        ...base,
        id: `${f.id}:ack`,
        at: f.acknowledgedAt,
        text: `${first} acknowledged their coaching focus “${f.behaviorName}”`,
        tag: { tone: "neutral", label: "Coaching" },
      });
    } else if (f.status === "assigned") {
      out.push({
        ...base,
        id: `${f.id}:assigned`,
        at: f.assignedAt,
        text: `${first} hasn’t opened their focus yet (assigned ${weekdayShort(f.assignedAt)})`,
        tag: { tone: "attention", label: "Needs nudge" },
      });
    }
  }
  return out;
}

/** Feed insights tagged for the Team Updates tab. */
export function insightUpdates(insights: Insight[], people: Person[]): TeamUpdate[] {
  return insights.map((i) => {
    const rep =
      i.affectedRepIds.length === 1 ? people.find((p) => p.id === i.affectedRepIds[0]) : null;
    return {
      id: `i:${i.id}`,
      at: i.createdAt,
      who: rep?.name ?? "Bylda",
      text: i.headline,
      tag: i.tag ? { tone: i.tone as TagTone, label: i.tag } : null,
      href: { to: "/app/home/team-updates" },
      insight: { confidence: i.confidence, sampleSize: i.sampleSize, sampleLabel: i.sampleLabel },
    };
  });
}
