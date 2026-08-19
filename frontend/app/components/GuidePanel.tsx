import type { CategoryKey, Rules } from "~/lib/types";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "~/lib/types";

import { CategoryIcon } from "./CategoryIcon";
import { Icon, type IconName } from "./Icon";

const LOOP: { stage: string; name: string; goes: string; what: string; icon: IconName }[] = [
  {
    stage: "First",
    name: "Plan",
    goes: "ledger",
    icon: "wallet",
    what: "Set income, fixed costs and a savings goal. What survives is the month's spending money.",
  },
  {
    stage: "Daily",
    name: "Log",
    goes: "ledger",
    icon: "pencil",
    what: "Enter each spend by hand, into one of four buckets, with a note.",
  },
  {
    stage: "Anytime",
    name: "Read",
    goes: "spending",
    icon: "layers",
    what: "Watch the pace, the weeks and the categories move against last month.",
  },
  {
    stage: "Last",
    name: "Close",
    goes: "review",
    icon: "star",
    what: "Answer the four questions, write the note, carry the plan forward.",
  },
];

const ASK: Record<CategoryKey, string> = {
  needs: "Would skipping this cause a real problem?",
  wants: "Did I buy this because I wanted it, not because I needed it?",
  culture: "Does this leave me with something I did not have before?",
  unexpected: "Could I have seen this coming a month ago?",
};

const SECTION_GUIDE: { key: string; label: string; icon: IconName; what: string }[] = [
  { key: "overview", label: "Overview", icon: "chart",
    what: "What is left to spend, at what daily rate, and the written verdicts on what is running hot or improving." },
  { key: "spending", label: "Spending", icon: "layers",
    what: "The four buckets with month-over-month movement, a column per day, and the running total against an even pace." },
  { key: "trends", label: "Trends", icon: "trend",
    what: "Calendar weeks against their share of the budget, which weekday costs most, and up to twelve months of totals." },
  { key: "outlook", label: "Outlook", icon: "target",
    what: "What you may still spend per day under several ambitions, where the month lands, and costed suggestions." },
  { key: "compare", label: "Compare", icon: "calendar",
    what: "Month, quarter, half-year and year side by side — spent, saved and the movement between them, plus a breakdown by your own labels." },
  { key: "accounts", label: "Accounts", icon: "coins",
    what: "Your bank accounts and cards, what each one paid for this month, and how much the card still owes against its limit." },
  { key: "budget", label: "Budget", icon: "wallet",
    what: "Split the month's spending money between the four buckets, and set limits on individual labels. Optional, and planned fresh each month." },
  { key: "ledger", label: "Ledger", icon: "table",
    what: "Set the month up and log entries. Every row can be edited or deleted." },
  { key: "review", label: "Review", icon: "star",
    what: "The four questions kakeibo closes on, answered from your entries, plus a note you write yourself." },
];

export function GuidePanel({
  rules,
  currency,
  onNavigate,
}: {
  rules: Rules;
  currency: string;
  onNavigate: (key: string) => void;
}) {
  const meta = (key: CategoryKey) => ({
    needs: { label: "Needs", jp: "必要", what: "Groceries, transport, medicine, bills — anything you would have to buy again next month to keep going." },
    wants: { label: "Wants", jp: "欲求", what: "Eating out, clothes beyond replacement, treats, films. Pleasant, optional, and the first place to trim." },
    culture: { label: "Culture", jp: "文化", what: "Books, courses, museums, music. Self-enrichment gets its own bucket so it is not quietly cut first." },
    unexpected: { label: "Unexpected", jp: "予期せぬ", what: "Repairs, medical bills, gifts, fines. Things you could not have planned for this month." },
  })[key];

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="help" size={15} /></span>
          <h2>The month, as a loop</h2>
          <span className="sub">Kakeibo is a four-beat cycle — the app is built around it</span>
        </div>

        <div className="gloop">
          {LOOP.map((step) => (
            <button type="button" className="gstage" key={step.name} onClick={() => onNavigate(step.goes)}>
              <span className="gs-top">
                <span className="gs-ic"><Icon name={step.icon} size={14} /></span>
                <span className="gs-stage">{step.stage}</span>
              </span>
              <span className="gs-name">{step.name}</span>
              <span className="gs-what">{step.what}</span>
              <span className="gs-go">Go to {step.goes} <Icon name="right" size={11} /></span>
            </button>
          ))}
        </div>
        <p className="emptynote" style={{ paddingBottom: 0 }}>
          Then it starts again — the note you write when closing is what changes the next plan.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="layers" size={15} /></span>
          <h2>The four buckets</h2>
          <span className="sub">Sort by why you bought it, not by what it was</span>
        </div>
        <p className="secondary" style={{ fontSize: 13, marginTop: 0 }}>
          The same cup of coffee is a Need on the way to work and a Want on a Sunday afternoon. That
          distinction is the whole method — get it wrong and the app has nothing useful to tell you.
        </p>

        <div className="buckets">
          {CATEGORY_ORDER.map((key) => {
            const m = meta(key);
            return (
              <article className="bucket" key={key} style={{ "--cat": CATEGORY_COLOR[key] } as React.CSSProperties}>
                <span className="b-badge"><CategoryIcon category={key} size={18} /></span>
                <div className="b-body">
                  <h3>
                    {m.label} <span className="b-jp">{m.jp}</span>
                  </h3>
                  <p>{m.what}</p>
                  <p className="b-ask">{ASK[key]}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <span className="cardic"><Icon name="chart" size={15} /></span>
            <h2>What each section shows</h2>
          </div>
          <div className="gsections">
            {SECTION_GUIDE.map((section) => (
              <button type="button" className="gsection" key={section.key} onClick={() => onNavigate(section.key)}>
                <span className="gsec-ic"><Icon name={section.icon} size={14} /></span>
                <span className="gsec-body">
                  <span className="gsec-label">{section.label}</span>
                  <span className="gsec-what">{section.what}</span>
                </span>
                <Icon name="right" size={12} />
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="cardic"><Icon name="info" size={15} /></span>
            <h2>What the app decides on its own</h2>
            <span className="sub">the rules behind the written findings</span>
          </div>
          <dl className="grules">
            <div>
              <dt>leak</dt>
              <dd>
                The same note logged <strong>{rules.leak_min_repeats} or more times</strong>, averaging{" "}
                <strong>{rules.leak_max_share_pct}% or less</strong> of the month per occurrence. Small
                <em> and</em> frequent. A big repeat — the weekly grocery run — is listed as a recurring
                cost with no alarm attached.
              </dd>
            </div>
            <div>
              <dt>wants</dt>
              <dd>
                Flagged above <strong>{rules.wants_flag_pct}%</strong> of spending, noted approvingly at{" "}
                <strong>{rules.wants_lean_pct}%</strong> or under.
              </dd>
            </div>
            <div>
              <dt>unexpected</dt>
              <dd>
                Flagged above <strong>{rules.unexpected_flag_pct}%</strong>, with a nudge toward a
                separate buffer.
              </dd>
            </div>
            <div>
              <dt>culture</dt>
              <dd>
                Never scolded for rising, never congratulated for falling. It is the one bucket the
                method asks you to protect when you cut.
              </dd>
            </div>
            <div>
              <dt>projection</dt>
              <dd>
                Needs <strong>{rules.projection_min_days} days</strong> of entries before guessing a
                month-end total, and <strong>{rules.forecast_min_days}</strong> before Outlook calls it
                reliable.
              </dd>
            </div>
            <div>
              <dt>quiet days</dt>
              <dd>No-spend days are counted and reported once you reach <strong>{rules.quiet_days_min}</strong>.</dd>
            </div>
            <div>
              <dt>weekends</dt>
              <dd>
                Flagged when an average weekend day costs more than{" "}
                <strong>{rules.weekend_ratio_flag}&times;</strong> an average weekday.
              </dd>
            </div>
            <div>
              <dt>comparisons</dt>
              <dd>
                While a month is running, every &ldquo;versus last month&rdquo; figure compares the same
                stretch of days. A month in progress is never measured against a finished one.
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="wallet" size={15} /></span>
          <h2>Housekeeping</h2>
        </div>
        <div className="grid cols-4">
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Write notes consistently</h3>
            <p className="secondary" style={{ fontSize: 12.5, margin: 0 }}>
              The leak finder groups entries by their exact wording. Log <code>coffee</code> every time
              and twelve of them add up into a finding; log <code>Coffee</code>, <code>cafe</code> and{" "}
              <code>chai</code> for the same habit and they stay invisible.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Your data is safe to develop around</h3>
            <p className="secondary" style={{ fontSize: 12.5, margin: 0 }}>
              Everything lives in one SQLite file on your own machine — nothing leaves it and nothing
              logs in. It sits outside the container, so rebuilding and redeploying never touches it,
              schema changes arrive as migrations rather than a fresh start, and a snapshot is taken
              on every startup in case anything does go wrong.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Updating the app</h3>
            <p className="secondary" style={{ fontSize: 12.5, margin: 0 }}>
              Run <code>./run.sh</code> in the project folder. It backs your ledger up, fetches the
              latest version, rebuilds, checks every entry survived, and tidies up after itself. If
              anything is missing it puts your data straight back.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Card spending</h3>
            <p className="secondary" style={{ fontSize: 12.5, margin: 0 }}>
              A spend counts on the day you make it, not the day the bill is paid. A card purchase in
              August is August&rsquo;s spending even though the money leaves your bank in September.
              Never log the bill payment as an expense — use <em>Mark bill as paid</em> on the
              Accounts tab, which clears the debt without counting the money twice.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Correcting entries</h3>
            <p className="secondary" style={{ fontSize: 12.5, margin: 0 }}>
              Every ledger row has an edit and a delete. Dates are clamped to the month you are
              viewing, so to move an entry to another month, switch months and re-add it. Amounts are
              in {currency}.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
