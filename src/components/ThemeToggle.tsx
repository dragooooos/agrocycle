import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_EVENT = "farmrotate-themechange";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({
  className = "theme-toggle",
  showLabel = false,
}: ThemeToggleProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("farmrotate-theme");

    if (stored === "dark") {
      document.documentElement.dataset.theme = "dark";
    }
    setDark(document.documentElement.dataset.theme === "dark");

    const sync = () =>
      setDark(document.documentElement.dataset.theme === "dark");
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !dark;

    document.documentElement.dataset.theme = next ? "dark" : "light";

    localStorage.setItem(
      "farmrotate-theme",
      next ? "dark" : "light",
    );

    setDark(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const label = dark ? "Light mode" : "Dark mode";
  const shortLabel = dark ? "Light" : "Dark";

  return (
    <button
      className={className}
      onClick={toggle}
      aria-label="Toggle theme"
      title={label}
    >
      {showLabel ? (
        <>
          <span className="side-nav-icon">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </span>
          <span className="side-nav-label">{shortLabel}</span>
        </>
      ) : dark ? (
        <Sun size={17} />
      ) : (
        <Moon size={17} />
      )}
    </button>
  );
}
