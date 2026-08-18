import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useNavigation,
  useRouteError,
  useSearchParams,
} from "@remix-run/react";
import type { ClientActionFunctionArgs, ClientLoaderFunctionArgs } from "@remix-run/react";
import { useState, type ReactNode } from "react";

import { CategoryPanel } from "~/components/CategoryPanel";
import { DailyChart, DailyTable } from "~/components/DailyChart";
import { HistoryStrip } from "~/components/HistoryStrip";
import { Icon } from "~/components/Icon";
import { InsightsPanel } from "~/components/InsightsPanel";
import { LedgerPanel } from "~/components/LedgerPanel";
import { Overview } from "~/components/Overview";
import { PaceChart } from "~/components/PaceChart";
import { PlanCard } from "~/components/PlanCard";
import { ReflectionPanel } from "~/components/ReflectionPanel";
import { ThemeToggle } from "~/components/ThemeToggle";
import { WeekdayPanel } from "~/components/WeekdayPanel";
import { WeeklyPanel } from "~/components/WeeklyPanel";
import { api } from "~/lib/api";
import { formattersFor } from "~/lib/format";
import type { CategoryKey, Dashboard } from "~/lib/types";

export const meta = () => [{ title: "kaKeiBo — household ledger" }];

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  return api.dashboard(month ?? undefined);
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const num = (key: string) => Number(form.get(key) ?? 0) || 0;

  try {
    switch (intent) {
      case "add-expense": {
        await api.addExpense({
          spent_on: String(form.get("spent_on")),
          category: String(form.get("category") || "needs"),
          amount: num("amount"),
          note: String(form.get("note") ?? "").trim(),
        });
        break;
      }
      case "delete-expense": {
        await api.deleteExpense(Number(form.get("id")));
        break;
      }
      case "save-plan": {
        // Read-modify-write so saving the numbers never clobbers the note.
        const month = String(form.get("month"));
        const current = await api.getPlan(month);
        await api.savePlan(month, {
          income: num("income"),
          fixed_costs: num("fixed_costs"),
          savings_goal: num("savings_goal"),
          reflection: current.reflection,
        });
        break;
      }
      case "save-reflection": {
        const month = String(form.get("month"));
        const current = await api.getPlan(month);
        await api.savePlan(month, {
          income: current.income,
          fixed_costs: current.fixed_costs,
          savings_goal: current.savings_goal,
          reflection: String(form.get("reflection") ?? ""),
        });
        break;
      }
      default:
        return { ok: false, error: `unknown action: ${intent}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export default function Index() {
  const data = useLoaderData<Dashboard>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const fmt = formattersFor(data);

  const labels = Object.fromEntries(
    (Object.keys(data.category_meta) as CategoryKey[]).map((k) => [k, data.category_meta[k].label]),
  ) as Record<CategoryKey, string>;
  const hints = Object.fromEntries(
    (Object.keys(data.category_meta) as CategoryKey[]).map((k) => [k, data.category_meta[k].hint]),
  ) as Record<CategoryKey, string>;

  const hasPlan = data.totals.income > 0 || data.totals.fixed_costs > 0;
  const pending = navigation.state === "loading";
  const lastDay = String(data.days_in_month).padStart(2, "0");

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <h1>kaKeiBo</h1>
          <span className="jp">家計簿</span>
          <span className="tag">household financial ledger</span>
        </div>

        <span className="spacer" />

        {/* One filter row above everything it scopes: the month drives every
            number and every chart on the page. */}
        <div className="filterbar">
          <div className="monthnav">
            <Link
              className="iconbtn"
              to={`/?month=${data.prev_month}`}
              aria-label="Previous month"
              prefetch="intent"
            >
              <Icon name="left" size={15} />
            </Link>
            <span className="current">{data.month_label}</span>
            <Link
              className="iconbtn"
              to={`/?month=${data.next_month}`}
              aria-label="Next month"
              prefetch="intent"
            >
              <Icon name="right" size={15} />
            </Link>
          </div>
          {data.month !== data.current_month ? (
            <Link className="pillbtn" to="/">
              This month
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <div className="stack" data-pending={pending}>
        <Overview
          totals={data.totals}
          comparison={data.comparison}
          daysLeft={data.days_left}
          daysElapsed={data.days_elapsed}
          daysInMonth={data.days_in_month}
          isCurrentMonth={data.is_current_month}
          hasPlan={hasPlan}
          fmt={fmt}
        />

        <InsightsPanel insights={data.insights} />

        <div className="grid main">
          <div className="stack">
            <CategoryPanel
              categories={data.categories}
              spent={data.totals.spent}
              comparison={data.comparison}
              fmt={fmt}
            />

            <ChartCard
              title="Day by day"
              sub={`Every day of ${data.month_label} — hover or focus a day for its breakdown`}
              table={<DailyTable daily={data.daily} labels={labels} fmt={fmt} />}
            >
              <DailyChart
                daily={data.daily}
                allowance={hasPlan ? data.totals.daily_allowance : 0}
                labels={labels}
                fmt={fmt}
              />
            </ChartCard>

            <ChartCard
              title="Running total against pace"
              sub="Where the month stands versus spending evenly across it"
              table={<DailyTable daily={data.daily} labels={labels} fmt={fmt} />}
            >
              <PaceChart
                daily={data.daily}
                available={hasPlan ? data.totals.available_to_spend : 0}
                fmt={fmt}
              />
            </ChartCard>

            <WeeklyPanel weekly={data.weekly} labels={labels} hasPlan={hasPlan} fmt={fmt} />

            <div className="grid cols-2">
              <WeekdayPanel profile={data.weekday_profile} fmt={fmt} />
              <HistoryStrip
                history={data.history}
                activeMonth={data.month}
                hasPlanAnywhere={data.history.some((row) => row.available > 0)}
                fmt={fmt}
              />
            </div>
          </div>

          <div className="stack">
            <PlanCard
              key={`plan-${data.month}`}
              month={data.month}
              monthLabel={data.month_label}
              plan={data.plan}
              suggestion={data.plan_suggestion}
              totals={data.totals}
              fmt={fmt}
            />

            <LedgerPanel
              month={data.month}
              expenses={data.expenses}
              labels={labels}
              hints={hints}
              defaultDate={data.is_current_month ? data.today : `${data.month}-01`}
              minDate={`${data.month}-01`}
              maxDate={`${data.month}-${lastDay}`}
              fmt={fmt}
            />

            <ReflectionPanel
              key={`reflect-${data.month}`}
              month={data.month}
              monthLabel={data.month_label}
              questions={data.reflection_questions}
              reflection={data.plan.reflection}
              fmt={fmt}
            />
          </div>
        </div>
      </div>

      <p className="emptynote" style={{ textAlign: "center", paddingTop: 22 }}>
        Everything lives in a local SQLite file. Viewing {data.month_label}
        {searchParams.get("month") ? " · " : ""}
        {searchParams.get("month") ? <Link to="/">back to this month</Link> : null}
      </p>
    </div>
  );
}

/** A chart and its table twin — every value readable without a hover. */
function ChartCard({
  title,
  sub,
  children,
  table,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  table: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className="sub">{sub}</span>
        <span className="spacer" />
        <button
          className="pillbtn"
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
        >
          <Icon name={showTable ? "chart" : "table"} size={13} />{" "}
          {showTable ? "Chart" : "Table"}
        </button>
      </div>
      {showTable ? table : children}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <div className="app">
      <div className="card" style={{ maxWidth: 640, margin: "12vh auto" }}>
        <div className="card-head">
          <h2>The ledger could not be opened</h2>
        </div>
        <p className="secondary">
          The API did not answer. Check that the FastAPI server is running:
        </p>
        <pre
          style={{
            background: "var(--surface-sunken)",
            padding: "10px 12px",
            borderRadius: 9,
            fontSize: 12.5,
            overflowX: "auto",
          }}
        >
          cd backend && uvicorn app.main:app --reload --port 8004
        </pre>
        <p className="muted" style={{ fontSize: 12.5 }}>
          {message}
        </p>
        <button className="btn" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}
