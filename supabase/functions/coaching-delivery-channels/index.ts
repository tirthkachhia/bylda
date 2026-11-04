import {
  requireCoachingAdmin,
  coachingCors,
  coachingJson as json,
} from "../_shared/coaching/admin-access.ts";
import { checkedDeliveryUrl } from "../_shared/coaching/delivery-contract.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: coachingCors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null),
    auth = await requireCoachingAdmin(req, body?.organization_id);
  if (!auth.ok) return auth.response;
  if (body.action === "retry" && typeof body.id === "string") {
    const { data, error } = await auth.admin
      .from("coaching_report_deliveries")
      .update({ status: "queued", error_message: null, completed_at: null, started_at: null })
      .eq("id", body.id)
      .eq("organization_id", auth.orgId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    return error || !data
      ? json({ error: "Delivery could not be retried" }, 400)
      : json({ ok: true });
  }
  if (body.action === "toggle" && typeof body.id === "string") {
    const { data, error } = await auth.admin
      .from("coaching_delivery_channels")
      .update({ enabled: body.enabled === true })
      .eq("id", body.id)
      .eq("organization_id", auth.orgId)
      .select("id")
      .maybeSingle();
    return error || !data
      ? json({ error: "Channel could not be changed" }, 400)
      : json({ ok: true });
  }
  if (body.action !== "save") return json({ error: "Unknown action" }, 400);
  const kind = String(body.kind ?? ""),
    value = String(body.value ?? "").trim(),
    label = String(body.label ?? "").trim();
  if (
    !["slack", "teams", "email", "webhook"].includes(kind) ||
    !label ||
    label.length > 150 ||
    value.length > 4000
  )
    return json({ error: "Provide a supported channel, label and destination" }, 400);
  try {
    if (kind === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        throw new Error("Enter a destination email address");
      if (!Deno.env.get("SENDGRID_API_KEY") || !Deno.env.get("SENDGRID_FROM_EMAIL"))
        throw new Error("SendGrid sender must be configured on the server first");
    } else
      checkedDeliveryUrl(
        kind,
        value,
        (Deno.env.get("COACHING_WEBHOOK_ALLOWED_HOSTS") ?? "")
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean),
      );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Invalid destination" }, 400);
  }
  const encryptionKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encryptionKey || encryptionKey.length < 16)
    return json({ error: "Encrypted integration storage is not configured" }, 503);
  const reference = `coaching_dl_${crypto.randomUUID()}`;
  const { error: secretError } = await auth.admin.rpc("set_user_integration", {
    _user_id: auth.user.id,
    _integration_key: reference,
    _value: value,
    _encryption_key: encryptionKey,
  });
  if (secretError) return json({ error: "Destination could not be encrypted" }, 500);
  const { error } = await auth.admin.from("coaching_delivery_channels").insert({
    organization_id: auth.orgId,
    kind,
    label,
    secret_ref: reference,
    created_by: auth.user.id,
  });
  if (error) return json({ error: "Channel could not be saved" }, 500);
  return json({ ok: true });
});
