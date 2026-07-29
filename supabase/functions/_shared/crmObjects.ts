// Shared CRM object resolution — the Phase 0 foundation.
//
// One place that knows how to create-or-match the core CRM records so every
// entry point (crm-action, bylda-action, workflows) produces the same coherent
// graph: a lead is linked to a contact, a contact is linked to a company, and
// companies/contacts are deduped instead of piling up duplicates.
//
// All writes here assume a service-role (admin) client — RLS is intentionally
// bypassed, so callers MUST verify org membership before invoking these.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

/** Strip protocol, `www.`, path and query so `https://www.Acme.com/x` → `acme.com`. */
export function normalizeDomain(raw: unknown): string | null {
  if (!raw) return null;
  const d = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
  return d || null;
}

export interface CompanyInput {
  name?: unknown;
  domain?: unknown;
  website?: unknown;
  industry?: unknown;
  size?: unknown;
  location?: unknown;
}

export interface ResolvedCompany {
  id: string;
  name: string;
  created: boolean;
}

/**
 * Find an org's company by normalized domain (preferred) or case-insensitive
 * name, creating it if there is no match. Returns null when there is nothing to
 * key on (no name and no domain).
 */
export async function resolveCompany(
  admin: SupabaseClient,
  orgId: string,
  input: CompanyInput,
): Promise<ResolvedCompany | null> {
  const name = input.name ? String(input.name).trim() : "";
  const domain = normalizeDomain(input.domain ?? input.website);
  if (!name && !domain) return null;

  // Dedupe by domain first (strongest signal), then by name.
  if (domain) {
    const { data: byDomain } = await admin
      .from("companies")
      .select("id, name, domain")
      .eq("organization_id", orgId)
      .ilike("domain", `%${domain}%`)
      .limit(25);
    const hit = (byDomain ?? []).find((c) => normalizeDomain(c.domain) === domain);
    if (hit) return { id: hit.id as string, name: hit.name as string, created: false };
  }
  if (name) {
    const { data: byName } = await admin
      .from("companies")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .limit(25);
    const hit = (byName ?? []).find(
      (c) => String(c.name).trim().toLowerCase() === name.toLowerCase(),
    );
    if (hit) return { id: hit.id as string, name: hit.name as string, created: false };
  }

  const { data: created, error } = await admin
    .from("companies")
    .insert({
      organization_id: orgId,
      name: name || domain!,
      domain: domain,
      website: input.website ? String(input.website) : null,
      industry: input.industry ? String(input.industry) : null,
      size: input.size ? String(input.size) : null,
      location: input.location ? String(input.location) : null,
    })
    .select("id, name")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create company");
  // Flag any near-duplicates this new account collides with (best-effort).
  await scanForDuplicates(admin, orgId, "company", created.id as string);
  return { id: created.id as string, name: created.name as string, created: true };
}

export interface ContactInput {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  source?: unknown;
  tags?: unknown;
  company_id?: string | null;
}

export interface ResolvedContact {
  id: string;
  created: boolean;
}

/**
 * Find an org's contact by email (case-insensitive) or exact name, creating one
 * if there is no match. `contacts` is user-owned (user_id NOT NULL) and keyed on
 * `org_id`, so the caller's userId owns any newly created contact. When a
 * companyId is supplied, an existing contact missing a company link is backfilled.
 * Returns null when there is not enough to identify a person (no name, no email).
 */
export async function resolveContact(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  input: ContactInput,
): Promise<ResolvedContact | null> {
  const firstName = input.first_name ? String(input.first_name).trim() : "";
  const lastName = input.last_name ? String(input.last_name).trim() : "";
  const email = input.email ? String(input.email).trim() : "";
  if (!firstName && !lastName && !email) return null;

  let match: { id: string; company_id: string | null } | null = null;

  if (email) {
    const { data } = await admin
      .from("contacts")
      .select("id, company_id")
      .eq("org_id", orgId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data) match = data as { id: string; company_id: string | null };
  }
  if (!match && (firstName || lastName)) {
    let q = admin.from("contacts").select("id, company_id").eq("org_id", orgId);
    q = firstName ? q.ilike("first_name", firstName) : q.is("first_name", null);
    q = lastName ? q.ilike("last_name", lastName) : q.is("last_name", null);
    const { data } = await q.limit(1).maybeSingle();
    if (data) match = data as { id: string; company_id: string | null };
  }

  if (match) {
    // Backfill the company link if we now know it and the contact had none.
    if (input.company_id && !match.company_id) {
      await admin.from("contacts").update({ company_id: input.company_id }).eq("id", match.id);
    }
    return { id: match.id, created: false };
  }

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      org_id: orgId,
      user_id: userId,
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      phone: input.phone ? String(input.phone) : null,
      company: input.company ? String(input.company) : null,
      company_id: input.company_id ?? null,
      source: input.source ? String(input.source) : "bylda",
      tags: Array.isArray(input.tags) ? (input.tags as string[]) : [],
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create contact");
  // Flag any near-duplicates this new person collides with (best-effort).
  await scanForDuplicates(admin, orgId, "contact", created.id as string);
  return { id: created.id as string, created: true };
}

interface DuplicateCandidate {
  id: string;
  confidence: number;
  reason: string;
}

/**
 * Insert a duplicate pair into the dedupe queue, ordered deterministically so
 * the (org, type, unordered-pair) unique index makes re-scanning idempotent.
 * A unique-violation (pair already queued) is swallowed.
 */
async function queueDuplicate(
  admin: SupabaseClient,
  orgId: string,
  entityType: "contact" | "company",
  idA: string,
  idB: string,
  confidence: number,
  reason: string,
): Promise<void> {
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA];
  const { error } = await admin.from("duplicate_matches").insert({
    organization_id: orgId,
    entity_type: entityType,
    entity_id_a: a,
    entity_id_b: b,
    confidence,
    reason,
    status: "pending",
  });
  // 23505 = unique_violation: the pair is already queued — that's fine.
  if (error && error.code !== "23505") {
    // Non-fatal: dedupe is a best-effort background concern.
    console.error("queueDuplicate failed", error.message);
  }
}

/**
 * Scan an org for likely duplicates of one just-created record and enqueue any
 * matches into `duplicate_matches`. Best-effort: never throws to the caller.
 * Contacts key on email (strong) then exact name; companies on normalized
 * domain (strong) then exact name. Archived/merged records are ignored.
 */
export async function scanForDuplicates(
  admin: SupabaseClient,
  orgId: string,
  entityType: "contact" | "company",
  entityId: string,
): Promise<void> {
  try {
    if (entityType === "contact") {
      const { data: self } = await admin
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("id", entityId)
        .maybeSingle();
      if (!self) return;
      const found = new Map<string, DuplicateCandidate>();

      if (self.email) {
        const { data } = await admin
          .from("contacts")
          .select("id")
          .eq("org_id", orgId)
          .neq("id", entityId)
          .neq("status", "merged")
          .ilike("email", String(self.email))
          .limit(25);
        for (const c of data ?? [])
          found.set(c.id as string, { id: c.id as string, confidence: 0.95, reason: "same email" });
      }
      if (self.first_name && self.last_name) {
        const { data } = await admin
          .from("contacts")
          .select("id")
          .eq("org_id", orgId)
          .neq("id", entityId)
          .neq("status", "merged")
          .ilike("first_name", String(self.first_name))
          .ilike("last_name", String(self.last_name))
          .limit(25);
        for (const c of data ?? [])
          if (!found.has(c.id as string))
            found.set(c.id as string, {
              id: c.id as string,
              confidence: 0.75,
              reason: "same name",
            });
      }
      for (const m of found.values())
        await queueDuplicate(admin, orgId, "contact", entityId, m.id, m.confidence, m.reason);
      return;
    }

    // company
    const { data: self } = await admin
      .from("companies")
      .select("id, name, domain")
      .eq("id", entityId)
      .maybeSingle();
    if (!self) return;
    const domain = normalizeDomain(self.domain);
    const found = new Map<string, DuplicateCandidate>();

    if (domain) {
      const { data } = await admin
        .from("companies")
        .select("id, domain")
        .eq("organization_id", orgId)
        .neq("id", entityId)
        .is("merged_into_id", null)
        .ilike("domain", `%${domain}%`)
        .limit(25);
      for (const c of data ?? [])
        if (normalizeDomain(c.domain) === domain)
          found.set(c.id as string, {
            id: c.id as string,
            confidence: 0.95,
            reason: "same domain",
          });
    }
    if (self.name) {
      const { data } = await admin
        .from("companies")
        .select("id, name")
        .eq("organization_id", orgId)
        .neq("id", entityId)
        .is("merged_into_id", null)
        .ilike("name", String(self.name))
        .limit(25);
      for (const c of data ?? [])
        if (
          !found.has(c.id as string) &&
          String(c.name).trim().toLowerCase() === String(self.name).trim().toLowerCase()
        )
          found.set(c.id as string, { id: c.id as string, confidence: 0.75, reason: "same name" });
    }
    for (const m of found.values())
      await queueDuplicate(admin, orgId, "company", entityId, m.id, m.confidence, m.reason);
  } catch (e) {
    console.error("scanForDuplicates failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Log a lead-lifecycle activity onto the CRM timeline. `crm_activities.deal_id`
 * is NOT NULL, so this is only for lead-scoped events (create, stage change,
 * note). `type` must be one of the values allowed by the table's check
 * constraint (see the Phase 0 migration, which adds 'created').
 */
export async function logLeadActivity(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  leadId: string,
  type: "created" | "note" | "stage_change" | "email" | "call" | "task" | "meeting",
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await admin
    .from("crm_activities")
    .insert({
      organization_id: orgId,
      deal_id: leadId,
      user_id: userId,
      type,
      content,
      metadata,
    })
    .then(
      () => {},
      () => {},
    );
}
