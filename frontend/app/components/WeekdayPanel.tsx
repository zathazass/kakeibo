import type { Formatters } from "~/lib/format";
import type { WeekdayRow } from "~/lib/types";

/**
 * Magnitude across an ordered scale, so it is one hue — never a colour per day,
 * which would double-encode bar length as hue.
 */
import { Icon } from "./Icon";

export function WeekdayPanel({ profile, fmt }: { profile: WeekdayRow[]; fmt: Formatters }) {
  const peak = Math.max(...profile.map((row) => row.avg), 1);
  const live = profile.filter((row) => row.days > 0);
  const priciest = live.length
    ? live.reduce((best, row) => (row.avg > best.avg ? row : best), live[0])
    : null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="cardic"><Icon name="clock" size={15} /></span>
        <h2>Day of the week</h2>
        <span className="sub">Average spend per day, across this month</span>
      </div>

      {live.length === 0 ? (
        <div className="emptynote">No days logged yet this month.</div>
      ) : (
        <div>
          {profile.map((row) => (
            <div
              key={row.weekday}
              style={{
                display: "grid",
                gridTemplateColumns: "44px minmax(0, 1fr) 84px",
                alignItems: "center",
                gap: 12,
                padding: "5px 0",
                opacity: row.days ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: row.is_weekend ? 600 : 400 }}>
                {row.short}
                {row.is_weekend ? <span className="muted"> ·</span> : null}
              </span>
              <span
                style={{
                  height: 14,
                  background: "var(--surface-sunken)",
                  borderRadius: 999,
                  overflow: "hidden",
                  display: "block",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${(row.avg / peak) * 100}%`,
                    background: "var(--series-1)",
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </span>
              <span className="tnum" style={{ textAlign: "right", fontSize: 12.5 }}>
                {row.days ? fmt.money(row.avg) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {priciest && priciest.avg > 0 ? (
        <div className="emptynote">
          {priciest.label}s cost the most on average — {fmt.money(priciest.avg)} across{" "}
          {priciest.days} of them, {fmt.money(priciest.total)} in total.
        </div>
      ) : null}
    </div>
  );
}
