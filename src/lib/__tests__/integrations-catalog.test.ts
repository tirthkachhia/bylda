import { describe, expect, it } from "vitest";
import { getCatalogByKey } from "@/lib/integrations-catalog";
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
