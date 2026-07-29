/**
 * invokeEdge — the single gateway for calling Supabase edge functions from the client.
 *
 * Every call gets: auth header, request timeout (AbortController), resp.ok checking,
 * typed errors (status + code), and one automatic retry on network/5xx failures.
 * Use invokeEdge for JSON request/response functions and invokeEdgeStream for SSE
 * streaming functions (timeout covers time-to-headers only, never an active stream).
 */

import { supabase } from "@/integrations/supabase/client";

export class EdgeError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EdgeError";
    this.status = status;
    this.code = code;
  }

  /** True for auth/plan/quota errors where retrying is pointless. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export interface InvokeEdgeOptions {
  /** Abort the request after this many ms. Default 60s (AI calls are slow). */
  timeoutMs?: number;
  /** Retries on network errors / 5xx. Default 1. Never retries 4xx. */
  retries?: number;
  /** Skip attaching the user session token (functions with verify_jwt=false). */
  skipAuth?: boolean;
  /** External AbortSignal (e.g. component unmount) merged with the timeout. */
  signal?: AbortSignal;
}

function edgeUrl(fn: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
}

async function authHeaders(skipAuth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!skipAuth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new EdgeError("Not authenticated", 401, "NO_SESSION");
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

function mergeSignals(
  timeoutMs: number,
  external?: AbortSignal,
): { controller: AbortController; clearTimer: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("TIMEOUT")), timeoutMs);
  const clearTimer = () => clearTimeout(timer);
  controller.signal.addEventListener("abort", clearTimer, { once: true });
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else
      external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
  }
  return { controller, clearTimer };
}

async function toEdgeError(resp: Response): Promise<EdgeError> {
  const body = (await resp.json().catch(() => ({}))) as { error?: string; code?: string };
  const fallback =
    resp.status === 429
      ? "Rate limit reached. Try again in a moment."
      : resp.status === 402
        ? "Usage limit reached. Check your plan in Billing."
        : `Request failed (HTTP ${resp.status}). Please try again.`;
  return new EdgeError(body.error || fallback, resp.status, body.code);
}

async function fetchWithRetry(
  fn: string,
  body: unknown,
  opts: InvokeEdgeOptions,
): Promise<Response> {
  const { timeoutMs = 60_000, retries = 1, skipAuth = false, signal } = opts;
  const headers = await authHeaders(skipAuth);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { controller, clearTimer } = mergeSignals(timeoutMs, signal);
    try {
      const resp = await fetch(edgeUrl(fn), {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      // Headers arrived — stop the timeout so it never aborts an active stream.
      clearTimer();
      if (resp.ok) return resp;
      const err = await toEdgeError(resp);
      if (err.isClientError || attempt === retries) throw err;
      lastError = err;
    } catch (e) {
      // Caller-initiated aborts and 4xx must never be retried.
      if (signal?.aborted) throw e;
      if (e instanceof EdgeError && e.isClientError) throw e;
      if (attempt === retries) {
        if (e instanceof EdgeError) throw e;
        const timedOut = e instanceof Error && /TIMEOUT|abort/i.test(String(e.message ?? e));
        throw new EdgeError(
          timedOut
            ? "The request timed out. Please try again."
            : "Network error — check your connection and try again.",
          0,
          timedOut ? "TIMEOUT" : "NETWORK",
        );
      }
      lastError = e;
    }
    // brief backoff before the retry
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new EdgeError("Request failed", 0);
}

/**
 * Call a JSON edge function. Resolves with the parsed body; throws EdgeError
 * on HTTP errors, timeouts, network failures, or `{ error }` payloads.
 *
 * The body read is bounded too: fetchWithRetry's timer only guards
 * time-to-headers, so without this a function that sends headers and then
 * stalls would hang the caller forever (the "Generating with AI…" freeze).
 */
export async function invokeEdge<T = Record<string, unknown>>(
  fn: string,
  body?: unknown,
  opts: InvokeEdgeOptions = {},
): Promise<T> {
  const resp = await fetchWithRetry(fn, body, opts);
  const bodyTimeoutMs = opts.timeoutMs ?? 60_000;
  const data = (await Promise.race([
    resp.json().catch(() => null),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new EdgeError("The server stopped responding. Please try again.", 0, "BODY_TIMEOUT"),
          ),
        bodyTimeoutMs,
      ),
    ),
  ])) as (T & { error?: string }) | null;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new EdgeError(String(data.error), resp.status, (data as { code?: string }).code);
  }
  if (data === null) throw new EdgeError("Empty response from server", resp.status);
  return data as T;
}

/**
 * Call a streaming (SSE) edge function. Resolves with the raw Response once
 * headers arrive and resp.ok is verified; the caller owns reading the stream.
 * The timeout only guards time-to-first-byte — pass `signal` to cancel mid-stream.
 */
export async function invokeEdgeStream(
  fn: string,
  body: unknown,
  opts: InvokeEdgeOptions = {},
): Promise<Response> {
  // Streams should not auto-retry by default: a retried stream duplicates output.
  return fetchWithRetry(fn, body, { retries: 0, ...opts });
}
