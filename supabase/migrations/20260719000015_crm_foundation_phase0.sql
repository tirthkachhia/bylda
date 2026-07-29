-- ── Phase 0: CRM Foundation Fix ──────────────────────────────────────────────
-- Makes the core CRM graph coherent:
--   • crm_activities can record 'created' events (not just note/stage_change),
--     so deal creation shows up on the timeline.
--   • dedupe indexes back the create-or-match logic in _shared/crmObjects.ts
--     (company by domain/name, contact by email/name).
-- Everything is additive and idempotent.

-- 1. Allow 'created' on the activity timeline.
alter table public.crm_activities drop constraint if exists crm_activities_type_check;
alter table public.crm_activities
  add constraint crm_activities_type_check
  check (type in ('created', 'note', 'stage_change', 'email', 'call', 'task', 'meeting'));

-- 2. Nova can now propose create_company (matches the widened propose_action tool).
alter table public.nova_actions drop constraint if exists nova_actions_action_type_check;
alter table public.nova_actions
  add constraint nova_actions_action_type_check
  check (action_type = any (array[
    'update_lead_stage',
    'log_crm_note',
    'create_task',
    'create_contact',
    'create_company',
    'log_memory',
    'trigger_n8n_workflow'
  ]::text[]));

-- 3. Dedupe support — case-insensitive lookups on the keys crm-action matches on.
create index if not exists idx_companies_org_domain_lower
  on public.companies (organization_id, lower(domain));
create index if not exists idx_companies_org_name_lower
  on public.companies (organization_id, lower(name));
create index if not exists idx_contacts_org_email_lower
  on public.contacts (org_id, lower(email));
