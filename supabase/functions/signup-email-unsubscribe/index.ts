import { createClient } from "npm:@supabase/supabase-js@2.45.0";
Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Invalid link", { status: 400 });
  if (req.method === "GET")
    return new Response(
      '<!doctype html><title>Bylda email preferences</title><h1>Stop Bylda product emails?</h1><form method="post"><button>Unsubscribe</button></form>',
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Referrer-Policy": "no-referrer",
          "Cache-Control": "no-store",
        },
      },
    );
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await db
    .from("signup_email_preferences")
    .update({ marketing: false })
    .eq("unsubscribe_token", token);
  return new Response(
    error
      ? "Could not save. Please retry."
      : "You have unsubscribed from Bylda product emails. Account and security emails are unaffected.",
    {
      status: error ? 500 : 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    },
  );
});
