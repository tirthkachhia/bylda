import { describe, expect, it } from "vitest";
import { crumbFor } from "./crumb";
import { SCREENS, screenForRoute } from "./screens";

const at = (path: string) => crumbFor(screenForRoute(path)!);

describe("top-bar breadcrumb", () => {
  it("says the area once on Intelligence routes, as Figma draws it", () => {
    expect(at("/app/intelligence")).toBe("Intelligence Home");
    expect(at("/app/intelligence/team-behaviors")).toBe("Intelligence / Team behaviors");
    expect(at("/app/intelligence/outcomes")).toBe("Intelligence / Outcome patterns");
    expect(at("/app/intelligence/prospects")).toBe("Intelligence / Prospect patterns");
    for (const s of SCREENS.filter((x) => x.area === "08" && x.url))
      expect(crumbFor(s)).not.toMatch(/^Intelligence \/ Intelligence/);
  });

  it("matches the other frames checked against Figma", () => {
    expect(at("/app/calls/upload")).toBe("Calls / Manual upload");
    expect(at("/app/workspace/profile")).toBe("Settings / Profile");
    expect(at("/app/team")).toBe("Team Overview");
  });

  it('never prints "<Area> / <Area> — …"', () => {
    for (const s of SCREENS) expect(crumbFor(s)).not.toMatch(/^(.+) \/ \1 — /);
  });
});
