# Context + Memory MVP: local testing

The MVP runs entirely against local Supabase. Docker Desktop must be running.
These commands reset only the local database; do not add `--linked`.

## Start the local stack

```powershell
bun install
bunx supabase start
bunx supabase db reset
```

Create `supabase/.env.local`:

```text
INBOUND_WEBHOOK_SECRET=local-context-memory-secret
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

The Context Package and deterministic retrieval do not need model keys.
`ANTHROPIC_API_KEY` is only required to run call intelligence, and
`OPENAI_API_KEY` is reserved for optional embeddings.

Serve Edge Functions in one terminal:

```powershell
bunx supabase functions serve --env-file supabase/.env.local
```

Serve the application in another terminal:

```powershell
bun run dev
```

## Run tests

Pure context ranking, budgeting, phone normalization, and transcript chunking:

```powershell
bun run test:context
```

End-to-end smoke test against local Auth, Postgres, RLS, pgvector, and the
`context-package` Edge Function:

```powershell
bun run test:context:local
```

The smoke test creates an isolated organization, account, contact, deal, call,
transcript, baseline, and context evidence. It validates the returned
`ContextPackage` and removes the fixture afterward.

## Expected smoke-test output

The command prints JSON containing:

- `ok: true`
- `package_version: "1.0"`
- the resolved call entity
- the Acme fixture deal and contact
- at least one evidence item
- source-reference and context-version counts

If the smoke test reports that the function is unavailable, confirm that
`supabase functions serve` is still running.
