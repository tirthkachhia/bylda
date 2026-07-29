// TASK-051 · Session restore — persists and retrieves the user's last meaningful app path.

const STORAGE_KEY = "bylda:last-app-path";

const EXCLUDED_PREFIXES = ["/onboarding", "/auth"];

export function saveLastAppPath(path: string): void {
  if (!path.startsWith("/app/")) return;
  if (EXCLUDED_PREFIXES.some((p) => path.startsWith(p))) return;
  try {
    localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }
}

export function getLastAppPath(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearLastAppPath(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }
}
