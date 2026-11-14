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

type InviteRole = "admin" | "manager" | "member";

interface InviteBody {
  organizationId?: string;
  email?: string;
  role?: InviteRole;
  name?: string;
  teamId?: string;
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
  const { data: verified, error: assuranceError } = await userClient.rpc(
    "coaching_session_verified",
  );
  if (assuranceError || !verified)
    return json({ error: "Complete account verification before inviting teammates" }, 403);
  const callerId = userData.user.id;

  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") return json({ error: "Invalid invite body" }, 400);
  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role: InviteRole = body.role ?? "member";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const teamId = typeof body.teamId === "string" ? body.teamId : null;

  if (!/^[0-9a-f-]{36}$/i.test(organizationId))
    return json({ error: "A valid organizationId is required" }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "A valid email is required" }, 400);
  if (!["admin", "manager", "member"].includes(role)) return json({ error: "Invalid role" }, 400);
  if (
    teamId &&
    (!/^[0-9a-f-]{36}$/i.test(teamId) || role !== "member" || !name || name.length > 120)
  )
    return json({ error: "Agents need a valid team, name and member role" }, 400);

  // ── Authorize: caller must be owner/admin of this org ──────────────────────
  const { data: caller } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", callerId)
    .maybeSingle();
  if (!caller || !["owner", "admin", "manager"].includes(caller.role as string)) {
    return json({ error: "Manager access is required to invite agents." }, 403);
  }
  if (caller.role === "manager" && (role !== "member" || !teamId))
    return json({ error: "Managers can only invite agents to their own teams." }, 403);
  if (teamId) {
    const { data: team, error: teamError } = await admin
      .from("coaching_teams")
      .select("manager_id")
      .eq("id", teamId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (teamError || !team || (caller.role === "manager" && team.manager_id !== callerId))
      return json({ error: "Choose a team you manage." }, 403);
    // Reject a known rep owned by another manager before sending an email.
    const { data: rep } = await userClient
      .from("reps")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .maybeSingle();
    const { data: existingRep } = await admin
      .from("reps")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .maybeSingle();
    if (existingRep && !rep) return json({ error: "Agent belongs to another manager." }, 403);
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
    const { data: existingMember, error: existingMemberError } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", inviteeId)
      .maybeSingle();
    if (existingMemberError) return json({ error: "Could not verify existing membership" }, 500);
    if (caller.role === "manager" && existingMember && existingMember.role !== "member")
      return json({ error: "This account already has a privileged workspace role." }, 403);
  } else {
    const appUrl = Deno.env.get("APP_URL");
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      appUrl
        ? {
            redirectTo: `${appUrl.replace(/\/$/, "")}/auth/invite`,
            data: { full_name: name, invited_workspace_id: organizationId },
          }
        : undefined,
    );
    if (inviteErr || !invited?.user) {
      return json({ error: `Could not send invite: ${inviteErr?.message ?? "unknown"}` }, 500);
    }
    inviteeId = invited.user.id;
    status = "invited";
  }

  if (teamId) {
    // Membership, auth identity and team assignment commit atomically. The RPC
    // rechecks authorization after the email provider call, including races.
    const { data: repId, error: agentError } = await admin.rpc("attach_coaching_agent", {
      p_org: organizationId,
      p_user: inviteeId,
      p_caller: callerId,
      p_team: teamId,
      p_name: name,
      p_email: email,
    });
    if (agentError) return json({ error: `Could not add agent: ${agentError.message}` }, 409);
    return json({ ok: true, status, role, user_id: inviteeId, rep_id: repId });
  }
  // Re-inviting an existing member never silently changes their role. Role
  // changes belong to the owner's explicit role editor.
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: organizationId, user_id: inviteeId, role },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true },
    );
  if (memberErr) {
    return json({ error: `Could not add member: ${memberErr.message}` }, 500);
  }

  return json({ ok: true, status, role, user_id: inviteeId });
});
