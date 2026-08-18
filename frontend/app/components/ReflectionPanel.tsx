import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import type { Formatters } from "~/lib/format";
import type { ReflectionQuestion } from "~/lib/types";

interface Props {
  month: string;
  monthLabel: string;
  questions: ReflectionQuestion[];
  reflection: string;
  fmt: Formatters;
}

/** The four questions a kakeibo month closes on, answered from the ledger. */
import { Icon } from "./Icon";

export function ReflectionPanel({ month, monthLabel, questions, reflection, fmt }: Props) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const [text, setText] = useState(reflection);
  const [saved, setSaved] = useState(false);

  useEffect(() => setText(reflection), [reflection, month]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 2400);
      return () => clearTimeout(timer);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="card">
      <div className="card-head">
        <span className="cardic"><Icon name="quote" size={15} /></span>
        <h2>The four questions</h2>
        <span className="sub">{monthLabel} · answered from your entries</span>
      </div>

      {questions.map((q) => (
        <div className="qa" key={q.question}>
          <div className="q">{q.question}</div>
          {q.value !== null ? <div className="a tnum">{fmt.money(q.value)}</div> : null}
          <div className="d">{q.detail}</div>
        </div>
      ))}

      <hr className="hr" />

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-reflection" />
        <input type="hidden" name="month" value={month} />
        <div className="field">
          <label htmlFor="reflection">Your own note on {monthLabel}</label>
          <textarea
            id="reflection"
            name="reflection"
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What worked, what did not, and the one thing to change next month."
          />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" type="submit" disabled={fetcher.state !== "idle"}>
            {fetcher.state !== "idle" ? "Saving…" : "Save reflection"}
          </button>
          {saved ? <span className="muted">Saved.</span> : null}
        </div>
      </fetcher.Form>
    </div>
  );
}
