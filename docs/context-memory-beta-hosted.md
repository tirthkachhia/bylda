# Context Memory beta without Docker

The browser and Vite application run on localhost. Supabase Postgres, Auth, and
Edge Functions run in a separate hosted development project. This keeps real
beta data isolated from production and does not require Docker.

## 1. Create the development backend

Create a new Supabase project named `bylda-context-beta`. Copy its project
reference, project URL, publishable/anon key, and database password.

Link this repository to that development project:

```powershell
bunx supabase login
bunx supabase link --project-ref <development-project-ref>
bunx supabase db push
```

Do not link or push this migration to the production project for beta testing.

## 2. Configure localhost

Create `.env.local` in the repository root:

```text
VITE_SUPABASE_URL=https://<development-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<development-publishable-or-anon-key>
VITE_SUPABASE_PROJECT_ID=<development-project-ref>
```

The publishable/anon key is intended for browser use. Never put the service-role
key in `.env.local` or any `VITE_` variable.

## 3. Configure hosted Edge Function secrets

Generate separate beta encryption and webhook secrets:

```powershell
$encryptionKey = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$webhookSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Configure the development project:

```powershell
bunx supabase secrets set `
  APP_URL=http://localhost:8080 `
  INTEGRATIONS_ENCRYPTION_KEY=$encryptionKey `
  INBOUND_WEBHOOK_SECRET=$webhookSecret `
  GHL_CLIENT_ID=<your-ghl-client-id> `
  GHL_CLIENT_SECRET=<your-ghl-client-secret> `
  ANTHROPIC_API_KEY=<optional-for-call-analysis>
```

`ANTHROPIC_API_KEY` is required only for the “Analyze selected call” action.
CRM synchronization and Context Package assembly are deterministic and do not
require a model key.

Add the development callback URL to the GoHighLevel OAuth application:

```text
https://<development-project-ref>.supabase.co/functions/v1/integration-oauth-callback
```

Keep the existing production callback registered as well.

## 4. Deploy the beta functions

```powershell
bunx supabase functions deploy integration-oauth-start
bunx supabase functions deploy integration-oauth-callback --no-verify-jwt
bunx supabase functions deploy sync-gohighlevel
bunx supabase functions deploy get-inbound-url
bunx supabase functions deploy ingest-call-webhook --no-verify-jwt
bunx supabase functions deploy context-package
bunx supabase functions deploy analyze-call
```

Shared modules under `supabase/functions/_shared` are bundled automatically.

## 5. Run and use the beta

```powershell
bun run dev
```

Open `http://localhost:8080`, create/sign in to a beta account, then open:

```text
http://localhost:8080/app/context-memory
```

The beta workflow uses real data:

1. Connect GoHighLevel under Integrations.
2. Select “Sync real contacts and opportunities.”
3. Copy the secure call webhook into a dialer/transcription provider.
4. Select an imported deal or ingested call.
5. Build and inspect the live Context Package.
6. Optionally run call intelligence with the Context Package.

No fixture or demo rows are used by this screen.
