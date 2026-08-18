import type { Dashboard, Expense, Plan } from "./types";

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

  addExpense: (payload: {
    spent_on: string;
    category: string;
    amount: number;
    note: string;
  }) => request<Expense>("/expenses", { method: "POST", body: JSON.stringify(payload) }),

  updateExpense: (
    id: number,
    payload: { spent_on: string; category: string; amount: number; note: string },
  ) => request<Expense>(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteExpense: (id: number) => request<void>(`/expenses/${id}`, { method: "DELETE" }),

  getPlan: (month: string) => request<Plan>(`/months/${month}/plan`),

  savePlan: (
    month: string,
    payload: { income: number; fixed_costs: number; savings_goal: number; reflection: string },
  ) =>
    request<unknown>(`/months/${month}/plan`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
