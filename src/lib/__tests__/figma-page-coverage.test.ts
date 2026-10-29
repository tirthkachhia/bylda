import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { figmaEmptyPages } from "../figma-page-catalog";
import {
  figmaScreenManifest,
  figmaSetupSteps,
  figmaSpecialScreens,
} from "../figma-screen-manifest";

describe("Figma page coverage", () => {
  it("retains a frontend destination for every audited prototype frame", () => {
    expect(figmaScreenManifest).toHaveLength(101);
    expect(new Set(figmaScreenManifest.map((p) => p.id)).size).toBe(101);
    expect(new Set(figmaEmptyPages.map((p) => p.key)).size).toBe(figmaEmptyPages.length);
    const destinations = new Set([...figmaEmptyPages.map((p) => p.key), ...figmaSpecialScreens]);
    for (const page of figmaScreenManifest) {
      const path = new URL(page.url, "https://example.invalid").pathname;
      if (path.startsWith("/app/views/"))
        expect(destinations.has(path.split("/").at(-1)!)).toBe(true);
      else if (path.startsWith("/setup/"))
        expect(figmaSetupSteps).toContain(path.split("/").at(-1));
      else expect(existsSync(`src/routes/${path.slice(1).replaceAll("/", ".")}.tsx`)).toBe(true);
    }
  });
  it("keeps all new empty views disconnected from backend writes and temporary assets", () => {
    const views = readFileSync("src/components/app/FigmaPageViews.tsx", "utf8");
    expect(views).not.toMatch(/supabase|invokeEdge|\.insert\(|\.update\(/);
    expect(views).toContain('data-unavailable="true"');
    expect(views).not.toContain("figma.com/api/mcp/asset");
    for (const asset of ["empty-state.svg", "empty-avatar.svg"]) {
      const svg = readFileSync(`public/figma/${asset}`, "utf8");
      expect(svg.length).toBeGreaterThan(100);
      expect(svg).toContain(asset === "empty-state.svg" ? 'width="44"' : 'width="20"');
    }
  });
});
