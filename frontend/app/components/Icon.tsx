export type IconName =
  | "up" | "down" | "check" | "warn" | "info" | "clock" | "leak" | "star"
  | "left" | "right" | "sun" | "moon" | "trash" | "plus" | "table" | "chart";

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
  chart: "M2.5 13h11M4.5 13V8M8 13V4.5M11.5 13V9.5",
};

const CIRCLES: Partial<Record<IconName, [number, number, number]>> = {
  warn: [8, 8, 5.6],
  info: [8, 8, 5.6],
  clock: [8, 8, 5.2],
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
