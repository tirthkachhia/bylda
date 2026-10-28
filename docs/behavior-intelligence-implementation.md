# Behavioral intelligence MVP

This implements the next analyzer iteration around three behavior families: discovery linked to recommendation, objection clarification/resolution, and commitment/next steps. Six analytical dimensions remain independent; there is no new overall effectiveness score. Existing reports and Jev scores remain compatible projections and diagnostics.

## Analysis and evidence

- `analyze-behavior.ts` processes every available transcript turn in bounded, sequential chunks, carrying source-linked earlier commitments/concerns forward. The ending is included. Empty/malformed results, provider truncation, oversized inputs, and deadlines fail explicitly rather than publishing partial coverage as a full call.
- The general-sales pass receives current source turns, separately labeled sourced prior context, and at most four reviewed coaching examples. It receives no assigned playbook. Execution is evaluated separately against the saved playbook version. Different wording/order/options alone are not failure.
- Each event retains context, the rep action, subsequent buyer speech (or no observable response), progression, interpretation, alternative explanations, a coaching action, uncertainty, opportunity applicability, stage and confidence. Source text, speaker and timestamps are attached in code from referenced turn IDs. Unsupported roles, fabricated IDs, and responses preceding the action are rejected. Short acknowledgments cannot establish full objection resolution by themselves.
- These checks establish attribution and source identity, not semantic truth. Manager review remains necessary. Speaker/timing values are model estimates; recording completeness and carrier outcomes remain unverified. A transcript cannot establish external policy activation/payment. No emotional/personality judgments or measured rushing metrics are added.
- The legacy extraction now has a larger budget and retains the opening and ending when it must omit a middle section. Its coverage is still disclosed independently. Behavioral coverage does not imply the legacy extraction saw every turn.
- Execution supports fulfilled (`followed`), adapted, partial, missed, not applicable and not observable. Ambiguous/buyer-only quotes become not observable; partial legacy coverage cannot establish an omission. Absent validated guideline judgments become explicit unknowns.

## Retention and learning

The migration adds:

| Store                        | Purpose                                                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coaching_analysis_runs`     | Immutable successful analysis snapshots: rep/call, actual call time, transcript hash and source snapshot/provenance, context receipt, model/prompt/taxonomy/playbook versions, coverage, token counts, all validated events and execution judgments |
| `coaching_behavior_events`   | Queryable per-run events with a stable occurrence key within the transcript snapshot, separate evidence and assessment, applicability and timestamps                                                                                                |
| `coaching_behavior_feedback` | Append-only manager accuracy, usefulness and correction records                                                                                                                                                                                     |
| `coaching_policy_versions`   | Immutable, explicitly manager-approved policy/source text versions; these are supplied organizational references, not a declaration of legal correctness                                                                                            |
| `coaching_reviewed_examples` | Service-only retrieval of accurate **and** useful reviewed examples; latest labels per reviewer must agree, disputed examples are withheld, and repeated analyses of one occurrence are deduplicated                                                |

The guarded `complete_call_analysis` RPC archives the run/events in the same transaction as the current insight projection and job completion. An archive failure rolls back the projection. Transcript text, structured-transcript changes, changed rep assignment and stale runs are guarded. A later analysis does not delete earlier behavioral records or their reviews. Deleting the call intentionally cascades its history; this is not indefinite retention after deletion.

Existing legacy exchange scores/moments/adherence still function as replaceable projections. They should not be used as an immutable analysis history. Reports prefer execution judgments from the retained run when available.

Reviewed examples may inform coaching alternatives on future calls. They are not current-call evidence or product/policy authority. Incorrect/unhelpful labels remain available for evaluation but do not automatically become training labels. This implements retrieval and review, not automatic model weight updates or automatic promotion of a new rubric.

## Rep and manager delivery

- Call review leads with an observed final state, a supported strength, one next-call action, buyer response, source evidence and uncertainty. The full retained event set is available behind details. Six judgments and execution checklists are secondary views.
- Recording links seek to source timestamps and attempt playback. If the recording is unavailable, the transcript is navigated instead. Report links can load older cited calls outside the recent-call list and must not substitute another recording. Timestamp accuracy still depends on the transcript source.
- The manager brief uses actual call occurrence time and the latest retained run per call. It includes selected eligible opportunities, concerns, strengths/counterexamples, coaching actions and source links. Selected opportunities are not an exhaustive denominator of every opportunity in the recording.
- General behavior trends require matching model/prompt/taxonomy, objective, stage and buyer constraints, accurate reviewer labels, at least five judged opportunities across three calls in **each** of two non-overlapping 30-day periods. Unknown/unobservable/ineligible/unreviewed cases do not silently become failures. Results are descriptive, not evidence that coaching caused change. Otherwise the state is insufficient evidence.
- Composite legacy scores and raw curves are drill-down diagnostics, not effectiveness verdicts. Exchange flags are not unique compliance incidents. A manager marking a conversation held does not assert that an email/Slack notification was delivered.

## Security and rollout

The tracked development/production environment files contained a service-role credential. It has been removed from the new source, and a regression test checks this boundary. **The credential must still be rotated in Supabase and replaced in the server/worker secret stores. Removing it from source does not revoke it or erase Git history.** Public frontend connection settings remain configured.

New tables enforce organization-scoped reads; members cannot write analyses or edit reviews. Manager/owner/admin roles can append reviews and approve policy versions. Report updates are restricted to the delivery/conversation timestamp column and authorized managers. Backend writes use the existing server service role.

Deployment order:

1. Rotate the exposed credential and configure the replacement in server/worker secret stores through the existing operational process. Never place it in a tracked or browser-exposed environment file.
2. Apply `20261027000001_behavior_intelligence.sql` after the existing coaching/context migrations. Take the usual database backup first.
3. Deploy `analyze-call` and `coaching-report`, then the frontend from this branch. Old callers stay compatible with the completion RPC. The new analyzer fails clearly if its storage migration is missing.
4. Re-analyze a small fixed call sample. Existing reports are not fabricated into historical behavioral records. Inspect beginning/ending coverage, role attribution, applicability, opportunity counts, policy references and source navigation.
5. Have managers review accuracy and usefulness separately. Compare baseline/revised output with the same complete inputs, model and playbook version before claiming an improvement rate. Track cost, latency and failure rates, especially for long calls under the existing edge timeout.

Changes are source-tested locally; this document is not a claim that production migrations, credential rotation, deployments or live-model acceptance testing have happened.

Still separate integration work: externally verified carrier/CRM outcomes, automated email/Slack delivery, coaching-assignment-based causal measurement, policy maintenance UI, and model fine-tuning. Actual insurance rules/product promises require approved maintained sources; none are invented by this change.

## Validation

- Unit/regression tests cover source hydration, actor/order checks, acknowledgments, independent general judgment, approved policy citations, chunk coverage, moment selection and comparable trend denominators.
- PostgreSQL-backed tests use PGlite and the **actual existing completion RPC plus the new migration**. They cover rollback, retained history, transcript changes, organization isolation, manager-only append-only feedback, reviewed-example eligibility, policy approval and restricted report updates.
- Playback tests exercise timestamp parsing, media seeking and recording-unavailable behavior.
- Full app type-check, Deno edge checks and production build are part of the verification. Existing type errors encountered during this work were repaired using real SDK/runtime declarations and narrowed values, rather than disabling type checking.
