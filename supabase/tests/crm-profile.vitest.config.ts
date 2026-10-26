import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["supabase/tests/crm-profile-worker.test.ts"] } });
