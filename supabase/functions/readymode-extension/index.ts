import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { handleReadyModeExtension } from "../_shared/readymode-extension-handler.ts";
Deno.serve((req) => handleReadyModeExtension(req, createClient));
