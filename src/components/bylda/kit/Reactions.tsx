import { cn } from "./cn";

/** Reactions (39:956) — pill counters under a room message, plus "+". */
export type Reaction = { symbol: string; count: number; mine?: boolean };

export function Reactions({
  reactions,
  onReact,
  onAdd,
  className,
}: {
  reactions: Reaction[];
  onReact?: (symbol: string) => void;
  onAdd?: () => void;
  className?: string;
}) {
  const pill =
    "type-ui-small inline-flex items-center gap-1 rounded-by-pill border border-by-border-engraved bg-by-surface-inset px-2 py-[3px] text-by-text-secondary transition-colors hover:border-by-border-control";
  return (
    <div className={cn("flex items-start gap-1.5", className)}>
      {reactions.map((r) => (
        <button
          key={r.symbol}
          type="button"
          className={cn(pill, r.mine && "border-by-border-control text-by-text-primary")}
          onClick={() => onReact?.(r.symbol)}
          aria-pressed={r.mine}
        >
          <span>{r.symbol}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <button type="button" className={pill} onClick={onAdd} aria-label="Add reaction">
        +
      </button>
    </div>
  );
}
