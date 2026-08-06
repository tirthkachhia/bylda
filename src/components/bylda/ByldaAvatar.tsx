type ByldaAvatarMood = "active" | "thinking" | "alert" | "idle";

interface ByldaAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  mood?: ByldaAvatarMood;
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 56, xl: 96 };

const MOOD_COLOR: Record<ByldaAvatarMood, string> = {
  active: "#16A34A",
  thinking: "#D97706",
  alert: "#E8530A",
  idle: "#A89F97",
};

export function ByldaAvatar({ size = "md", mood = "active", className }: ByldaAvatarProps) {
  const px = SIZES[size];
  const moodAnim =
    mood === "active"
      ? { animation: "bylda-mood-pulse 2s ease-in-out infinite" }
      : mood === "alert"
        ? { animation: "bylda-mood-fast 0.9s ease-in-out infinite" }
        : undefined;

  return (
    <span
      className={className}
      aria-label="Bylda AI"
      role="img"
      style={{ width: px, height: px, display: "block", flexShrink: 0, position: "relative" }}
    >
      <img
        src="/bylda-logo.png"
        alt=""
        style={{
          width: px,
          height: px,
          display: "block",
          borderRadius: px * 0.24,
          objectFit: "cover",
          background: "#000",
          boxShadow: `0 0 ${px * 0.24}px rgba(93, 101, 130, 0.35)`,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -1,
          bottom: -1,
          width: Math.max(5, px * 0.18),
          height: Math.max(5, px * 0.18),
          borderRadius: "50%",
          background: MOOD_COLOR[mood],
          border: `${Math.max(1, px * 0.04)}px solid var(--background, #fff)`,
          ...moodAnim,
        }}
      />
    </span>
  );
}
