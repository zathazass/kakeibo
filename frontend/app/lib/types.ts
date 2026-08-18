export type CategoryKey = "needs" | "wants" | "culture" | "unexpected";

export const CATEGORY_ORDER: CategoryKey[] = ["needs", "wants", "culture", "unexpected"];

/** Fixed categorical slots — assigned by entity, never by rank, never cycled. */
export const CATEGORY_COLOR: Record<CategoryKey, string> = {
  needs: "var(--series-1)",
  wants: "var(--series-2)",
  culture: "var(--series-3)",
  unexpected: "var(--series-4)",
};

export type Tone = "critical" | "serious" | "warning" | "good" | "info";

export interface Plan {
  month: string;
  income: number;
  fixed_costs: number;
  savings_goal: number;
  reflection: string;
}

export interface PlanSuggestion {
  from_month: string;
  from_label: string;
  income: number;
  fixed_costs: number;
  savings_goal: number;
}

export interface Totals {
  income: number;
  fixed_costs: number;
  savings_goal: number;
  available_to_spend: number;
  spent: number;
  remaining: number;
  entries: number;
  actual_savings: number;
  savings_rate: number;
  savings_goal_pct: number;
  daily_allowance: number;
  safe_daily_left: number;
  avg_daily_spend: number;
  projected_spend: number;
  projected_savings: number;
  projected_over: number;
  budget_used_pct: number;
  month_elapsed_pct: number;
  expected_by_now: number;
  pace_delta: number;
  is_over_budget: boolean;
}

export interface CategoryRow {
  key: CategoryKey;
  label: string;
  jp: string;
  hint: string;
  slot: number;
  amount: number;
  entries: number;
  share: number;
  prev_amount: number;
  delta: number;
  delta_pct: number | null;
  avg_per_entry: number;
}

export type DailyRow = {
  date: string;
  day: number;
  label: string;
  weekday: number;
  weekday_short: string;
  is_weekend: boolean;
  is_today: boolean;
  is_future: boolean;
  total: number;
  entries: number;
  cumulative: number;
  pace: number;
} & Record<CategoryKey, number>;

export type WeekRow = {
  index: number;
  label: string;
  range_label: string;
  start: string;
  end: string;
  days: number;
  elapsed_days: number;
  is_partial: boolean;
  is_future: boolean;
  total: number;
  entries: number;
  allowance: number;
  delta_vs_allowance: number;
  avg_per_day: number;
  busiest_day: string | null;
} & Record<CategoryKey, number>;

export interface WeekdayRow {
  weekday: number;
  label: string;
  short: string;
  is_weekend: boolean;
  total: number;
  days: number;
  entries: number;
  avg: number;
}

export interface Expense {
  id: number;
  spent_on: string;
  category: CategoryKey;
  amount: number;
  note: string;
  created_at: string;
}

export interface Insight {
  tone: Tone;
  group: "pace" | "overspent" | "reduced" | "pattern" | "leak";
  icon: string;
  title: string;
  detail: string;
  rank: number;
}

export interface Comparison {
  prev_month: string;
  prev_month_label: string;
  prev_month_short: string;
  like_for_like: boolean;
  cutoff_day: number | null;
  prev_spent: number;
  prev_full_spent: number;
  prev_savings: number;
  spent: number;
  delta: number;
  delta_pct: number | null;
  direction: "up" | "down" | "flat";
}

export interface HistoryRow {
  month: string;
  label: string;
  spent: number;
  income: number;
  available: number;
  saved: number;
  over_budget: boolean;
}

export interface Leak {
  label: string;
  entries: number;
  total: number;
  category: CategoryKey;
}

export interface ReflectionQuestion {
  question: string;
  value: number | null;
  detail: string;
}

export interface Dashboard {
  month: string;
  month_label: string;
  prev_month: string;
  next_month: string;
  current_month: string;
  is_current_month: boolean;
  is_future_month: boolean;
  today: string;
  days_in_month: number;
  days_elapsed: number;
  days_left: number;
  currency: string;
  locale: string;
  category_meta: Record<CategoryKey, { label: string; jp: string; hint: string }>;
  plan: Plan;
  plan_suggestion: PlanSuggestion | null;
  totals: Totals;
  categories: CategoryRow[];
  daily: DailyRow[];
  weekly: WeekRow[];
  weekday_profile: WeekdayRow[];
  comparison: Comparison;
  history: HistoryRow[];
  leaks: Leak[];
  top_expenses: Expense[];
  expenses: Expense[];
  insights: Insight[];
  reflection_questions: ReflectionQuestion[];
}
