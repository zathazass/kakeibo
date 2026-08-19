import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";
import type { ClientActionFunctionArgs, ClientLoaderFunctionArgs } from "@remix-run/react";
import { useState, type ReactNode } from "react";

import { BudgetPanel } from "~/components/BudgetPanel";
import { CategoryPanel } from "~/components/CategoryPanel";
import { ComparePanel } from "~/components/ComparePanel";
import { DailyChart, DailyTable } from "~/components/DailyChart";
import { GuidePanel } from "~/components/GuidePanel";
import { HistoryStrip } from "~/components/HistoryStrip";
import { Icon } from "~/components/Icon";
import { InsightsPanel } from "~/components/InsightsPanel";
import { LedgerPanel } from "~/components/LedgerPanel";
import { OutlookPanel } from "~/components/OutlookPanel";
import { Overview } from "~/components/Overview";
import { PaceChart } from "~/components/PaceChart";
import { PlanCard } from "~/components/PlanCard";
import { SideNav, type NavSection } from "~/components/SideNav";
import { ReflectionPanel } from "~/components/ReflectionPanel";
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
          tag: String(form.get("tag") ?? "").trim(),
        });
        break;
      }
      case "update-expense": {
        await api.updateExpense(Number(form.get("id")), {
          spent_on: String(form.get("spent_on")),
          category: String(form.get("category") || "needs"),
          amount: num("amount"),
          note: String(form.get("note") ?? "").trim(),
          tag: String(form.get("tag") ?? "").trim(),
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

const SECTIONS = [
  { key: "overview", label: "Overview", icon: "chart", hint: "Where the month stands, and what needs attention" },
  { key: "spending", label: "Spending", icon: "layers", hint: "The four buckets, day by day, against the pace" },
  { key: "trends", label: "Trends", icon: "trend", hint: "Weeks, days of the week, and recent months" },
  { key: "outlook", label: "Outlook", icon: "target", hint: "Spending limits, predictions and what to change next" },
  { key: "compare", label: "Compare", icon: "calendar", hint: "Month, quarter, half year and year side by side" },
  { key: "budget", label: "Budget", icon: "wallet", hint: "Split the month's spending money by bucket and by label" },
  { key: "ledger", label: "Ledger", icon: "table", hint: "Set the month up and log what you spend" },
  { key: "review", label: "Review", icon: "star", hint: "Close the month on the four questions" },
  { key: "guide", label: "Guide", icon: "help", hint: "How kakeibo works and how to read this app" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const VIEW_KEY = "kakeibo-view";

function initialView(): SectionKey {
  if (typeof window === "undefined") return "overview";
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return SECTIONS.some((s) => s.key === stored) ? (stored as SectionKey) : "overview";
  } catch {
    return "overview";
  }
}

export default function Index() {
  const data = useLoaderData<Dashboard>();
  const navigation = useNavigation();
  const fmt = formattersFor(data);
  const [view, setView] = useState<SectionKey>(initialView);

  const select = (key: string) => {
    setView(key as SectionKey);
    try {
      localStorage.setItem(VIEW_KEY, key);
    } catch {
      /* private mode — the section just will not be remembered */
    }
  };

  const labels = Object.fromEntries(
    (Object.keys(data.category_meta) as CategoryKey[]).map((k) => [k, data.category_meta[k].label]),
  ) as Record<CategoryKey, string>;
  const hints = Object.fromEntries(
    (Object.keys(data.category_meta) as CategoryKey[]).map((k) => [k, data.category_meta[k].hint]),
  ) as Record<CategoryKey, string>;

  const hasPlan = data.totals.income > 0 || data.totals.fixed_costs > 0;
  const pending = navigation.state === "loading";
  const lastDay = String(data.days_in_month).padStart(2, "0");

  const counts: Record<SectionKey, number | undefined> = {
    overview: data.insights.filter((i) => i.group === "overspent").length,
    spending: data.categories.filter((c) => c.amount > 0).length,
    trends: undefined,
    outlook: data.outlook.suggestions.length,
    compare: undefined,
    budget: undefined,
    ledger: data.totals.entries,
    review: undefined,
    guide: undefined,
  };
  const sections: NavSection[] = SECTIONS.map((s) => ({ ...s, count: counts[s.key] }));

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
            number and every chart in every section. */}
        <div className="filterbar">
          {data.month !== data.current_month ? (
            <Link className="pillbtn" to="/">
              This month
            </Link>
          ) : null}
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
        </div>
      </header>

      <div className="shell">
        <SideNav sections={sections} active={view} onSelect={select} />

        <div className="stack" data-pending={pending}>
          {view === "overview" ? (
            <>
              <Overview
                totals={data.totals}
                comparison={data.comparison}
                daily={data.daily}
                daysLeft={data.days_left}
                daysElapsed={data.days_elapsed}
                daysInMonth={data.days_in_month}
                isCurrentMonth={data.is_current_month}
                hasPlan={hasPlan}
                fmt={fmt}
              />
              <InsightsPanel insights={data.insights} />
            </>
          ) : null}

          {view === "spending" ? (
            <>
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
            </>
          ) : null}

          {view === "trends" ? (
            <>
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
            </>
          ) : null}

          {view === "outlook" ? (
            <OutlookPanel
              outlook={data.outlook}
              monthLabel={data.month_label}
              daysLeft={data.days_left}
              isCurrentMonth={data.is_current_month}
              fmt={fmt}
            />
          ) : null}

          {view === "compare" ? (
            <ComparePanel currency={data.currency} locale={data.locale} labels={labels} />
          ) : null}

          {view === "budget" ? (
            <BudgetPanel
              key={`budget-${data.month}`}
              month={data.month}
              monthLabel={data.month_label}
              labels={labels}
              tagOptions={data.tags}
              fmt={fmt}
            />
          ) : null}

          {view === "ledger" ? (
            <div className="grid ledgergrid">
              <LedgerPanel
                month={data.month}
                expenses={data.expenses}
                labels={labels}
                hints={hints}
                tagOptions={data.tags}
                defaultDate={data.is_current_month ? data.today : `${data.month}-01`}
                minDate={`${data.month}-01`}
                maxDate={`${data.month}-${lastDay}`}
                fmt={fmt}
              />
              <PlanCard
                key={`plan-${data.month}`}
                month={data.month}
                monthLabel={data.month_label}
                plan={data.plan}
                suggestion={data.plan_suggestion}
                totals={data.totals}
                fmt={fmt}
              />
            </div>
          ) : null}

          {view === "guide" ? (
            <GuidePanel rules={data.rules} currency={data.currency} onNavigate={select} />
          ) : null}

          {view === "review" ? (
            <div className="grid ledgergrid">
              <ReflectionPanel
                key={`reflect-${data.month}`}
                month={data.month}
                monthLabel={data.month_label}
                questions={data.reflection_questions}
                reflection={data.plan.reflection}
                fmt={fmt}
              />
              <InsightsPanel insights={data.insights} stacked />
            </div>
          ) : null}
        </div>
      </div>
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
          cd backend && uvicorn app.main:app --reload --port 2455
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
