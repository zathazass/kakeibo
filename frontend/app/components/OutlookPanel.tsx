import type { Formatters } from "~/lib/format";
import { clamp01 } from "~/lib/format";
import type { Outlook, SpreadView } from "~/lib/types";
import { CATEGORY_COLOR } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon, type IconName } from "./Icon";

export function OutlookPanel({
  outlook,
  spread,
  monthLabel,
  daysLeft,
  isCurrentMonth,
  fmt,
}: {
  outlook: Outlook;
  spread: SpreadView;
  monthLabel: string;
  daysLeft: number;
  isCurrentMonth: boolean;
  fmt: Formatters;
}) {
  const { lifetime, limits, projection, suggestions } = outlook;

  return (
    <>
      {/* ------------------------------------------------ spending limits */}
      <div className="card">
        <div className="card-head">
          <span className="cardic">
            <Icon name="target" size={15} />
          </span>
          <h2>What you can still spend</h2>
          <span className="sub">
            {isCurrentMonth
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in ${monthLabel}`
              : `${monthLabel} is finished — limits apply to a month in progress`}
          </span>
        </div>

        {limits.length === 0 ? (
          <div className="emptynote">
            Limits appear once you are inside a month with a plan set. Set income and fixed costs
            on the Ledger tab.
          </div>
        ) : (
          <div className="limits">
            {limits.map((limit) => (
              <div className={`limit tone-${limit.tone}${limit.blown ? " is-blown" : ""}`} key={limit.key}>
                <div className="lim-head">
                  <span className="lim-label">{limit.label}</span>
                  <span className="lim-budget">of {fmt.money(limit.budget)}</span>
                </div>

                {limit.blown ? (
                  <div className="lim-value is-blown">
                    <Icon name="warn" size={15} /> Already past by {fmt.money(Math.abs(limit.left))}
                  </div>
                ) : (
                  <div className="lim-value">
                    {fmt.money(limit.per_day)} <span className="per">a day</span>
                  </div>
                )}

                <div className="meter" aria-hidden="true">
                  <div
                    className={`fill${limit.blown ? " critical" : ""}`}
                    style={{ width: `${clamp01(limit.used_pct / 100) * 100}%` }}
                  />
                </div>

                <div className="lim-foot">
                  {limit.blown ? (
                    <span>{fmt.percent(limit.used_pct)} of that budget used</span>
                  ) : (
                    <span>
                      {fmt.money(limit.left)} left · about {fmt.money(limit.per_week)} a week
                    </span>
                  )}
                </div>
                <p className="lim-detail">{limit.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid cols-2">
        {/* ------------------------------------------------- where it lands */}
        <div className="card">
          <div className="card-head">
            <span className="cardic">
              <Icon name="trend" size={15} />
            </span>
            <h2>Where this month lands</h2>
          </div>

          <div className="hero" style={{ marginBottom: 4 }}>
            <div className="figure">
              <div className="label">Projected total</div>
              <div className={`value${projection.over > 0 ? " over" : ""}`}>
                {fmt.money(projection.spend)}
              </div>
              <div className="caption">
                {projection.over > 0
                  ? `${fmt.money(projection.over)} over the budget`
                  : `${fmt.money(Math.abs(projection.over))} under the budget`}
                {" · "}
                {projection.reliable
                  ? `from ${projection.basis_days} days of entries`
                  : `only ${projection.basis_days} days in — treat this loosely`}
              </div>
            </div>
          </div>

          <hr className="hr" />

          <div className="nextmonth">
            <div className="nm-head">
              <Icon name="calendar" size={14} />
              <span>Setting up {projection.next_month_label}</span>
            </div>
            <div className="tilerow">
              <div className="tile">
                <div className="label">
                  <span className="tic">
                    <Icon name="coins" size={13} />
                  </span>
                  Expect to spend
                </div>
                <div className="value">{fmt.money(projection.expected_spend)}</div>
                <div className="foot">
                  {projection.suggested_from
                    ? `averaged over your ${projection.suggested_from}`
                    : "not enough history yet"}
                </div>
              </div>
              <div className="tile">
                <div className="label">
                  <span className="tic">
                    <Icon name="target" size={13} />
                  </span>
                  Suggested savings goal
                </div>
                <div className="value">{fmt.money(projection.suggested_goal)}</div>
                <div className="foot">what is left over without changing anything</div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- suggestions */}
        <div className="card">
          <div className="card-head">
            <span className="cardic">
              <Icon name="star" size={15} />
            </span>
            <h2>What to change</h2>
            {suggestions.length ? <span className="sub">{suggestions.length}</span> : null}
          </div>

          {suggestions.length === 0 ? (
            <div className="emptynote">
              Nothing to suggest yet — a couple of months of entries and this fills in.
            </div>
          ) : (
            suggestions.map((item, index) => (
              <div className="insight" data-tone={item.tone} key={`${item.title}-${index}`}>
                <span className="ic">
                  <Icon name={item.icon as IconName} size={14} />
                </span>
                <div>
                  <div className="title">{item.title}</div>
                  <div className="detail">{item.detail}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {spread.commitments.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <span className="cardic"><Icon name="calendar" size={15} /></span>
            <h2>Already paid for</h2>
            <span className="sub">
              recharges and subscriptions still running — {fmt.money(spread.committed_monthly)} a
              month of your spending is already committed
            </span>
          </div>

          <div className="tablewrap">
            <table className="data">
              <caption className="sr-only">Prepaid commitments still running</caption>
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Covers</th>
                  <th scope="col">A month</th>
                  <th scope="col">Months left</th>
                  <th scope="col">Runs out</th>
                  <th scope="col">Not used yet</th>
                </tr>
              </thead>
              <tbody>
                {spread.commitments.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      {c.note || <span className="muted">no note</span>}{" "}
                      <span className="muted">{c.tag || c.label}</span>
                    </th>
                    <td>{fmt.money(c.amount)}</td>
                    <td>{c.months} mo</td>
                    <td>{fmt.money(c.monthly)}</td>
                    <td>
                      {c.expiring_soon ? (
                        <span className="delta up">{c.months_left} — renew soon</span>
                      ) : (
                        c.months_left
                      )}
                    </td>
                    <td>{c.covers_until_label}</td>
                    <td>{fmt.money(c.unused_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="secondary" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
            {fmt.money(spread.unused_value)} of what you have already paid covers months still to
            come. That money is spent as far as your bank is concerned, but not yet used — which is
            why moving it aside when you pay, as you already do, is the right instinct.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------ collective view */}
      <div className="card">
        <div className="card-head">
          <span className="cardic">
            <Icon name="layers" size={15} />
          </span>
          <h2>Everything so far</h2>
          <span className="sub">
            {lifetime.months} {lifetime.months === 1 ? "month" : "months"} tracked
            {lifetime.first_day ? ` since ${lifetime.first_day}` : ""}
          </span>
        </div>

        <div className="tilerow">
          <Stat icon="coins" label="Total spent" value={fmt.money(lifetime.spent)}
                foot={`${lifetime.entries} entries over ${lifetime.active_days} spending days`} />
          <Stat icon="calendar" label="Usual month" value={fmt.money(lifetime.avg_monthly_spend)}
                foot={`recently ${fmt.money(lifetime.recent_avg_spend)} a month`} />
          <Stat icon="clock" label="Usual day" value={fmt.money(lifetime.avg_daily_spend)}
                foot="averaged over days you actually spent" />
          <Stat icon="target" label="Total saved" value={fmt.money(lifetime.total_saved)}
                foot={`about ${fmt.money(lifetime.avg_monthly_saved)} a month`} />
        </div>

        {lifetime.best_month || lifetime.worst_month ? (
          <>
            <hr className="hr" />
            <div className="row" style={{ gap: 22 }}>
              {lifetime.best_month ? (
                <span className="secondary" style={{ fontSize: 12.5 }}>
                  <strong className="tnum">{fmt.money(lifetime.best_month.spent)}</strong> was your
                  leanest month — {lifetime.best_month.label}
                </span>
              ) : null}
              {lifetime.worst_month ? (
                <span className="secondary" style={{ fontSize: 12.5 }}>
                  <strong className="tnum">{fmt.money(lifetime.worst_month.spent)}</strong> was your
                  heaviest — {lifetime.worst_month.label}
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        <hr className="hr" />

        <p className="secondary" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 12 }}>
          What a normal month looks like per bucket, and where this one sits against it.
        </p>

        <div className="avgrows">
          {lifetime.categories.map((cat) => {
            const scale = Math.max(
              ...lifetime.categories.map((c) => Math.max(c.avg_per_month, c.this_month)),
              1,
            );
            const over = cat.this_month > cat.avg_per_month && cat.avg_per_month > 0;
            return (
              <div
                className="avgrow"
                key={cat.key}
                style={{ "--cat": CATEGORY_COLOR[cat.key] } as React.CSSProperties}
              >
                <span className="ar-name">
                  <CategoryIcon category={cat.key} size={14} />
                  {cat.label}
                </span>
                <span className="ar-track">
                  <span className="ar-avg" style={{ width: `${(cat.avg_per_month / scale) * 100}%` }} />
                  <span
                    className={`ar-now${over ? " is-over" : ""}`}
                    style={{ width: `${(cat.this_month / scale) * 100}%` }}
                  />
                </span>
                <span className="ar-nums">
                  <b className="tnum">{fmt.money(cat.this_month)}</b>
                  <span className="muted tnum">usually {fmt.money(cat.avg_per_month)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          <span className="item">
            <i className="key" style={{ background: "var(--text-muted)", opacity: 0.35 }} />
            a usual month
          </span>
          <span className="item">
            <i className="key" style={{ background: "var(--series-1)" }} />
            this month
          </span>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  foot,
}: {
  icon: IconName;
  label: string;
  value: string;
  foot: string;
}) {
  return (
    <div className="tile">
      <div className="label">
        <span className="tic">
          <Icon name={icon} size={13} />
        </span>
        {label}
      </div>
      <div className="value">{value}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}
