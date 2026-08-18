import type { Dashboard } from "./types";

/** Currency + number formatting, driven by the locale the API reports. */
export function makeFormatters(currency: string, locale: string) {
  const numberFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const preciseFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const compactFmt = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const money = (value: number) => `${currency}${numberFmt.format(Math.round(value || 0))}`;

  return {
    /** Whole units — the default across the dashboard. */
    money,
    /** Signed, for deltas. */
    signed: (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`,
    /** Paise-accurate, for the ledger. */
    exact: (value: number) => `${currency}${preciseFmt.format(value || 0)}`,
    /** Short axis ticks. */
    compact: (value: number) =>
      value === 0 ? "0" : `${currency}${compactFmt.format(value)}`,
    number: (value: number) => numberFmt.format(value || 0),
    percent: (value: number, digits = 0) => `${(value || 0).toFixed(digits)}%`,
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;

export function formattersFor(data: Dashboard): Formatters {
  return makeFormatters(data.currency, data.locale);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a YYYY-MM-DD as a local date — `new Date(iso)` would read it as UTC. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

export function weekdayLabel(iso: string): string {
  return DAY_NAMES[parseISODate(iso).getDay()];
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Clamp a fraction into 0..1 for meter widths. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Round an axis maximum up to a readable step (1 / 2 / 5 × 10ⁿ). */
export function niceMax(value: number): number {
  if (!value || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Evenly spaced axis ticks, inclusive of 0 and the max. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}
