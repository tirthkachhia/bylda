// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("client environment boundaries", () => {
  it.each([".env.production", ".env.development"])(
    "does not retain a server service-role credential in %s",
    (path) => {
      const text = readFileSync(path, "utf8");
      const serverKeyPresent = /^SUPABASE_SERVICE_ROLE_KEY=.+$/m.test(text);
      const privilegedJwtPresent = [...text.matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)].some(
        (match) => {
          try {
            return (
              JSON.parse(Buffer.from(match[1], "base64url").toString()).role === "service_role"
            );
          } catch {
            return false;
          }
        },
      );
      // Assert booleans, so a regression cannot echo the credential in test output.
      expect(serverKeyPresent || privilegedJwtPresent).toBe(false);
    },
  );
});
