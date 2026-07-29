// Small trend line for compact impact cards — adapted from the LineChart
// pattern in app.mission-control.tsx, sized for a sidebar rail rather than
// a full dashboard card.

export function Sparkline({
  points,
  width = 160,
  height = 48,
  color = "var(--primary)",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const x = (i: number) => (i / (points.length - 1)) * (width - 6) + 3;
  const y = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ");
  const area = `${path} L${x(points.length - 1)} ${height} L${x(0)} ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
      <path d={area} fill={color} opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last)} r="2.5" fill={color} />
    </svg>
  );
}
