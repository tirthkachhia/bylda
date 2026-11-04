import { describe, expect, it } from "vitest";
import { parseOutcomeCsv } from "../coaching/outcomes";
import { checkedDeliveryUrl } from "../../../supabase/functions/_shared/coaching/delivery-contract";
import { workspaceDateStamp, workspaceWeekStart } from "../coaching/calendar";
import { csvText } from "../download";
const id = "11111111-1111-4111-8111-111111111111";
describe("outcome CSV and delivery boundaries", () => {
  it("parses quoted references and preserves outcome attribution inputs", () => {
    const rows = parseOutcomeCsv(
      `call_id,outcome,occurred_at,source_reference\n${id},placed,2026-11-02,"carrier, record 23"`,
    );
    expect(rows[0]).toEqual({
      call_id: id,
      outcome: "placed",
      occurred_at: "2026-11-02T00:00:00.000Z",
      source_reference: "carrier, record 23",
    });
  });
  it("rejects malformed dates, unsupported outcomes and missing columns", () => {
    expect(() => parseOutcomeCsv(`call_id,outcome,occurred_at\n${id},won,2026-11-02`)).toThrow(
      "unsupported outcome",
    );
    expect(() => parseOutcomeCsv(`call_id,outcome,occurred_at\n${id},placed,2026-02-30`)).toThrow(
      "ISO date",
    );
    expect(() => parseOutcomeCsv("id,status\n1,won")).toThrow("requires");
  });
  it("does not allow tenant-configured webhooks to reach private or arbitrary endpoints", () => {
    for (const url of [
      "http://hooks.slack.com/services/a",
      "https://hooks.slack.com.evil.example/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/x",
      "https://user:secret@hooks.slack.com/x",
    ])
      expect(() => checkedDeliveryUrl("slack", url)).toThrow();
    expect(() => checkedDeliveryUrl("webhook", "https://unapproved.example/x")).toThrow(
      "must be configured",
    );
    expect(checkedDeliveryUrl("webhook", "https://approved.example/x", ["approved.example"])).toBe(
      "https://approved.example/x",
    );
  });
  it("allows official provider webhooks without following redirects", () => {
    expect(checkedDeliveryUrl("slack", "https://hooks.slack.com/services/a")).toContain(
      "hooks.slack.com",
    );
    expect(
      checkedDeliveryUrl("teams", "https://environment.api.powerplatform.com/powerautomate/x"),
    ).toContain("powerplatform.com");
    expect(() =>
      checkedDeliveryUrl("teams", "https://api.powerplatform.com.evil.example/x"),
    ).toThrow();
  });
  it("uses workspace-local calendar dates across midnight and week boundaries", () => {
    const now = Date.parse("2026-11-03T02:00:00Z");
    expect(workspaceDateStamp(now, "America/New_York")).toBe("2026-11-02");
    expect(workspaceWeekStart(now, "America/New_York", 1)).toBe("2026-11-02");
    expect(workspaceWeekStart(now, "America/New_York", 0)).toBe("2026-11-01");
    expect(workspaceDateStamp(now, "Invalid/Zone")).toBeNull();
  });
  it("neutralizes formulas in exported CSV user fields", () => {
    expect(csvText([["=IMPORTXML(x)", "normal, text"]])).toBe(`"'=IMPORTXML(x)","normal, text"`);
  });
});
