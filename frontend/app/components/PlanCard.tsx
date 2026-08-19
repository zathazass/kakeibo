import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import type { Formatters } from "~/lib/format";
import type { Account, Plan, PlanSuggestion, Totals } from "~/lib/types";

interface Props {
  month: string;
  monthLabel: string;
  plan: Plan;
  suggestion: PlanSuggestion | null;
  totals: Totals;
  accounts: Account[];
  fmt: Formatters;
}

/**
 * Kakeibo's opening move: income, minus fixed costs, minus savings — and only
 * what survives that is the month's spending money.
 */
import { Icon } from "./Icon";

export function PlanCard({ month, monthLabel, plan, suggestion, totals, accounts, fmt }: Props) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const [income, setIncome] = useState(String(plan.income || ""));
  const [fixed, setFixed] = useState(String(plan.fixed_costs || ""));
  const [goal, setGoal] = useState(String(plan.savings_goal || ""));
  const [incomeAccount, setIncomeAccount] = useState(String(plan.income_account_id ?? ""));

  const preview =
    (Number(income) || 0) - (Number(fixed) || 0) - (Number(goal) || 0);
  const dirty =
    Number(income || 0) !== plan.income ||
    Number(fixed || 0) !== plan.fixed_costs ||
    Number(goal || 0) !== plan.savings_goal ||
    (incomeAccount ? Number(incomeAccount) : null) !== (plan.income_account_id ?? null);

  const applySuggestion = () => {
    if (!suggestion) return;
    setIncome(String(suggestion.income || ""));
    setFixed(String(suggestion.fixed_costs || ""));
    setGoal(String(suggestion.savings_goal || ""));
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="cardic"><Icon name="wallet" size={15} /></span>
        <h2>Plan for {monthLabel}</h2>
        <span className="sub">Savings come off the top, before any spending</span>
      </div>

      {suggestion ? (
        <div className="notice" style={{ marginBottom: 12 }}>
          <span>
            {suggestion.from_label} was set up with {fmt.money(suggestion.income)} income and{" "}
            {fmt.money(suggestion.fixed_costs)} fixed costs.
          </span>
          <button type="button" className="btn ghost" onClick={applySuggestion}>
            Use those figures
          </button>
        </div>
      ) : null}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-plan" />
        <input type="hidden" name="month" value={month} />

        <div className="grid cols-3">
          <div className="field">
            <label htmlFor="income">Income</label>
            <input
              id="income"
              name="income"
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fixed_costs">Fixed costs</label>
            <input
              id="fixed_costs"
              name="fixed_costs"
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={fixed}
              onChange={(event) => setFixed(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="savings_goal">Savings goal</label>
            <input
              id="savings_goal"
              name="savings_goal"
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
        </div>

        {accounts.length > 0 ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="income_account_id">Salary lands in</label>
            <select
              id="income_account_id"
              name="income_account_id"
              className="select"
              value={incomeAccount}
              onChange={(event) => setIncomeAccount(event.target.value)}
            >
              <option value="">not recorded</option>
              {accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="secondary">
            Spending money:{" "}
            <strong className="tnum" style={{ color: preview < 0 ? "var(--critical-text)" : undefined }}>
              {fmt.money(preview)}
            </strong>
            {preview < 0 ? <span className="muted"> — fixed costs and savings exceed income</span> : null}
          </span>
          <button className="btn" type="submit" disabled={fetcher.state !== "idle" || !dirty}>
            {fetcher.state !== "idle" ? "Saving…" : dirty ? "Save plan" : "Saved"}
          </button>
        </div>
      </fetcher.Form>

      {totals.income > 0 ? (
        <>
          <hr className="hr" />
          <div className="secondary" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {fmt.money(totals.income)} in, {fmt.money(totals.fixed_costs)} committed to fixed
            costs, {fmt.money(totals.savings_goal)} put aside. That leaves{" "}
            <strong>{fmt.money(totals.available_to_spend)}</strong> for the month, or{" "}
            {fmt.money(totals.daily_allowance)} a day.
          </div>
        </>
      ) : null}
    </div>
  );
}
