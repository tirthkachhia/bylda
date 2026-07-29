import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "bylda-theme";

function systemPref(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // :root is light by default; add .dark for dark mode only
  root.classList.remove("dark", "light");
  if (t === "dark") root.classList.add("dark");
  root.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Bylda is a sky-first product — bright daytime sky is the default surface.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Initial sync from localStorage (client only)
  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") initial = stored;
    } catch {
      /* ignore */
    }
    setThemeState(initial);
    const resolved = initial === "system" ? systemPref() : initial;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Listen to system changes when in "system" mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = mql.matches ? "dark" : "light";
      setResolvedTheme(r);
      applyTheme(r);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    const resolved = t === "system" ? systemPref() : t;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
