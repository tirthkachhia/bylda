import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { loadConnectedOAuth } from "../_shared/integration-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type WritebackField = {
  key?: string;
  label?: string;
  value?: string;
  confidence?: number;
  evidence_quote?: string;
  crm_target?: string;
  eligible?: boolean;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function numericValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as { insight_id?: string };
  if (!body.insight_id) return json({ error: "insight_id is required" }, 400);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: insight } = await admin
    .from("call_insights")
    .select(
      "id,call_id,organization_id,summary,crm_writeback_preview,writeback_status,vertical_insights",
    )
    .eq("id", body.insight_id)
    .maybeSingle();
  if (!insight) return json({ error: "Call insight not found" }, 404);
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", insight.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return json({ error: "Forbidden" }, 403);
  if (insight.writeback_status === "written") {
    return json({ ok: true, already_written: true });
  }

  const fields = (
    Array.isArray(insight.crm_writeback_preview) ? insight.crm_writeback_preview : []
  ) as WritebackField[];
  const eligible = fields.filter(
    (field) => field.eligible && field.crm_target && field.value?.trim(),
  );
  if (!eligible.length) return json({ error: "No approved CRM fields are eligible" }, 400);

  const { data: call } = await admin
    .from("calls")
    .select("id,lead_id,contact_id,provider,provider_call_id,started_at")
    .eq("id", insight.call_id)
    .eq("organization_id", insight.organization_id)
    .maybeSingle();
  if (!call) return json({ error: "Call not found" }, 404);

  const [{ data: lead }, { data: contact }] = await Promise.all([
    call.lead_id
      ? admin
          .from("leads")
          .select("id,name,stage,value,custom_fields,external_source,external_id,external_data")
          .eq("id", call.lead_id)
          .eq("organization_id", insight.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    call.contact_id
      ? admin
          .from("contacts")
          .select("id,first_name,last_name,custom_fields,external_source,external_id")
          .eq("id", call.contact_id)
          .eq("org_id", insight.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const externalContactId =
    contact?.external_source === "gohighlevel" ? String(contact.external_id ?? "") : "";
  const externalOpportunityId =
    lead?.external_source === "gohighlevel" ? String(lead.external_id ?? "") : "";
  if (!externalContactId && !externalOpportunityId) {
    return json({ error: "This call is not linked to a GoHighLevel contact or opportunity" }, 400);
  }

  await admin
    .from("call_insights")
    .update({
      writeback_status: "writing",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", insight.id);

  try {
    const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
    if (!encKey) throw new Error("Integration storage is not configured");
    const oauth = await loadConnectedOAuth(admin, user.id, "gohighlevel", encKey);
    const token = oauth.accessToken;
    const locationId = oauth.locationId;
    if (!token || !locationId) throw new Error("Connect GoHighLevel before approving write-back");
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Version: "v3",
    };

    const leadCustomFields = object(lead?.custom_fields);
    const contactCustomFields = object(contact?.custom_fields);
    let nextStage: string | null = null;
    let nextValue: number | null = null;
    for (const field of eligible) {
      const target = String(field.crm_target);
      if (target === "lead.stage") nextStage = String(field.value);
      else if (target === "lead.value") nextValue = numericValue(field.value);
      else if (target.startsWith("lead.custom_fields.")) {
        leadCustomFields[target.slice("lead.custom_fields.".length)] = field.value;
      } else if (target.startsWith("contact.custom_fields.")) {
        contactCustomFields[target.slice("contact.custom_fields.".length)] = field.value;
      }
    }

    if (lead) {
      const leadUpdate: Record<string, unknown> = {
        custom_fields: leadCustomFields,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (nextStage) leadUpdate.stage = nextStage;
      if (nextValue !== null) leadUpdate.value = nextValue;
      const { error } = await admin
        .from("leads")
        .update(leadUpdate)
        .eq("id", lead.id)
        .eq("organization_id", insight.organization_id);
      if (error) throw error;
    }
    if (contact) {
      const { error } = await admin
        .from("contacts")
        .update({ custom_fields: contactCustomFields, updated_at: new Date().toISOString() })
        .eq("id", contact.id)
        .eq("org_id", insight.organization_id);
      if (error) throw error;
    }

    const noteBody = [
      `Bylda call intelligence${call.started_at ? ` — ${new Date(call.started_at).toISOString()}` : ""}`,
      insight.summary ? `Summary: ${insight.summary}` : null,
      ...eligible.map(
        (field) =>
          `${field.label ?? field.key}: ${field.value} (${Math.round(Number(field.confidence ?? 0) * 100)}% confidence)`,
      ),
      `Bylda call ID: ${call.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    let noteId: string | null = null;
    if (externalContactId) {
      const noteResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(externalContactId)}/notes`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ title: "Bylda call intelligence", body: noteBody }),
        },
      );
      const notePayload = object(await noteResponse.json().catch(() => ({})));
      if (!noteResponse.ok) {
        throw new Error(
          `GoHighLevel note write failed (${noteResponse.status}). Check contacts.write permission.`,
        );
      }
      noteId = String(object(notePayload.note).id ?? "") || null;
    }

    let opportunityUpdated = false;
    if (externalOpportunityId && nextValue !== null) {
      const opportunityResponse = await fetch(
        `https://services.leadconnectorhq.com/opportunities/${encodeURIComponent(externalOpportunityId)}`,
        { method: "PUT", headers, body: JSON.stringify({ monetaryValue: nextValue }) },
      );
      if (!opportunityResponse.ok) {
        throw new Error(
          `GoHighLevel opportunity write failed (${opportunityResponse.status}). Check opportunities.write permission.`,
        );
      }
      opportunityUpdated = true;
    }

    if (lead) {
      await admin.from("crm_activities").insert({
        organization_id: insight.organization_id,
        deal_id: lead.id,
        user_id: user.id,
        type: "note",
        content: noteBody,
        metadata: { source: "gohighlevel_call_writeback", call_id: call.id, note_id: noteId },
      });
    }

    const result = {
      provider: "gohighlevel",
      location_id: locationId,
      note_id: noteId,
      opportunity_updated: opportunityUpdated,
      fields_written: eligible.map((field) => field.key),
      written_at: new Date().toISOString(),
    };
    await admin
      .from("call_insights")
      .update({ writeback_status: "written", writeback_result: result, writeback_error: null })
      .eq("id", insight.id);
    return json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GoHighLevel write-back failed";
    await admin
      .from("call_insights")
      .update({ writeback_status: "failed", writeback_error: message })
      .eq("id", insight.id);
    return json({ error: message }, 502);
  }
});
