# Visual frontend integration

The original application remains the functional foundation. This revision uses the Bylda/bylda frontend's typography, colors, UI primitives and navigation styling without replacing the original data or business flows.

The new desktop/mobile navigation points to the original routes. The existing canvas still uses its original onOpen, onBack, onHome and onAsk callbacks and renders its original page content. CRM write-back, calls, deal memory, context memory, records, forecasts, integrations and account tools continue using the original code.

All original src/lib helpers, authentication/client gateways, Supabase functions/migrations/types, Workers, n8n workflows, environment files, deployment config and functional page components remain unchanged. The prior imported product screens, data adapters, mocks, source-resolution changes and unavailable-state behavior have been removed. Original auth redirect behavior is restored.

Dependencies: the four font packages used by the new design are added while retaining the original locked package versions. @radix-ui/react-slot is explicitly declared because the original UI imports it and the original lock already contains it.

Validation: Bun frozen-lockfile install and Bun production Vercel build pass. The original suite has 152 passing tests and 2 pre-existing integration-catalog failures, plus 4 passing navigation/callback regression tests. Lint of the edited shell/layout components passes. No original backend or src/lib files differ from the original main snapshot.

The PR remains a draft until the external preview deployment is verified. No production merge or backend migration is part of this change.
