import type { Insight } from "~/lib/types";

import { Icon, type IconName } from "./Icon";

const GROUPS: { key: Insight["group"][]; title: string; blank: string; icon: IconName }[] = [
  {
    icon: "up",
    key: ["overspent"],
    title: "Where it went over",
    blank: "Nothing is running ahead of budget this month.",
  },
  {
    icon: "down",
    key: ["reduced"],
    title: "Where you pulled back",
    blank: "No savings against last month to report yet.",
  },
  {
    icon: "leak",
    key: ["pattern", "leak", "pace"],
    title: "Patterns and leaks",
    blank: "Log a few more entries and the patterns start showing up here.",
  },
];

export function InsightsPanel({
  insights,
  stacked = false,
}: {
  insights: Insight[];
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "stack" : "grid cols-3"}>
      {GROUPS.map((group) => {
        const rows = insights
          .filter((item) => group.key.includes(item.group))
          .sort((a, b) => a.rank - b.rank);

        return (
          <div className="card" key={group.title}>
            <div className="card-head">
              <span className="cardic"><Icon name={group.icon} size={15} /></span>
              <h2>{group.title}</h2>
              {rows.length ? <span className="sub">{rows.length}</span> : null}
            </div>
            {rows.length === 0 ? (
              <div className="emptynote">{group.blank}</div>
            ) : (
              rows.map((item, index) => (
                <div className="insight" data-tone={item.tone} key={`${item.title}-${index}`}>
                  {/* icon + label, never colour alone */}
                  <span className="ic">
                    <Icon name={item.icon as IconName} size={14} />
                  </span>
                  <div>
                    <div className="title">{item.title}</div>
                    <div className="detail">{item.detail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
