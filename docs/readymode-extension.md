# ReadyMode Chrome importer

The ReadyMode connector in Integrations has **Chrome extension** (default) and **Admin webhook** options. Existing webhook ingestion remains unchanged. The downloadable ZIP is generated from `extensions/readymode/` by `bun run extension:package`; builds regenerate it.

## Deploy

1. Apply `20261117000001_readymode_extension.sql` (new private connection table, no user-readable policies).
2. Deploy `readymode-extension` with JWT verification disabled, as declared in `supabase/config.toml`. It explicitly authenticates JWTs for connection management and hashed tokens for import-only actions. Deploy `import-call` too, since its existing behavior now lives in `_shared/import-call.ts`.
3. Existing `COACHING_WORKER_URL` and `COACHING_WORKER_SECRET` are required for transcription/analysis queue dispatch. Private `call-audio` storage and the existing worker pipeline are reused.
4. Publish the app build, including `/downloads/bylda-readymode-extension.zip`.

The extension is fixed to the production BYLDA Supabase origin. Changing projects requires updating `manifest.json` and `core.js` together. Never bundle a service key, user session, or workspace import token.

## Protocol

Authenticated members call `readymode-extension` with `{action: connect|status|disconnect, organization_id}`. Connect returns a one-time-displayed JSON code containing an opaque token and endpoint. Replacing a code immediately revokes its predecessor. Disconnect deletes the hashed connection row. Tokens expire in 30 days; every operation rechecks workspace membership.

The extension sends `x-bylda-connection` with bounded JSON. `prepare` validates source identity/permission/file type/size, checks call ownership, and mints an immutable private storage upload URL. The extension uploads audio directly to that signed storage URL; no ReadyMode cookies are sent to BYLDA. `import` verifies storage size, calls the same shared manual import pipeline with a server-selected ReadyMode source, and queues transcription or analysis. Supplied transcripts use worker `kind: analyze`. Audio-only imports use the existing transcription queue. A failed queue request reports an error and supports retry with the same deterministic UUID v8 call ID.

No undocumented ReadyMode endpoints are guessed. The collector reads rendered call rows, audio/source elements, download anchors, exposed call IDs, and available transcript elements. It supports old Xencall domains. The ReadyMode UI can vary by tenant, so real tenant validation is still necessary. Hidden players, inaccessible frames, opaque download controls, redirects, or media on unsupported hosts use the explicit file-attachment fallback. It does not traverse report pagination or auto-export every call in the account.

## Verification

Tests cover realistic call-log DOM, source-domain validation, stable identities, extension token parsing, destination restrictions, private audio upload, transcript-only import, duplicate retry preparation, and failed queues/uploads. Build/package checks verify the downloadable artifact. Live tenant imports require a ReadyMode account with call-recording download permission.
