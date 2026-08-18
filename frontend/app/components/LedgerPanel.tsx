import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import type { Formatters } from "~/lib/format";
import { dayLabel, weekdayLabel } from "~/lib/format";
import type { CategoryKey, Expense } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

interface Props {
  month: string;
  expenses: Expense[];
  labels: Record<CategoryKey, string>;
  hints: Record<CategoryKey, string>;
  defaultDate: string;
  minDate: string;
  maxDate: string;
  fmt: Formatters;
}

export function LedgerPanel({
  month,
  expenses,
  labels,
  hints,
  defaultDate,
  minDate,
  maxDate,
  fmt,
}: Props) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState<CategoryKey>("needs");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => setDate(defaultDate), [defaultDate, month]);

  // Clear the amount and note once the entry lands; keep date and category so
  // logging a run of same-day entries stays fast.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setAmount("");
      setNote("");
    }
  }, [fetcher.state, fetcher.data]);

  const groups = expenses.reduce<Record<string, Expense[]>>((acc, entry) => {
    (acc[entry.spent_on] ??= []).push(entry);
    return acc;
  }, {});
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="card formcard">
      <div className="card-head">
        <span className="cardic"><Icon name="pencil" size={15} /></span>
        <h2>Ledger</h2>
        <span className="sub">
          {expenses.length} {expenses.length === 1 ? "entry" : "entries"} this month
        </span>
      </div>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="add-expense" />
        <div className="formgrid">
          <div className="field">
            <label htmlFor="spent_on">Date</label>
            <input
              id="spent_on"
              name="spent_on"
              className="input"
              type="date"
              required
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              name="amount"
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="field wide">
            <label htmlFor="cat-needs">Category</label>
            <div className="catpick">
              {CATEGORY_ORDER.map((key) => (
                <label key={key} htmlFor={`cat-${key}`} title={hints[key]}>
                  <input
                    id={`cat-${key}`}
                    type="radio"
                    name="category"
                    value={key}
                    checked={category === key}
                    onChange={() => setCategory(key)}
                  />
                  <CategoryIcon category={key} size={13} tinted />
                  {labels[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="field wide">
            <label htmlFor="note">Note</label>
            <input
              id="note"
              name="note"
              className="input"
              type="text"
              maxLength={200}
              placeholder="groceries, chai, bus fare…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="submit">
            <button className="btn" type="submit" disabled={fetcher.state !== "idle"}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </div>
        {fetcher.data?.error ? (
          <div className="notice" style={{ marginTop: 10 }}>
            Could not save that entry: {fetcher.data.error}
          </div>
        ) : null}
      </fetcher.Form>

      <hr className="hr" />

      {days.length === 0 ? (
        <div className="emptystate">
          <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
            <rect x="18" y="10" width="84" height="64" rx="5" className="es-page" />
            <path d="M60 10v64" className="es-spine" />
            <path d="M27 26h24M27 36h24M27 46h18" className="es-rule" />
            <path d="M69 26h24M69 36h24M69 46h18" className="es-rule" />
            <circle cx="93" cy="60" r="13" className="es-coin" />
            <path d="M93 54v12M89.6 57h4.8a2.4 2.4 0 0 1 0 4.8h-2.8a2.4 2.4 0 0 0 0 4.8h4.8"
                  className="es-mark" />
          </svg>
          <p>
            <strong>Nothing logged for this month yet.</strong>
          </p>
          <p>
            Kakeibo is written by hand for a reason — the act of entering each spend is what makes
            it conscious.
          </p>
        </div>
      ) : (
        <div className="scrolly">
          {days.map((day) => {
            const rows = groups[day];
            const dayTotal = rows.reduce((sum, row) => sum + row.amount, 0);
            return (
              <div className="daygroup" key={day}>
                <div className="dayhead">
                  <span className="d">{dayLabel(day)}</span>
                  <span className="wd">{weekdayLabel(day)}</span>
                  <span className="sum">{fmt.money(dayTotal)}</span>
                </div>
                {rows.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    labels={labels}
                    hints={hints}
                    minDate={minDate}
                    maxDate={maxDate}
                    fmt={fmt}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * One ledger line, in one of three states: reading it, correcting it, or
 * confirming a delete. Deletes ask first — an entry has no undo.
 */
function EntryRow({
  entry,
  labels,
  hints,
  minDate,
  maxDate,
  fmt,
}: {
  entry: Expense;
  labels: Record<CategoryKey, string>;
  hints: Record<CategoryKey, string>;
  minDate: string;
  maxDate: string;
  fmt: Formatters;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const busy = fetcher.state !== "idle";
  const describe = entry.note ? `\u201C${entry.note}\u201D` : labels[entry.category];

  // Close the editor once the save lands; a failed save stays open with the error.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setMode("view");
  }, [fetcher.state, fetcher.data]);

  if (mode === "edit") {
    return (
      <fetcher.Form method="post" className="entry-edit">
        <input type="hidden" name="intent" value="update-expense" />
        <input type="hidden" name="id" value={entry.id} />

        <div className="field">
          <label htmlFor={`edit-date-${entry.id}`}>Date</label>
          <input
            id={`edit-date-${entry.id}`}
            name="spent_on"
            className="input"
            type="date"
            required
            min={minDate}
            max={maxDate}
            defaultValue={entry.spent_on}
          />
        </div>

        <div className="field">
          <label htmlFor={`edit-amount-${entry.id}`}>Amount</label>
          <input
            id={`edit-amount-${entry.id}`}
            name="amount"
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={entry.amount}
          />
        </div>

        <div className="field wide">
          <label htmlFor={`edit-cat-${entry.id}-needs`}>Category</label>
          <div className="catpick">
            {CATEGORY_ORDER.map((key) => (
              <label key={key} htmlFor={`edit-cat-${entry.id}-${key}`} title={hints[key]}>
                <input
                  id={`edit-cat-${entry.id}-${key}`}
                  type="radio"
                  name="category"
                  value={key}
                  defaultChecked={entry.category === key}
                />
                <CategoryIcon category={key} size={13} tinted />
                {labels[key]}
              </label>
            ))}
          </div>
        </div>

        <div className="field wide">
          <label htmlFor={`edit-note-${entry.id}`}>Note</label>
          <input
            id={`edit-note-${entry.id}`}
            name="note"
            className="input"
            type="text"
            maxLength={200}
            placeholder="groceries, chai, bus fare…"
            defaultValue={entry.note}
          />
        </div>

        {fetcher.data?.error ? (
          <p className="editerr wide">Could not save that change: {fetcher.data.error}</p>
        ) : null}

        <div className="acts wide">
          <button type="button" className="btn tiny ghost" onClick={() => setMode("view")} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn tiny" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </fetcher.Form>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="entry confirming">
        <span className="cicon" style={{ color: CATEGORY_COLOR[entry.category] }}>
          <CategoryIcon category={entry.category} size={15} />
        </span>
        <span className="note">Delete {describe}?</span>
        <span className="amt">{fmt.exact(entry.amount)}</span>
        <span className="acts">
          <button type="button" className="btn tiny ghost" onClick={() => setMode("view")} disabled={busy}>
            Keep
          </button>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete-expense" />
            <input type="hidden" name="id" value={entry.id} />
            <button type="submit" className="btn tiny danger" disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          </fetcher.Form>
        </span>
      </div>
    );
  }

  return (
    <div className="entry">
      <span className="cicon" style={{ color: CATEGORY_COLOR[entry.category] }}>
        <CategoryIcon category={entry.category} size={15} />
      </span>
      <span className="note">
        {entry.note || <span className="muted">no note</span>}
        <span className="cat">{labels[entry.category]}</span>
      </span>
      <span className="amt">{fmt.exact(entry.amount)}</span>
      <span className="acts">
        <button
          type="button"
          className="act"
          onClick={() => setMode("edit")}
          title="Edit this entry"
          aria-label={`Edit ${describe}`}
        >
          <Icon name="pencil" size={14} />
        </button>
        <button
          type="button"
          className="act danger"
          onClick={() => setMode("confirm")}
          title="Delete this entry"
          aria-label={`Delete ${describe}`}
        >
          <Icon name="trash" size={14} />
        </button>
      </span>
    </div>
  );
}
