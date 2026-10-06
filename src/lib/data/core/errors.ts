/** Thrown by a real fetcher whose backend object does not exist yet (BACKEND_BACKLOG.md). */
export class NotBuiltError extends Error {
  readonly code = "NOT_BUILT";
  constructor(readonly object: string) {
    super(`NOT_BUILT: ${object}`);
    this.name = "NotBuiltError";
  }
}

/** Thrown when a role asks for data it must never see (e.g. a rep asking for peer data). */
export class ForbiddenForRoleError extends Error {
  readonly code = "FORBIDDEN_FOR_ROLE";
  constructor(
    readonly what: string,
    readonly role: string,
  ) {
    super(`FORBIDDEN_FOR_ROLE: ${role} cannot read ${what}`);
    this.name = "ForbiddenForRoleError";
  }
}

export function isNotBuilt(e: unknown): e is NotBuiltError {
  return e instanceof NotBuiltError || (e instanceof Error && e.message.startsWith("NOT_BUILT"));
}
