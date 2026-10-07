import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceNavigation } from "../workspace-navigation";

describe("live UI integration", () => {
  it("retains the original live integration, setup, calls, and AI destinations", () => {
    const links = workspaceNavigation.map((item) => item.to);
    for (const path of ["/app/crm/calls", "/app/integrations", "/app/crm/setup", "/app/memory"])
      expect(links).toContain(path);
    expect(new Set(links).size).toBe(links.length);
    for (const path of links) {
      const route = path === "/app" ? "app.index.tsx" : `${path.slice(1).replaceAll("/", ".")}.tsx`;
      expect(existsSync(resolve("src/routes", route))).toBe(true);
    }
  });
  it("does not adopt mock data or bypass the original authentication guard", () => {
    const shell = readFileSync(resolve("src/components/app/LiveWorkspaceShell.tsx"), "utf8");
    const layout = readFileSync(resolve("src/routes/app.tsx"), "utf8");
    expect(shell).not.toContain("@/lib/data");
    expect(shell).toContain("await signOut()");
    expect(shell).toContain("queryClient.clear()");
    expect(layout).toContain("loading || !user");
    expect(layout).not.toContain("mocksForced");
  });
});
