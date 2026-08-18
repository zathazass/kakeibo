import { useState } from "react";

import type { Formatters } from "~/lib/format";
import { niceMax, ticks } from "~/lib/format";
import { useElementWidth } from "~/lib/useElementWidth";
import type { CategoryKey, DailyRow } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

const H = 280;
const PAD = { top: 22, right: 16, bottom: 34, left: 60 };
const PLOT_H = H - PAD.top - PAD.bottom;

/** Column with a 4px rounded cap and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

interface Props {
  daily: DailyRow[];
  allowance: number;
  labels: Record<CategoryKey, string>;
  fmt: Formatters;
}

export function DailyChart({ daily, allowance, labels, fmt }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, W] = useElementWidth<HTMLDivElement>(960);

  const PLOT_W = Math.max(120, W - PAD.left - PAD.right);
  const peak = Math.max(...daily.map((d) => d.total), allowance, 0);
  const max = niceMax(peak || 1);
  const band = PLOT_W / daily.length;
  const barW = Math.max(3, Math.min(20, band - 8));
  // With room to spare, label every day instead of every fifth.
  const labelEvery = band >= 30 ? 1 : band >= 18 ? 2 : 5;

  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;
  const x = (index: number) => PAD.left + index * band;

  const biggest = daily.reduce(
    (best, row, index) => (row.total > (daily[best]?.total ?? 0) ? index : best),
    0,
  );
  const peakRow = daily[biggest];
  const showPeakLabel = Boolean(peakRow && peakRow.total > 0);
  const row = active === null ? null : daily[active];

  return (
    <div className="chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spending for each day of the month">
        {/* recessive grid: solid hairlines, one step off the surface */}
        {ticks(max).map((value) => (
          <g key={value}>
            <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="ticktext" x={PAD.left - 10} y={y(value) + 4} textAnchor="end">
              {fmt.compact(value)}
            </text>
          </g>
        ))}

        {daily.map((d, index) =>
          d.is_today ? (
            <rect
              key="today"
              className="todayband"
              x={x(index)}
              y={PAD.top}
              width={band}
              height={PLOT_H}
            />
          ) : null,
        )}

        {/* the even-pace threshold — dashed precisely because it IS a threshold */}
        {allowance > 0 && allowance <= max ? (
          <g>
            <line
              className="threshold"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(allowance)}
              y2={y(allowance)}
            />
            <text className="marklabel" x={W - PAD.right} y={y(allowance) - 7} textAnchor="end">
              {fmt.money(allowance)} a day keeps you on budget
            </text>
          </g>
        ) : null}

        <line
          className="axisline"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
        />

        {daily.map((d, index) => {
          if (d.total <= 0) return null;
          const height = Math.max(2, PLOT_H - (y(d.total) - PAD.top));
          return (
            <path
              key={d.date}
              d={columnPath(x(index) + (band - barW) / 2, y(d.total), barW, height)}
              fill="var(--series-1)"
              opacity={active === null || active === index ? 1 : 0.45}
            />
          );
        })}

        {/* one direct label, on the extreme — never a number on every column */}
        {showPeakLabel && peakRow ? (
          <text
            className="marklabel"
            x={x(biggest) + band / 2}
            y={y(peakRow.total) - 8}
            textAnchor="middle"
          >
            {fmt.money(peakRow.total)}
          </text>
        ) : null}

        {daily.map((d, index) =>
          d.day === 1 || d.day % labelEvery === 0 ? (
            <text
              key={`t-${d.date}`}
              className="ticktext"
              x={x(index) + band / 2}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
            >
              {d.day}
            </text>
          ) : null,
        )}

        {/* hit targets span the full plot height and the whole band (~27px) */}
        {daily.map((d, index) => (
          <rect
            key={`hit-${d.date}`}
            className="hit"
            x={x(index)}
            y={PAD.top}
            width={band}
            height={PLOT_H}
            tabIndex={0}
            role="button"
            aria-label={`${d.label}: ${fmt.money(d.total)}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
          />
        ))}
      </svg>

      {row ? (
        <div
          className="tooltip"
          style={{
            left: `${((x(active!) + band / 2) / W) * 100}%`,
            top: `${(y(Math.max(row.total, 0)) / H) * 100}%`,
          }}
        >
          <div className="t-head">
            <span>
              {row.label} · {row.weekday_short}
            </span>
            <span className="tnum">{fmt.money(row.total)}</span>
          </div>
          {CATEGORY_ORDER.filter((key) => row[key] > 0).map((key) => (
            <div className="t-row" key={key}>
              <i className="key" style={{ background: CATEGORY_COLOR[key] }} />
              {labels[key]}
              <span className="val">{fmt.money(row[key])}</span>
            </div>
          ))}
          <div className="t-note">
            {row.total === 0
              ? row.is_future
                ? "Still to come"
                : "No spending — a quiet day"
              : `${row.entries} ${row.entries === 1 ? "entry" : "entries"} · running total ${fmt.money(row.cumulative)}`}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The table twin — every plotted value, WCAG-clean, no hover required. */
export function DailyTable({
  daily,
  labels,
  fmt,
}: {
  daily: DailyRow[];
  labels: Record<CategoryKey, string>;
  fmt: Formatters;
}) {
  const rows = daily.filter((d) => d.total > 0 || d.is_today);
  const totals = CATEGORY_ORDER.reduce(
    (acc, key) => ({ ...acc, [key]: daily.reduce((sum, d) => sum + d[key], 0) }),
    {} as Record<CategoryKey, number>,
  );
  const grand = daily.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="tablewrap">
      <table className="data">
        <caption className="sr-only">Spending for each day, by category</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {CATEGORY_ORDER.map((key) => (
              <th scope="col" key={key}>
                <i className="th-key" style={{ background: CATEGORY_COLOR[key] }} />
                {labels[key]}
              </th>
            ))}
            <th scope="col">Total</th>
            <th scope="col">Running</th>
            <th scope="col">On pace</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                Nothing logged this month yet.
              </td>
            </tr>
          ) : (
            rows.map((d) => (
              <tr key={d.date}>
                <th scope="row">
                  {d.label} <span className="muted">{d.weekday_short}</span>
                </th>
                {CATEGORY_ORDER.map((key) => (
                  <td key={key}>{d[key] > 0 ? fmt.money(d[key]) : "—"}</td>
                ))}
                <td>{fmt.money(d.total)}</td>
                <td>{fmt.money(d.cumulative)}</td>
                <td className={d.cumulative > d.pace ? "" : "muted"}>{fmt.money(d.pace)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Month</td>
            {CATEGORY_ORDER.map((key) => (
              <td key={key}>{fmt.money(totals[key])}</td>
            ))}
            <td>{fmt.money(grand)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
