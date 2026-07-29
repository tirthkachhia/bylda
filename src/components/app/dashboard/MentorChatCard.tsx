// AI Mentor — Campus's compact mentor card. Shows whichever mentor owns the
// active lesson (falls back to the roster's first mentor before a curriculum
// exists) and links into the full chat experience rather than re-implementing
// chat here.

import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useCurriculum } from "@/hooks/use-curriculum";
import { mentorById, MENTOR_ROSTER } from "@/lib/mentors";
import { MentorAvatar } from "@/components/app/MentorAvatar";

export function MentorChatCard() {
  const { activeLesson } = useCurriculum();
  const mentor = (activeLesson ? mentorById(activeLesson.mentor_id) : null) ?? MENTOR_ROSTER[0];

  return (
    <div
      className="rounded-[6px] border px-5 py-4"
      style={{
        borderColor: `color-mix(in oklab, ${mentor.hue} 25%, var(--border))`,
        background: "var(--surface)",
      }}
    >
      <div className="mb-2.5 text-[12.5px] font-bold" style={{ color: "var(--muted-foreground)" }}>
        AI Mentor
      </div>
      <div className="flex items-center gap-3">
        <MentorAvatar mentor={mentor} size="md" />
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold" style={{ color: "var(--foreground)" }}>
            {mentor.name}
          </div>
          <div className="text-[11.5px]" style={{ color: mentor.hue }}>
            {mentor.domain}
          </div>
        </div>
      </div>
      <p
        className="mt-2.5 text-[12.5px] leading-relaxed"
        style={{ color: "var(--muted-foreground)" }}
      >
        {`Hi! I'm here to guide you through this module. Let's keep building.`}
      </p>
      <Link
        to="/app/launchpad/mentors"
        className="mt-3 inline-flex items-center gap-1.5 rounded-[5px] px-3.5 py-2 text-[12.5px] font-bold text-white"
        style={{ background: mentor.hue }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Chat with {mentor.first}
      </Link>
    </div>
  );
}
