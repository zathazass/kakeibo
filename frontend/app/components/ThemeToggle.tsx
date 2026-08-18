import { useEffect, useState } from "react";

import { Icon } from "./Icon";

type Mode = "light" | "dark";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("kakeibo-theme");
    if (stored === "light" || stored === "dark") {
      setMode(stored);
    } else {
      setMode(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("kakeibo-theme", next);
    } catch {
      /* private mode — the choice just will not persist */
    }
  };

  return (
    <button
      className="iconbtn"
      type="button"
      onClick={toggle}
      title={mode === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon name={mode === "dark" ? "sun" : "moon"} size={15} />
    </button>
  );
}
