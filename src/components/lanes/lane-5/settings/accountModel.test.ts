import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/data";
import { auditCsv, sortedAudit, safeInvoiceUrl, usageValue } from "./accountModel";
const entry: AuditEntry = {
  id: "a",
  createdAt: "2026-09-01T10:00:00Z",
  actorName: "Owner",
  action: "updated",
  entity: "Workspace",
};
describe("audit exports and billing links", () => {
  it.each(["=SUM(A1:A2)", " +1", "\t@command", "\u0000 =formula", "-1"])(
    "neutralizes spreadsheet formulas in %j",
    (value) => {
      expect(auditCsv([{ ...entry, entity: value }])).toContain(`"'${value}"`);
    },
  );
  it("preserves quoted text, commas, newlines and UTC timestamps", () => {
    const csv = auditCsv([{ ...entry, entity: 'Team, "One"\nTwo' }]);
    expect(csv).toContain('"Team, ""One""\nTwo"');
    expect(csv).toContain('"2026-09-01T10:00:00Z"');
    expect(csv.split("\r\n")[0]).toContain("When (UTC)");
  });
  it("sorts without changing shared audit arrays", () => {
    const newer = { ...entry, id: "b", createdAt: "2026-09-29T10:00:00Z" };
    const rows = [entry, newer];
    expect(sortedAudit(rows).map((row) => row.id)).toEqual(["b", "a"]);
    expect(rows[0]).toBe(entry);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:secret@example.com/invoice",
    "not a url",
  ])("refuses unsafe invoice URLs", (value) => expect(safeInvoiceUrl(value)).toBeUndefined());
  it("allows an actual HTTPS invoice document", () =>
    expect(safeInvoiceUrl("https://example.com/invoice/123")).toBe(
      "https://example.com/invoice/123",
    ));
  it("does not interpret an absent usage limit as zero or unlimited", () => {
    expect(usageValue({ key: "seats", label: "Seats", used: 14, limit: null, period: "Sep" })).toBe(
      "14",
    );
    expect(usageValue(undefined)).toBe("—");
  });
});
