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
  const cx = px / 2;

  const outerR = px * 0.46;
  const midR = px * 0.35;
  const coreR = px * 0.24;
  const eyeR = coreR * 0.18;
  const eyeOffX = coreR * 0.3;
  const eyeY = cx - coreR * 0.06;
  const moodDotR = coreR * 0.16;
  const moodDotY = cx + coreR * 0.4;

  const moodColor = MOOD_COLOR[mood];

  const moodAnim =
    mood === "active"
      ? { animation: "bylda-mood-pulse 2s ease-in-out infinite" }
      : mood === "alert"
        ? { animation: "bylda-mood-fast 0.9s ease-in-out infinite" }
        : mood === "thinking"
          ? undefined
          : undefined;

  const uid = `bylda-${size}-${mood}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className={className}
      aria-label="Bylda AI"
      role="img"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <radialGradient id={`${uid}-core`} cx="40%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#FF7A3D" />
          <stop offset="100%" stopColor="#B33A06" />
        </radialGradient>
        <filter id={`${uid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation={px * 0.07}
            floodColor="#E8530A"
            floodOpacity="0.45"
          />
        </filter>
        <filter id={`${uid}-dark-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={px * 0.12} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" />
        </filter>
      </defs>

      {/* Outer dashed ring — rotates continuously */}
      <circle
        cx={cx}
        cy={cx}
        r={outerR}
        fill="none"
        stroke="var(--color-primary, #E8530A)"
        strokeOpacity="0.40"
        strokeWidth="1"
        strokeDasharray="4 6"
        style={{
          transformOrigin: `${cx}px ${cx}px`,
          animation: "bylda-outer-spin 12s linear infinite",
        }}
      />

      {/* Mid ring — scale-pulses */}
      <circle
        cx={cx}
        cy={cx}
        r={midR}
        fill="var(--color-primary-surface, #FEF0E8)"
        stroke="var(--color-primary, #E8530A)"
        strokeOpacity="0.22"
        strokeWidth="1"
        style={{
          transformOrigin: `${cx}px ${cx}px`,
          animation: "bylda-mid-pulse 3s ease-in-out infinite",
        }}
      />

      {/* Core orb */}
      <circle cx={cx} cy={cx} r={coreR} fill={`url(#${uid}-core)`} filter={`url(#${uid}-shadow)`} />

      {/* Eyes — blink every 4s */}
      <circle
        cx={cx - eyeOffX}
        cy={eyeY}
        r={eyeR}
        fill="rgba(255,255,255,0.88)"
        style={{
          transformOrigin: `${cx - eyeOffX}px ${eyeY}px`,
          animation: "bylda-blink 4s ease-in-out infinite",
        }}
      />
      <circle
        cx={cx + eyeOffX}
        cy={eyeY}
        r={eyeR}
        fill="rgba(255,255,255,0.88)"
        style={{
          transformOrigin: `${cx + eyeOffX}px ${eyeY}px`,
          animation: "bylda-blink 4s ease-in-out infinite",
          animationDelay: "0.04s",
        }}
      />

      {/* Mood indicator dot */}
      <circle cx={cx} cy={moodDotY} r={moodDotR} fill={moodColor} style={moodAnim} />
    </svg>
  );
}
