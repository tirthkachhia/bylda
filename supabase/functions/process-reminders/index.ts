// process-reminders — cron worker. Finds upcoming appointments (next 24h) that
// haven't had a reminder sent, delivers an email + SMS reminder to the contact
// via send-email / send-sms, and marks reminder_sent. Internal/service only.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (token !== serviceKey) return json({ error: "Forbidden" }, 403);

  const admin = createClient(url, serviceKey);

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: events } = await admin
    .from("calendar_events")
    .select(
      "id, organization_id, contact_id, title, start_time, meeting_link, reminder_sent, status",
    )
    .eq("reminder_sent", false)
    .in("status", ["scheduled", "confirmed"])
    .gte("start_time", now.toISOString())
    .lte("start_time", horizon.toISOString())
    .limit(100);

  let sent = 0;
  for (const ev of events ?? []) {
    if (!ev.contact_id) {
      await admin.from("calendar_events").update({ reminder_sent: true }).eq("id", ev.id);
      continue;
    }
    const when = new Date(ev.start_time as string).toLocaleString();
    const body = `Reminder: "${ev.title}" is scheduled for ${when}.${ev.meeting_link ? ` Join: ${ev.meeting_link}` : ""}`;

    const deliver = async (fn: string, payload: Record<string, unknown>) => {
      try {
        await fetch(`${url}/functions/v1/${fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            internal: true,
            org_id: ev.organization_id,
            contact_id: ev.contact_id,
            ...payload,
          }),
        });
      } catch {
        /* non-fatal */
      }
    };
    await deliver("send-email", { subject: `Reminder: ${ev.title}`, body });
    await deliver("send-sms", { body });

    await admin.from("calendar_events").update({ reminder_sent: true }).eq("id", ev.id);
    sent++;
  }

  return json({ processed: (events ?? []).length, reminded: sent });
});
