export type IconName =
  | "up" | "down" | "check" | "warn" | "info" | "clock" | "leak" | "star"
  | "left" | "right" | "sun" | "moon" | "trash" | "plus" | "table" | "chart"
  | "pencil" | "close" | "menu" | "external" | "layers" | "trend"
  | "calendar" | "wallet" | "target" | "coins" | "quote";

const PATHS: Record<IconName, string> = {
  up: "M8 12.5V3.5M8 3.5 4.5 7M8 3.5 11.5 7",
  down: "M8 3.5v9M8 12.5 4.5 9M8 12.5 11.5 9",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  warn: "M8 3v6M8 12.2v.3",
  info: "M8 7.2v5.3M8 3.6v.3",
  clock: "M8 4.2v4l2.6 1.6",
  leak: "M8 3.2s3.6 4 3.6 6.2A3.6 3.6 0 0 1 8 13a3.6 3.6 0 0 1-3.6-3.6C4.4 7.2 8 3.2 8 3.2Z",
  star: "M8 2.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z",
  left: "M10 3.5 5.5 8l4.5 4.5",
  right: "M6 3.5 10.5 8 6 12.5",
  sun: "M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M8 1.6v1.3M8 13.1v1.3M14.4 8h-1.3M2.9 8H1.6M12.5 3.5l-.9.9M4.4 11.6l-.9.9M12.5 12.5l-.9-.9M4.4 4.4l-.9-.9",
  moon: "M13 9.6A5.4 5.4 0 0 1 6.4 3 5.6 5.6 0 1 0 13 9.6Z",
  trash: "M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8",
  plus: "M8 3.5v9M3.5 8h9",
  table: "M2.5 3.5h11v9h-11zM2.5 6.7h11M6.4 6.7v5.8",
  pencil: "M11.3 2.6l2.1 2.1-7.7 7.7-2.8.7.7-2.8zM9.8 4.1l2.1 2.1",
  close: "M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6",
  menu: "M2.6 4.5h10.8M2.6 8h10.8M2.6 11.5h10.8",
  layers: "M8 2.4l5.6 2.9L8 8.2 2.4 5.3zM2.4 8.4L8 11.3l5.6-2.9M2.4 11.2L8 14.1l5.6-2.9",
  trend: "M2.5 12l3.6-3.9 2.4 2.2 4.6-5.1M9.6 5.2h3.9v3.9",
  calendar: "M2.6 4.4h10.8v9H2.6zM2.6 7.1h10.8M5.6 2.6v2.2M10.4 2.6v2.2",
  wallet: "M2.6 5.2h10.8v8H2.6zM2.6 5.2 10.2 2.6l.9 2.6M10.6 9.2h2.8",
  target: "M8 2.8v2.4M8 10.8v2.4M13.2 8h-2.4M5.2 8H2.8",
  coins: "M2.8 4.6c0-1 1.9-1.8 4.2-1.8s4.2.8 4.2 1.8-1.9 1.8-4.2 1.8-4.2-.8-4.2-1.8M2.8 4.6v3.2c0 1 1.9 1.8 4.2 1.8M11.2 4.6v2.2M5 11.4c0-1 1.9-1.8 4.2-1.8s4.2.8 4.2 1.8-1.9 1.8-4.2 1.8-4.2-.8-4.2-1.8M5 11.4v1.4c0 1 1.9 1.8 4.2 1.8s4.2-.8 4.2-1.8v-1.4",
  quote: "M5.6 11.6c-1.6 0-2.6-1.2-2.6-2.8 0-2.4 1.7-4.4 4-5.4l.6 1.2c-1.4.7-2.3 1.7-2.5 2.7 1.4 0 2.4 1 2.4 2.3s-.9 2-1.9 2M12 11.6c-1.6 0-2.6-1.2-2.6-2.8 0-2.4 1.7-4.4 4-5.4l.6 1.2c-1.4.7-2.3 1.7-2.5 2.7 1.4 0 2.4 1 2.4 2.3s-.9 2-1.9 2",
  external: "M9.6 3.4h3v3M12.6 3.4L7.9 8.1M11.4 9.4v3.2H3.4V4.6h3.2",
  chart: "M2.5 13h11M4.5 13V8M8 13V4.5M11.5 13V9.5",
};

const CIRCLES: Partial<Record<IconName, [number, number, number]>> = {
  warn: [8, 8, 5.6],
  info: [8, 8, 5.6],
  clock: [8, 8, 5.2],
  target: [8, 8, 5.4],
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const circle = CIRCLES[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {circle ? <circle cx={circle[0]} cy={circle[1]} r={circle[2]} /> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
