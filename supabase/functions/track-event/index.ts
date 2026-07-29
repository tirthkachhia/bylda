// track-event — public campaign engagement tracker hit by email clients.
//   GET ?c=<campaign>&e=<contact>&t=open            → logs a unique open, 1x1 gif
//   GET ?c=<campaign>&e=<contact>&t=click&u=<b64url> → logs a click, 302 → url
//   GET ?c=<campaign>&e=<contact>&t=unsubscribe      → opt the contact out
// Writes via service role; unique (campaign,contact,type) index keeps counts
// distinct. verify_jwt = false (email clients can't send a JWT).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// 1x1 transparent GIF.
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

function pixelResponse() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c");
  const contactId = url.searchParams.get("e");
  const type = url.searchParams.get("t") ?? "open";

  // A missing campaign still returns a pixel so email rendering never breaks.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = serviceKey ? createClient(Deno.env.get("SUPABASE_URL")!, serviceKey) : null;

  let redirectTo: string | null = null;
  if (type === "click") {
    const raw = url.searchParams.get("u");
    if (raw) {
      try {
        const decoded = atob(decodeURIComponent(raw));
        if (/^https?:\/\//i.test(decoded)) redirectTo = decoded;
      } catch {
        /* bad url param */
      }
    }
  }

  if (admin && campaignId && ["open", "click", "unsubscribe"].includes(type)) {
    try {
      const { data: campaign } = await admin
        .from("campaigns")
        .select("id, organization_id, open_count, click_count, unsubscribe_count")
        .eq("id", campaignId)
        .maybeSingle();
      if (campaign) {
        const { error: insErr } = await admin.from("campaign_events").insert({
          organization_id: campaign.organization_id,
          campaign_id: campaignId,
          contact_id: contactId,
          type,
          url: redirectTo,
        });
        // Only bump the counter on a genuinely new (distinct) engagement.
        if (!insErr) {
          const col =
            type === "open" ? "open_count" : type === "click" ? "click_count" : "unsubscribe_count";
          const current = (campaign as Record<string, number>)[col] ?? 0;
          await admin
            .from("campaigns")
            .update({ [col]: current + 1 })
            .eq("id", campaignId);
          if (type === "unsubscribe" && contactId) {
            await admin
              .from("contacts")
              .update({ do_not_contact: true, opted_out_sms: true })
              .eq("id", contactId);
          }
        }
      }
    } catch {
      /* tracking must never break delivery */
    }
  }

  if (type === "click" && redirectTo) {
    return new Response(null, { status: 302, headers: { Location: redirectTo } });
  }
  if (type === "unsubscribe") {
    return new Response(
      "<html><body style='font-family:system-ui;text-align:center;padding:48px'><h2>You're unsubscribed</h2><p>You won't receive further emails from this sender.</p></body></html>",
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }
  return pixelResponse();
});
