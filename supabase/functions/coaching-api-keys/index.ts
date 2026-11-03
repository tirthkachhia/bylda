import {
  requireCoachingAdmin,
  coachingCors,
  coachingJson as json,
} from "../_shared/coaching/admin-access.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: coachingCors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null),
    auth = await requireCoachingAdmin(req, body?.organization_id);
  if (!auth.ok) return auth.response;
  if (body.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100)
      return json({ error: "Enter a key name up to 100 characters" }, 400);
    const token = `bylda_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("")}`;
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
    const { data, error } = await auth.admin
      .from("coaching_api_keys")
      .insert({
        organization_id: auth.orgId,
        name,
        prefix: token.slice(0, 14),
        key_hash: hash,
        created_by: auth.user.id,
      })
      .select("id,prefix")
      .single();
    if (error) return json({ error: "Key could not be created" }, 500);
    return json({ id: data.id, prefix: data.prefix, token });
  }
  if (body.action === "revoke" && typeof body.id === "string") {
    const { data, error } = await auth.admin
      .from("coaching_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("organization_id", auth.orgId)
      .select("id")
      .maybeSingle();
    if (error || !data) return json({ error: "Key could not be revoked" }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
});
