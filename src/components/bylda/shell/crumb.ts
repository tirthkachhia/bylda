import { AREA_NAMES, type ScreenEntry } from "./screens";

/**
 * Top-bar breadcrumb for a registry screen. Registry names repeat their area
 * ("Intelligence — Team behaviors"), so the area is said once, as Figma draws it:
 *   "Intelligence — Team behaviors" → "Intelligence / Team behaviors"   (I7, 51:1420)
 *   "Calls — Manual upload"         → "Calls / Manual upload"           (C7, 28:1263)
 *   "Intelligence Home"             → "Intelligence Home"               (I1, 27:298)
 *   "Team Overview"                 → "Team Overview"                   (T1, 12:2)
 * Any other name keeps the "<Area> / <name>" form.
 */
export function crumbFor(entry: Pick<ScreenEntry, "area" | "name">): string {
  const area = AREA_NAMES[entry.area] ?? "";
  const { name } = entry;
  if (!area) return name;
  const dashed = `${area} — `;
  if (name.startsWith(dashed)) return `${area} / ${name.slice(dashed.length)}`;
  if (name.startsWith(`${area} `) && !name.includes(" — ")) return name;
  return `${area} / ${name}`;
}
