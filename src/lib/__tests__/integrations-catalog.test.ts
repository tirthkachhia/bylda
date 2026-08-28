import { describe, expect, it } from "vitest";
import {
  CATALOG,
  credentialFieldsForIntegration,
  getCatalogByKey,
} from "@/lib/integrations-catalog";
import { oauthProviderName } from "@/lib/integration-oauth";

describe("Salesforce integration", () => {
  it("is available as a managed OAuth connector", () => {
    const salesforce = getCatalogByKey("salesforce");

    expect(salesforce).toMatchObject({
      key: "salesforce",
      inputType: "oauth",
      popular: true,
    });
    expect(salesforce?.comingSoon).not.toBe(true);
    expect(oauthProviderName("salesforce")).toBe("Salesforce");
  });
});

describe("ReadyMode integration", () => {
  it("is available as a call webhook connector", () => {
    const readymode = getCatalogByKey("readymode");

    expect(readymode).toMatchObject({
      key: "readymode",
      name: "ReadyMode",
      category: "CRM & Sales",
      popular: true,
    });
    expect(readymode?.comingSoon).not.toBe(true);
  });
});

describe("API credential fallback", () => {
  it("gives every non-OAuth catalog connector at least one encrypted field", () => {
    const missing = CATALOG.filter(
      (item) => item.inputType !== "oauth" && credentialFieldsForIntegration(item).length === 0,
    );

    expect(missing).toEqual([]);
  });

  it("preserves every field required by multi-credential connectors", () => {
    expect(credentialFieldsForIntegration(getCatalogByKey("twilio")!)).toHaveLength(3);
    expect(credentialFieldsForIntegration(getCatalogByKey("gohighlevel")!)).toHaveLength(2);
    expect(credentialFieldsForIntegration(getCatalogByKey("sendgrid")!)).toHaveLength(2);
  });

  it("covers every connector that has no managed OAuth provider", () => {
    const unsupported = CATALOG.filter(
      (item) =>
        item.key !== "readymode" &&
        !oauthProviderName(item.key) &&
        credentialFieldsForIntegration(item).length === 0,
    );

    expect(unsupported).toEqual([]);
  });
});
