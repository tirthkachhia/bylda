// team-invite — owner/admin invites a teammate into their organization.
//
// Flow:
//   1. verify the caller (JWT) and confirm they are owner/admin of the org
//   2. if the email already has an account, just add the membership
//   3. otherwise send a Supabase Auth invite email, then add the membership
//
// Membership inserts use the service role (the organization_members RLS only
// allows self-insert), but the org + role authorization is enforced here.

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

type InviteRole = "admin" | "member";

interface InviteBody {
  organizationId?: string;
  email?: string;
  role?: InviteRole;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const callerId = userData.user.id;

  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = (body.organizationId ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const role: InviteRole = body.role === "admin" ? "admin" : "member";

  if (!organizationId) return json({ error: "organizationId is required" }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "A valid email is required" }, 400);

  // ── Authorize: caller must be owner/admin of this org ──────────────────────
  const { data: caller } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", callerId)
    .maybeSingle();
  if (!caller || !["owner", "admin"].includes(caller.role as string)) {
    return json({ error: "Only an owner or admin can invite teammates." }, 403);
  }

  // ── Resolve the invitee: existing account vs new invite ────────────────────
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let inviteeId: string;
  let status: "added_existing" | "invited";

  if (existingProfile?.id) {
    inviteeId = existingProfile.id as string;
    status = "added_existing";
  } else {
    const appUrl = Deno.env.get("APP_URL");
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      appUrl ? { redirectTo: `${appUrl}/auth/invite` } : undefined,
    );
    if (inviteErr || !invited?.user) {
      return json({ error: `Could not send invite: ${inviteErr?.message ?? "unknown"}` }, 500);
    }
    inviteeId = invited.user.id;
    status = "invited";
  }

  // Already a member? Treat as idempotent success.
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: organizationId, user_id: inviteeId, role },
      { onConflict: "organization_id,user_id" },
    );
  if (memberErr) {
    return json({ error: `Could not add member: ${memberErr.message}` }, 500);
  }

  return json({ ok: true, status, role, user_id: inviteeId });
});
