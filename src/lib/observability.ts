// Error tracking — Sentry, gated entirely behind VITE_SENTRY_DSN.
// When the DSN is unset (local dev, CI, or any env without it) this is a no-op:
// nothing initializes and captureException silently does nothing. Browser-only.

import * as Sentry from "@sentry/react";

let initialized = false;

export function initObservability() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureError(error: unknown) {
  if (initialized) Sentry.captureException(error);
}

export { Sentry };
