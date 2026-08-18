import type { Formatters } from "~/lib/format";
import { clamp01 } from "~/lib/format";
import type { CategoryRow, Comparison } from "~/lib/types";
import { CATEGORY_COLOR } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

/**
 * The four kakeibo buckets. Colour follows the bucket, never its rank, so a
 * category keeps its hue whatever the month looks like.
 */
export function CategoryPanel({
  categories,
  spent,
  comparison,
  fmt,
}: {
  categories: CategoryRow[];
  spent: number;
  comparison: Comparison;
  fmt: Formatters;
}) {
  const peak = Math.max(...categories.map((c) => c.amount), 1);

  return (
    <div className="card">
      <div className="card-head">
        <span className="cardic"><Icon name="layers" size={15} /></span>
        <h2>Where the money went</h2>
        <span className="sub">
          Split by intent, not by shop — the same coffee is a Need or a Want depending on why
        </span>
      </div>

      {spent > 0 ? (
        <>
          <div className="mixbar" role="img" aria-label="Share of spending by category">
            {categories
              .filter((c) => c.amount > 0)
              .map((c) => (
                <div
                  key={c.key}
                  className="seg"
                  style={{
                    background: CATEGORY_COLOR[c.key],
                    flexGrow: c.amount,
                    flexBasis: 0,
                  }}
                  title={`${c.label}: ${fmt.money(c.amount)} (${fmt.percent(c.share)})`}
                />
              ))}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            {categories
              .filter((c) => c.amount > 0)
              .map((c) => (
                <span className="item" key={c.key}>
                  <i className="key" style={{ background: CATEGORY_COLOR[c.key] }} />
                  {c.label}
                  <strong className="tnum" style={{ color: "var(--text-primary)" }}>
                    {fmt.money(c.amount)}
                  </strong>
                  <span className="muted">{fmt.percent(c.share)}</span>
                </span>
              ))}
          </div>
          <hr className="hr" />
        </>
      ) : null}

      <div className="grid cols-4">
        {categories.map((c) => (
          <div
            className="catcard"
            key={c.key}
            style={{ "--cat": CATEGORY_COLOR[c.key] } as React.CSSProperties}
          >
            <div className="top">
              <span className="badge">
                <CategoryIcon category={c.key} size={18} />
              </span>
              <span className="names">
                <span className="name">{c.label}</span>
                <span className="jp">{c.jp}</span>
              </span>
            </div>
            <div className="amount tnum">{fmt.money(c.amount)}</div>
            <div className="bar">
              <span
                style={{
                  width: `${clamp01(c.amount / peak) * 100}%`,
                  background: CATEGORY_COLOR[c.key],
                }}
              />
            </div>
            <div className="row" style={{ gap: 8, fontSize: 12 }}>
              <span className="muted">
                {fmt.percent(c.share)} · {c.entries} {c.entries === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div style={{ fontSize: 12 }}>
              {c.prev_amount > 0 || c.amount > 0 ? (
                <span
                  className={`delta ${
                    c.key === "culture" ? "flat" : c.delta > 0 ? "up" : c.delta < 0 ? "down" : "flat"
                  }`}
                >
                  {c.delta !== 0 ? (
                    <Icon name={c.delta > 0 ? "up" : "down"} size={12} />
                  ) : null}
                  {c.delta === 0
                    ? "level with"
                    : `${fmt.money(Math.abs(c.delta))}${
                        c.delta_pct !== null ? ` (${Math.abs(c.delta_pct).toFixed(0)}%)` : ""
                      } ${c.delta > 0 ? "more than" : "less than"}`}{" "}
                  <span className="muted">{comparison.prev_month_short}</span>
                </span>
              ) : (
                <span className="muted">nothing here yet</span>
              )}
            </div>
            <div className="hint">{c.hint}</div>
          </div>
        ))}
      </div>

      {comparison.like_for_like && comparison.cutoff_day ? (
        <div className="emptynote">
          Comparisons use the same first {comparison.cutoff_day} days of{" "}
          {comparison.prev_month_label}, so a month in progress is never measured against a
          finished one.
        </div>
      ) : null}
    </div>
  );
}
