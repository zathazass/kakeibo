/**
 * A 2px trend line for a stat tile. Deliberately unlabelled and axis-free —
 * it shows shape, and the tile's own value carries the number.
 */
export function Sparkline({
  values,
  width = 108,
  height = 26,
  color = "var(--series-1)",
  showEnd = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  showEnd?: boolean;
}) {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;

  // Inset by the marker radius so the end dot and the stroke are not clipped
  // by the viewBox edge — the last point would otherwise sit exactly on it.
  const PAD = 3.5;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const stepX = (width - PAD * 2) / (points.length - 1);
  const x = (index: number) => PAD + index * stepX;
  const y = (value: number) => height - PAD - ((value - min) / span) * (height - PAD * 2);

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(points[points.length - 1]);

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={`${path} L${lastX},${height} L${x(0)},${height} Z`} fill={color} opacity={0.12} />
      <path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {showEnd ? <circle cx={lastX} cy={lastY} r={2.5} fill={color} /> : null}
    </svg>
  );
}
