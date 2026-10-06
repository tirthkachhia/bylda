/** Where a signed-in user lands when the sign-in URL carries no (valid) `?redirect=`. */
export const DEFAULT_APP_REDIRECT = "/app";

const ORIGIN = "http://sign-in.invalid";
const MAX_LENGTH = 2048;

// Control characters and backslashes: browsers read `\` as `/`, so `/\evil.com` is `//evil.com`.
function hasUnsafeChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || ch === "\\") return true;
  }
  return false;
}

/**
 * Validates the `?redirect=` handed to /auth/sign-in. Only a same-origin path inside /app is
 * honored; anything else — absolute URLs, `//host`, `/\host`, other paths, traversal out of
 * /app — falls back to `/app`, so sign-in can't be turned into an open redirect.
 *
 * Returns path + search + hash, normalized by the URL parser.
 */
export function safeAppRedirect(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) {
    return DEFAULT_APP_REDIRECT;
  }
  if (hasUnsafeChar(raw) || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_APP_REDIRECT;
  }
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return DEFAULT_APP_REDIRECT;
  }
  // Resolved, so `/app/../x` and `/app/%2e%2e/x` are judged by where they actually point.
  const inApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
  if (url.origin !== ORIGIN || !inApp) return DEFAULT_APP_REDIRECT;
  return `${url.pathname}${url.search}${url.hash}`;
}
