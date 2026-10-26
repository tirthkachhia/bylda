# Manual call import

## Latest production verification — 2026-09-28

Upload form, global Storage setting, private bucket and worker now allow 100 MiB.
Worker passes a byte-limited stream to Whisper instead of buffering/base64-encoding
the entire file. All 176 tests pass, including exact-limit and oversized-stream cases.
A synthetic 104,832,102-byte WAV was uploaded through the production form with no
supplied transcript: Cloudflare returned 303 transcript characters and coaching
completed (`ccaf3d2d-271f-42aa-bbb8-5e950e016a0c`). Earlier MP3 and MP4 synthetic
uploads also completed transcription and coaching. No external CRM records were
changed. This supersedes the historical audio-testing blockers below.

The Calls page accepts private recording uploads (MP3, MP4, M4A, WAV, WebM, OGG, FLAC; up to 104,857,600 bytes, labelled 100 MB), transcript text, and optional call context. MP4 requires an audio track. The importer requires workspace membership and an explicit permission acknowledgment. Storage is private and organization-scoped; audio URLs sent to the transcription worker expire after three minutes.

## Release prerequisites

1. Apply `20260918000001_call_uploads.sql`, `20260928000001_call_video_uploads.sql`, and `20260928000002_call_upload_100mb.sql` to the intended Supabase project. The global Storage file-size setting must also allow at least 100 MiB (configured in `supabase/config.toml`).
2. Deploy `import-call` and `analyze-call` to that same project.
3. Configure server secrets `TRANSCRIPTION_WORKER_URL` and `CALL_TRANSCRIPTION_SECRET`. The existing worker contract accepts POST JSON `{ recording_url, provider, language }` and returns `{ transcript }`. The current import uses English. Do not expose these secrets to the browser.
4. Deploy the frontend. Verify authenticated upload, another workspace's access denial, transcription failure recovery, analysis retry, and sign-out.

Transcript-only imports do not require a transcription worker. If transcription fails or is unconfigured, the audio-backed call is retained and the user can paste a transcript and retry the same import. Analysis failure is reported separately from a successful save. Imports never write directly to an external CRM; manual calls are not automatically matched to a contact.

## Evidence limitations

User-supplied details are unverified context, not transcript evidence or instructions. Conduct observations require a matching transcript quote. The analyzer does not request sentiment scores or estimate talk-time ratios from plain text. Speaker timing metrics are not yet calculated. Analysis currently covers the first 24,000 characters; longer transcripts show an explicit partial-coverage notice. Stored transcript limit is 100,000 characters. Uploaded recordings are retained privately until a retention/deletion workflow is implemented; do not imply automatic deletion.

## Verification performed locally

Production build completed; 162 regression tests passed. These checks do not establish live transcription-worker availability or a successful production upload. A real recording and signed-in local/deployed session are still required for end-to-end verification.

## Production verification — 2026-09-18

Deployed frontend to `app.usebylda.com`, functions to `ipidfqwlszuhjgjygbvx`, and applied/recorded migration `20260918000001`. Verified in signed-in Chrome: synthetic transcript import, AI summary, six quote-backed conduct observations, persisted results after reload, CRM field preview, and disabled write-back without a linked contact. Unauthenticated import returned HTTP 401. Fixed missing required conduct output and imported calls being hidden beneath dated calls. Regression suite: 162 passed.

The labelled synthetic call remains in the workspace for inspection (`e50dbfbe-6ece-4691-9176-1d441f874642`); no external CRM writes were made. Audio-only end-to-end testing remains blocked by the Chrome extension's file-URL permission, not by a verified application error. Worker configuration names exist, but that alone is not proof of working audio transcription. Latest frontend deployment: `bylda-1oxblop9r-bylda.vercel.app`.
