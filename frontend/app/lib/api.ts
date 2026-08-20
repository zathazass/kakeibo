import type {
  Account,
  AccountsView,
  BudgetView,
  Comparison,
  Dashboard,
  Expense,
  Plan,
  Transfer,
} from "./types";

/**
 * In dev, Vite proxies /api to the FastAPI server; in the built SPA, FastAPI
 * serves both. Either way a relative path is correct.
 */
const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* response had no JSON body — the status line is all we get */
    }
    throw new Error(detail);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  dashboard: (month?: string) =>
    request<Dashboard>(`/dashboard${month ? `?month=${encodeURIComponent(month)}` : ""}`),

  accounts: (month: string) => request<AccountsView>(`/accounts?month=${month}`),

  createAccount: (payload: Record<string, unknown>) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }),

  updateAccount: (id: number, payload: Record<string, unknown>) =>
    request<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteAccount: (id: number) => request<void>(`/accounts/${id}`, { method: "DELETE" }),

  settleCard: (id: number, payload: { up_to?: string; paid_on?: string }) =>
    request<{ settled: number; note: string }>(`/accounts/${id}/settle`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  transfers: (month: string) => request<Transfer[]>(`/transfers?month=${month}`),

  addTransfer: (payload: {
    moved_on: string;
    from_account_id: number | null;
    to_account_id: number | null;
    amount: number;
    kind: string;
    note: string;
  }) => request<Transfer>("/transfers", { method: "POST", body: JSON.stringify(payload) }),

  deleteTransfer: (id: number) => request<void>(`/transfers/${id}`, { method: "DELETE" }),

  budget: (month: string) => request<BudgetView>(`/months/${month}/budget`),

  saveBudget: (
    month: string,
    payload: { categories: Record<string, number>; tags: Record<string, number> },
  ) =>
    request<BudgetView>(`/months/${month}/budget`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  compare: (grain: string) =>
    request<Comparison>(`/compare?grain=${encodeURIComponent(grain)}`),

  addExpense: (payload: {
    spent_on: string;
    category: string;
    amount: number;
    note: string;
    tag: string;
    account_id: number | null;
    spread_months: number;
  }) => request<Expense>("/expenses", { method: "POST", body: JSON.stringify(payload) }),

  updateExpense: (
    id: number,
    payload: {
      spent_on: string;
      category: string;
      amount: number;
      note: string;
      tag: string;
      account_id: number | null;
      spread_months: number;
    },
  ) => request<Expense>(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteExpense: (id: number) => request<void>(`/expenses/${id}`, { method: "DELETE" }),

  getPlan: (month: string) => request<Plan>(`/months/${month}/plan`),

  savePlan: (
    month: string,
    payload: {
      income: number;
      fixed_costs: number;
      savings_goal: number;
      income_account_id: number | null;
      reflection: string;
    },
  ) =>
    request<unknown>(`/months/${month}/plan`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
