# Call coaching / Jonah signal framework

The Calls page now defaults to a dedicated Coaching tab. It adapts the V1 review
typography, neutral surfaces, evidence blocks, section filters and dark context
panel from Bylda/bylda's integration branch, without its mock data adapters.
The existing summary, transcript, imports, CRM sync and write-back remain.

## Contract

`analyze-call { call_id }` retains its authenticated organization membership
check. The existing `complete_call_analysis` RPC stores the additive JSON value
`vertical_insights.coaching`: `{version: 1, basis: "transcript", signals, limitations}`.
Each signal has category, signal, evidence_quote, context, rep_quote, buyer_quote,
interpretation, practice and source_offset. Source offset is normalized-text
position, NOT an audio timestamp. Evidence and optional speaker quotes must occur
in the transcript. Output is capped at 24 moments and ordered by source position.
No schema migration is required. Old analyses remain viewable and can be explicitly
re-analyzed. The UI never automatically submits customer CRM writes.

## Scope and limitations

Sixteen sections cover conversation dynamics, pace, delivery, opening, discovery,
listening, rep language, pitch, pricing, objections, buyer participation,
buyer-stated reactions, buying signals, structure, stages and closing.
Audio pitch/volume, validated timing, interruptions, overlap, ratios, quantitative
baselines and cross-call associations are NOT computed by this transcript path.
They are listed with required inputs, not fabricated. Buyer-stated reactions
replace inferred emotional-state scoring. All interpretations require human review.
No personality, workplace emotion, or employment suitability scoring is provided.

The backend uses its existing configured PAL/Anthropic analysis provider; this
change does not silently switch analysis to the Cloudflare transcription worker.
Only the first 24,000 transcript characters are analyzed, visibly marked when partial.

## Verification and deployment

`npx vitest run` includes adversarial quote, malformed-output, deduplication,
category, and invented-timestamp tests. `bun run build` checks production bundling.
No database migration or data deletion is required.

The user explicitly removed the approval requirement for this deployment.
Backend deployment command:
`npx supabase functions deploy analyze-call --project-ref ipidfqwlszuhjgjygbvx`

Frontend: `npx vercel@48 deploy --prod --yes`.

## Live verification (October 7, 2026)

- analyze-call deployed as active version 88, with JWT verification enabled.
- Frontend deployed at https://bylda-idryn2bht-bylda.vercel.app and app.usebylda.com.
- Generate coaching was exercised on the existing explicitly synthetic September
  27 10:39 PM QA call. It saved five verified-quote moments across four categories.
- Questions & discovery filter correctly showed only its two moments.
- CRM write-back remained present and disabled for this unmatched audio upload;
  no customer CRM records were modified.
- 184 automated tests passed and local/remote production builds passed.
- Repository-wide typecheck is not clean (existing errors outside these files);
  no diagnostics named the new coaching files or modified Calls route.
