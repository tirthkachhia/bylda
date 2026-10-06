import type { Role } from "../types/session";
import { ForbiddenForRoleError } from "./errors";

/** Who is asking. Every loader receives it; rep scoping is enforced from it. */
export type DataCtx = {
  userId: string;
  orgId: string | null;
  workspaceId: string | null;
  teamId: string | null;
  role: Role;
};

export const MANAGER_ROLES: Role[] = ["owner", "admin", "manager", "coach", "viewer"];

/** Rep safety (CLAUDE.md §4): peer / comparison / team-wide data is never served to a rep. */
export function assertNotRep(ctx: DataCtx, what: string) {
  if (ctx.role === "rep") throw new ForbiddenForRoleError(what, ctx.role);
}

/** For rep-scoped reads: a rep may only ever read their own id, whatever was asked for. */
export function scopeRepId(ctx: DataCtx, requested?: string | null): string | null {
  if (ctx.role === "rep") return ctx.userId;
  return requested ?? null;
}
