import { Link } from "@remix-run/react";

import type { Formatters } from "~/lib/format";
import type { HistoryRow } from "~/lib/types";

/**
 * Twelve months of totals. One hue — this is magnitude over time, so the bars
 * carry length and the budget marker carries the verdict.
 */
export function HistoryStrip({
  history,
  activeMonth,
  hasPlanAnywhere,
  fmt,
}: {
  history: HistoryRow[];
  activeMonth: string;
  hasPlanAnywhere: boolean;
  fmt: Formatters;
}) {
  if (history.length < 2) return null;

  const scale = Math.max(...history.map((row) => Math.max(row.spent, row.available)), 1);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Recent months</h2>
        <span className="sub">Total spent each month</span>
        <span className="spacer" />
        {hasPlanAnywhere ? (
          <div className="legend">
            <span className="item">
              <i className="key" style={{ background: "var(--series-1)" }} />
              spent
            </span>
            <span className="item">
              <i
                className="key"
                style={{ background: "var(--text-primary)", width: 12, height: 2, opacity: 0.55 }}
              />
              spending money
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        {history.map((row) => {
          const isActive = row.month === activeMonth;
          return (
            <Link
              key={row.month}
              to={`/?month=${row.month}`}
              style={{
                flex: 1,
                minWidth: 0,
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                gap: 6,
              }}
              title={`${row.label}: ${fmt.money(row.spent)} spent${
                row.available > 0 ? ` of ${fmt.money(row.available)}` : ""
              }`}
            >
              <span
                style={{
                  position: "relative",
                  display: "block",
                  height: 72,
                  background: "var(--surface-sunken)",
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${(row.spent / scale) * 100}%`,
                    background: "var(--series-1)",
                    borderRadius: "4px 4px 0 0",
                    opacity: isActive ? 1 : 0.62,
                  }}
                />
                {row.available > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: `${(row.available / scale) * 100}%`,
                      height: 2,
                      background: "var(--text-primary)",
                      opacity: 0.55,
                    }}
                  />
                ) : null}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  textAlign: "center",
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
