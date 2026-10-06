/** Shared A1–A5 form helpers (kept out of AuthLayout.tsx for fast refresh). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
}
