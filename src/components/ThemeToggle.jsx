import { useEffect, useState } from "react";

// "system" follows the OS setting; "light" / "dark" override it.
// index.html applies the saved choice before first paint to avoid a flash.
const KEY = "vinylpuffin.theme";
const ORDER = ["system", "light", "dark"];
const LABELS = { system: "Auto", light: "Light", dark: "Dark" };

function readTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return ORDER.includes(t) ? t : "system";
  } catch {
    return "system";
  }
}

const icons = {
  system: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  dark: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
};

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* preference just won't persist */
    }
  }, [theme]);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => setTheme(next)}
      title={`Theme: ${LABELS[theme]} (switch to ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[next]}.`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {icons[theme]}
      </svg>
      <span>{LABELS[theme]}</span>
    </button>
  );
}
