# Actual LLM pilot: general sales judgment independent of the playbook

2026-10-26. Three uploaded calls, six isolated analysis angles per call. Production analyzer, assignments, and saved insights were not changed.

## Finding

The distinction Tirth wants is useful and visible in the recordings: an effective recommendation can differ from the older script, and a call that advances can still contain poor decisions. However, this experiment does **not** establish that a broad six-angle prompt, a larger model, or model self-review is reliable enough to ship by itself.

The next MVP iteration should combine independent sales judgment with source-backed evidence and accurate call-state tracking. Keep playbook execution separate. Do not average it into effectiveness.

## What actually ran

- Used Cloudflare-hosted `@cf/openai/gpt-oss-120b` for 18 completed angle evaluations across three distinct calls, with one validation retry each (36 inference requests). General sales passes received no playbook or previous analyzer output. Execution passes received **Anshs test v1**.
- Used every available structured turn: 487, 504, and 436 turns, reaching approximately 44, 51, and 49 minutes. This means all available transcript turns, not independently verified completeness against the audio.
- Masked long numeric identifiers and emails. No production database writes or retranscription. Private source and raw results remain under ignored `.analyzer-eval.local/`.
- Ran one additional same-model evidence audit on Call A, then a focused six-excerpt evaluation. These also made important errors; neither is treated as ground truth.
- An independent model comparison could not run: Cloudflare returned HTTP 429 stating its daily free neuron allocation had been exhausted. No plan or billing change was made.

The call analyzer in this repository uses the Anthropic abstraction layer, while this pilot used an available Cloudflare model. The live baseline also used a different playbook and truncated context. Consequently, this is an exploratory experiment, not a controlled prompt-only improvement benchmark, model ranking, or accuracy estimate.

## Evidence-reviewed examples

These conclusions were checked against speaker-labeled source turns by the coding agent. They are not human gold labels or proof of policy compliance. Raw model judgments were narrowed or rejected where unsupported.

| Call | General selling strength | Separate weakness or uncertainty | Observed progression |
|---|---|---|---|
| A · `81c26cf7` | At **7:38–8:16**, the rep connects two coverage options to the stated expense need, obtains a selection, confirms premium, and checks affordability. Two options are allowed by Anshs test; the older baseline criticized this for not using three packages. | At **20:48–21:20**, the customer raises a scam concern. The rep responds with a statement about the rep's own potential prison sentence rather than a clear verification route. Coach the response; do not call it a threat against the customer. Material coverage/payout claims require policy verification. | At **41:10**, the rep announces approval; later the premium and carrier are confirmed and the call wraps up. Approval is **rep-reported**, not independently verified activation. The old summary incorrectly ended the story at medical questions. |
| B · `ba204574` | The rep eventually elicits a concrete budget and confirms **$16.59 and the June 12 start date**, with the customer answering affirmatively at **20:43–21:16**. Earlier hesitation must not erase later agreement. | At **9:52–13:08**, the customer wants information and initially does not want to start; treating that only as a payment-timing objection misses a distinction. At **38:57–39:13**, the customer asks about viewing the application and the rep says they should be fine without doing so. That is a coaching concern about informed review, even if the application advances; no legal finding is made. | Later the rep reports approval and recaps the selected coverage/premium/start date. Customer willingness changes during the call; do not label the entire call as either continuous refusal or unqualified informed consent. |
| C · `13162e7b` | At **8:25–10:54**, the customer raises budget constraints. The rep asks about finances, acknowledges that $105 is too much, offers $55, and checks affordability. This is useful adaptation independent of script wording. | The ending provides contact details and a follow-up interval, but lacks a compact recap there of coverage, premium, draft date, and carrier together. Informality or offering a support number is not inherently misconduct. | The customer accepts the lower-priced option and participates in the application. The closing excerpt is friendly, but does not independently establish approval, activation, or payment. |

## Six-angle interpretation

| Angle | Call A | Call B | Call C |
|---|---|---|---|
| Playbook execution | Two-option presentation fulfills the flexible playbook objective | Decision/hesitation handling warrants review; later confirmation also counts | Affordability adaptation fulfills an objective; ending recap can improve |
| Sales effectiveness | Need-linked recommendation and a concrete choice | Budget clarification helps; earlier reframing and document-review response weaken the approach | Lower recommendation responds to the disclosed constraint |
| Rep behavior | Clear option confirmation; weak handling of verification concern | Persistence, assumptions, and confirmation must be assessed at their own moments | Useful budget clarification; keep rapport purposeful |
| Customer reaction/state | Need, choice, verification concern, later premium confirmation coexist | Initial reluctance changes to specific agreement; do not infer a single fixed state | States budget constraint, then accepts the lower option |
| Sales progression/state | Choice → application → rep-reported approval | Information-seeking → later specific price/date agreement → rep-reported approval | Lower option accepted → application activity; activation unverified |
| Risk/compliance | Verify material policy claims; do not invent a prison threat or licensing violation | Check informed-review handling; actual policy/legal context is absent | Verify applicable claims and procedures; do not fabricate rules against personal contact details |

These are evidence-based descriptions, not six calibrated scores. A complete call can contain both successful adaptation and poor behavior. The framework must also allow appropriate disqualification or respectful refusal to count as good selling without a close.

## Failures that the MVP must prevent

Four of the 18 final raw angle outputs passed the pilot's mechanical citation checks. Fourteen failed at least one check. Across those outputs there were nine quotations not verbatim anywhere in the supplied transcript, seven quotations attached to the wrong turn, nine genuine but too-short quotations rejected by the pilot's eight-character minimum, and one invalid finding category. The minimum-length failures are evaluator limitations, not fabricated evidence. These counts are not a general accuracy rate.

Passing quote checks still did not ensure sound judgment. Examples rejected during source review:

- A rep's statement about term coverage was attributed to the customer as the customer's own concern.
- A rep talking about their own possible prison sentence was described as threatening the customer.
- Lack of external license verification was treated as evidence of licensing misconduct.
- Providing a support number was treated as a privacy/consent breach without a supplied rule.
- A model praised telling the customer they did not need to view the application as proven correct procedure.
- A model called a statement about coverage beginning on day one a promise of immediate claim payment. Those are different assertions.

The same-model audit repeated several of these errors despite explicit corrections. Model self-review is a fallible additional signal, not validation.

## Smallest credible next iteration

1. **Prompt change:** independently assess the rep's move, customer's explicit response, and observed outcome. Ask what helped, what hurt, and what is unknown. Treat script execution as a separate reference. Do not require exact phrasing, three options, or a fixed sequence unless explicitly necessary for that objective.
2. **Small dev work:** have the model select source turn IDs; attach original text, speaker, and timestamp in code. Validate actor and response context. Short answers such as “yes” need the preceding question, not automatic rejection. Quote matching alone is insufficient.
3. **Small dev work:** preserve start/end and earlier commitment context; label reported approval separately from verified activation. Do not judge full-call outcomes from a clipped prefix.
4. **Small logic change:** remove playbook coverage from the effectiveness verdict; permit successful adaptations as learning moments. Keep risk and adherence visible independently. Update report selection too, or it will reintroduce script bias.
5. **Evaluation before rollout:** Tirth marks expected strengths, weaknesses, and final states on a fixed sample. Re-run the current and revised prompts with the same model, same complete inputs, and same playbook. Compare unsupported criticisms/praise, useful coaching, role attribution, and outcome accuracy. Use the rejected cases above as regression examples, without treating this agent's judgments as unquestionable labels.

No major dashboard or pipeline replacement is needed to test that iteration. No claim of percentage improvement is justified by this pilot.

## Reproducibility

- `scripts/analyzer-eval.py`: isolated six-angle inference, citation validation, retries and run manifest; no production writes.
- `scripts/analyzer-eval-audit.py`: experimental same-model audit and host-attached source evidence. Its semantic failures are retained for inspection, not approved results.
- Raw inputs/results: `.analyzer-eval.local/source.json`, `.analyzer-eval.local/results/`, and focused excerpt outputs in the same ignored directory. Do not commit these private files.
- Provider request format checked against [Cloudflare's model documentation](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/). The documentation supports the request format, not the sales judgments in this report.
