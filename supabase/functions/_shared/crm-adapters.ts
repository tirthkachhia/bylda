import type { CrmSnapshot, CanonicalCompany, CanonicalContact, CanonicalDeal } from "./context-crm-ingest.ts";
import { estimateTokens, splitContextText } from "./context-package.ts";
import type { StoredOAuth } from "./integration-credentials.ts";

const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const next = String(value).trim();
  return next || null;
}

function numberValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function props(value: unknown): JsonRecord {
  return record(record(value).properties);
}

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload === "object" ? JSON.stringify(payload).slice(0, 240) : "";
    throw new Error(`Provider request failed (${response.status}) ${detail}`.trim());
  }
  return payload;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload === "object" ? JSON.stringify(payload).slice(0, 240) : "";
    throw new Error(`Provider request failed (${response.status}) ${detail}`.trim());
  }
  return payload;
}

export function splitName(value: unknown): { firstName: string | null; lastName: string | null } {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

export function mapHubSpotCompany(row: unknown): CanonicalCompany | null {
  const item = record(row);
  const id = text(item.id);
  const fields = props(item);
  const name = text(fields.name);
  if (!id || !name) return null;
  return {
    externalId: id,
    name,
    domain: text(fields.domain),
    website: text(fields.website),
    industry: text(fields.industry),
    payload: item,
  };
}

export function mapHubSpotContact(
  row: unknown,
  companyIdByContact?: Map<string, string>,
): CanonicalContact | null {
  const item = record(row);
  const id = text(item.id);
  const fields = props(item);
  if (!id) return null;
  return {
    externalId: id,
    firstName: text(fields.firstname),
    lastName: text(fields.lastname),
    email: text(fields.email),
    phone: text(fields.phone),
    companyName: text(fields.company),
    externalCompanyId: companyIdByContact?.get(id) ?? text(fields.associatedcompanyid),
    source: "HubSpot",
    payload: item,
  };
}

export function mapHubSpotDeal(
  row: unknown,
  links?: { contactId?: string | null; companyId?: string | null },
): CanonicalDeal | null {
  const item = record(row);
  const id = text(item.id);
  const fields = props(item);
  if (!id) return null;
  return {
    externalId: id,
    name: text(fields.dealname) ?? "HubSpot deal",
    value: numberValue(fields.amount),
    stage: text(fields.dealstage),
    source: "HubSpot",
    externalContactId: links?.contactId ?? null,
    externalCompanyId: links?.companyId ?? null,
    payload: item,
  };
}

export function mapSalesforceAccount(row: unknown): CanonicalCompany | null {
  const item = record(row);
  const id = text(item.Id);
  const name = text(item.Name);
  if (!id || !name) return null;
  return {
    externalId: id,
    name,
    website: text(item.Website),
    domain: text(item.Website),
    industry: text(item.Industry),
    payload: item,
  };
}

export function mapSalesforceContact(row: unknown): CanonicalContact | null {
  const item = record(row);
  const id = text(item.Id);
  if (!id) return null;
  return {
    externalId: id,
    firstName: text(item.FirstName),
    lastName: text(item.LastName),
    email: text(item.Email),
    phone: text(item.Phone),
    companyName: text(record(item.Account).Name),
    externalCompanyId: text(item.AccountId),
    source: "Salesforce",
    payload: item,
  };
}

export function mapSalesforceOpportunity(
  row: unknown,
  contactId?: string | null,
): CanonicalDeal | null {
  const item = record(row);
  const id = text(item.Id);
  if (!id) return null;
  return {
    externalId: id,
    name: text(item.Name) ?? "Salesforce opportunity",
    value: numberValue(item.Amount),
    stage: text(item.StageName),
    source: "Salesforce",
    companyName: text(record(item.Account).Name),
    externalCompanyId: text(item.AccountId),
    externalContactId: contactId ?? null,
    payload: item,
  };
}

export function mapCloseLead(row: unknown): {
  company: CanonicalCompany | null;
  contacts: CanonicalContact[];
} {
  const item = record(row);
  const id = text(item.id);
  const name = text(item.display_name) ?? text(item.name);
  const company = id && name
    ? {
        externalId: id,
        name,
        website: text(item.url),
        payload: item,
      }
    : null;
  const contacts = (Array.isArray(item.contacts) ? item.contacts : [])
    .map((contactRow) => {
      const contact = record(contactRow);
      const contactId = text(contact.id);
      if (!contactId) return null;
      const emails = Array.isArray(contact.emails) ? contact.emails : [];
      const phones = Array.isArray(contact.phones) ? contact.phones : [];
      const names = splitName(contact.name);
      return {
        externalId: contactId,
        firstName: names.firstName,
        lastName: names.lastName,
        email: text(record(emails[0]).email),
        phone: text(record(phones[0]).phone),
        companyName: name,
        externalCompanyId: id,
        source: "Close",
        payload: contact,
      } satisfies CanonicalContact;
    })
    .filter((contact): contact is CanonicalContact => Boolean(contact));
  return { company, contacts };
}

export function mapCloseOpportunity(row: unknown): CanonicalDeal | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  return {
    externalId: id,
    name: text(item.lead_name) ?? text(item.note) ?? text(item.status_label) ?? "Close opportunity",
    value: numberValue(item.value) != null ? Number(item.value) / 100 : null,
    stage: text(item.status_type) === "won"
      ? "Won"
      : text(item.status_type) === "lost"
        ? "Lost"
        : text(item.status_label),
    source: "Close",
    externalContactId: text(item.contact_id),
    externalCompanyId: text(item.lead_id),
    payload: item,
  };
}

export function mapPipedriveOrganization(row: unknown): CanonicalCompany | null {
  const item = record(row);
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return null;
  return {
    externalId: id,
    name,
    domain: text(item.cc_email),
    payload: item,
  };
}

export function mapPipedrivePerson(row: unknown): CanonicalContact | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  const names = splitName(item.name);
  const email = Array.isArray(item.email) ? record(item.email[0]).value : item.email;
  const phone = Array.isArray(item.phone) ? record(item.phone[0]).value : item.phone;
  return {
    externalId: id,
    firstName: text(item.first_name) ?? names.firstName,
    lastName: text(item.last_name) ?? names.lastName,
    email: text(email),
    phone: text(phone),
    companyName: text(item.org_name),
    externalCompanyId: text(record(item.org_id).value) ?? text(item.org_id),
    source: "Pipedrive",
    payload: item,
  };
}

export function mapPipedriveDeal(row: unknown): CanonicalDeal | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  return {
    externalId: id,
    name: text(item.title) ?? "Pipedrive deal",
    value: numberValue(item.value),
    stage: text(item.status) === "won" ? "Won" : text(item.status) === "lost" ? "Lost" : text(item.stage_id),
    source: "Pipedrive",
    companyName: text(item.org_name),
    externalContactId: text(item.person_id) ?? text(record(item.person_id).value),
    externalCompanyId: text(item.org_id) ?? text(record(item.org_id).value),
    payload: item,
  };
}

export function mapGoHighLevelContact(row: unknown): CanonicalContact | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  const names = splitName(item.name);
  return {
    externalId: id,
    firstName: text(item.firstName) ?? names.firstName,
    lastName: text(item.lastName) ?? names.lastName,
    email: text(item.email),
    phone: text(item.phone),
    companyName: text(item.companyName),
    source: text(item.source) ?? "GoHighLevel",
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    payload: item,
  };
}

export function mapGoHighLevelConversationContact(row: unknown): CanonicalContact | null {
  const item = record(row);
  const id = text(item.contactId);
  if (!id) return null;
  const fullName = text(item.fullName) ?? text(item.contactName);
  const names = splitName(fullName);
  const contactName = text(item.contactName);
  return {
    externalId: id,
    firstName: names.firstName,
    lastName: names.lastName,
    email: text(item.email),
    phone: text(item.phone),
    companyName: contactName && contactName !== fullName ? contactName : null,
    source: "GoHighLevel conversation",
    payload: item,
  };
}

export function mapGoHighLevelOpportunity(
  row: unknown,
): CanonicalDeal | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  const contact = record(item.contact);
  return {
    externalId: id,
    name: text(item.name) ?? text(contact.name) ?? "GoHighLevel opportunity",
    email: text(contact.email),
    phone: text(contact.phone),
    companyName: text(contact.companyName),
    value: numberValue(item.monetaryValue),
    stage: text(item.status),
    source: text(item.source) ?? "GoHighLevel",
    externalContactId: text(item.contactId),
    payload: item,
  };
}

export function mapStripeCustomer(row: unknown): CanonicalContact | null {
  const item = record(row);
  const id = text(item.id);
  if (!id) return null;
  const names = splitName(item.name);
  return {
    externalId: id,
    firstName: names.firstName,
    lastName: names.lastName,
    email: text(item.email),
    phone: text(item.phone),
    companyName: text(record(item.metadata).company) ?? text(item.name),
    source: "Stripe",
    payload: item,
  };
}

export function notionPageTitle(row: unknown): string {
  const item = record(row);
  const properties = record(item.properties);
  for (const value of Object.values(properties)) {
    const field = record(value);
    if (field.type === "title" && Array.isArray(field.title)) {
      const title = field.title
        .map((part) => text(record(part).plain_text))
        .filter(Boolean)
        .join("");
      if (title) return title;
    }
  }
  return text(record(record(item.properties).title).plain_text) ?? "Notion page";
}

function asUuid(value: string) {
  const hex = value.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function notionPageToChunks(row: unknown) {
  const item = record(row);
  const id = asUuid(text(item.id) ?? "");
  if (!id) return [];
  const title = notionPageTitle(item);
  const url = text(item.url) ?? "";
  const content = [title, url].filter(Boolean).join("\n");
  return splitContextText(content || title).map((chunk, index) => ({
    sourceType: "notion_page",
    sourceId: id,
    chunkIndex: index,
    content: chunk,
    tokenCount: estimateTokens(chunk),
    occurredAt: text(item.last_edited_time) ?? new Date().toISOString(),
    metadata: { title, url, provider: "notion" },
  }));
}

async function hubspotList(objectType: string, properties: string[], token: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const results: unknown[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      properties: properties.join(","),
    });
    if (after) params.set("after", after);
    const payload = record(
      await getJson(`https://api.hubapi.com/crm/v3/objects/${objectType}?${params}`, headers),
    );
    results.push(...(Array.isArray(payload.results) ? payload.results : []));
    after = text(record(record(payload.paging).next).after);
    if (!after) break;
  }
  return results;
}

async function hubspotAssociations(
  fromType: string,
  toType: string,
  ids: string[],
  token: string,
) {
  const links = new Map<string, string>();
  if (!ids.length) return links;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    try {
      const payload = record(
        await postJson(
          `https://api.hubapi.com/crm/v4/associations/${fromType}/${toType}/batch/read`,
          headers,
          { inputs: batch.map((id) => ({ id })) },
        ),
      );
      for (const row of Array.isArray(payload.results) ? payload.results : []) {
        const item = record(row);
        const fromId = text(record(item.from).id);
        const firstTo = record((Array.isArray(item.to) ? item.to : [])[0]);
        const toId = text(firstTo.toObjectId) ?? text(firstTo.id);
        if (fromId && toId) links.set(fromId, toId);
      }
    } catch {
      // Associations are optional; CRM objects still ingest without them.
    }
  }
  return links;
}

export async function fetchHubSpotSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  const [companies, contacts, deals] = await Promise.all([
    hubspotList("companies", ["name", "domain", "website", "industry"], oauth.accessToken).catch(
      () => [],
    ),
    hubspotList(
      "contacts",
      ["firstname", "lastname", "email", "phone", "company", "associatedcompanyid"],
      oauth.accessToken,
    ),
    hubspotList("deals", ["dealname", "amount", "dealstage", "pipeline", "closedate"], oauth.accessToken),
  ]);
  const contactIds = contacts.map((row) => text(record(row).id)).filter((id): id is string => Boolean(id));
  const dealIds = deals.map((row) => text(record(row).id)).filter((id): id is string => Boolean(id));
  const [contactCompanies, dealContacts, dealCompanies] = await Promise.all([
    hubspotAssociations("contacts", "companies", contactIds, oauth.accessToken),
    hubspotAssociations("deals", "contacts", dealIds, oauth.accessToken),
    hubspotAssociations("deals", "companies", dealIds, oauth.accessToken),
  ]);
  return {
    companies: companies.map(mapHubSpotCompany).filter((row): row is CanonicalCompany => Boolean(row)),
    contacts: contacts
      .map((row) => mapHubSpotContact(row, contactCompanies))
      .filter((row): row is CanonicalContact => Boolean(row)),
    deals: deals
      .map((row) => {
        const id = text(record(row).id);
        return mapHubSpotDeal(row, {
          contactId: id ? dealContacts.get(id) ?? null : null,
          companyId: id ? dealCompanies.get(id) ?? null : null,
        });
      })
      .filter((row): row is CanonicalDeal => Boolean(row)),
  };
}

async function salesforceQuery(instanceUrl: string, token: string, soql: string) {
  const url = `${instanceUrl.replace(/\/$/, "")}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
  const payload = record(
    await getJson(url, { Authorization: `Bearer ${token}`, Accept: "application/json" }),
  );
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function fetchSalesforceSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  if (!oauth.instanceUrl) {
    throw new Error("Reconnect Salesforce so Bylda can store the instance URL.");
  }
  const [accounts, contacts, opportunities, roles] = await Promise.all([
    salesforceQuery(
      oauth.instanceUrl,
      oauth.accessToken,
      "SELECT Id, Name, Website, Industry FROM Account ORDER BY LastModifiedDate DESC LIMIT 500",
    ),
    salesforceQuery(
      oauth.instanceUrl,
      oauth.accessToken,
      "SELECT Id, FirstName, LastName, Email, Phone, AccountId, Account.Name FROM Contact ORDER BY LastModifiedDate DESC LIMIT 500",
    ),
    salesforceQuery(
      oauth.instanceUrl,
      oauth.accessToken,
      "SELECT Id, Name, Amount, StageName, AccountId, Account.Name FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 500",
    ),
    salesforceQuery(
      oauth.instanceUrl,
      oauth.accessToken,
      "SELECT OpportunityId, ContactId, IsPrimary FROM OpportunityContactRole LIMIT 500",
    ).catch(() => []),
  ]);
  const contactByOpportunity = new Map<string, string>();
  for (const role of roles) {
    const item = record(role);
    const opportunityId = text(item.OpportunityId);
    const contactId = text(item.ContactId);
    if (opportunityId && contactId && (item.IsPrimary === true || !contactByOpportunity.has(opportunityId))) {
      contactByOpportunity.set(opportunityId, contactId);
    }
  }
  return {
    companies: accounts.map(mapSalesforceAccount).filter((row): row is CanonicalCompany => Boolean(row)),
    contacts: contacts.map(mapSalesforceContact).filter((row): row is CanonicalContact => Boolean(row)),
    deals: opportunities
      .map((row) => mapSalesforceOpportunity(row, contactByOpportunity.get(String(record(row).Id)) ?? null))
      .filter((row): row is CanonicalDeal => Boolean(row)),
  };
}

async function closeList(path: string, token: string) {
  const results: unknown[] = [];
  let skip = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = record(
      await getJson(
        `https://api.close.com/api/v1/${path}/?_limit=${PAGE_LIMIT}&_skip=${skip}`,
        { Authorization: `Bearer ${token}`, Accept: "application/json" },
      ),
    );
    const rows = Array.isArray(payload.data) ? payload.data : [];
    results.push(...rows);
    if (!payload.has_more || !rows.length) break;
    skip += rows.length;
  }
  return results;
}

export async function fetchCloseSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  const [leads, opportunities] = await Promise.all([
    closeList("lead", oauth.accessToken),
    closeList("opportunity", oauth.accessToken),
  ]);
  const companies: CanonicalCompany[] = [];
  const contacts: CanonicalContact[] = [];
  for (const lead of leads) {
    const mapped = mapCloseLead(lead);
    if (mapped.company) companies.push(mapped.company);
    contacts.push(...mapped.contacts);
  }
  return {
    companies,
    contacts,
    deals: opportunities.map(mapCloseOpportunity).filter((row): row is CanonicalDeal => Boolean(row)),
  };
}

async function pipedriveList(apiDomain: string, path: string, token: string) {
  const base = apiDomain.replace(/\/$/, "");
  const results: unknown[] = [];
  let start = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = record(
      await getJson(
        `${base}/api/v1/${path}?start=${start}&limit=${PAGE_LIMIT}`,
        { Authorization: `Bearer ${token}`, Accept: "application/json" },
      ),
    );
    const rows = Array.isArray(payload.data) ? payload.data : [];
    results.push(...rows);
    const more = record(record(payload.additional_data).pagination).more_items_in_collection;
    if (!more || !rows.length) break;
    start += rows.length;
  }
  return results;
}

export async function fetchPipedriveSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  const apiDomain = oauth.apiDomain ?? "https://api.pipedrive.com";
  const [orgs, persons, deals] = await Promise.all([
    pipedriveList(apiDomain, "organizations", oauth.accessToken),
    pipedriveList(apiDomain, "persons", oauth.accessToken),
    pipedriveList(apiDomain, "deals", oauth.accessToken),
  ]);
  return {
    companies: orgs.map(mapPipedriveOrganization).filter((row): row is CanonicalCompany => Boolean(row)),
    contacts: persons.map(mapPipedrivePerson).filter((row): row is CanonicalContact => Boolean(row)),
    deals: deals.map(mapPipedriveDeal).filter((row): row is CanonicalDeal => Boolean(row)),
  };
}

export async function fetchGoHighLevelSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  if (!oauth.locationId) throw new Error("Connect your GoHighLevel account first");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${oauth.accessToken}`,
    Version: "v3",
  };
  const [contactsResponse, opportunitiesResponse, conversationsResponse] = await Promise.all([
    fetch("https://services.leadconnectorhq.com/contacts/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ locationId: oauth.locationId, pageLimit: PAGE_LIMIT }),
    }),
    fetch(
      `https://services.leadconnectorhq.com/opportunities/search?locationId=${encodeURIComponent(oauth.locationId)}&limit=${PAGE_LIMIT}`,
      { headers },
    ),
    fetch(
      `https://services.leadconnectorhq.com/conversations/search?locationId=${encodeURIComponent(oauth.locationId)}&limit=${PAGE_LIMIT}&sort=desc&sortBy=last_message_date`,
      { headers },
    ),
  ]);
  if (contactsResponse.status === 401 || opportunitiesResponse.status === 401) {
    throw new Error("GoHighLevel rejected this token. Check its sub-account and scopes.");
  }
  if (!contactsResponse.ok) throw new Error("Could not read GoHighLevel contacts");
  const contactsPayload = record(await contactsResponse.json());
  const opportunitiesPayload = opportunitiesResponse.ok
    ? record(await opportunitiesResponse.json())
    : { opportunities: [] };
  const conversationsPayload = conversationsResponse.ok
    ? record(await conversationsResponse.json())
    : { conversations: [] };
  const contacts = (contactsPayload.contacts ?? contactsPayload.results ?? []) as unknown[];
  const opportunities = (opportunitiesPayload.opportunities ??
    opportunitiesPayload.results ??
    []) as unknown[];
  const conversationContacts = (conversationsPayload.conversations ?? []) as unknown[];
  const contactsByExternalId = new Map<string, CanonicalContact>();
  for (const contact of contacts
    .map(mapGoHighLevelContact)
    .filter((row): row is CanonicalContact => Boolean(row))) {
    contactsByExternalId.set(contact.externalId, contact);
  }
  for (const contact of conversationContacts
    .map(mapGoHighLevelConversationContact)
    .filter((row): row is CanonicalContact => Boolean(row))) {
    if (!contactsByExternalId.has(contact.externalId)) {
      contactsByExternalId.set(contact.externalId, contact);
    }
  }
  const companyNames = new Map<string, CanonicalCompany>();
  const mappedContacts = [...contactsByExternalId.values()].map((contact) => {
    if (contact.companyName) {
      const key = contact.companyName.toLowerCase();
      if (!companyNames.has(key)) {
        companyNames.set(key, {
          externalId: `name:${key}`,
          name: contact.companyName,
          payload: { name: contact.companyName, source: "gohighlevel" },
        });
      }
      contact.externalCompanyId = `name:${key}`;
    }
    return contact;
  });
  return {
    companies: [...companyNames.values()],
    contacts: mappedContacts,
    deals: opportunities
      .map(mapGoHighLevelOpportunity)
      .filter((row): row is CanonicalDeal => Boolean(row)),
  };
}

export async function fetchStripeSnapshot(oauth: StoredOAuth): Promise<CrmSnapshot> {
  const payload = record(
    await getJson("https://api.stripe.com/v1/customers?limit=100", {
      Authorization: `Bearer ${oauth.accessToken}`,
      Accept: "application/json",
    }),
  );
  const customers = Array.isArray(payload.data) ? payload.data : [];
  return {
    contacts: customers
      .map(mapStripeCustomer)
      .filter((row): row is CanonicalContact => Boolean(row)),
  };
}

export async function fetchNotionPages(oauth: StoredOAuth) {
  const payload = record(
    await postJson(
      "https://api.notion.com/v1/search",
      {
        Authorization: `Bearer ${oauth.accessToken}`,
        "Notion-Version": "2022-06-28",
        Accept: "application/json",
      },
      { page_size: 20, filter: { value: "page", property: "object" } },
    ),
  );
  return (Array.isArray(payload.results) ? payload.results : []).flatMap(notionPageToChunks);
}
