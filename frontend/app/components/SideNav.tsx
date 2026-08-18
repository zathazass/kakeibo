import { useEffect, useState } from "react";

import { Icon, type IconName } from "./Icon";

export interface NavSection {
  key: string;
  label: string;
  icon: IconName;
  hint: string;
  count?: number;
}

type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem("kakeibo-theme");
    else localStorage.setItem("kakeibo-theme", theme);
  } catch {
    /* private mode — the choice just will not persist */
  }
}

/** Always-on section nav. No dropdown: every section is one click away. */
export function SideNav({
  sections,
  active,
  onSelect,
}: {
  sections: NavSection[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("kakeibo-theme");
      setTheme(stored === "light" || stored === "dark" ? stored : "system");
    } catch {
      setTheme("system");
    }
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <nav className="sidenav" aria-label="Sections">
      <div className="navlist" role="tablist" aria-orientation="vertical">
        {sections.map((section) => {
          const on = section.key === active;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={on}
              title={section.hint}
              className={`navitem${on ? " is-on" : ""}`}
              onClick={() => onSelect(section.key)}
            >
              <span className="ic">
                <Icon name={section.icon} size={15} />
              </span>
              <span className="lbl">{section.label}</span>
              {section.count !== undefined && section.count > 0 ? (
                <span className="count">{section.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="navfoot">
        <p className="navhead">Theme</p>
        <div className="segmented" role="group" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              aria-pressed={theme === option.value}
              className={theme === option.value ? "is-on" : ""}
            >
              {option.label}
            </button>
          ))}
        </div>

        <a className="navlink" href="/docs" target="_blank" rel="noreferrer">
          API docs &amp; raw data
          <Icon name="external" size={12} />
        </a>
      </div>
    </nav>
  );
}
