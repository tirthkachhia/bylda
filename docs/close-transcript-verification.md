# Close transcript verification — 2026-09-23

Production: https://app.usebylda.com

## Fixed and deployed
- `sync-crm` now requests Close call activities, including explicitly selected `recording_transcript` and `voicemail_transcript` fields.
- Native utterances retain speaker labels and timestamps. Notes/summaries are not treated as transcripts.
- If native text is absent, up to three recordings per sync are downloaded with Close OAuth, stored in private workspace storage, and transcribed through the configured Cloudflare worker. OAuth credentials are never forwarded off api.close.com.
- Repeated syncs reuse saved transcripts and do not create duplicate calls. Missing analysis is retried.
- Integrations → Close → Manage now has a sync button and persistent result report.
- Fixed the worker splitting encoded audio at arbitrary byte boundaries (which broke WAV decoding); whole validated files are sent to transcription.

## Live results
- Close OAuth sync: 1 contact, 3 calls, 3 transcripts.
- The three Close recordings were 6, 12, and 11 seconds; native Close transcript fields were empty. Cloudflare produced transcripts of 42, 43, and 42 characters. All three have persisted AI insight rows.
- Bylda call IDs: `fd0197cc-83f3-4c20-a0a8-3af3d324cf2a`, `11cf78ef-b6c4-4e5e-8cf6-0e4d48901acd`, `4d7fc04b-d170-404e-b700-080bf314b17c`.
- Separate clearly labeled synthetic audio import: `ab633f7a-57cc-4024-8291-cf17e56f78c9`; 303-character transcript and AI evidence saved. This is a manual test, NOT a native Close call.
- No customer records were written back to Close and no outbound communications were sent.

## Limits / follow-up
- This verifies manual sync → recording transcription → AI analysis, not unattended scheduling or Close CRM write-back.
- At most 500 recent calls are checked and 3 missing transcripts generated per sync. Remaining recordings require another sync.
- Short recordings are not sufficient to validate deep discovery/coaching quality.
- Native Close transcript parsing is fixture-tested; the live account supplied recordings only.
- Frontend and functions deployed from local checkout; changes are not committed/pushed by this task.

Sources: https://developer.close.com/api/resources/activities/calls and https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
