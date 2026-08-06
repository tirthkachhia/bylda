import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  customFields?: unknown[];
};

type GhlOpportunity = {
  id: string;
  name?: string;
  monetaryValue?: number;
  status?: string;
  source?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  contact?: { name?: string; email?: string; phone?: string; companyName?: string };
  createdAt?: string;
  updatedAt?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id as string | undefined;
  if (!orgId) return json({ error: "No Bylda organization found" }, 400);

  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) return json({ error: "Integration storage is not configured" }, 503);
  const secret = async (key: string) => {
    const { data, error } = await admin.rpc("get_user_integration", {
      _user_id: user.id,
      _integration_key: key,
      _encryption_key: encKey,
    });
    if (error) throw new Error(`Unable to read ${key} credential`);
    return typeof data === "string" ? data : "";
  };

  try {
    const [token, locationId] = await Promise.all([
      secret("gohighlevel"),
      secret("gohighlevel_location"),
    ]);
    if (!token || !locationId) {
      return json({ error: "Connect a GoHighLevel token and Location ID first" }, 400);
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Version: "v3",
    };

    const [contactsResponse, opportunitiesResponse] = await Promise.all([
      fetch("https://services.leadconnectorhq.com/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ locationId, pageLimit: 100 }),
      }),
      fetch(
        `https://services.leadconnectorhq.com/opportunities/search?locationId=${encodeURIComponent(locationId)}&limit=100`,
        { headers },
      ),
    ]);

    if (contactsResponse.status === 401 || opportunitiesResponse.status === 401) {
      return json({ error: "GoHighLevel rejected this token. Check its sub-account and scopes." }, 401);
    }
    if (!contactsResponse.ok) {
      const detail = await contactsResponse.text();
      console.error("[sync-gohighlevel] contacts", contactsResponse.status, detail.slice(0, 500));
      return json({ error: "Could not read GoHighLevel contacts" }, 502);
    }

    const contactsPayload = await contactsResponse.json();
    const opportunitiesPayload = opportunitiesResponse.ok
      ? await opportunitiesResponse.json()
      : { opportunities: [] };
    const contacts: GhlContact[] = contactsPayload.contacts ?? contactsPayload.results ?? [];
    const opportunities: GhlOpportunity[] =
      opportunitiesPayload.opportunities ?? opportunitiesPayload.results ?? [];

    const contactRows = contacts.filter((c) => c.id).map((c) => {
      const names = (c.name ?? "").trim().split(/\s+/);
      return {
        user_id: user.id,
        org_id: orgId,
        first_name: c.firstName ?? names[0] ?? null,
        last_name: c.lastName ?? (names.slice(1).join(" ") || null),
        email: c.email ?? null,
        phone: c.phone ?? null,
        company: c.companyName ?? null,
        status: "new",
        source: c.source ?? "GoHighLevel",
        tags: Array.isArray(c.tags) ? c.tags : [],
        custom_fields: { gohighlevel: c.customFields ?? [] },
        external_source: "gohighlevel",
        external_id: c.id,
        updated_at: new Date().toISOString(),
      };
    });

    let contactsImported = 0;
    if (contactRows.length) {
      const { data, error } = await admin
        .from("contacts")
        .upsert(contactRows, { onConflict: "org_id,external_source,external_id" })
        .select("id");
      if (error) throw new Error(`Contact import failed: ${error.message}`);
      contactsImported = data?.length ?? contactRows.length;
    }

    const leadRows = opportunities.filter((o) => o.id).map((o) => ({
      organization_id: orgId,
      user_id: user.id,
      name: o.name ?? o.contact?.name ?? "GoHighLevel opportunity",
      email: o.contact?.email ?? null,
      phone: o.contact?.phone ?? null,
      company: o.contact?.companyName ?? null,
      stage: "New",
      source: o.source ?? "GoHighLevel",
      value: o.monetaryValue ?? null,
      external_source: "gohighlevel",
      external_id: o.id,
      external_data: {
        status: o.status,
        pipeline_id: o.pipelineId,
        pipeline_stage_id: o.pipelineStageId,
        contact_id: o.contactId,
      },
      updated_at: new Date().toISOString(),
    }));

    let opportunitiesImported = 0;
    if (leadRows.length) {
      const { data, error } = await admin
        .from("leads")
        .upsert(leadRows, { onConflict: "organization_id,external_source,external_id" })
        .select("id");
      if (error) throw new Error(`Opportunity import failed: ${error.message}`);
      opportunitiesImported = data?.length ?? leadRows.length;
    }

    return json({
      ok: true,
      location_id: locationId,
      contacts_received: contacts.length,
      contacts_imported: contactsImported,
      opportunities_received: opportunities.length,
      opportunities_imported: opportunitiesImported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GoHighLevel sync failed";
    console.error("[sync-gohighlevel]", message);
    return json({ error: message }, 500);
  }
});
