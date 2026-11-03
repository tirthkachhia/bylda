import {
  requireCoachingAdmin,
  coachingCors,
  coachingJson as json,
} from "../_shared/coaching/admin-access.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: coachingCors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null),
    auth = await requireCoachingAdmin(req, body?.organization_id);
  if (!auth.ok) return auth.response;
  if (body.action === "export") {
    const output: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      organization_id: auth.orgId,
    };
    let bytes = 0;
    for (const table of [
      "calls",
      "call_transcripts",
      "call_insights",
      "coaching_analysis_runs",
      "coaching_behavior_events",
      "coaching_call_notes",
      "coaching_assignments",
      "coaching_teams",
      "coaching_policy_versions",
      "coaching_reports",
      "coaching_recorded_outcomes",
    ]) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 250) {
        const { data, error } = await auth.admin
          .from(table)
          .select("*")
          .eq("organization_id", auth.orgId)
          .order("id")
          .range(from, from + 249);
        if (error) return json({ error: `Export could not read ${table}` }, 500);
        bytes += new TextEncoder().encode(JSON.stringify(data ?? [])).length;
        if (bytes > 20000000)
          return json(
            {
              error:
                "Export is too large for one response. Export individual call histories or use the read-only API.",
            },
            413,
          );
        rows.push(...(data ?? []));
        if (!data || data.length < 250) break;
      }
      output[table] = rows;
    }
    // Secrets, credentials, private room messages and billing data are excluded.
    return json({ data: output });
  }
  if (body.action === "delete_workspace") {
    const { data: org, error } = await auth.admin
      .from("organizations")
      .select("id,name,owner_id")
      .eq("id", auth.orgId)
      .maybeSingle();
    if (error || !org || org.owner_id !== auth.user.id)
      return json({ error: "Only the workspace owner can delete it" }, 403);
    if (body.confirmation !== `DELETE ${org.name}`)
      return json({ error: "Type DELETE followed by the exact workspace name" }, 400);
    const { data: storedPaths, error: pathError } = await auth.admin.rpc(
      "coaching_workspace_audio_paths",
      { p_org: auth.orgId, p_actor: auth.user.id },
    );
    if (pathError) return json({ error: "Recording cleanup could not be prepared" }, 500);
    const paths = (storedPaths ?? []).filter(
      (p: unknown): p is string =>
        typeof p === "string" && p.startsWith(`${auth.orgId}/`) && !p.includes(".."),
    );
    const { data: cleanup, error: cleanupError } = await auth.admin
      .from("coaching_storage_cleanup")
      .insert({ organization_id: auth.orgId, paths: [...new Set(paths)] })
      .select("id")
      .single();
    if (cleanupError)
      return json(
        { error: "Recording cleanup could not be retained; workspace was not deleted" },
        500,
      );
    const { data: removed, error: deleteError } = await auth.admin
      .from("organizations")
      .delete()
      .eq("id", auth.orgId)
      .eq("owner_id", auth.user.id)
      .select("id")
      .maybeSingle();
    if (deleteError || !removed) {
      await auth.admin.from("coaching_storage_cleanup").delete().eq("id", cleanup.id);
      return json(
        { error: "Workspace could not be deleted; dependent records may require review" },
        500,
      );
    }
    return json({
      ok: true,
      audio_cleanup: "queued",
      message:
        "Workspace deleted. Private recording objects are queued for secure cleanup; external provider recordings remain with their provider.",
    });
  }
  return json({ error: "Unknown action" }, 400);
});
