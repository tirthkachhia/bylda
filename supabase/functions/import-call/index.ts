import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { importCall, importHeaders } from "../_shared/import-call.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: importHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: importHeaders });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return new Response(JSON.stringify({ error: "Sign in to import calls" }), {
      status: 401,
      headers: { ...importHeaders, "Content-Type": "application/json" },
    });
  return importCall(client, user, await req.json().catch(() => null));
});
