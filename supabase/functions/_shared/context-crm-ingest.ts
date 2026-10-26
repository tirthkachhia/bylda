import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { resolveCompany } from "./crmObjects.ts";
import {
  emitDomainEvent,
  markRawObjectProcessed,
  sha256Hex,
  storeRawObject,
  upsertExternalObject,
} from "./context-ingestion.ts";

export type CanonicalCompany = {
  externalId: string;
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  payload: Record<string, unknown>;
};

export type CanonicalContact = {
  externalId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  externalCompanyId?: string | null;
  source?: string | null;
  tags?: string[];
  payload: Record<string, unknown>;
};

export type CanonicalDeal = {
  externalId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  value?: number | null;
  stage?: string | null;
  source?: string | null;
  externalContactId?: string | null;
  externalCompanyId?: string | null;
  payload: Record<string, unknown>;
};

export type CrmSnapshot = {
  companies?: CanonicalCompany[];
  contacts?: CanonicalContact[];
  deals?: CanonicalDeal[];
};

export type CrmIngestResult = {
  provider: string;
  companies_imported: number;
  contacts_imported: number;
  deals_imported: number;
  companies_received: number;
  contacts_received: number;
  deals_received: number;
};

export function mapDealStage(value: unknown): string {
  const stage = String(value ?? "").trim();
  if (!stage) return "New";
  const normalized = stage.toLowerCase().replace(/[_-]+/g, " ");
  const compact = normalized.replace(/\s+/g, "");
  if (compact === "won" || compact.endsWith("closedwon") || /\bwon\b/.test(normalized))
    return "Won";
  if (compact === "lost" || compact.endsWith("closedlost") || /\blost\b/.test(normalized)) {
    return "Lost";
  }
  if (/\b(proposal|quote|quoted|negotiat\w*|contract)\b/.test(normalized)) return "Proposal";
  if (/\b(qualified|open|active|in progress|pipeline)\b/.test(normalized)) return "Qualified";
  if (/\b(contacted|engaged|attempting|replied)\b/.test(normalized)) return "Contacted";
  return "New";
}

async function storeRaw(
  admin: SupabaseClient,
  organizationId: string,
  provider: string,
  objectType: string,
  externalId: string,
  payload: Record<string, unknown>,
) {
  const snapshotHash = await sha256Hex(JSON.stringify(payload));
  return storeRawObject(admin, {
    organizationId,
    provider,
    objectType,
    externalId,
    idempotencyKey: `${externalId}:${snapshotHash}`,
    payload,
  });
}

async function mappedCompanyId(
  admin: SupabaseClient,
  organizationId: string,
  provider: string,
  externalId?: string | null,
): Promise<string | null> {
  if (!externalId) return null;
  const { data } = await admin
    .from("integration_external_objects")
    .select("canonical_id")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("external_object_type", "company")
    .eq("external_object_id", externalId)
    .eq("canonical_type", "company")
    .maybeSingle();
  return data?.canonical_id ? String(data.canonical_id) : null;
}

export async function ingestCrmSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    provider: string;
    sourceLabel: string;
    snapshot: CrmSnapshot;
  },
): Promise<CrmIngestResult> {
  const companies = (input.snapshot.companies ?? []).filter((row) => row.externalId && row.name);
  const contacts = (input.snapshot.contacts ?? []).filter((row) => row.externalId);
  const deals = (input.snapshot.deals ?? []).filter((row) => row.externalId);
  const rawIds = new Map<string, string | null>();

  await Promise.all([
    ...companies.map(async (company) => {
      rawIds.set(
        `company:${company.externalId}`,
        await storeRaw(
          admin,
          input.organizationId,
          input.provider,
          "company",
          company.externalId,
          company.payload,
        ),
      );
    }),
    ...contacts.map(async (contact) => {
      rawIds.set(
        `contact:${contact.externalId}`,
        await storeRaw(
          admin,
          input.organizationId,
          input.provider,
          "contact",
          contact.externalId,
          contact.payload,
        ),
      );
    }),
    ...deals.map(async (deal) => {
      rawIds.set(
        `deal:${deal.externalId}`,
        await storeRaw(
          admin,
          input.organizationId,
          input.provider,
          "deal",
          deal.externalId,
          deal.payload,
        ),
      );
    }),
  ]);

  const companyIdByExternal = new Map<string, string>();
  for (const company of companies) {
    const existingId = await mappedCompanyId(
      admin,
      input.organizationId,
      input.provider,
      company.externalId,
    );
    const resolved = existingId
      ? { id: existingId }
      : await resolveCompany(admin, input.organizationId, {
          name: company.name,
          domain: company.domain,
          website: company.website,
          industry: company.industry,
        });
    if (!resolved) continue;
    companyIdByExternal.set(company.externalId, resolved.id);
    await Promise.all([
      upsertExternalObject(admin, {
        organizationId: input.organizationId,
        provider: input.provider,
        externalObjectType: "company",
        externalObjectId: company.externalId,
        canonicalType: "company",
        canonicalId: resolved.id,
        metadata: { name: company.name, domain: company.domain ?? null },
      }),
      markRawObjectProcessed(
        admin,
        rawIds.get(`company:${company.externalId}`) ?? null,
        "company",
        resolved.id,
      ),
    ]);
  }

  const contactExternalIds = contacts.map((contact) => contact.externalId);
  const existingContactsResult = contactExternalIds.length
    ? await admin
        .from("contacts")
        .select("id,external_id,company_id")
        .eq("org_id", input.organizationId)
        .eq("external_source", input.provider)
        .in("external_id", contactExternalIds)
    : { data: [], error: null };
  if (existingContactsResult.error) {
    throw new Error(`Existing contact lookup failed: ${existingContactsResult.error.message}`);
  }
  const contactIdByExternal = new Map<string, { id: string; companyId: string | null }>();
  for (const row of existingContactsResult.data ?? []) {
    if (!row.external_id) continue;
    contactIdByExternal.set(String(row.external_id), {
      id: String(row.id),
      companyId: row.company_id ? String(row.company_id) : null,
    });
  }

  const contactRows = contacts.map((contact) => {
    const linkedCompanyId =
      (contact.externalCompanyId
        ? companyIdByExternal.get(contact.externalCompanyId)
        : undefined) ??
      contactIdByExternal.get(contact.externalId)?.companyId ??
      null;
    return {
      user_id: input.userId,
      org_id: input.organizationId,
      first_name: contact.firstName ?? null,
      last_name: contact.lastName ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      company: contact.companyName ?? null,
      company_id: linkedCompanyId,
      status: "new",
      source: contact.source ?? input.sourceLabel,
      tags: contact.tags ?? [],
      custom_fields: { [input.provider]: contact.payload },
      external_source: input.provider,
      external_id: contact.externalId,
      updated_at: new Date().toISOString(),
    };
  });

  let contactsImported = 0;
  if (contactRows.length) {
    const { data, error } = await admin
      .from("contacts")
      .upsert(contactRows, { onConflict: "org_id,external_source,external_id" })
      .select("id,external_id,company_id");
    if (error) throw new Error(`Contact import failed: ${error.message}`);
    contactsImported = data?.length ?? contactRows.length;
    for (const row of data ?? []) {
      if (!row.external_id) continue;
      const externalId = String(row.external_id);
      contactIdByExternal.set(externalId, {
        id: String(row.id),
        companyId: row.company_id ? String(row.company_id) : null,
      });
      await Promise.all([
        upsertExternalObject(admin, {
          organizationId: input.organizationId,
          provider: input.provider,
          externalObjectType: "contact",
          externalObjectId: externalId,
          canonicalType: "contact",
          canonicalId: String(row.id),
        }),
        markRawObjectProcessed(
          admin,
          rawIds.get(`contact:${externalId}`) ?? null,
          "contact",
          String(row.id),
        ),
      ]);
    }
  }

  const dealExternalIds = deals.map((deal) => deal.externalId);
  const existingLeadsResult = dealExternalIds.length
    ? await admin
        .from("leads")
        .select("id,external_id,contact_id,company_id")
        .eq("organization_id", input.organizationId)
        .eq("external_source", input.provider)
        .in("external_id", dealExternalIds)
    : { data: [], error: null };
  if (existingLeadsResult.error) {
    throw new Error(`Existing deal lookup failed: ${existingLeadsResult.error.message}`);
  }
  const existingLeadByExternal = new Map<
    string,
    { contactId: string | null; companyId: string | null }
  >();
  for (const row of existingLeadsResult.data ?? []) {
    if (!row.external_id) continue;
    existingLeadByExternal.set(String(row.external_id), {
      contactId: row.contact_id ? String(row.contact_id) : null,
      companyId: row.company_id ? String(row.company_id) : null,
    });
  }

  const leadRows = deals.map((deal) => {
    const linkedContact = deal.externalContactId
      ? contactIdByExternal.get(deal.externalContactId)
      : undefined;
    const existingLead = existingLeadByExternal.get(deal.externalId);
    const companyId =
      (deal.externalCompanyId ? companyIdByExternal.get(deal.externalCompanyId) : undefined) ??
      linkedContact?.companyId ??
      existingLead?.companyId ??
      null;
    return {
      organization_id: input.organizationId,
      user_id: input.userId,
      name: deal.name || `${input.sourceLabel} deal`,
      email: deal.email ?? null,
      phone: deal.phone ?? null,
      company: deal.companyName ?? null,
      contact_id: linkedContact?.id ?? existingLead?.contactId ?? null,
      company_id: companyId,
      stage: mapDealStage(deal.stage),
      source: deal.source ?? input.sourceLabel,
      value: deal.value ?? null,
      external_source: input.provider,
      external_id: deal.externalId,
      external_data: deal.payload,
      updated_at: new Date().toISOString(),
    };
  });

  let dealsImported = 0;
  if (leadRows.length) {
    const { data, error } = await admin
      .from("leads")
      .upsert(leadRows, { onConflict: "organization_id,external_source,external_id" })
      .select("id,external_id");
    if (error) throw new Error(`Deal import failed: ${error.message}`);
    dealsImported = data?.length ?? leadRows.length;
    for (const row of data ?? []) {
      if (!row.external_id) continue;
      const externalId = String(row.external_id);
      await Promise.all([
        upsertExternalObject(admin, {
          organizationId: input.organizationId,
          provider: input.provider,
          externalObjectType: "deal",
          externalObjectId: externalId,
          canonicalType: "lead",
          canonicalId: String(row.id),
        }),
        markRawObjectProcessed(
          admin,
          rawIds.get(`deal:${externalId}`) ?? null,
          "lead",
          String(row.id),
        ),
      ]);
    }
  }

  await emitDomainEvent(admin, {
    organizationId: input.organizationId,
    eventKey: `${input.provider}:sync:${new Date().toISOString().slice(0, 13)}`,
    eventType: "crm.sync.completed",
    source: "sync-crm",
    subjectType: "integration",
    payload: {
      provider: input.provider,
      companies_imported: companyIdByExternal.size,
      contacts_imported: contactsImported,
      deals_imported: dealsImported,
    },
  });

  return {
    provider: input.provider,
    companies_imported: companyIdByExternal.size,
    contacts_imported: contactsImported,
    deals_imported: dealsImported,
    companies_received: companies.length,
    contacts_received: contacts.length,
    deals_received: deals.length,
  };
}
