// Custom 3-color theme palette — "Make it yours".
// The user picks Base (background), Secondary (buttons & highlights), and
// Text. Every other token is derived with color-mix so the whole app follows,
// in both light and dark mode. Stored in localStorage; applied as inline
// custom properties on <html>, which override the .light/.dark class tokens.

export interface ByldaPalette {
  base: string;
  secondary: string;
  text: string;
}

const STORAGE_KEY = "bylda-palette";

export const BASE_PRESETS = ["#ffffff", "#f7f5f0", "#0f172a", "#111111"];
export const SECONDARY_PRESETS = ["#7c3aed", "#2563eb", "#059669", "#ea580c", "#db2777"];
export const TEXT_PRESETS = ["#111827", "#334155", "#e5e7eb", "#f8fafc"];

/** Tokens derived from the 3 picked colors. */
function derivedTokens(p: ByldaPalette): Record<string, string> {
  const mix = (a: string, pct: number, b: string) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;
  return {
    "--background": p.base,
    "--bg-panel": mix(p.text, 2, p.base),
    "--bg-elevated": mix(p.text, 4, p.base),
    "--surface": mix(p.text, 4, p.base),
    "--surface-2": mix(p.text, 8, p.base),
    "--surface-offset": mix(p.text, 6, p.base),
    "--surface-secondary": mix(p.text, 4, p.base),
    "--surface-tertiary": mix(p.text, 10, p.base),
    "--popover": mix(p.text, 4, p.base),

    "--foreground": p.text,
    "--muted-foreground": mix(p.text, 62, p.base),
    "--text-faint": mix(p.text, 32, p.base),

    "--border": mix(p.text, 16, p.base),
    "--border-subtle": mix(p.text, 9, p.base),
    "--divider": mix(p.text, 8, p.base),
    "--input": mix(p.text, 16, p.base),

    "--primary": p.secondary,
    "--primary-hover": mix("black", 12, p.secondary),
    "--primary-active": mix("black", 20, p.secondary),
    "--primary-soft": mix(p.secondary, 10, p.base),
    "--primary-border": mix(p.secondary, 35, p.base),
    "--primary-glow": mix(p.secondary, 32, "transparent"),
    "--accent": p.secondary,
    "--ring": p.secondary,
    "--border-strong": mix(p.secondary, 40, p.base),

    "--sidebar": p.base,
    "--sidebar-foreground": p.text,
    "--sidebar-primary": p.secondary,
    "--sidebar-accent": mix(p.secondary, 10, p.base),
    "--sidebar-border": mix(p.text, 16, p.base),
    "--sidebar-ring": p.secondary,
  };
}

const APPLIED = Object.keys(derivedTokens({ base: "#fff", secondary: "#fff", text: "#fff" }));

export function applyPalette(p: ByldaPalette): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(derivedTokens(p))) root.style.setProperty(k, v);
}

export function clearPalette(): void {
  const root = document.documentElement;
  for (const k of APPLIED) root.style.removeProperty(k);
  localStorage.removeItem(STORAGE_KEY);
}

export function savePalette(p: ByldaPalette): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function loadPalette(): ByldaPalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ByldaPalette;
    if (
      typeof p?.base === "string" &&
      typeof p?.secondary === "string" &&
      typeof p?.text === "string"
    ) {
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

/** Apply the saved palette on app start (no-op when none saved). */
export function applyStoredPalette(): void {
  const p = loadPalette();
  if (p) applyPalette(p);
}

/* ── Readability check (WCAG contrast between Text and Base) ── */

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  try {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  } catch {
    return 21;
  }
}

export function isReadable(p: ByldaPalette): boolean {
  return contrastRatio(p.text, p.base) >= 4.5;
}
