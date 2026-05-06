import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "alwakeelo-theme-v1";

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "dark"; // existing users default to current dark theme until they toggle
}

function systemPref(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: ThemeMode): ResolvedTheme {
  return theme === "system" ? systemPref() : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readStoredTheme()));

  // Apply theme to <html> via .dark class + data-theme attribute
  useEffect(() => {
    const root = document.documentElement;
    const r = resolve(theme);
    setResolvedTheme(r);
    if (r === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    root.setAttribute("data-theme", r);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Re-resolve when system preference changes (only if user is on "system")
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);
  const toggle = useCallback(() => {
    setThemeState((cur) => (resolve(cur) === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
