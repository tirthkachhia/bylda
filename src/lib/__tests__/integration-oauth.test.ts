import { describe, expect, it } from "vitest";
import { credentialProvider, oauthProviderName } from "@/lib/integration-oauth";

describe("oauthProviderName", () => {
  it("exposes Stripe as a managed OAuth connector", () => {
    expect(oauthProviderName("stripe")).toBe("Stripe");
  });

  it("exposes Mailchimp and PayPal as managed account connectors", () => {
    expect(oauthProviderName("mailchimp")).toBe("Mailchimp");
    expect(oauthProviderName("paypal")).toBe("PayPal");
  });

  it("exposes GitHub and Shopify as managed OAuth connectors", () => {
    expect(oauthProviderName("github")).toBe("GitHub");
    expect(oauthProviderName("shopify")).toBe("Shopify");
  });

  it("exposes OpenAI and Anthropic as encrypted credential connectors", () => {
    expect(credentialProvider("openai")?.name).toBe("OpenAI");
    expect(credentialProvider("anthropic")?.name).toBe("Anthropic");
  });

  it("exposes Jira, Asana, and Google Analytics as OAuth connectors", () => {
    expect(oauthProviderName("jira")).toBe("Jira");
    expect(oauthProviderName("asana")).toBe("Asana");
    expect(oauthProviderName("googleanalytics")).toBe("Google");
  });

  it("exposes Zapier as an encrypted webhook connector", () => {
    expect(credentialProvider("zapier")?.inputType).toBe("url");
  });

  it("exposes Airtable OAuth and SendGrid credentials", () => {
    expect(oauthProviderName("airtable")).toBe("Airtable");
    expect(credentialProvider("sendgrid")?.name).toBe("SendGrid");
  });

  it("exposes HubSpot, Salesforce, and Close as OAuth CRM connectors", () => {
    expect(oauthProviderName("hubspot")).toBe("HubSpot");
    expect(oauthProviderName("salesforce")).toBe("Salesforce");
    expect(oauthProviderName("close_io")).toBe("Close");
  });

  it("does not expose unknown integrations as OAuth connectors", () => {
    expect(oauthProviderName("unknown-provider")).toBeNull();
  });
});
