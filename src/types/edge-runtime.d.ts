// Shared pure modules reference the server SDK. Keep its real types when checked by app tsc.
declare module "npm:@supabase/supabase-js@2.45.0" {
  export { createClient } from "@supabase/supabase-js";
  export type { SupabaseClient } from "@supabase/supabase-js";
}
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
