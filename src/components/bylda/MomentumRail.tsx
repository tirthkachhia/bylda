/**
 * MomentumRail — the persistent "here's what led to this screen" strip.
 *
 * This is the generalized momentum loop: a collapsed-by-default rail that
 * shows the closed loop of cause-and-effect leading into the current screen.
 * Each link is optional and only rendered when present, so a screen passes
 * whatever context it actually has.
 *
 * Note: this is intentionally a NEW component, not a rewrite of ClosedLoopChip.
 * ClosedLoopChip is a small status-chip vocabulary with ~9 live call sites and
 * a { kind, label } API; repurposing it into a {goal, decision, task, asset,
 * automation} rail would break every one of those. The two share the same
 * violet closed-loop language but serve different jobs.
 */
import { useState } from "react";
import {
  Target,
  GitBranch,
  CheckSquare,
  FileText,
  Zap,
  TrendingUp,
  ChevronDown,
  Repeat,
  type LucideIcon,
} from "lucide-react";

export interface MomentumLoop {
  /** The standing objective this screen serves. */
  goal?: string;
  /** The call Bylda/you made that routed here. */
  decision?: string;
  /** The concrete action in play. */
  task?: string;
  /** The artifact produced or being acted on. */
  asset?: string;
  /** The automation now carrying it forward. */
  automation?: string;
  /** The resulting movement (streak, delta, unlocked next). */
  momentum?: string;
}

const LINKS: { key: keyof MomentumLoop; icon: LucideIcon; label: string }[] = [
  { key: "goal", icon: Target, label: "Goal" },
  { key: "decision", icon: GitBranch, label: "Decision" },
  { key: "task", icon: CheckSquare, label: "Task" },
  { key: "asset", icon: FileText, label: "Asset" },
  { key: "automation", icon: Zap, label: "Automation" },
  { key: "momentum", icon: TrendingUp, label: "Momentum" },
];

export function MomentumRail({
  loop,
  defaultOpen = false,
  className = "",
}: {
  loop: MomentumLoop;
  /** Collapsed by default per spec; pass true to start expanded. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const items = LINKS.map((l) => ({ ...l, value: loop[l.key] })).filter(
    (l): l is typeof l & { value: string } => Boolean(l.value),
  );
  if (items.length === 0) return null;

  return (
    <div
      className={`overflow-hidden rounded-[8px] border ${className}`}
      style={{ borderColor: "var(--primary-border)", background: "var(--primary-soft)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-left"
        aria-expanded={open}
      >
        <Repeat className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--primary)" }}
        >
          What led here
        </span>
        {!open && (
          <span className="truncate text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {items.map((i) => i.value).join("  →  ")}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--primary)" }}
        />
      </button>

      {open && (
        <ol
          className="flex flex-col gap-0 border-t px-3.5 py-2.5"
          style={{ borderColor: "var(--primary-border)" }}
        >
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="flex items-start gap-2.5 py-1">
                <div className="flex flex-col items-center self-stretch">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--surface)", color: "var(--primary)" }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {idx < items.length - 1 && (
                    <span
                      className="mt-0.5 w-px flex-1"
                      style={{ background: "var(--primary-border)" }}
                    />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.06em]"
                    style={{ color: "var(--primary)" }}
                  >
                    {item.label}
                  </div>
                  <div className="text-[13px] leading-snug" style={{ color: "var(--foreground)" }}>
                    {item.value}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
