import { describe, expect, it } from "vitest";
import type { RoleDefinition } from "@/lib/data";
import { permissionCell } from "./settingsModel";
const role = (permissions: string[]): RoleDefinition => ({
  role: "manager",
  name: "Manager",
  description: "",
  permissions,
});
describe("shared role grants", () => {
  it("keeps own and team scopes distinct", () => {
    expect(permissionCell(role(["calls.read:own"]), "calls")).toBe("own");
    expect(permissionCell(role(["calls.read:team"]), "calls")).toBe("own team");
  });
  it("does not infer audio, peer profiles or sharing from call-read access", () => {
    for (const capability of ["audio", "profiles", "clips.share"])
      expect(permissionCell(role(["calls.read:own"]), capability)).toBe("—");
  });
  it("does not infer coaching assignment from a read grant", () => {
    expect(permissionCell(role(["coaching.read:own"]), "coaching.assign")).toBe("—");
    expect(permissionCell(role(["coaching.*:team"]), "coaching.assign")).toBe("own team");
  });
  it("honors explicit wildcard grants without matching unrelated namespaces", () => {
    expect(permissionCell(role(["*"]), "billing")).toBe("●");
    expect(permissionCell(role(["settings.*"]), "billing")).toBe("—");
  });
});
