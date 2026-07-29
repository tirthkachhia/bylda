// Mentor avatar — the face on every lesson. Initials on the mentor's accent
// hue; consistent everywhere a mentor appears (home hero, curriculum map,
// lesson header, chat).

import { cn } from "@/lib/utils";
import { mentorInitials, type Mentor } from "@/lib/mentors";

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[17px]",
  xl: "h-20 w-20 text-[24px]",
} as const;

export function MentorAvatar({
  mentor,
  size = "md",
  muted = false,
  className,
}: {
  mentor: Mentor;
  size?: keyof typeof SIZES;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      title={`${mentor.name} — ${mentor.domain}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        SIZES[size],
        muted && "opacity-40 saturate-50",
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${mentor.hue} 85%, black)`,
        boxShadow: muted ? "none" : `0 0 0 2px color-mix(in oklab, ${mentor.hue} 30%, transparent)`,
      }}
    >
      {mentorInitials(mentor)}
    </span>
  );
}
