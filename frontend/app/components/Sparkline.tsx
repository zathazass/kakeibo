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

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const y = (value: number) => height - 2 - ((value - min) / span) * (height - 4);

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  const lastX = (points.length - 1) * stepX;
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
      <path d={`${path} L${lastX},${height} L0,${height} Z`} fill={color} opacity={0.1} />
      <path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {showEnd ? <circle cx={lastX} cy={lastY} r={2.5} fill={color} /> : null}
    </svg>
  );
}
