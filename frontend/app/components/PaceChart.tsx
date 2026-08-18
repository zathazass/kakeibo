import { useState } from "react";

import type { Formatters } from "~/lib/format";
import { niceMax, ticks } from "~/lib/format";
import type { DailyRow } from "~/lib/types";
import { useElementWidth } from "~/lib/useElementWidth";

const H = 250;
const PAD = { top: 22, right: 16, bottom: 34, left: 60 };
const PLOT_H = H - PAD.top - PAD.bottom;

interface Props {
  daily: DailyRow[];
  available: number;
  fmt: Formatters;
}

/**
 * Cumulative spending against an even day-by-day pace. Emphasis form: the
 * actual line is the subject, the pace and the budget ceiling are context —
 * one y-axis, never two.
 */
export function PaceChart({ daily, available, fmt }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, W] = useElementWidth<HTMLDivElement>(960);

  const PLOT_W = Math.max(120, W - PAD.left - PAD.right);
  const labelEvery = PLOT_W / daily.length >= 30 ? 1 : PLOT_W / daily.length >= 18 ? 2 : 5;
  const elapsed = daily.filter((d) => !d.is_future);
  const spent = elapsed.length ? elapsed[elapsed.length - 1].cumulative : 0;
  const max = niceMax(Math.max(spent, daily[daily.length - 1]?.pace ?? 0, available, 1));

  const x = (index: number) => PAD.left + (index / Math.max(1, daily.length - 1)) * PLOT_W;
  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;

  const line = (rows: DailyRow[], pick: (row: DailyRow) => number) =>
    rows.map((row, i) => `${i === 0 ? "M" : "L"}${x(daily.indexOf(row))},${y(pick(row))}`).join(" ");

  const actualPath = elapsed.length ? line(elapsed, (d) => d.cumulative) : "";
  const areaPath = elapsed.length
    ? `${actualPath} L${x(elapsed.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
    : "";
  const pacePath = available > 0 ? line(daily, (d) => d.pace) : "";

  const last = elapsed[elapsed.length - 1];
  const row = active === null ? null : daily[active];
  const overPace = row ? row.cumulative - row.pace : 0;

  return (
    <div className="chart" ref={wrapRef}>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span className="item">
          <i className="key line" style={{ background: "var(--series-1)" }} />
          Spent so far
        </span>
        {available > 0 ? (
          <>
            <span className="item">
              <i className="key dashed" />
              Even pace
            </span>
            <span className="item">
              <i className="key line" style={{ background: "var(--axis)" }} />
              Spending money ({fmt.money(available)})
            </span>
          </>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Running total against an even spending pace">
        {ticks(max).map((value) => (
          <g key={value}>
            <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="ticktext" x={PAD.left - 10} y={y(value) + 4} textAnchor="end">
              {fmt.compact(value)}
            </text>
          </g>
        ))}

        {available > 0 && available <= max ? (
          <line
            className="axisline"
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(available)}
            y2={y(available)}
          />
        ) : null}

        {pacePath ? <path className="threshold" d={pacePath} fill="none" /> : null}

        {areaPath ? <path d={areaPath} fill="var(--series-1)" opacity={0.1} /> : null}
        {actualPath ? (
          <path
            d={actualPath}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {row && !row.is_future ? (
          <line className="crosshair" x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={y(0)} />
        ) : null}

        {/* end marker: >=8px across, with a 2px surface ring so it stays legible */}
        {last ? (
          <g>
            <circle
              className="ring"
              cx={x(daily.indexOf(last))}
              cy={y(last.cumulative)}
              r={5}
              fill="var(--series-1)"
            />
            <text
              className="marklabel"
              x={x(daily.indexOf(last)) - 10}
              y={y(last.cumulative) - 10}
              textAnchor="end"
            >
              {fmt.money(last.cumulative)}
            </text>
          </g>
        ) : null}

        <line className="axisline" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

        {daily.map((d, index) =>
          d.day === 1 || d.day % labelEvery === 0 ? (
            <text
              key={`t-${d.date}`}
              className="ticktext"
              x={x(index)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
            >
              {d.day}
            </text>
          ) : null,
        )}

        {daily.map((d, index) => (
          <rect
            key={`hit-${d.date}`}
            className="hit"
            x={x(index) - PLOT_W / daily.length / 2}
            y={PAD.top}
            width={PLOT_W / daily.length}
            height={PLOT_H}
            tabIndex={0}
            role="button"
            aria-label={`${d.label}: ${fmt.money(d.cumulative)} spent so far`}
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
          style={{ left: `${(x(active!) / W) * 100}%`, top: `${(y(row.cumulative) / H) * 100}%` }}
        >
          <div className="t-head">
            <span>{row.label}</span>
            <span className="tnum">{fmt.money(row.cumulative)}</span>
          </div>
          {available > 0 ? (
            <>
              <div className="t-row">
                <i className="key" style={{ background: "var(--text-muted)" }} />
                Even pace
                <span className="val">{fmt.money(row.pace)}</span>
              </div>
              <div className="t-note">
                {row.is_future
                  ? "Still to come"
                  : overPace > 0
                    ? `${fmt.money(overPace)} ahead of pace`
                    : `${fmt.money(Math.abs(overPace))} below pace`}
              </div>
            </>
          ) : (
            <div className="t-note">Set a plan to see the pace line</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
