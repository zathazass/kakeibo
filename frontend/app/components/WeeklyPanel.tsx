import type { Formatters } from "~/lib/format";
import type { CategoryKey, WeekRow } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

interface Props {
  weekly: WeekRow[];
  labels: Record<CategoryKey, string>;
  hasPlan: boolean;
  fmt: Formatters;
}

/**
 * Part-to-whole per week: stacked horizontal bars with a 2px surface gap doing
 * the separating, the week total direct-labelled at the tip, and the full
 * numeric table underneath (which is also the relief for the two light-mode
 * hues that sit under 3:1 on the surface).
 */
export function WeeklyPanel({ weekly, labels, hasPlan, fmt }: Props) {
  const scale = Math.max(
    ...weekly.map((w) => w.total),
    ...(hasPlan ? weekly.map((w) => w.allowance) : [0]),
    1,
  );
  const monthTotal = weekly.reduce((sum, w) => sum + w.total, 0);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Week by week</h2>
        <span className="sub">Calendar weeks, Monday start, clipped to the month</span>
        <span className="spacer" />
        <div className="legend">
          {CATEGORY_ORDER.map((key) => (
            <span className="item" key={key}>
              <i className="key" style={{ background: CATEGORY_COLOR[key] }} />
              {labels[key]}
            </span>
          ))}
          {hasPlan ? (
            <span className="item">
              <i
                className="key"
                style={{ background: "var(--text-primary)", width: 2, height: 12, opacity: 0.55 }}
              />
              week&rsquo;s share of budget
            </span>
          ) : null}
        </div>
      </div>

      <div>
        {weekly.map((w) => {
          const barWidth = (w.total / scale) * 100;
          return (
            <div className={`weekrow${w.is_future ? " is-future" : ""}`} key={w.index}>
              <div className="wk-name">
                <b>{w.label}</b>
                <span>
                  {w.range_label}
                  {w.is_partial ? ` · ${w.days}d` : ""}
                </span>
              </div>

              <div className="wk-track">
                <div className="wk-bar" style={{ width: `${Math.max(barWidth, 0)}%` }}>
                  {CATEGORY_ORDER.filter((key) => w[key] > 0).map((key) => (
                    <div
                      key={key}
                      className="seg"
                      style={{ background: CATEGORY_COLOR[key], flexGrow: w[key], flexBasis: 0 }}
                      title={`${labels[key]}: ${fmt.money(w[key])}`}
                    />
                  ))}
                </div>
                {hasPlan && !w.is_future ? (
                  <div
                    className="allowmark"
                    style={{ left: `${Math.min((w.allowance / scale) * 100, 100)}%` }}
                    title={`Budget share for this week: ${fmt.money(w.allowance)}`}
                  />
                ) : null}
              </div>

              <div className="wk-total">
                {w.is_future ? <span className="muted">—</span> : fmt.money(w.total)}
              </div>
            </div>
          );
        })}
      </div>

      <hr className="hr" />

      <div className="tablewrap">
        <table className="data">
          <caption className="sr-only">Weekly spending by category</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              {CATEGORY_ORDER.map((key) => (
                <th scope="col" key={key}>
                  <i className="th-key" style={{ background: CATEGORY_COLOR[key] }} />
                  {labels[key]}
                </th>
              ))}
              <th scope="col">Total</th>
              <th scope="col">Per day</th>
              {hasPlan ? (
                <>
                  <th scope="col">Budget share</th>
                  <th scope="col">Over / under</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => (
              <tr key={w.index} style={w.is_future ? { opacity: 0.5 } : undefined}>
                <th scope="row">
                  {w.label} <span className="muted">{w.range_label}</span>
                </th>
                {CATEGORY_ORDER.map((key) => (
                  <td key={key}>{w[key] > 0 ? fmt.money(w[key]) : "—"}</td>
                ))}
                <td>{fmt.money(w.total)}</td>
                <td>{w.elapsed_days ? fmt.money(w.avg_per_day) : "—"}</td>
                {hasPlan ? (
                  <>
                    <td>{fmt.money(w.allowance)}</td>
                    <td>
                      {w.is_future ? (
                        "—"
                      ) : (
                        <span className={`delta ${w.delta_vs_allowance > 0 ? "up" : "down"}`}>
                          {w.delta_vs_allowance > 0 ? "+" : "−"}
                          {fmt.money(Math.abs(w.delta_vs_allowance))}
                        </span>
                      )}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Month</td>
              {CATEGORY_ORDER.map((key) => (
                <td key={key}>{fmt.money(weekly.reduce((sum, w) => sum + w[key], 0))}</td>
              ))}
              <td>{fmt.money(monthTotal)}</td>
              <td />
              {hasPlan ? <td colSpan={2} /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
