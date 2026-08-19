import { useEffect, useState } from "react";

import { api } from "~/lib/api";
import type { Formatters } from "~/lib/format";
import { clamp01, todayISO } from "~/lib/format";
import type { AccountKind, AccountLine, AccountsView, TransferKind } from "~/lib/types";

import { Icon, type IconName } from "./Icon";

const KIND_ICON: Record<AccountKind, IconName> = {
  savings: "target",
  spending: "wallet",
  salary: "coins",
  credit: "layers",
};

const BLANK = {
  name: "",
  bank: "",
  kind: "spending" as AccountKind,
  credit_limit: "",
  note: "",
  archived: false,
};

export function AccountsPanel({
  month,
  monthLabel,
  fmt,
  onChanged,
}: {
  month: string;
  monthLabel: string;
  fmt: Formatters;
  onChanged: () => void;
}) {
  const [view, setView] = useState<AccountsView | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [settled, setSettled] = useState<string | null>(null);
  const [move, setMove] = useState({
    moved_on: todayISO(),
    from_account_id: "",
    to_account_id: "",
    amount: "",
    kind: "sip" as TransferKind,
    note: "",
  });

  const load = () => {
    setBusy(true);
    return api
      .accounts(month)
      .then(setView)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    let alive = true;
    api
      .accounts(month)
      .then((r) => alive && setView(r))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const startNew = () => {
    setForm({ ...BLANK });
    setEditing("new");
    setError(null);
  };

  const startEdit = (account: AccountLine) => {
    setForm({
      name: account.name,
      bank: account.bank,
      kind: account.kind,
      credit_limit: account.credit_limit ? String(account.credit_limit) : "",
      note: account.note,
      archived: Boolean(account.archived),
    });
    setEditing(account.id);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      bank: form.bank.trim(),
      kind: form.kind,
      credit_limit: form.kind === "credit" ? Number(form.credit_limit) || 0 : 0,
      note: form.note.trim(),
      archived: form.archived,
    };
    try {
      if (editing === "new") await api.createAccount(payload);
      else if (typeof editing === "number") await api.updateAccount(editing, payload);
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async (account: AccountLine) => {
    setBusy(true);
    try {
      await api.deleteAccount(account.id);
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const settle = async (account: AccountLine) => {
    setBusy(true);
    try {
      const result = await api.settleCard(account.id, { paid_on: todayISO() });
      setSettled(`Cleared ${result.settled} charge${result.settled === 1 ? "" : "s"} on ${account.name}.`);
      setTimeout(() => setSettled(null), 5000);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const addMove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.addTransfer({
        moved_on: move.moved_on,
        from_account_id: move.from_account_id ? Number(move.from_account_id) : null,
        to_account_id: move.to_account_id ? Number(move.to_account_id) : null,
        amount: Number(move.amount) || 0,
        kind: move.kind,
        note: move.note.trim(),
      });
      setMove({ ...move, amount: "", note: "" });
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const removeMove = async (id: number) => {
    setBusy(true);
    try {
      await api.deleteTransfer(id);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const named = (id: number | null) =>
    id ? (view?.accounts.find((a) => a.id === id)?.name ?? "—") : "outside";

  const live = (view?.accounts ?? []).filter((a) => !a.archived);
  const archived = (view?.accounts ?? []).filter((a) => a.archived);
  const credit = view?.credit;

  const formCard = (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <span className="cardic"><Icon name={editing === "new" ? "plus" : "pencil"} size={15} /></span>
        <h2>{editing === "new" ? "Add an account" : "Edit account"}</h2>
      </div>
      <div className="grid cols-3">
        <div className="field">
          <label htmlFor="acc-name">Name</label>
          <input id="acc-name" className="input" value={form.name} maxLength={60}
                 placeholder="Kotak Spending"
                 onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="acc-bank">Bank</label>
          <input id="acc-bank" className="input" value={form.bank} maxLength={60}
                 placeholder="Kotak Mahindra"
                 onChange={(e) => setForm({ ...form, bank: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="acc-kind">Used for</label>
          <select id="acc-kind" className="select" value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as AccountKind })}>
            {(view?.kinds ?? []).map((kind) => (
              <option value={kind.key} key={kind.key}>{kind.label}</option>
            ))}
          </select>
        </div>
        {form.kind === "credit" ? (
          <div className="field">
            <label htmlFor="acc-limit">Credit limit</label>
            <input id="acc-limit" className="input" type="number" min="0" step="1"
                   inputMode="decimal" placeholder="75000" value={form.credit_limit}
                   onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          </div>
        ) : null}
        <div className="field" style={{ gridColumn: form.kind === "credit" ? "span 2" : "span 3" }}>
          <label htmlFor="acc-note">Note</label>
          <input id="acc-note" className="input" value={form.note} maxLength={200}
                 placeholder="salary, SIP debits, card bill"
                 onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </div>
      <p className="secondary" style={{ fontSize: 12.5, marginTop: 10 }}>
        {(view?.kinds ?? []).find((k) => k.key === form.kind)?.hint}
      </p>
      {error ? <p className="editerr">{error}</p> : null}
      <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
        {typeof editing === "number" ? (
          <button className="btn ghost" type="button" onClick={() => setForm({ ...form, archived: !form.archived })}>
            {form.archived ? "Un-archive" : "Archive"}
          </button>
        ) : null}
        <button className="btn ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
        <button className="btn" type="button" onClick={save} disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : "Save account"}
        </button>
      </div>
    </div>
  );

  const card = (account: AccountLine) => {
    const isCredit = account.kind === "credit";
    const used = account.utilisation ?? 0;
    return (
      <div className="acct" key={account.id}>
        <div className="ac-head">
          <span className={`ac-ic kind-${account.kind}`}><Icon name={KIND_ICON[account.kind]} size={15} /></span>
          <span className="ac-title">
            <b>{account.name}</b>
            <span>{account.bank || account.kind_label}</span>
          </span>
          <button className="act" type="button" title="Edit account"
                  aria-label={`Edit ${account.name}`} onClick={() => startEdit(account)}>
            <Icon name="pencil" size={14} />
          </button>
        </div>

        <div className="ac-body">
          <div className="ac-stat">
            <span className="lbl">Spent in {monthLabel}</span>
            <b>{fmt.money(account.spent_this_month)}</b>
            <span className="sub">{account.entries_this_month} entries</span>
          </div>

          {!isCredit && account.has_balance ? (
            <div className="ac-stat">
              <span className="lbl">Balance</span>
              <b>{fmt.money(account.balance ?? 0)}</b>
              <span className="sub">
                {account.salary_this_month > 0
                  ? `${fmt.money(account.salary_this_month)} salary this month`
                  : account.moved_in_month > 0
                    ? `${fmt.money(account.moved_in_month)} moved in`
                    : "opening + in − out"}
              </span>
            </div>
          ) : null}

          {isCredit ? (
            <div className="ac-stat">
              <span className="lbl">Owed on the card</span>
              <b className={account.utilisation_high ? "over" : ""}>{fmt.money(account.outstanding ?? 0)}</b>
              <span className="sub">
                {account.credit_limit > 0
                  ? `${fmt.money(account.available ?? 0)} of ${fmt.money(account.credit_limit)} free`
                  : "no limit set"}
              </span>
            </div>
          ) : null}
        </div>

        {isCredit && account.credit_limit > 0 ? (
          <>
            <div className="meter">
              <div className={`fill ${used > 80 ? "critical" : used > (credit?.flag_at ?? 30) ? "warning" : ""}`}
                   style={{ width: `${clamp01(used / 100) * 100}%` }} />
            </div>
            <div className="ac-foot">
              <span>{fmt.percent(used)} of the limit used</span>
              {(account.unsettled_entries ?? 0) > 0 ? (
                <button className="linkbtn" type="button" onClick={() => settle(account)} disabled={busy}>
                  Mark bill as paid ({account.unsettled_entries})
                </button>
              ) : (
                <span className="muted">nothing outstanding</span>
              )}
            </div>
          </>
        ) : null}

        {account.note ? <p className="ac-note">{account.note}</p> : null}
      </div>
    );
  };

  return (
    <div data-pending={busy && !view}>
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="wallet" size={15} /></span>
          <h2>Accounts &amp; cards</h2>
          <span className="sub">where each entry was paid from</span>
          <span className="spacer" />
          <button className="pillbtn" type="button" onClick={startNew}>
            <Icon name="plus" size={13} /> Add account
          </button>
        </div>

        {settled ? <div className="notice" style={{ marginBottom: 14 }}>{settled}</div> : null}

        {view ? (
          <>
            <div className="tilerow" style={{ marginBottom: 16 }}>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="coins" size={13} /></span>Salary this month</div>
                <div className="value">{fmt.money(view.salary.amount)}</div>
                <div className="foot">
                  {view.salary.account_name
                    ? `lands in ${view.salary.account_name}`
                    : "set which account it lands in, on the Ledger tab"}
                </div>
              </div>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="target" size={13} /></span>Put aside this month</div>
                <div className="value">{fmt.money(view.savings.put_aside)}</div>
                <div className="foot">
                  {view.savings.sip > 0 ? `${fmt.money(view.savings.sip)} invested` : "nothing invested yet"}
                  {view.savings.into_savings > 0 ? ` · ${fmt.money(view.savings.into_savings)} to savings` : ""}
                </div>
              </div>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="check" size={13} /></span>Savings goal</div>
                <div className="value">{fmt.money(view.savings.goal)}</div>
                <div className="foot">
                  {view.savings.goal <= 0
                    ? "no goal set for this month"
                    : view.savings.met
                      ? "met — the money has actually moved"
                      : `${fmt.money(view.savings.short_by)} still to move across`}
                </div>
              </div>
            </div>
            {view.savings.goal > 0 ? (
              <div className="meter" style={{ marginBottom: 16 }}>
                <div
                  className={`fill ${view.savings.met ? "" : "warning"}`}
                  style={{ width: `${clamp01(view.savings.put_aside / view.savings.goal) * 100}%` }}
                />
              </div>
            ) : null}
            <hr className="hr" />
          </>
        ) : null}

        {credit && credit.cards > 0 ? (
          <>
            <div className="tilerow" style={{ marginBottom: 16 }}>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="layers" size={13} /></span>Credit limit</div>
                <div className="value">{fmt.money(credit.limit)}</div>
                <div className="foot">across {credit.cards} {credit.cards === 1 ? "card" : "cards"}</div>
              </div>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="warn" size={13} /></span>Owed but not paid</div>
                <div className={`value${credit.utilisation > credit.flag_at ? " over" : ""}`}>
                  {fmt.money(credit.outstanding)}
                </div>
                <div className="foot">{fmt.percent(credit.utilisation)} of the limit</div>
              </div>
              <div className="tile">
                <div className="label"><span className="tic"><Icon name="check" size={13} /></span>Still available</div>
                <div className="value">{fmt.money(credit.available)}</div>
                <div className="foot">
                  {credit.utilisation > credit.flag_at
                    ? `above the ${credit.flag_at}% mark lenders watch`
                    : `comfortably under ${credit.flag_at}%`}
                </div>
              </div>
            </div>
            <hr className="hr" />
          </>
        ) : null}

        {!view?.has_accounts ? (
          <div className="emptynote">
            No accounts yet. Add one for each place money moves through — a savings account, the
            account you spend from, the one salary lands in, and a card. Entries can then say which
            one paid.
          </div>
        ) : (
          <div className="acctgrid">{live.map(card)}</div>
        )}

        {view && view.unassigned.total > 0 && view.has_accounts ? (
          <div className="emptynote">
            {fmt.money(view.unassigned.total)} of this month&rsquo;s spending ({fmt.percent(view.unassigned.share)})
            has no account against it. Older entries were logged before accounts existed — edit any of
            them on the Ledger tab to attach one.
          </div>
        ) : null}

        {archived.length > 0 ? (
          <>
            <hr className="hr" />
            <p className="navhead" style={{ marginBottom: 8 }}>Archived</p>
            <div className="acctgrid">{archived.map(card)}</div>
          </>
        ) : null}
      </div>

      {editing !== null ? formCard : null}

      {view?.has_accounts ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <span className="cardic"><Icon name="trend" size={15} /></span>
            <h2>Money moved</h2>
            <span className="sub">SIPs and transfers between your own accounts — never spending</span>
          </div>

          <div className="movegrid">
            <div className="field">
              <label htmlFor="mv-kind">What</label>
              <select id="mv-kind" className="select" value={move.kind}
                      onChange={(e) => setMove({ ...move, kind: e.target.value as TransferKind })}>
                {(view.transfer_kinds ?? []).map((k) => (
                  <option value={k.key} key={k.key}>{k.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-date">Date</label>
              <input id="mv-date" className="input" type="date" value={move.moved_on}
                     onChange={(e) => setMove({ ...move, moved_on: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mv-from">Out of</label>
              <select id="mv-from" className="select" value={move.from_account_id}
                      onChange={(e) => setMove({ ...move, from_account_id: e.target.value })}>
                <option value="">—</option>
                {live.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-to">Into</label>
              <select id="mv-to" className="select" value={move.to_account_id}
                      onChange={(e) => setMove({ ...move, to_account_id: e.target.value })}>
                <option value="">{move.kind === "sip" ? "an investment" : "—"}</option>
                {live.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-amt">Amount</label>
              <input id="mv-amt" className="input" type="number" min="0.01" step="0.01"
                     inputMode="decimal" placeholder="0.00" value={move.amount}
                     onChange={(e) => setMove({ ...move, amount: e.target.value })} />
            </div>
            <div className="field wide">
              <label htmlFor="mv-note">Note</label>
              <input id="mv-note" className="input" type="text" maxLength={200}
                     placeholder={move.kind === "sip" ? "Nifty index fund" : "moved to savings"}
                     value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} />
            </div>
            <div className="submit">
              <button className="btn" type="button" onClick={addMove}
                      disabled={busy || !(Number(move.amount) > 0)}>
                <Icon name="plus" size={13} /> Record
              </button>
            </div>
          </div>

          <p className="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            {(view.transfer_kinds ?? []).find((k) => k.key === move.kind)?.hint}
          </p>

          <hr className="hr" />

          {view.transfers.length === 0 ? (
            <div className="emptynote">Nothing moved this month yet.</div>
          ) : (
            view.transfers.map((t) => (
              <div className="entry" key={t.id}>
                <span className="cicon" style={{ color: t.kind === "sip" ? "var(--series-3)" : "var(--series-1)" }}>
                  <Icon name={t.kind === "sip" ? "target" : "right"} size={15} />
                </span>
                <span className="note">
                  {t.note || <span className="muted">no note</span>}
                  <span className="cat">
                    {named(t.from_account_id)} → {t.to_account_id ? named(t.to_account_id) : "investment"} · {t.moved_on}
                  </span>
                </span>
                <span className="amt">{fmt.money(t.amount)}</span>
                <span className="acts">
                  <button className="act danger" type="button" title="Remove"
                          aria-label={`Remove ${t.note || "transfer"}`} onClick={() => removeMove(t.id)}>
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="cardic"><Icon name="info" size={15} /></span>
          <h2>How card spending is counted</h2>
        </div>
        <p className="secondary" style={{ fontSize: 13, margin: 0, maxWidth: "80ch" }}>
          A spend counts on <strong>the day you make it</strong>, not the day the bill is paid. Buy a
          cot on your card in August and it is August&rsquo;s spending, even though the money leaves
          your bank in September — otherwise a month&rsquo;s picture would depend on your billing
          cycle rather than on what you did.
        </p>
        <p className="secondary" style={{ fontSize: 13, marginTop: 10, marginBottom: 0, maxWidth: "80ch" }}>
          So <strong>do not log the bill payment as an expense</strong> — that would count the same
          money twice. Press <em>Mark bill as paid</em> on the card instead: it clears what is owed
          without touching any month&rsquo;s totals.
        </p>
        <p className="secondary" style={{ fontSize: 13, marginTop: 10, marginBottom: 0, maxWidth: "80ch" }}>
          A <strong>SIP is not spending either</strong>. It is your savings goal being carried out —
          money moving from one of your pockets to another. Record it under <em>Money moved</em> and it
          counts towards what you have put aside, rather than against what you have spent.
        </p>
      </div>
    </div>
  );
}
