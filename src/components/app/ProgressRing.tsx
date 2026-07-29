// Shared circular progress ring — extracted from the local ProgressRing in
// app.playbook.tsx so the Business Roadmap can use the same visual for
// per-stage and health-score rings.

export function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  color = "var(--primary)",
  trackColor = "var(--border)",
  label,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Custom center content — defaults to "{percent}%" */
  label?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const pct = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {label ?? (
          <span
            className="text-[12px] font-bold"
            style={{ color: "var(--foreground)", fontSize: size >= 90 ? 20 : 12 }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
