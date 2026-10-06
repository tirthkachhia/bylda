# Frontend integration

The original `tirthkachhia/bylda` backend and existing workflows remain the base.
The new UI was imported from `Bylda/bylda`'s `integration` branch at `da7b38b`.

## Behavior

- Existing URLs and business logic are retained. The new shell's Revenue workspace section links to Today, CRM call actions/write-back, deal memory, context memory, CRM records, forecasts, CRM setup, automations, integrations and account settings.
- New calls/reviews, uploads, integrations and supported account/billing fields use the imported adapters against the existing Supabase and edge-function contracts.
- Supabase functions, migrations, generated database types, Workers, n8n workflows, credentials, shared auth/client gateways and deployment config are unchanged.
- Missing V1 domains do not silently return sample data. They render an unavailable state; the existing tools remain accessible. No backend schemas were invented to support the redesign.
- Explicit `VITE_BYLDA_MOCKS=true` remains a development/demo option and shows a persistent sample-data label. It bypasses sign-in as in the source frontend; do not enable it for a live workspace.
- CRM write-back remains available through the existing CRM call workflow. The new V1 integration screens are read-only by design.

## Readiness and validation

The frontend's `GAPS.md` and `BACKEND_BACKLOG.md` describe new product features without backing tables/endpoints. Coaching, rooms, behavioral intelligence and V1 reports cannot be made live through a visual-only integration. Production uses unavailable/empty states for these features rather than demo fixtures.

The production Vercel build, token check, backend boundary check and lint of the integration-specific changes pass. Frontend typecheck reports the same 9 errors as the unchanged original branch; no added type errors were found. The imported and original test suite: 869 passed, 36 skipped, 2 failed; 6 additional production-data regression tests pass. The same 2 integration-catalog failures reproduce on the unchanged original main branch (GHL catalog requirements), so they are pre-existing. Full-repository lint did not complete; targeted integration lint passed.

A signed-in live smoke test still requires the deployed backend and a test account; no production data was altered during validation. This change is prepared for review, not merged or deployed.
