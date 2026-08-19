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
  tag: string;
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

export interface OutlookLimit {
  key: string;
  label: string;
  budget: number;
  left: number;
  per_day: number;
  per_week: number;
  used_pct: number;
  blown: boolean;
  tone: Tone;
  detail: string;
}

export interface OutlookProjection {
  spend: number;
  savings: number;
  over: number;
  basis_days: number;
  reliable: boolean;
  next_month: string;
  next_month_label: string;
  expected_spend: number;
  suggested_goal: number;
  suggested_from: string | null;
}

export interface LifetimeCategory {
  key: CategoryKey;
  label: string;
  slot: number;
  total: number;
  avg_per_month: number;
  share: number;
  this_month: number;
}

export interface Lifetime {
  months: number;
  entries: number;
  active_days: number;
  spent: number;
  first_day: string | null;
  last_day: string | null;
  avg_monthly_spend: number;
  recent_avg_spend: number;
  avg_monthly_saved: number;
  avg_daily_spend: number;
  total_saved: number;
  best_month: HistoryRow | null;
  worst_month: HistoryRow | null;
  categories: LifetimeCategory[];
}

export interface Suggestion {
  tone: Tone;
  icon: string;
  title: string;
  detail: string;
  amount: number | null;
  rank: number;
}

export interface Outlook {
  lifetime: Lifetime;
  limits: OutlookLimit[];
  projection: OutlookProjection;
  suggestions: Suggestion[];
}

export interface PeriodCategory {
  key: CategoryKey;
  label: string;
  slot: number;
  amount: number;
  share: number;
  avg_per_period?: number;
}

export interface Period {
  key: string;
  label: string;
  span: string;
  months: number;
  month_keys: string[];
  spent: number;
  entries: number;
  income: number;
  fixed_costs: number;
  savings_goal: number;
  available: number;
  saved: number;
  savings_rate: number;
  avg_per_month: number;
  categories: PeriodCategory[];
  delta: number;
  delta_pct: number | null;
  direction: "up" | "down" | "flat";
}

export interface TagTotal {
  tag: string;
  category: CategoryKey;
  label: string;
  total: number;
  entries: number;
  share: number;
  avg: number;
}

export interface ComparisonSummary {
  grain: string;
  periods: number;
  months: number;
  entries: number;
  total_spent: number;
  total_income: number;
  total_saved: number;
  avg_per_period: number;
  savings_rate: number;
  highest: Period | null;
  lowest: Period | null;
  best_saved: Period | null;
}

export interface Comparison {
  grain: string;
  grains: { key: string; label: string }[];
  currency: string;
  locale: string;
  periods: Period[];
  summary: ComparisonSummary;
  category_totals: PeriodCategory[];
  tags: TagTotal[];
  tagged_share: number;
  top_expenses: Expense[];
}

export interface TagOptions {
  suggestions: Record<CategoryKey, string[]>;
  used: string[];
}

export type BudgetState = "none" | "ok" | "close" | "over";
export type BudgetPace = "none" | "behind" | "even" | "ahead";

export interface BudgetLine {
  key?: CategoryKey;
  tag?: string;
  category?: CategoryKey;
  label: string;
  slot?: number;
  budget: number;
  spent: number;
  entries?: number;
  left: number;
  used_pct: number;
  state: BudgetState;
  pace: BudgetPace;
  suggested: number;
}

export interface BudgetView {
  month: string;
  available: number;
  allocated: number;
  unallocated: number;
  over_allocated: boolean;
  tag_allocated: number;
  spent: number;
  has_budgets: boolean;
  categories: (BudgetLine & { key: CategoryKey; slot: number })[];
  tags: (BudgetLine & { tag: string; category: CategoryKey })[];
  can_suggest: boolean;
  close_at: number;
}

export interface Rules {
  wants_flag_pct: number;
  wants_lean_pct: number;
  unexpected_flag_pct: number;
  leak_min_repeats: number;
  leak_max_share_pct: number;
  quiet_days_min: number;
  weekend_ratio_flag: number;
  projection_min_days: number;
  forecast_min_days: number;
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
  rules: Rules;
  tags: TagOptions;
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
  outlook: Outlook;
  reflection_questions: ReflectionQuestion[];
}
