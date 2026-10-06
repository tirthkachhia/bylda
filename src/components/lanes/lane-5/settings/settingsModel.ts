import type { RoleDefinition } from "@/lib/data";
/** Only present grants supplied by the shared API; never infer absent capabilities. */
export const capabilities = [
  ["Workspace settings", "settings"],
  ["Billing", "billing"],
  ["Integrations", "integrations"],
  ["Methodology & behavior rules", "methodology"],
  ["Users & teams", "users"],
  ["See team intelligence & patterns", "insights"],
  ["See calls & call review", "calls"],
  ["Hear call audio", "audio"],
  ["See other reps’ behavior profiles", "profiles"],
  ["Assign coaching", "coaching.assign"],
  ["Receive coaching / daily rep brief", "coaching.read"],
  ["Rep comparison & team overview", "comparison"],
  ["Share call clips with reps", "clips.share"],
  ["Reports", "reports"],
] as const;
export function permissionCell(definition: RoleDefinition, capability: string): string {
  if (definition.permissions.includes("*")) return "●";
  const grants = definition.permissions.filter((permission) => {
    const key = permission.split(":")[0];
    return (
      key === capability ||
      key === `${capability}.*` ||
      key.startsWith(`${capability}.`) ||
      (key.endsWith(".*") && capability.startsWith(key.slice(0, -1)))
    );
  });
  if (!grants.length) return "—";
  const scopes = [...new Set(grants.map((g) => g.split(":")[1] ?? "all"))];
  return scopes
    .map((scope) => (scope === "team" ? "own team" : scope === "own" ? "own" : "●"))
    .join(", ");
}
