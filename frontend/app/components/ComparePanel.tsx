import { useEffect, useState } from "react";

import { api } from "~/lib/api";
import type { Formatters } from "~/lib/format";
import { makeFormatters } from "~/lib/format";
import type { CategoryKey, Comparison } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

export function ComparePanel({
  currency,
  locale,
  labels,
}: {
  currency: string;
  locale: string;
  labels: Record<CategoryKey, string>;
}) {
  const [grain, setGrain] = useState("month");
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fmt: Formatters = makeFormatters(currency, locale);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .compare(grain)
      .then((result) => alive && setData(result))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [grain]);

  const grains = data?.grains ?? [
    { key: "month", label: "Month" },
    { key: "quarter", label: "Quarter" },
    { key: "half", label: "Half" },
    { key: "year", label: "Year" },
  ];

  const picker = (
    <div className="segmented" role="group" aria-label="Compare by">
      {grains.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setGrain(option.key)}
          aria-pressed={grain === option.key}
          className={grain === option.key ? "is-on" : ""}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="calendar" size={15} /></span>
          <h2>Compare periods</h2>
        </div>
        <div className="emptynote">Could not load the comparison: {error}</div>
      </div>
    );
  }

  const periods = data?.periods ?? [];
  const shown = [...periods].reverse(); // newest first reads better in a list
  const scale = Math.max(...periods.map((p) => p.spent), 1);
  const summary = data?.summary;

  return (
    <div data-pending={loading}>
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="calendar" size={15} /></span>
          <h2>Compare periods</h2>
          <span className="sub">
            {summary
              ? `${summary.periods} ${summary.periods === 1 ? "period" : "periods"} · ${summary.months} months of entries`
              : "loading"}
          </span>
          <span className="spacer" />
          {picker}
        </div>

        {summary && summary.total_spent > 0 ? (
          <div className="tilerow" style={{ marginBottom: 18 }}>
            <div className="tile">
              <div className="label"><span className="tic"><Icon name="coins" size={13} /></span>Total spent</div>
              <div className="value">{fmt.money(summary.total_spent)}</div>
              <div className="foot">{summary.entries} entries all told</div>
            </div>
            <div className="tile">
              <div className="label"><span className="tic"><Icon name="target" size={13} /></span>Total saved</div>
              <div className="value">{fmt.money(summary.total_saved)}</div>
              <div className="foot">{fmt.percent(summary.savings_rate)} of income kept</div>
            </div>
            <div className="tile">
              <div className="label"><span className="tic"><Icon name="calendar" size={13} /></span>Typical {data?.grain}</div>
              <div className="value">{fmt.money(summary.avg_per_period)}</div>
              <div className="foot">averaged over periods with entries</div>
            </div>
            {summary.highest ? (
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="up" size={13} /></span>Heaviest</div>
                <div className="value">{fmt.money(summary.highest.spent)}</div>
                <div className="foot">{summary.highest.label}</div>
              </div>
            ) : null}
            {summary.lowest ? (
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="down" size={13} /></span>Leanest</div>
                <div className="value">{fmt.money(summary.lowest.spent)}</div>
                <div className="foot">{summary.lowest.label}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {periods.length === 0 ? (
          <div className="emptynote">
            {loading ? "Loading…" : "Nothing to compare yet — log a few entries first."}
          </div>
        ) : (
          <>
            <div className="legend" style={{ marginBottom: 10 }}>
              {CATEGORY_ORDER.map((key) => (
                <span className="item" key={key}>
                  <i className="key" style={{ background: CATEGORY_COLOR[key] }} />
                  {labels[key]}
                </span>
              ))}
            </div>

            <div>
              {shown.map((period) => (
                <div className="weekrow" key={period.key}>
                  <div className="wk-name">
                    <b>{period.label}</b>
                    <span>{period.span || `${period.entries} entries`}</span>
                  </div>
                  <div className="wk-track">
                    <div className="wk-bar" style={{ width: `${(period.spent / scale) * 100}%` }}>
                      {period.categories
                        .filter((c) => c.amount > 0)
                        .map((c) => (
                          <div
                            key={c.key}
                            className="seg"
                            style={{ background: CATEGORY_COLOR[c.key], flexGrow: c.amount, flexBasis: 0 }}
                            title={`${c.label}: ${fmt.money(c.amount)}`}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="wk-total">
                    {fmt.money(period.spent)}
                    {period.delta !== 0 ? (
                      <span className={`delta ${period.direction === "up" ? "up" : "down"}`} style={{ display: "block", fontSize: 11 }}>
                        {period.direction === "up" ? "+" : "−"}
                        {fmt.money(Math.abs(period.delta))}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <hr className="hr" />

            <div className="tablewrap">
              <table className="data">
                <caption className="sr-only">Spending and saving by period</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    {CATEGORY_ORDER.map((key) => (
                      <th scope="col" key={key}>
                        <i className="th-key" style={{ background: CATEGORY_COLOR[key] }} />
                        {labels[key]}
                      </th>
                    ))}
                    <th scope="col">Spent</th>
                    <th scope="col">vs before</th>
                    <th scope="col">Income</th>
                    <th scope="col">Saved</th>
                    <th scope="col">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((period) => (
                    <tr key={period.key}>
                      <th scope="row">
                        {period.label} <span className="muted">{period.span}</span>
                      </th>
                      {CATEGORY_ORDER.map((key) => {
                        const cat = period.categories.find((c) => c.key === key);
                        return <td key={key}>{cat && cat.amount > 0 ? fmt.money(cat.amount) : "—"}</td>;
                      })}
                      <td>{fmt.money(period.spent)}</td>
                      <td>
                        {period.delta === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className={`delta ${period.direction === "up" ? "up" : "down"}`}>
                            {period.direction === "up" ? "+" : "−"}
                            {fmt.money(Math.abs(period.delta))}
                            {period.delta_pct !== null ? ` (${Math.abs(period.delta_pct).toFixed(0)}%)` : ""}
                          </span>
                        )}
                      </td>
                      <td>{period.income > 0 ? fmt.money(period.income) : "—"}</td>
                      <td>{period.income > 0 ? fmt.money(period.saved) : "—"}</td>
                      <td>{period.income > 0 ? fmt.percent(period.savings_rate) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head">
            <span className="cardic"><Icon name="layers" size={15} /></span>
            <h2>Where the money actually goes</h2>
            <span className="sub">your own labels, across every period</span>
          </div>

          {!data || data.tags.length === 0 ? (
            <div className="emptynote">
              No labels yet. Add one to an entry on the Ledger tab — type anything you like, such as
              &ldquo;Food&rdquo;, &ldquo;Snacks&rdquo; or &ldquo;Gadgets&rdquo; — and the breakdown builds
              itself from there.
            </div>
          ) : (
            <>
              <div className="tagrows">
                {data.tags.map((tag) => (
                  <div className="tagrow" key={`${tag.tag}-${tag.category}`}>
                    <span className="tg-name" style={{ color: CATEGORY_COLOR[tag.category] }}>
                      <CategoryIcon category={tag.category} size={13} />
                      <span style={{ color: "var(--text-primary)" }}>{tag.tag}</span>
                    </span>
                    <span className="tg-track">
                      <span
                        className="tg-fill"
                        style={{
                          width: `${(tag.total / Math.max(data.tags[0].total, 1)) * 100}%`,
                          background: CATEGORY_COLOR[tag.category],
                        }}
                      />
                    </span>
                    <span className="tg-nums">
                      <b className="tnum">{fmt.money(tag.total)}</b>
                      <span className="muted tnum">
                        {fmt.percent(tag.share)} · {tag.entries}×
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="emptynote">
                {fmt.percent(data.tagged_share)} of your spending carries a label. Anything without
                one is grouped as Untagged.
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="cardic"><Icon name="up" size={15} /></span>
            <h2>Biggest single spends</h2>
            <span className="sub">all time</span>
          </div>
          {!data || data.top_expenses.length === 0 ? (
            <div className="emptynote">Nothing logged yet.</div>
          ) : (
            data.top_expenses.map((entry) => (
              <div className="entry" key={entry.id} style={{ padding: "8px 0" }}>
                <span className="cicon" style={{ color: CATEGORY_COLOR[entry.category] }}>
                  <CategoryIcon category={entry.category} size={15} />
                </span>
                <span className="note">
                  {entry.note || <span className="muted">no note</span>}
                  <span className="cat">
                    {entry.tag ? `${entry.tag} · ` : ""}
                    {entry.spent_on}
                  </span>
                </span>
                <span className="amt">{fmt.money(entry.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
