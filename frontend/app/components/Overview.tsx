import type { ReactNode } from "react";

import type { Formatters } from "~/lib/format";
import { clamp01 } from "~/lib/format";
import type { Comparison, DailyRow, SpreadView, Totals } from "~/lib/types";

import { Icon, type IconName } from "./Icon";
import { Sparkline } from "./Sparkline";

interface Props {
  totals: Totals;
  comparison: Comparison;
  daily: DailyRow[];
  spread: SpreadView;
  daysLeft: number;
  daysElapsed: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  hasPlan: boolean;
  fmt: Formatters;
}

export function Overview({
  totals,
  comparison,
  daily,
  spread,
  daysLeft,
  daysElapsed,
  daysInMonth,
  isCurrentMonth,
  hasPlan,
  fmt,
}: Props) {
  const used = totals.available_to_spend > 0 ? totals.spent / totals.available_to_spend : 0;
  const elapsedShare = daysInMonth ? daysElapsed / daysInMonth : 0;
  const aheadOfPace = totals.budget_used_pct - totals.month_elapsed_pct;
  const fillTone =
    used > 1 ? "critical" : aheadOfPace > 5 ? "warning" : "";

  // Cumulative spend through today — shape only; the tile carries the number.
  const spentSoFar = daily.filter((d) => !d.is_future).map((d) => d.cumulative);

  const deltaClass =
    comparison.direction === "up" ? "up" : comparison.direction === "down" ? "down" : "flat";

  return (
    <div className="card">
      <div className="hero">
        <div className="figure">
          <div className="label">{totals.is_over_budget ? "Over budget by" : "Left to spend"}</div>
          <div className={`value${totals.is_over_budget ? " over" : ""}`}>
            {fmt.money(Math.abs(totals.remaining))}
          </div>
          <div className="caption">
            {hasPlan ? (
              isCurrentMonth ? (
                totals.is_over_budget ? (
                  <>
                    {daysLeft} {daysLeft === 1 ? "day" : "days"} still to go — further spending
                    comes out of savings.
                  </>
                ) : (
                  <>
                    {fmt.money(totals.safe_daily_left)} a day for the {daysLeft} remaining{" "}
                    {daysLeft === 1 ? "day" : "days"}
                  </>
                )
              ) : (
                <>of {fmt.money(totals.available_to_spend)} set aside for the month</>
              )
            ) : (
              <>Set income and fixed costs to unlock the budget</>
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <div className="meter-wrap">
            <div
              className="meter"
              role="meter"
              aria-valuenow={Math.round(totals.budget_used_pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of this month's spending money used"
            >
              <div
                className={`fill ${fillTone}`}
                style={{ width: `${clamp01(used) * 100}%` }}
              />
            </div>
            {isCurrentMonth && hasPlan ? (
              <div
                className="pacemark"
                style={{ left: `${clamp01(elapsedShare) * 100}%` }}
                data-label="today"
              />
            ) : null}
          </div>
          <div className="meter-legend">
            <span>
              <strong className="tnum">{fmt.money(totals.spent)}</strong> spent ·{" "}
              {fmt.percent(totals.budget_used_pct)} of budget
            </span>
            <span>
              {hasPlan ? (
                <>
                  {fmt.percent(totals.month_elapsed_pct)} of the month gone
                  {isCurrentMonth && Math.abs(totals.pace_delta) >= 1 ? (
                    <>
                      {" · "}
                      <span className={`delta ${totals.pace_delta > 0 ? "up" : "down"}`}>
                        {fmt.money(Math.abs(totals.pace_delta))}{" "}
                        {totals.pace_delta > 0 ? "ahead of" : "below"} pace
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>no budget set</>
              )}
            </span>
          </div>
        </div>
      </div>

      <hr className="hr" />

      <div className="tilerow">
        <Tile
          icon="wallet"
          label="Spending money"
          value={fmt.money(totals.available_to_spend)}
          foot={`${fmt.money(totals.income)} income − ${fmt.money(totals.fixed_costs)} fixed − ${fmt.money(totals.savings_goal)} savings`}
        />
        <Tile
          icon="coins"
          spark={spentSoFar}
          label="Spent so far"
          value={fmt.money(totals.spent)}
          foot={`${totals.entries} ${totals.entries === 1 ? "entry" : "entries"} · ${fmt.money(totals.avg_daily_spend)} a day`}
          delta={
            comparison.prev_spent > 0 ? (
              <span className={`delta ${deltaClass}`}>
                <Icon name={comparison.direction === "down" ? "down" : "up"} size={13} />
                {fmt.money(Math.abs(comparison.delta))} vs {comparison.prev_month_short}
              </span>
            ) : null
          }
        />
        <Tile
          icon="target"
          label="Saved so far"
          value={fmt.money(totals.actual_savings)}
          foot={
            totals.savings_goal > 0
              ? `${fmt.percent(totals.savings_goal_pct)} of the ${fmt.money(totals.savings_goal)} goal`
              : `${fmt.percent(totals.savings_rate)} of income`
          }
        />
        <Tile
          icon="trend"
          label={isCurrentMonth ? "Projected month-end" : "Month total"}
          value={fmt.money(isCurrentMonth ? totals.projected_spend : totals.spent)}
          foot={
            hasPlan
              ? totals.projected_over > 0
                ? `${fmt.money(totals.projected_over)} over budget at this rate`
                : `${fmt.money(Math.abs(totals.projected_over))} under budget at this rate`
              : "—"
          }
        />
        {spread.has_spread ? (
          <Tile
            icon="calendar"
            label="What the month really costs"
            value={fmt.money(spread.monthly_spent)}
            foot={
              spread.difference < 0
                ? `${fmt.money(Math.abs(spread.difference))} of what you paid covers later months`
                : `includes ${fmt.money(spread.difference)} carried in from earlier payments`
            }
          />
        ) : null}
        <Tile
          icon="clock"
          label="Daily allowance"
          value={fmt.money(totals.daily_allowance)}
          foot={`${fmt.money(totals.expected_by_now)} would be even by day ${daysElapsed}`}
        />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  foot,
  delta,
  icon,
  spark,
}: {
  label: string;
  value: string;
  foot: string;
  delta?: ReactNode;
  icon: IconName;
  spark?: number[];
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
      {delta ? <div>{delta}</div> : null}
      <div className="foot">{foot}</div>
      {spark ? <Sparkline values={spark} /> : null}
    </div>
  );
}
