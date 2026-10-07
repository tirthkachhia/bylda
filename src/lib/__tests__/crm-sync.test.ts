import { describe, expect, it } from "vitest";
import { connectedCrmKeys, sourceName } from "../crm-sync";

describe("CRM sync selection", () => {
  it("selects all supported connected CRMs, without unrelated integrations", () => {
    expect(
      connectedCrmKeys([
        ...[
          "gohighlevel",
          "close_io",
          "hubspot",
          "salesforce",
          "pipedrive",
          "notion",
          "stripe",
          "close_io",
        ].map((integration_key) => ({ integration_key, status: "connected" })),
        { integration_key: "hubspot", status: "disconnected" },
      ]),
    ).toEqual(["gohighlevel", "close_io", "hubspot", "salesforce", "pipedrive"]);
  });
  it("does not sync disconnected or unsupported accounts", () => {
    expect(
      connectedCrmKeys([
        { integration_key: "close_io", status: "error" },
        { integration_key: "unknown", status: "connected" },
      ]),
    ).toEqual([]);
  });
  it("uses readable source labels", () => {
    expect(sourceName("close_io")).toBe("Close");
    expect(sourceName("manual_upload")).toBe("Audio upload");
    expect(sourceName(null)).toBe("Unknown source");
  });
});
