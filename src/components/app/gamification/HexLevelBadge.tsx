// Hex-shaped Business Level badge for the Roadmap and Campus pages — reads the
// level color tokens and founder level from use-founder-progress.

import { cn } from "@/lib/utils";
import type { FounderLevel } from "@/hooks/use-founder-progress";

const LEVEL_COLORS: Record<number, string> = {
  1: "var(--level-1-color)",
  2: "var(--level-2-color)",
  3: "var(--level-3-color)",
  4: "var(--level-4-color)",
  5: "var(--level-5-color)",
  6: "var(--level-6-color)",
  7: "var(--level-7-color)",
  8: "var(--level-8-color)",
  9: "var(--level-9-color)",
  10: "var(--level-10-color)",
};

const HEX_CLIP = "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)";

export function HexLevelBadge({
  level,
  levelLabel,
  size = 72,
  className,
}: {
  level: FounderLevel;
  levelLabel: string;
  size?: number;
  className?: string;
}) {
  const color = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div
        className="flex items-center justify-center"
        style={{
          width: size,
          height: size,
          clipPath: HEX_CLIP,
          background: `linear-gradient(155deg, color-mix(in oklab, ${color} 85%, black), ${color})`,
          boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 40%, transparent)`,
        }}
      >
        <span
          className="font-display font-black text-white"
          style={{ fontSize: size * 0.36, lineHeight: 1 }}
        >
          {level}
        </span>
      </div>
      <span className="text-[11px] font-bold" style={{ color: "var(--foreground)" }}>
        {levelLabel}
      </span>
    </div>
  );
}
