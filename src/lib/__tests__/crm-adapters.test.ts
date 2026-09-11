import { describe, expect, it } from "vitest";
import { mapDealStage } from "../../../supabase/functions/_shared/context-crm-ingest.ts";
import {
  mapCloseLead,
  mapCloseOpportunity,
  mapHubSpotContact,
  mapHubSpotDeal,
  mapSalesforceContact,
  mapSalesforceOpportunity,
  mapStripeCustomer,
  notionPageTitle,
} from "../../../supabase/functions/_shared/crm-adapters.ts";

describe("CRM provider adapters", () => {
  it("normalizes provider-specific stages into the Bylda enum", () => {
    expect(mapDealStage("open")).toBe("Qualified");
    expect(mapDealStage("negotiation")).toBe("Proposal");
    expect(mapDealStage("unknown-provider-stage")).toBe("New");
  });

  it("maps HubSpot contacts and deals onto the canonical sales model", () => {
    const contact = mapHubSpotContact({
      id: "51",
      properties: {
        firstname: "Ada",
        lastname: "Lovelace",
        email: "ada@analytical.engine",
        phone: "+1 404 555 0101",
        company: "Analytical Engines",
      },
    });
    const deal = mapHubSpotDeal(
      {
        id: "77",
        properties: { dealname: "Pilot", amount: "12000", dealstage: "closedwon" },
      },
      { contactId: "51", companyId: "9" },
    );

    expect(contact).toMatchObject({
      externalId: "51",
      firstName: "Ada",
      email: "ada@analytical.engine",
      companyName: "Analytical Engines",
    });
    expect(deal).toMatchObject({
      externalId: "77",
      name: "Pilot",
      value: 12000,
      externalContactId: "51",
    });
    expect(mapDealStage(deal?.stage)).toBe("Won");
  });

  it("maps Salesforce contacts and opportunities with account links", () => {
    const contact = mapSalesforceContact({
      Id: "003xx",
      FirstName: "Grace",
      LastName: "Hopper",
      Email: "grace@navy.mil",
      AccountId: "001xx",
      Account: { Name: "US Navy" },
    });
    const deal = mapSalesforceOpportunity(
      {
        Id: "006xx",
        Name: "Compiler rollout",
        Amount: 50000,
        StageName: "Closed Lost",
        AccountId: "001xx",
      },
      "003xx",
    );

    expect(contact?.externalCompanyId).toBe("001xx");
    expect(contact?.companyName).toBe("US Navy");
    expect(deal?.externalContactId).toBe("003xx");
    expect(mapDealStage(deal?.stage)).toBe("Lost");
  });

  it("maps Close leads as companies with nested contacts", () => {
    const mapped = mapCloseLead({
      id: "lead_1",
      display_name: "Acme",
      contacts: [
        {
          id: "cont_1",
          name: "Jane Doe",
          emails: [{ email: "jane@acme.com" }],
          phones: [{ phone: "4045550199" }],
        },
      ],
    });
    const deal = mapCloseOpportunity({
      id: "oppo_1",
      lead_id: "lead_1",
      contact_id: "cont_1",
      lead_name: "Acme",
      value: 250000,
      status_type: "active",
      status_label: "Demo",
    });

    expect(mapped.company?.name).toBe("Acme");
    expect(mapped.contacts[0]).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
      externalCompanyId: "lead_1",
    });
    expect(deal).toMatchObject({
      name: "Acme",
      value: 2500,
      externalCompanyId: "lead_1",
      stage: "Demo",
    });
  });

  it("maps Stripe customers into contacts", () => {
    const contact = mapStripeCustomer({
      id: "cus_123",
      name: "Bylda Customer",
      email: "ops@bylda.com",
      phone: "5550100",
    });
    expect(contact).toMatchObject({
      externalId: "cus_123",
      firstName: "Bylda",
      lastName: "Customer",
      email: "ops@bylda.com",
    });
  });

  it("reads a Notion page title for memory chunks", () => {
    expect(
      notionPageTitle({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        properties: {
          Name: { type: "title", title: [{ plain_text: "Sales playbook" }] },
        },
      }),
    ).toBe("Sales playbook");
  });
});
