import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("farmrotate-theme");

    if (stored === "dark") {
      document.documentElement.dataset.theme = "dark";
      setDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !dark;

    document.documentElement.dataset.theme = next ? "dark" : "light";

    localStorage.setItem(
      "farmrotate-theme",
      next ? "dark" : "light",
    );

    setDark(next);
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}