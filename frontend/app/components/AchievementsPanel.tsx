import { clamp01 } from "~/lib/format";
import type { Rewards } from "~/lib/types";

import { Icon, type IconName } from "./Icon";

export function AchievementsPanel({ rewards }: { rewards: Rewards }) {
  const done = rewards.earned_count;
  const total = rewards.total;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="star" size={15} /></span>
          <h2>Moments</h2>
          <span className="sub">
            {done} of {total} found — the rest turn up when they turn up
          </span>
        </div>

        <div className="hero" style={{ alignItems: "center" }}>
          <div className="figure">
            <div className="label">Unlocked</div>
            <div className="value">
              {done}
              <span style={{ fontSize: 22, color: "var(--text-muted)" }}> / {total}</span>
            </div>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 240 }}>
            <div className="meter">
              <div className="fill" style={{ width: `${clamp01(done / total) * 100}%` }} />
            </div>
            <p className="secondary" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
              These reward keeping the ledger honest — turning up, labelling, closing a month,
              keeping a promise you made to yourself. None of them reward spending less, because a
              badge for a small month would only tempt you to leave entries out.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="check" size={15} /></span>
          <h2>Found</h2>
        </div>
        {rewards.earned.length === 0 ? (
          <div className="emptynote">Nothing yet. Log an entry and see what happens.</div>
        ) : (
          <div className="badges">
            {rewards.earned.map((item) => (
              <div className={`badge-card tier-${item.tier}`} key={item.key}>
                <span className="bc-icon">
                  <Icon name={item.icon as IconName} size={17} />
                </span>
                <span className="bc-body">
                  <strong>{item.title}</strong>
                  <span className="bc-flavour">{item.flavour}</span>
                  {item.earned_on ? <span className="bc-when">{item.earned_on}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="cardic"><Icon name="help" size={15} /></span>
          <h2>Still hidden</h2>
          <span className="sub">{rewards.locked.length} left — you get the clue, not the prize</span>
        </div>
        {rewards.locked.length === 0 ? (
          <div className="emptynote">You have found every one. Genuinely well done.</div>
        ) : (
          <div className="badges">
            {rewards.locked.map((item) => (
              <div className="badge-card is-locked" key={item.key}>
                <span className="bc-icon">
                  <Icon name="help" size={17} />
                </span>
                <span className="bc-body">
                  <strong>? ? ?</strong>
                  <span className="bc-flavour">{item.hint}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
