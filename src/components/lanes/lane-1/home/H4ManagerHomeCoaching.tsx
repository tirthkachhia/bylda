import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, StateEmpty, Tag, cn, type TagTone } from "@/components/bylda";
import { useCoachingFoci, type CoachingFocus } from "@/lib/data";
import { HomeTab } from "./shared/HomeTab";
import { ListCard, SectionLabel } from "./shared/List";

/**
 * H4 · Manager Home — Coaching
 * Figma 43:1670 (page 1:6) · Lane 1 — Ansh · route /app/home/coaching
 * Hooks: useHomeFeed (via HomeTab) + useCoachingFoci.
 *
 * The coaching loop at a glance — Focus → Evidence → Acknowledgement → Result (CLAUDE.md §4):
 * one card per focus that is live or needs a follow-up, status as a tag, progress as a bar.
 * No courses, no quizzes.
 */
export function H4ManagerHomeCoaching() {
  return <HomeTab eyebrow="HOME · COACHING">{() => <CoachingFoci />}</HomeTab>;
}

const ACTIVE = ["assigned", "acknowledged", "measuring"] as const;
const FOLLOW_UP = ["assigned", "not_yet", "reverted"] as const;

const isActive = (f: CoachingFocus) => (ACTIVE as readonly string[]).includes(f.status);
const needsFollowUp = (f: CoachingFocus) => (FOLLOW_UP as readonly string[]).includes(f.status);

/** 0–1 toward target, only when a measured result exists — never guessed. */
function progressOf(f: CoachingFocus): number | null {
  if (!f.result) return null;
  const span = f.result.target - f.result.baseline;
  if (span === 0) return null;
  return Math.min(1, Math.max(0, (f.result.value - f.result.baseline) / span));
}

function statusOf(f: CoachingFocus): { tone: TagTone; label: string } {
  switch (f.status) {
    case "assigned":
      return { tone: "neutral", label: "Assigned · not acknowledged" };
    case "acknowledged":
      return { tone: "info", label: "Acknowledged" };
    case "measuring":
      return {
        tone: "info",
        label:
          f.judgeAfter.calls !== null
            ? `Measuring · judged after ${f.judgeAfter.calls} calls`
            : "Measuring",
      };
    case "held":
      return { tone: "improve", label: "Held" };
    case "not_yet":
      return { tone: "attention", label: "Not there yet" };
    case "reverted":
      return { tone: "regress", label: "Reverted" };
  }
}

const FILL: Record<TagTone, string> = {
  improve: "bg-by-signal-improve",
  regress: "bg-by-signal-regress",
  attention: "bg-by-signal-attention",
  info: "bg-by-signal-info",
  neutral: "bg-by-text-tertiary",
};

function CoachingFoci() {
  const foci = useCoachingFoci();
  const navigate = useNavigate();
  const shown = (foci.data ?? []).filter((f) => isActive(f) || needsFollowUp(f));

  if (foci.isLoading) return null;
  if (shown.length === 0) {
    return (
      <StateEmpty
        eyebrow="HOME · COACHING"
        title="No coaching focuses yet."
        body="Assign one behavior to one rep, and Bylda will measure whether it changed."
        actions={[
          {
            label: "Assign coaching",
            variant: "secondary",
            onClick: () => void navigate({ to: "/app/coaching/assign" }),
          },
        ]}
      />
    );
  }

  const active = shown.filter(isActive).length;
  const followUp = shown.filter(needsFollowUp).length;

  return (
    <>
      <SectionLabel>
        {active} ACTIVE {active === 1 ? "FOCUS" : "FOCUSES"} · {followUp} NEEDS FOLLOW-UP
      </SectionLabel>
      {shown.map((f) => (
        <FocusCard key={f.id} focus={f} />
      ))}
    </>
  );
}

function FocusCard({ focus: f }: { focus: CoachingFocus }) {
  const status = statusOf(f);
  const progress = progressOf(f);
  return (
    <Link to="/app/coaching/$focusId" params={{ focusId: f.id }} className="block w-full">
      <ListCard className="transition-colors duration-200 ease-out hover:bg-by-surface-hover">
        <div className="flex items-center gap-2.5">
          <Avatar name={f.repName} size={32} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-ui-body-strong text-by-text-primary">{f.repName}</span>
            <span className="type-ui-small text-by-text-secondary">{f.behaviorName}</span>
          </span>
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>
        <div
          className="flex h-1.5 w-full overflow-hidden rounded-by-pill bg-by-surface-muted"
          role="progressbar"
          aria-label={`${f.repName}: ${f.behaviorName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress === null ? undefined : Math.round(progress * 100)}
        >
          {progress !== null ? (
            // Data-driven width — the one place a number must reach the style attribute.
            <span
              className={cn("h-1.5 rounded-by-pill", FILL[status.tone])}
              style={{ width: `${progress * 100}%` }}
            />
          ) : null}
        </div>
      </ListCard>
    </Link>
  );
}
