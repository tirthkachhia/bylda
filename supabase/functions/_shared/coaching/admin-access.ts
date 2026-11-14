import { createClient } from "npm:@supabase/supabase-js@2.45.0";
export const coachingCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
};
export const coachingJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...coachingCors, "Content-Type": "application/json" },
  });
export async function requireCoachingAdmin(req: Request, orgId: unknown) {
  if (typeof orgId !== "string" || !/^[0-9a-f-]{36}$/i.test(orgId))
    return {
      ok: false as const,
      response: coachingJson({ error: "organization_id is required" }, 400),
    };
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return {
      ok: false as const,
      response: coachingJson({ error: "Server is not configured" }, 503),
    };
  const admin = createClient(url, key),
    token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user)
    return { ok: false as const, response: coachingJson({ error: "Unauthorized" }, 401) };
  const sessionClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: verified, error: assuranceError } = await sessionClient.rpc(
    "coaching_session_verified",
  );
  if (assuranceError || !verified)
    return {
      ok: false as const,
      response: coachingJson({ error: "Complete account verification before continuing" }, 403),
    };
  const { data: member, error: membershipError } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    return {
      ok: false as const,
      response: coachingJson({ error: "Workspace authorization could not be checked" }, 503),
    };
  if (!member || !["owner", "admin"].includes(member.role))
    return {
      ok: false as const,
      response: coachingJson({ error: "Owner or admin access required" }, 403),
    };
  return { ok: true as const, admin, user, orgId };
}
