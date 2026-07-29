// RecentWinChip — momentum, celebrated in the moment. Reads the most recent
// positive bylda_event and surfaces it on the home with a warm, animated beat,
// instead of leaving wins buried in a collapsed rail (audit Part 2 Q5).
//
// One shared event ledger drives it, so a completed course step, a finished
// mission, or a new contact all light up here the moment they happen.

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Sparkles } from "lucide-react";
import { latestWinQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

const WIN_COPY: Record<string, string> = {
  "step.completed": "You completed a step",
  "mission.completed": "You finished a module",
  "course.generated": "Your course is ready",
  "track.graduation": "You advanced a stage",
  "contact.created": "A new contact landed",
};

export function RecentWinChip() {
  const { currentOrgId } = useAuth();
  const { data: win } = useQuery({
    ...latestWinQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  if (!win || !WIN_COPY[win.event_type]) return null;

  let when = "just now";
  try {
    when = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });
  } catch {
    /* keep default */
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{
        borderColor: "color-mix(in oklab, var(--success) 32%, transparent)",
        background: "color-mix(in oklab, var(--success) 12%, var(--surface))",
        animation: "winPop 0.5s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <style>{`@keyframes winPop {
        from { opacity: 0; transform: translateY(4px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }`}</style>
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ background: "var(--success)", color: "var(--success-foreground)" }}
      >
        <Sparkles className="h-3 w-3" />
      </span>
      <span className="text-[12.5px] font-bold" style={{ color: "var(--foreground)" }}>
        {WIN_COPY[win.event_type]}
      </span>
      <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
        {when}
      </span>
    </div>
  );
}
