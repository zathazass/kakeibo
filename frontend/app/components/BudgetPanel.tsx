import { useEffect, useState } from "react";

import { api } from "~/lib/api";
import type { Formatters } from "~/lib/format";
import { clamp01 } from "~/lib/format";
import type { BudgetView, CategoryKey } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

type Draft = { categories: Record<string, string>; tags: Record<string, string> };

const emptyDraft: Draft = { categories: {}, tags: {} };

function toDraft(view: BudgetView): Draft {
  return {
    categories: Object.fromEntries(
      view.categories.map((line) => [line.key, line.budget ? String(line.budget) : ""]),
    ),
    tags: Object.fromEntries(
      view.tags.map((line) => [line.tag, line.budget ? String(line.budget) : ""]),
    ),
  };
}

const num = (value: string) => Number(value) || 0;

export function BudgetPanel({
  month,
  monthLabel,
  labels,
  tagOptions,
  fmt,
}: {
  month: string;
  monthLabel: string;
  labels: Record<CategoryKey, string>;
  tagOptions: { suggestions: Record<CategoryKey, string[]>; used: string[] };
  fmt: Formatters;
}) {
  const [view, setView] = useState<BudgetView | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    let alive = true;
    setBusy(true);
    api
      .budget(month)
      .then((result) => {
        if (!alive) return;
        setView(result);
        setDraft(toDraft(result));
      })
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const save = async (next: Draft = draft) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.saveBudget(month, {
        categories: Object.fromEntries(
          Object.entries(next.categories).map(([k, v]) => [k, num(v)]),
        ),
        tags: Object.fromEntries(Object.entries(next.tags).map(([k, v]) => [k, num(v)])),
      });
      setView(result);
      setDraft(toDraft(result));
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const useSuggestions = () => {
    if (!view) return;
    setDraft({
      categories: Object.fromEntries(
        view.categories.map((l) => [l.key, l.suggested ? String(Math.round(l.suggested)) : ""]),
      ),
      tags: Object.fromEntries(
        view.tags.map((l) => [l.tag, l.suggested ? String(Math.round(l.suggested)) : ""]),
      ),
    });
  };

  const addTag = () => {
    const name = newTag.trim();
    if (!name || draft.tags[name] !== undefined) return;
    setDraft({ ...draft, tags: { ...draft.tags, [name]: "" } });
    setNewTag("");
  };

  if (error && !view) {
    return (
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="wallet" size={15} /></span>
          <h2>Monthly allocations</h2>
        </div>
        <div className="emptynote">Could not load allocations: {error}</div>
      </div>
    );
  }

  const plannedCats = Object.values(draft.categories).reduce((sum, v) => sum + num(v), 0);
  const left = (view?.available ?? 0) - plannedCats;
  const tagNames = Object.keys(draft.tags).sort((a, b) => a.localeCompare(b));
  const choices = Array.from(
    new Set([...(tagOptions.used ?? []), ...CATEGORY_ORDER.flatMap((c) => tagOptions.suggestions?.[c] ?? [])]),
  ).filter((c) => draft.tags[c] === undefined);

  return (
    <div data-pending={busy && !view}>
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="wallet" size={15} /></span>
          <h2>Allocations for {monthLabel}</h2>
          <span className="sub">splitting the month&rsquo;s spending money between the four buckets</span>
          <span className="spacer" />
          {view?.can_suggest ? (
            <button className="pillbtn" type="button" onClick={useSuggestions} disabled={busy}>
              <Icon name="target" size={13} /> Fill from my averages
            </button>
          ) : null}
        </div>

        {view && view.available <= 0 ? (
          <div className="notice" style={{ marginBottom: 14 }}>
            There is no spending money to split up yet — set income and fixed costs on the Ledger tab
            first. You can still set allocations; they just will not have a total to sit inside.
          </div>
        ) : null}

        <div className="alloc-summary">
          <div className="tile">
            <div className="label"><span className="tic"><Icon name="wallet" size={13} /></span>Spending money</div>
            <div className="value">{fmt.money(view?.available ?? 0)}</div>
            <div className="foot">after fixed costs and savings</div>
          </div>
          <div className="tile">
            <div className="label"><span className="tic"><Icon name="layers" size={13} /></span>Allocated</div>
            <div className="value">{fmt.money(plannedCats)}</div>
            <div className="foot">across the four buckets</div>
          </div>
          <div className="tile">
            <div className="label"><span className="tic"><Icon name="coins" size={13} /></span>Still unallocated</div>
            <div className={`value${left < 0 ? " over" : ""}`}>{fmt.money(Math.abs(left))}</div>
            <div className="foot">{left < 0 ? "over-allocated — trim something" : "free to assign"}</div>
          </div>
        </div>

        <hr className="hr" />

        <div className="allocrows">
          {(view?.categories ?? []).map((line) => {
            const planned = num(draft.categories[line.key]);
            return (
              <div className="allocrow" key={line.key} style={{ "--cat": CATEGORY_COLOR[line.key] } as React.CSSProperties}>
                <span className="al-name">
                  <span className="al-badge"><CategoryIcon category={line.key} size={16} /></span>
                  {labels[line.key]}
                </span>

                <label className="al-input">
                  <span className="sr-only">{labels[line.key]} allocation</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    placeholder="no limit"
                    value={draft.categories[line.key] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, categories: { ...draft.categories, [line.key]: e.target.value } })
                    }
                  />
                </label>

                <span className="al-track">
                  <span className="meter">
                    <span
                      className={`fill ${line.state === "over" ? "critical" : line.state === "close" ? "warning" : ""}`}
                      style={{
                        width: planned > 0 ? `${clamp01(line.spent / planned) * 100}%` : "0%",
                        display: "block",
                        height: "100%",
                      }}
                    />
                  </span>
                  <span className="al-sub">
                    {planned > 0 ? (
                      <>
                        {fmt.money(line.spent)} of {fmt.money(planned)} ·{" "}
                        {line.spent > planned
                          ? <span className="delta up">{fmt.money(line.spent - planned)} over</span>
                          : <span className="delta down">{fmt.money(planned - line.spent)} left</span>}
                        {line.pace === "ahead" ? <span className="muted"> · running hot</span> : null}
                      </>
                    ) : (
                      <span className="muted">{fmt.money(line.spent)} spent, no limit set</span>
                    )}
                  </span>
                </span>

                <span className="al-hint">
                  {line.suggested > 0 ? (
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          categories: { ...draft.categories, [line.key]: String(Math.round(line.suggested)) },
                        })
                      }
                    >
                      usually {fmt.money(line.suggested)}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="cardic"><Icon name="target" size={15} /></span>
          <h2>Limits by label</h2>
          <span className="sub">optional, and as fine-grained as you like</span>
        </div>

        {tagNames.length === 0 ? (
          <div className="emptynote">
            No labels yet. Add one below — or label a few entries on the Ledger tab and they will
            appear here automatically.
          </div>
        ) : (
          <div className="allocrows">
            {tagNames.map((name) => {
              const line = view?.tags.find((t) => t.tag === name);
              const planned = num(draft.tags[name]);
              const spent = line?.spent ?? 0;
              const category = line?.category ?? "wants";
              return (
                <div className="allocrow" key={name} style={{ "--cat": CATEGORY_COLOR[category] } as React.CSSProperties}>
                  <span className="al-name">
                    <span className="al-badge"><CategoryIcon category={category} size={16} /></span>
                    {name}
                  </span>
                  <label className="al-input">
                    <span className="sr-only">{name} limit</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      placeholder="no limit"
                      value={draft.tags[name] ?? ""}
                      onChange={(e) => setDraft({ ...draft, tags: { ...draft.tags, [name]: e.target.value } })}
                    />
                  </label>
                  <span className="al-track">
                    <span className="meter">
                      <span
                        className={`fill ${planned > 0 && spent > planned ? "critical" : ""}`}
                        style={{
                          width: planned > 0 ? `${clamp01(spent / planned) * 100}%` : "0%",
                          display: "block",
                          height: "100%",
                        }}
                      />
                    </span>
                    <span className="al-sub">
                      {planned > 0 ? (
                        <>
                          {fmt.money(spent)} of {fmt.money(planned)} ·{" "}
                          {spent > planned
                            ? <span className="delta up">{fmt.money(spent - planned)} over</span>
                            : <span className="delta down">{fmt.money(planned - spent)} left</span>}
                        </>
                      ) : (
                        <span className="muted">
                          {fmt.money(spent)} spent{line?.entries ? ` · ${line.entries}×` : ""}, no limit set
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="al-hint">
                    {line && line.suggested > 0 ? (
                      <button
                        type="button"
                        className="linkbtn"
                        onClick={() =>
                          setDraft({ ...draft, tags: { ...draft.tags, [name]: String(Math.round(line.suggested)) } })
                        }
                      >
                        usually {fmt.money(line.suggested)}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <hr className="hr" />
        <div className="row">
          <input
            className="input"
            style={{ maxWidth: 260 }}
            type="text"
            list="budget-tag-choices"
            placeholder="Add a label to budget for…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <datalist id="budget-tag-choices">
            {choices.map((choice) => (
              <option value={choice} key={choice} />
            ))}
          </datalist>
          <button className="btn ghost" type="button" onClick={addTag} disabled={!newTag.trim()}>
            <Icon name="plus" size={13} /> Add label
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="secondary" style={{ fontSize: 12.5 }}>
            {error ? (
              <span style={{ color: "var(--critical-text)" }}>Could not save: {error}</span>
            ) : saved ? (
              "Saved."
            ) : (
              "Allocations are per month, and carry nothing forward automatically — each month is planned on its own."
            )}
          </span>
          <button className="btn" type="button" onClick={() => save()} disabled={busy}>
            {busy ? "Saving…" : "Save allocations"}
          </button>
        </div>
      </div>
    </div>
  );
}
