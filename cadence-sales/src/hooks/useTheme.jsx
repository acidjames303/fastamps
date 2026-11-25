import { useState, useEffect, useCallback } from "react";
import { resolvedTheme, readPref, writePref } from "@/lib/themeAuto";

export function useTheme() {
  const [theme, setTheme] = useState(() => (typeof window === "undefined" ? "dark" : resolvedTheme()));
  const [pref, setPref] = useState(() => readPref());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writePref(next);
      setPref(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, pref };
}