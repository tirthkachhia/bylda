import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface XPProgressBarProps {
  percent: number;
  currentXP: number;
  xpForNextLevel: number;
  animate?: boolean;
  height?: number;
  className?: string;
  showLabel?: boolean;
}

export function XPProgressBar({
  percent,
  currentXP,
  xpForNextLevel,
  animate = true,
  height = 4,
  className,
  showLabel = false,
}: XPProgressBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const prevPercent = useRef(0);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    if (animate && percent !== prevPercent.current) {
      gsap.to(el, {
        width: `${percent}%`,
        duration: 1.2,
        ease: "power2.out",
      });
    } else {
      el.style.width = `${percent}%`;
    }
    prevPercent.current = percent;
  }, [percent, animate]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            XP
          </span>
          <span className="text-[9px] font-mono" style={{ color: "var(--muted-foreground)" }}>
            {currentXP.toLocaleString()} / {xpForNextLevel.toLocaleString()}
          </span>
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-full"
        style={{
          height,
          background: "var(--surface-2)",
        }}
      >
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: animate ? "0%" : `${percent}%`,
            background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
            boxShadow: "0 0 8px color-mix(in oklab, var(--primary) 45%, transparent)",
            transition: animate ? undefined : "width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}
