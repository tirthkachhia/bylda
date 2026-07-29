// book-appointment — public endpoint behind /book/[slug]. Looks up the active
// booking page, finds-or-creates the contact, and writes a calendar_events row
// via the service-role client (calendar_events has no public-insert RLS by
// design). verify_jwt = false: this is intentionally unauthenticated.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    start_time?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const slug = (body.slug || "").trim();
  const email = (body.email || "").trim();
  const name = (body.name || "").trim();
  const startTime = body.start_time;
  if (!slug || !email || !name || !startTime) {
    return json({ error: "Missing required fields" }, 400);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Resolve the active booking page.
  const { data: page } = await admin
    .from("booking_pages")
    .select(
      "id, organization_id, title, duration_minutes, event_type, confirmation_message, is_active",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!page) return json({ error: "Booking page not found" }, 404);

  const start = new Date(startTime);
  if (isNaN(start.getTime())) return json({ error: "Invalid start_time" }, 400);
  const end = new Date(start.getTime() + (page.duration_minutes ?? 30) * 60_000);

  // Find-or-create the contact (contacts uses org_id).
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || null;

  // contacts.user_id is NOT NULL and contacts are user-owned — system-created
  // contacts belong to the org owner.
  const { data: org } = await admin
    .from("organizations")
    .select("owner_id, created_by")
    .eq("id", page.organization_id)
    .maybeSingle();
  let ownerId: string | null = org?.owner_id ?? org?.created_by ?? null;
  if (!ownerId) {
    const { data: m } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", page.organization_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    ownerId = m?.user_id ?? null;
  }

  let contactId: string | null = null;
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("org_id", page.organization_id)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    contactId = existing.id;
  } else if (ownerId) {
    const { data: created } = await admin
      .from("contacts")
      .insert({
        org_id: page.organization_id,
        user_id: ownerId,
        first_name: firstName || null,
        last_name: lastName,
        email,
        phone: body.phone || null,
        source: "booking_page",
      })
      .select("id")
      .single();
    contactId = created?.id ?? null;
  }

  const { data: event, error: evErr } = await admin
    .from("calendar_events")
    .insert({
      organization_id: page.organization_id,
      contact_id: contactId,
      title: `${page.title} — ${name}`,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      event_type: page.event_type ?? "appointment",
      status: "scheduled",
      notes: body.notes || null,
    })
    .select("id")
    .single();
  if (evErr) return json({ error: "Could not book the appointment" }, 500);

  // Cross-system Connection 5: open a conversation thread for this contact with
  // a confirmation message, so the booking shows up in the unified inbox.
  if (contactId) {
    const when = start.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
    await admin
      .from("conversations")
      .insert({
        organization_id: page.organization_id,
        contact_id: contactId,
        channel: "email",
        direction: "outbound",
        subject: `Appointment confirmed: ${page.title}`,
        body: `Your ${page.title} is confirmed for ${when}.`,
        status: "open",
        metadata: { source: "booking", event_id: event.id },
      })
      .then(
        () => {},
        () => {},
      );
  }

  return json({
    ok: true,
    event_id: event.id,
    message: page.confirmation_message || "Your appointment is booked.",
  });
});
