// TASK-110 · Rate limiting
// TASK-111 · Request validation / sanitization
// TASK-112 · Security headers
// Shared security utilities for Supabase Edge Functions.

// ── Security headers ────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const SECURITY_HEADERS = {
  ...CORS_HEADERS,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function corsResponse(): Response {
  return new Response(null, { headers: SECURITY_HEADERS });
}

// ── Request validation ──────────────────────────────────────────────────────

export interface ValidationRule {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "object" | "array";
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedValues?: unknown[];
}

export type ValidationSchema = Record<string, ValidationRule>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBody(
  body: Record<string, unknown>,
  schema: ValidationSchema,
): ValidationResult {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];

    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (rule.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== rule.type) {
        errors.push(`${field} must be a ${rule.type}`);
        continue;
      }
    }

    if (typeof value === "string") {
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be at most ${rule.maxLength} characters`);
      }
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field} has an invalid format`);
      }
    }

    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push(`${field} must be one of: ${rule.allowedValues.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeString(input: string, maxLength = 5000): string {
  return (
    input
      .slice(0, maxLength)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim()
  );
}

// ── Rate limiting ───────────────────────────────────────────────────────────
// `checkRateLimit` is the synchronous, in-memory limiter (per Deno isolate) used
// today. For multi-region production it should be backed by a distributed store.
// `checkRateLimitAsync` + `setRateLimitBackend` provide that seam without
// touching existing callers: swap in a Cloudflare KV / Upstash backend at boot
// and the limit becomes global. The default backend wraps the in-memory store,
// so behavior is unchanged until a backend is explicitly set.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, max: 20 },
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + opts.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.max - 1, resetAt };
  }

  if (entry.count >= opts.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: opts.max - entry.count, resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: number): Response {
  return jsonResponse(
    { error: "Too many requests. Please try again shortly.", retry_after_ms: resetAt - Date.now() },
    429,
    { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
  );
}

// ── Pluggable backend (for distributed rate limiting) ────────────────────────
// A backend just needs to atomically "hit" a key within a window. The default
// is the in-memory store above. To go global, implement this against a shared
// KV/Redis and call setRateLimitBackend() once at startup.

export interface RateLimitBackend {
  hit(key: string, opts: RateLimitOptions): Promise<RateLimitResult>;
}

const inMemoryBackend: RateLimitBackend = {
  hit: (key, opts) => Promise.resolve(checkRateLimit(key, opts)),
};

let activeBackend: RateLimitBackend = inMemoryBackend;

export function setRateLimitBackend(backend: RateLimitBackend): void {
  activeBackend = backend;
}

export function checkRateLimitAsync(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, max: 20 },
): Promise<RateLimitResult> {
  return activeBackend.hit(key, opts);
}

// Minimal async key/value store (Cloudflare KV and Upstash Redis both satisfy
// this with thin wrappers). `getWithMeta` returns the stored counter + its TTL.
export interface RateLimitKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

// Drop-in distributed backend. Window is approximated with a per-key TTL — good
// enough for abuse protection. Wire it up at startup, e.g.:
//   setRateLimitBackend(createKvRateLimitBackend(env.RATE_LIMIT_KV));
export function createKvRateLimitBackend(kv: RateLimitKv): RateLimitBackend {
  return {
    async hit(key, opts) {
      const now = Date.now();
      const raw = await kv.get(key);
      const parsed = raw ? (JSON.parse(raw) as RateLimitEntry) : null;

      if (!parsed || now > parsed.resetAt) {
        const resetAt = now + opts.windowMs;
        await kv.put(key, JSON.stringify({ count: 1, resetAt }), Math.ceil(opts.windowMs / 1000));
        return { allowed: true, remaining: opts.max - 1, resetAt };
      }

      if (parsed.count >= opts.max) {
        return { allowed: false, remaining: 0, resetAt: parsed.resetAt };
      }

      const next = { count: parsed.count + 1, resetAt: parsed.resetAt };
      await kv.put(key, JSON.stringify(next), Math.ceil((parsed.resetAt - now) / 1000));
      return { allowed: true, remaining: opts.max - next.count, resetAt: parsed.resetAt };
    },
  };
}
