import { createClient } from "npm:@supabase/supabase-js@2.45.0";
const cors = {
  "Access-Control-Allow-Origin": "https://app.usebylda.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, key);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const dispatchKey = Deno.env.get("SIGNUP_EMAIL_DISPATCH_KEY");
    if (token !== key && (!dispatchKey || token !== dispatchKey)) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return json({ error: "Sign in required" }, 401);
      const { data: role } = await db
        .from("user_roles")
        .select("user_id")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) return json({ error: "Admin access required" }, 403);
    }
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM");
    const address = Deno.env.get("EMAIL_POSTAL_ADDRESS");
    const ready = !!(apiKey && from && address);
    const input = await req.json();
    if (input.action === "status")
      return json({
        ready,
        missing: [
          !apiKey && "RESEND_API_KEY",
          !from && "EMAIL_FROM",
          !address && "EMAIL_POSTAL_ADDRESS",
        ].filter(Boolean),
      });
    if (input.action !== "process") return json({ error: "Unknown action" }, 400);
    if (!ready)
      return json(
        { error: "Configure a verified email sender and postal address before sending." },
        503,
      );
    const { data: jobs, error } = await db.rpc("claim_signup_emails");
    if (error) throw error;
    let accepted = 0,
      failed = 0,
      skipped = 0;
    for (const job of jobs || []) {
      try {
        const {
          data: { user },
          error: userError,
        } = await db.auth.admin.getUserById(job.user_id);
        if (userError) throw userError;
        const { data: pref, error: prefError } = await db
          .from("signup_email_preferences")
          .select("marketing,unsubscribe_token")
          .eq("user_id", job.user_id)
          .maybeSingle();
        if (prefError) throw prefError;
        if (
          !user?.email_confirmed_at ||
          !user.email ||
          (job.kind === "update" && !pref?.marketing)
        ) {
          const { error } = await db
            .from("signup_email_queue")
            .update({ status: "skipped" })
            .eq("id", job.id);
          if (error) throw error;
          skipped++;
          continue;
        }
        const unsubscribe = `${url}/functions/v1/signup-email-unsubscribe?token=${pref?.unsubscribe_token}`;
        const text =
          job.body +
          "\n\nBylda\n" +
          address +
          (job.kind === "update" ? "\nUnsubscribe: " + unsubscribe : "");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `signup-email/${job.id}`,
          },
          body: JSON.stringify({ from, to: [user.email], subject: job.subject, text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
        const result = await response.json();
        const { error } = await db
          .from("signup_email_queue")
          .update({ status: "accepted", provider_id: result.id, error: null })
          .eq("id", job.id);
        if (error) throw error;
        accepted++;
      } catch {
        // Never auto-resend an ambiguous request after the provider's deduplication window.
        await db
          .from("signup_email_queue")
          .update({
            status: "failed",
            error: "Delivery not confirmed. Check provider logs before retrying.",
          })
          .eq("id", job.id);
        failed++;
      }
    }
    return json({ accepted, failed, skipped });
  } catch {
    return json({ error: "Email processing failed" }, 500);
  }
});
