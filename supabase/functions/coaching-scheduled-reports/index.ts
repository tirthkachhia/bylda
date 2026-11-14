import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { sendQueuedReportDelivery } from "../_shared/coaching/report-delivery.ts";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("COACHING_WORKER_SECRET"),
    url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supplied = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !url || !key) return json({ error: "Scheduler is not configured" }, 503);
  let difference = secret.length ^ supplied.length;
  for (let i = 0; i < secret.length; i++)
    difference |= secret.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  if (difference) return json({ error: "Unauthorized" }, 401);
  const db = createClient(url, key);
  let deliveryProcessed = false;
  try {
    deliveryProcessed = await sendQueuedReportDelivery(db);
  } catch {
    return json({ error: "Delivery queue could not be processed" }, 500);
  }
  const { data: cleanupJobs } = await db
    .from("coaching_storage_cleanup")
    .select("id,organization_id,paths")
    .order("created_at")
    .limit(1);
  for (const job of cleanupJobs ?? []) {
    const { data: org, error: orgError } = await db
      .from("organizations")
      .select("id")
      .eq("id", job.organization_id)
      .maybeSingle();
    if (orgError || org) continue;
    const paths = (job.paths as string[]).filter(
      (p) => p.startsWith(`${job.organization_id}/`) && !p.includes(".."),
    );
    let cleanupError: string | null = null;
    if (paths.length) {
      const { error } = await db.storage.from("call-audio").remove(paths.slice(0, 100));
      if (error) cleanupError = error.message;
    }
    if (cleanupError)
      await db
        .from("coaching_storage_cleanup")
        .update({ last_error: cleanupError })
        .eq("id", job.id);
    else if (paths.length > 100)
      await db
        .from("coaching_storage_cleanup")
        .update({ paths: paths.slice(100), last_error: null })
        .eq("id", job.id);
    else await db.from("coaching_storage_cleanup").delete().eq("id", job.id);
  }
  const { data: due, error } = await db.rpc("claim_due_coaching_reports");
  if (error) return json({ error: "Could not claim report schedules" }, 500);
  for (const schedule of due ?? []) {
    let reportId: string | null = null,
      lastError: string | null = null;
    try {
      const response = await fetch(`${url}/functions/v1/coaching-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rep_id: schedule.rep_id,
          days: schedule.days,
          requested_by: schedule.created_by,
          request_key: `${schedule.id}:${schedule.next_run_at}`,
        }),
        signal: AbortSignal.timeout(110000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.error ?? `Report request failed (${response.status})`);
      reportId = result.report_id;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Report failed";
    }
    // Advance only after this occurrence finishes (or records its failure). The
    // unique request key prevents duplicate reports after a worker/network retry.
    const interval = (schedule.cadence === "weekly" ? 7 : 1) * 86400000;
    let next = Date.parse(schedule.next_run_at);
    do {
      next += interval;
    } while (next <= Date.now());
    const { error: saveError } = await db
      .from("coaching_report_schedules")
      .update({
        next_run_at: lastError ? schedule.next_run_at : new Date(next).toISOString(),
        last_report_id: reportId ?? schedule.last_report_id,
        last_error: lastError,
        lease_token: null,
        lease_expires_at: null,
      })
      .eq("id", schedule.id)
      .eq("lease_token", schedule.lease_token);
    if (saveError)
      console.error("[coaching-scheduled-reports] schedule completion failed", schedule.id);
    if (reportId && schedule.created_by)
      await db.from("notifications").insert({
        user_id: schedule.created_by,
        type: "coaching_report",
        message: `Scheduled coaching report ready. Open Reports to review it.`,
      });
  }
  return json({ processed: due?.length ?? 0, delivery_processed: deliveryProcessed });
});
