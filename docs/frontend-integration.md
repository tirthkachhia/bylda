# Frontend integration — original live app

Destination: tirthkachhia/bylda, local codex/frontend-ui-integration branch.
UI source: Bylda/bylda origin/integration at da7b38b.

Imported unchanged: V1 design tokens/fonts and Icon, SidebarItem, Wordmark, cn.
Adapted: 64px rail, 248px sidebar, 56px header and responsive navigation into
LiveWorkspaceShell; home presentation uses the new typography and cards.

The original authenticated layout, queries, AI endpoint, CRM setup, sync,
write-back, uploads, settings and sign-out remain. No mock mode is enabled.
No Supabase/Workers files, schemas or credentials changed for this UI work.

This is the first UI integration pass, not a full replacement of all V1 screens.
The source's behavioral intelligence, coaching lifecycle, rooms, reports and
search screens rely on mock or missing contracts. They were not copied into
production as working features. Existing real screens remain accessible.
The source's read-only CRM rule was not adopted: the user's original write-back
functionality takes precedence.

Vercel keeps the original project link and Nitro preset. Patched TanStack Start
1.168.60, React Router 1.170.41 and router-plugin 1.168.42 remain aligned.
Do not replace these with the older versions in the UI source repo.

Verification: bun run build; bun run test; targeted CRM profile worker tests.
This checkout contains earlier uncommitted backend work, intentionally preserved.
Do not blanket-stage or publish unrelated pending changes.

## Release verification

- V1 styling now covers the live Calls, CRM Setup, Integrations, Accounts,
  Deal Memory, Reports and Settings pages. Their original query/action paths remain.
- Browser navigation verified on the production app; Accounts loaded 661 contacts,
  Home loaded 291 calls, and Integrations showed Close connected. Counts are a
  point-in-time observation, not fixture data or proof of a new sync.
- Removed the obsolete First Customers/Launchpad navigation and memory copy.
- Added accessible names for compact header actions.
- Automated suite: 25 files, 178 tests passed. Production build passed.
- No customer CRM writes, connector reinstalls, or destructive actions were run
  during this visual regression pass. Transcript ingestion and CRM write-back
  have regression coverage but were not newly exercised end-to-end in this pass.
- The commit also preserves earlier pending backend implementation already in
  this checkout; no production Supabase migrations were applied by this UI task.
