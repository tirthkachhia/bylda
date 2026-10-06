import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataSource, FieldMapping } from "@/lib/data";
const mode = vi.hoisted(() => ({ mock: false }));
vi.mock("@/lib/data", () => ({ mocksForced: () => mode.mock }));
import { catalog, mappingRows, sourceRows } from "./demo";

describe("Integrations presentation safety", () => {
  beforeEach(() => {
    mode.mock = false;
  });
  it("never substitutes demo sources or sync counts in real mode", () => {
    const source: DataSource = {
      key: "zoom",
      name: "Actual workspace Zoom",
      category: "meetings",
      status: "error",
      lastSyncAt: null,
      callsSynced: 0,
      waiting: 0,
      error: "Connection refused",
    };
    expect(sourceRows([source])).toEqual([
      {
        key: "zoom",
        name: "Actual workspace Zoom",
        category: "meetings",
        status: "error",
        description: "Meeting recorder",
        detail: "Connection refused",
      },
    ]);
    expect(sourceRows([])).toEqual([]);
  });
  it("never fills real CRM mappings with demo examples or made-up mapping status", () => {
    const mapping: FieldMapping = {
      byldaField: "Opportunity",
      crmObject: "Deal",
      crmField: null,
      direction: "read",
      required: false,
    };
    expect(mappingRows([mapping])).toEqual([
      { field: "Opportunity", property: "—", example: "—", status: "Pick field" },
    ]);
    expect(mappingRows([])).toEqual([]);
  });
  it("uses Figma fixtures only when forced demo mode is enabled", () => {
    mode.mock = true;
    expect(sourceRows([])).toEqual(catalog);
    expect(mappingRows([]).find((r) => r.field === "Amount")?.example).toBe("$48,000");
  });
});
