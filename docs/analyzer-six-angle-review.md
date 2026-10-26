# Analyzer review: six independent angles

Working review with Tirth, 2026-10-26. No production logic or playbook assignments changed.

## Decision

Evaluate general selling ability independently of the script. Following a playbook is evidence of process execution, not proof of effectiveness. Closing is evidence of an outcome, not proof that every rep action was good or safe. An appropriate disqualification or respectful end can also be good selling.

Produce six findings with supporting timestamps/quotes, confidence, and explicit unknowns. Keep them separate before writing a combined coaching recommendation. Do not collapse them into one quality score during the experiment.

| Angle | Main question | Do not substitute |
|---|---|---|
| Playbook execution | Which applicable objectives were fulfilled, adapted, skipped, or not observable? | Exact wording or a fixed sequence for the purpose of the step |
| Sales effectiveness | Did the approach help the customer make an informed, suitable decision toward the call goal? | Script adherence or closing alone |
| Rep behavior | Did the rep listen, clarify, adapt, explain, handle objections, and respect boundaries? | Customer enthusiasm as proof of skill |
| Customer reaction/state | What did the customer explicitly express: need, concern, understanding, confusion, willingness, resistance? | Hidden emotion, honesty, or motivation |
| Sales progression/state | What changed from start to finish: discovery, option selection, commitment, application, reported approval, next step? | Friendly tone, logistics answers, or a rep claim as verified completion |
| Risk/compliance | What statements or conduct merit review, under which supplied rule or policy? | A legal violation inferred from a script mismatch |

Use judgments such as positive / mixed / negative / insufficient evidence with a short explanation. Use stage/state labels for progression, and review severity plus evidence for risk. Do not force all six into arbitrary numeric scales.

## What the current implementation does

- `analysis-prompt.ts` tells the model that the playbook changes judgments and decides what matters. `analyze-call/index.ts` reinforces playbook-grounded coaching.
- `trajectory.ts` weights quality as rep move 40%, playbook coverage 30%, low risk 15%, and final customer temperature 15%. Coverage is distinct detected guideline choices divided by all guidelines, without an applicability denominator.
- Jev already asks separately about rep moves, customer temperature, playbook step, and introduced risk. Reuse this foundation. Its rep-move prompt explicitly says a good move can get a cold reply.
- `findLearningMoments` selects only temperature drops, risk flags, and weak moves. Successful adaptations cannot become selected positive learning moments through a prose prompt alone.
- `report-input.ts` excludes moments without a guideline from themes. `report-contract.ts` prefers playbook themes and describes the playbook as the coaching standard. This can reintroduce bias after the call analysis improves.
- Customer temperature mixes interest with commitment/application logistics. The risk question mixes sales friction with compliance review concerns. These need distinct definitions.
- Narrative analysis clips the start of the transcript at 40,000 characters. Jev uses a backward window (opening plus recent exchanges), so it can also lose earlier commitment context.

## Live pilot inspected in Chrome

Workspace: KOACH AI. Rep 1 has 11 calls, 10 reviewed. Rep 1 is assigned **Life insurance outbound (test) v2**, not the available **Anshs test v1**. Anshs test explicitly values flexible wording, permits one or two options, and says to stop selling after commitment. This assignment difference must be controlled in comparisons.

For the first selected Oct 18, 12:05 AM recording:

| Angle | Preliminary human review from visible transcript |
|---|---|
| Execution | The displayed v2 analysis marks two options instead of Gold/Silver/Bronze as a weakness. Anshs test explicitly permits two options. Reassess against the intended version. |
| Effectiveness | At 3:40–4:50 the rep clarifies the remaining expense gap and desired coverage. At 7:38 the rep links two options to the stated need; at 8:04 the customer selects the larger option. These are useful sales actions regardless of script wording. |
| Behavior | Discovery and recommendation linkage are strengths. At 43:14–43:29 the customer declines further referral discussion and says they need to leave; the rep acknowledges this but continues the topic. That is a specific coaching opportunity even after a successful application. |
| Customer state | The customer expresses need, selects an option, and later confirms premium and carrier. The existing summary also reports a scam concern; inspect that passage directly before making it a final evidence-backed finding. |
| Progression | At 38–40 minutes the customer is guided through the application/signature flow. At 41:10 the rep announces approval; at 41:36–41:52 premium and carrier are confirmed. Describe approval as reported by the rep; carrier status is not independently verified here. |
| Risk | At 2:24 the rep makes a broad term-policy payout claim, at 7:13 describes day-one coverage, and at 43:31 invokes a state requirement. Flag claims for verification against approved materials; do not declare them true, false, or unlawful from transcript alone. |

The stored summary says the call ended during medical questions, but the transcript ends at 44:18 with a wrap-up. The UI discloses that only 39,775 of 53,365 characters were analyzed. This is a coverage failure as well as a judgment problem.

This is a preliminary review of one call, not a completed model benchmark or a measured improvement claim.

## Changes by effort

| Change | Category | Scope |
|---|---|---|
| Judge general selling independently; recognize effective adaptation and poor execution despite adherence | Prompt | Revise call, Jev, explanation, and report instructions consistently |
| Stop automatically recommending a return to script; explain observed impact and alternatives | Prompt | Existing coaching output can carry better prose |
| Separate observation from inference; qualify reported outcomes and unknowns | Prompt | Preserve quote validation and coverage disclosure |
| Remove coverage from experimental general-effectiveness scoring | Small logic change | Recompute from saved features where available; version the formula and avoid comparing it blindly with old scores |
| Include successful adaptations and group themes without guideline IDs | Small development | Moment types/selection, report grouping, tests, and any UI assumptions |
| Return six independently validated results | Small development | Tool schema, normalization, persistence, and rendering; a prompt cannot preserve fields the parser drops |
| Separate progression from temperature and sales friction from policy risk | Small development | Questions, response types, summaries, evidence and unknown states |
| Apply stage-aware adherence and unknown/not-observable statuses | Small development | Rubric, applicability rules, schema/normalizer and denominator |
| Analyze the ending and maintain earlier commitment context | Small development | Full-call or chunked evidence extraction with synthesis, explicit coverage; validate cost and context limits |
| Carrier-confirmed outcomes, policy-grounded compliance determinations, longitudinal conversion | Larger development | External evidence/integrations and maintained policy sources; defer until needed |

Prompt changes are still code changes and deployments in this repo. There is no demonstrated runtime switch for six modes. Testing the concept offline needs no new product screens or database migrations. Production persistence may reuse existing JSON insights, but six fields still need validation and rendering; inspect reporting/query needs before deciding on a migration.

## Proposed comparison before a major build

1. Freeze the same ten reviewed calls, transcript hashes, call goals, and Anshs test version. Preserve original outputs. Keep the failed transcription outside the analysis benchmark.
2. Tirth labels representative strengths, weaknesses, progression, and risk-review concerns before seeing candidate outputs. Include the three requested combinations where the calls support them; do not manufacture cases.
3. Compare A: existing baseline, B: revised independent prompts using the same input coverage, C: revised prompts plus minimal scoring/selection changes. Separately test complete-call coverage so gains are attributable.
4. For the initial experiment, run six isolated analysis passes per call, then synthesize without averaging. Give playbook content to execution; provide task context and approved policy context to the other passes, without treating script wording as their rubric. Six product services are unnecessary.
5. Require each finding to carry call ID, angle, judgment, evidence quote/timestamp, observation, interpretation, confidence, and missing evidence. Match quotes and speakers to source. Missing context means unknown, not failure.
6. Measure unsupported criticism, unsupported praise, useful strengths/weaknesses, outcome accuracy, risk-review recall, and Tirth's usefulness rating; record cost, latency, and repeat-run consistency on ambiguous cases. Add a playbook-swap check: general selling judgments should stay stable unless relevant task or policy context changes.
7. Review disagreements together. Ship the smallest change set that fixes repeatable errors. Ten calls establish direction, not broad accuracy. No percentage uplift is justified yet.

Suggested first priority: independent general-sales coaching, accurate full-call progression, and removal of playbook coverage from the experimental effectiveness verdict. Then test whether separate positive moments and report grouping materially improve usefulness before building a larger dashboard.
