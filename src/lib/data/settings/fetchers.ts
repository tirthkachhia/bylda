import { auditLogQuery, profileQuery } from "@/lib/queries";
import { invokeEdge } from "@/lib/invokeEdge";
import { NotBuiltError } from "../core/errors";
import type { SettingsRow } from "./map";

const run = async <T>(q: { queryKey: readonly unknown[]; queryFn?: unknown }): Promise<T> =>
  (q.queryFn as (ctx: unknown) => Promise<T>)({
    queryKey: q.queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  });

/** REAL — existing wrappers (src/lib/queries.ts). */
export const fetchProfile = (userId: string) =>
  run<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }>(
    profileQuery(userId),
  );
export const fetchAudit = () =>
  run<{ id: string; email: string | null; event_type: string; created_at: string }[]>(
    auditLogQuery(50),
  );

/** REAL — invite a member (team-invite edge fn). */
export const inviteMember = (email: string, role: string) =>
  invokeEdge("team-invite", { email, role });

/** C-26 · workspace_settings (analysis prefs, retention, notification prefs, api keys) */
export async function fetchWorkspaceSettingsRow(): Promise<SettingsRow> {
  throw new NotBuiltError("workspace_settings");
}
