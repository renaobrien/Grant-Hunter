"use client";

// Sun/moon toggle in the nav. Defaults to light; dark is opt-in and persists in
// localStorage, applied pre-paint by the inline script in app/layout.tsx
// (data-theme on <html>). The OS setting is intentionally ignored.
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function effectiveTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  // No stored choice = light, matching the CSS default.
  return "light";
}

export default function ThemeToggle() {
  // null until mounted so the server render carries no theme assumption.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(effectiveTheme());
  }, []);

  function toggle() {
    const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode etc. - the toggle still works for this page view.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
