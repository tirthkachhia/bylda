import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { readIntegrationSecret } from "../integration-credentials.ts";
import { checkedDeliveryUrl } from "./delivery-contract.ts";
export async function sendQueuedReportDelivery(db: SupabaseClient) {
  // A crash after claiming is ambiguous: mark stale attempts failed, never
  // automatically send a second message whose first acceptance is unknown.
  await db
    .from("coaching_report_deliveries")
    .update({
      status: "failed",
      error_message: "Delivery confirmation was interrupted; retry may duplicate a message.",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "sending")
    .lt("started_at", new Date(Date.now() - 15 * 60000).toISOString());
  const { data: jobs, error } = await db.rpc("claim_coaching_report_delivery");
  if (error) throw new Error("Delivery queue could not be claimed");
  const job = jobs?.[0];
  if (!job) return false;
  let failure: string | null = null;
  try {
    const { data: channel } = await db
      .from("coaching_delivery_channels")
      .select("*")
      .eq("id", job.channel_id)
      .eq("organization_id", job.organization_id)
      .maybeSingle();
    if (!channel?.enabled) throw new Error("Channel is disabled");
    const { data: creator } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", job.organization_id)
      .eq("user_id", channel.created_by)
      .maybeSingle();
    if (!creator || !["owner", "admin"].includes(creator.role))
      throw new Error("Channel creator no longer has admin access");
    const { data: report } = await db
      .from("coaching_reports")
      .select("id,rep_id,status")
      .eq("id", job.report_id)
      .eq("organization_id", job.organization_id)
      .maybeSingle();
    if (report?.status !== "completed") throw new Error("Report is not completed");
    const encryptionKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
    if (!encryptionKey) throw new Error("Credential storage is not configured");
    const secret = await readIntegrationSecret(
      db,
      channel.created_by,
      channel.secret_ref,
      encryptionKey,
    );
    const link = new URL(
      "/app/crm/calls",
      Deno.env.get("APP_PUBLIC_URL") ?? "https://app.usebylda.com",
    );
    link.searchParams.set("view", "report");
    link.searchParams.set("repId", report.rep_id);
    link.searchParams.set("reportId", report.id);
    const text = `A Bylda coaching report is ready. Workspace membership is required to open it. ${link}`;
    let response: Response;
    if (channel.kind === "email") {
      const key = Deno.env.get("SENDGRID_API_KEY"),
        from = Deno.env.get("SENDGRID_FROM_EMAIL");
      if (!key || !from) throw new Error("SendGrid sender is not configured");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secret)) throw new Error("Invalid destination email");
      response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: secret }] }],
          from: { email: from },
          subject: "Bylda coaching report ready",
          content: [{ type: "text/plain", value: text }],
        }),
        signal: AbortSignal.timeout(10000),
      });
    } else {
      const url = checkedDeliveryUrl(
        channel.kind,
        secret,
        (Deno.env.get("COACHING_WEBHOOK_ALLOWED_HOSTS") ?? "")
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean),
      );
      const payload =
        channel.kind === "teams"
          ? {
              type: "message",
              attachments: [
                {
                  contentType: "application/vnd.microsoft.card.adaptive",
                  content: {
                    type: "AdaptiveCard",
                    version: "1.4",
                    body: [{ type: "TextBlock", text, wrap: true }],
                  },
                },
              ],
            }
          : channel.kind === "slack"
            ? { text, unfurl_links: false, unfurl_media: false }
            : {
                event: "coaching_report.ready",
                organization_id: job.organization_id,
                report_id: report.id,
                url: link.toString(),
              };
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    }
    if (!response.ok) throw new Error(`Provider did not accept delivery (${response.status})`);
  } catch (e) {
    failure = e instanceof Error ? e.message : "Delivery could not be confirmed";
  }
  const { error: saveError } = await db
    .from("coaching_report_deliveries")
    .update({
      status: failure ? "failed" : "accepted",
      error_message: failure,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "sending");
  if (saveError) throw new Error("Delivery acceptance could not be retained");
  return true;
}
