import { describe, expect, it } from "vitest";
import { DEFAULT_APP_REDIRECT, safeAppRedirect } from "@/lib/safe-redirect";

describe("safeAppRedirect", () => {
  describe("valid — same-origin paths inside /app are kept", () => {
    it.each([
      "/app",
      "/app/",
      "/app/calls",
      "/app/home/team-updates",
      "/app/calls?tab=mine&x=1",
      "/app/calls?x=1#section",
      "/app?x=//not-a-host",
    ])("%s", (path) => {
      expect(safeAppRedirect(path)).toBe(path);
    });
  });

  describe("missing — falls back to /app", () => {
    it.each([undefined, null, "", 42, true, [], {}, ["/app/calls"]])("%j", (value) => {
      expect(safeAppRedirect(value)).toBe(DEFAULT_APP_REDIRECT);
    });
  });

  describe("malicious or out of scope — falls back to /app", () => {
    it.each([
      // absolute / protocol-relative
      "https://evil.com",
      "http://evil.com/app",
      "https://evil.com/app/calls",
      "//evil.com",
      "//evil.com/app",
      "///evil.com",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      // backslash tricks (browsers treat `\` as `/`)
      "/\\evil.com",
      "/\\/evil.com",
      "\\\\evil.com",
      // control characters
      "/app\t//evil.com",
      "/app\n/x",
      "/app\r\n/x",
      "/app\u0000/x",
      // looks like /app but isn't
      "/app@evil.com",
      "/application",
      "/appx/calls",
      "/APP/calls",
      // other same-origin paths
      "/",
      "/auth/sign-in",
      "/auth/sign-in?redirect=/app",
      "/pricing",
      // relative / unanchored
      "app/calls",
      "./app",
      " /app",
      "%2F%2Fevil.com",
      // traversal out of /app, raw and encoded
      "/app/../evil",
      "/app/../../evil",
      "/app/%2e%2e/evil",
      "/app/%2E%2E/%2E%2E/evil",
      // oversized
      `/app/${"a".repeat(3000)}`,
    ])("%j", (value) => {
      expect(safeAppRedirect(value)).toBe(DEFAULT_APP_REDIRECT);
    });
  });
});
