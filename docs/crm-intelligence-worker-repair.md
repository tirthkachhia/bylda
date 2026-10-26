# Original app CRM setup repair

Branch: backend/crm-intelligence-setup. No production changes performed.

## Cause confirmed in code

The questionnaire invoked generate-crm-intelligence-profile, which used the
Anthropic PAL rather than the existing Cloudflare worker. AI failures were caught
and silently saved as an industry template with an active status.

## Repair

The edge function now calls https://ai.usebylda.com with the signed-in user's JWT,
the intake answers, business context, and the existing JSON profile schema.
Response shape and enums are validated before normalization and persistence.
AI failures do not overwrite a previous profile. Owner/admin authorization remains
required. Storage readiness is checked before spending inference time.

Saved active profiles remain in crm_intelligence_profiles scoped by organization_id.
The existing analyze-call function loads that active profile and hydrates its
industry-specific extraction fields. This does not create provider-native CRM
custom fields or bypass write-back review and field mapping requirements.

No frontend files changed (backend-track constraint). Existing frontend issues to
address separately: setup's load effect silently ignores database errors, and a
missing currentOrgId leaves its spinner running indefinitely.

## Verification

Run from this checkout:

```sh
npx vitest run --config supabase/tests/crm-profile.vitest.config.ts
```

Nine tests pass using mocked worker HTTP responses. This verifies request wiring,
industry-specific response preservation, schema rejection, and HTTP error paths;
it does not prove live model quality, database persistence, or live CRM writes.

## Approved release steps for Ansh

1. Verify the app and worker both target Supabase project ipidfqwlszuhjgjygbvx.
2. Confirm migration 20260822000001_crm_intelligence_profiles.sql is already
   applied; test any missing migration on a local stack/branch first. Do not bulk
   push unrelated pending migrations.
3. After approval only:

```sh
npx supabase functions deploy generate-crm-intelligence-profile --project-ref ipidfqwlszuhjgjygbvx
```

The existing worker endpoint is reused; no worker deployment or Anthropic key is
needed. In a test workspace, submit separate solar and insurance questionnaires,
reload and confirm profile persistence and generatedBy=cloudflare-workers-ai:…,
then analyze synthetic transcripts and confirm the relevant fields are extracted.
Verify any external CRM write separately against a designated test record.
