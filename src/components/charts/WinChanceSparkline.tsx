import { CHART } from "./chartTheme";

// Tiny inline SVG line of the set win probability after every point. No
// Recharts - it has to render inside the courtside pill and the parent card
// without a chunk download. Green when the last value favours us, red
// otherwise, with a faint 50% guide line.
export function WinChanceSparkline({
  history,
  width = 160,
  height = 40,
  className,
}: {
  history: number[]; // 0..1 per point
  width?: number;
  height?: number;
  className?: string;
}) {
  const pad = 3;
  const n = history.length;
  const last = n > 0 ? history[n - 1] : 0.5;
  const color = last >= 0.5 ? CHART.positive : CHART.negative;
  const x = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v: number) => pad + (1 - v) * (height - pad * 2);
  const points = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Set win chance over ${n} points, now ${Math.round(last * 100)}%`}
    >
      <line x1={pad} x2={width - pad} y1={y(0.5)} y2={y(0.5)} stroke={CHART.axisLine} strokeDasharray="3 3" />
      {n > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {n > 0 && <circle cx={x(n - 1)} cy={y(last)} r={3} fill={color} stroke={CHART.white} strokeWidth={1.5} />}
    </svg>
  );
}
