// Structured logging for edge functions. One JSON line per event, always
// carrying fn + requestId (+ orgId/userId when known) so production incidents
// can be traced across a request instead of grepping loose strings.

export interface LogContext {
  fn: string;
  requestId: string;
  orgId?: string;
  userId?: string;
}

export function makeLog(fn: string, extra: Partial<LogContext> = {}) {
  const ctx: LogContext = { fn, requestId: crypto.randomUUID(), ...extra };

  const emit = (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) => {
    const line = JSON.stringify({
      level,
      msg,
      ...ctx,
      ...(data ?? {}),
      ts: new Date().toISOString(),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    ctx,
    bind(extra2: Partial<LogContext>) {
      Object.assign(ctx, extra2);
    },
    info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  };
}
