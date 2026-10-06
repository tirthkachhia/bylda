# Lane 6 section 3 — delivery previews

Base: integration f92f575. User waived the fresh-session rule; section-specific branch preserves PR45. P1/P2/P5 unchanged. No merge.

P3 uses the saved 760px frame with a 640px email and 40px inset; P4 uses the 420px card with 32/28px insets and dark focus panel; P10 uses a 794px, minimum 1123px print document with 64px insets and bottom footer. Wordmark and kit geometry follow repository policy. Saved references read and compared to screenshots. Missing content changes heights and density substantially: these are not pixel-identical or merge-ready content-complete screens.

Current shared Brief has no typed executive summary, team behavior/coaching table, call coverage or delivery metadata. No daily_rep exists. Structured section gaps remain explicit. No free-form BriefSection body rendered because its individual statements have no confidence/sample contract. Outcome claims withheld without a closed-deal count; threshold and causal checks applied. Personal insight bodies/sample labels withheld to avoid embedded peer comparisons; no evidence links without call ownership. All supplied observations show confidence and sample. Low-confidence insights never receive an action.

Viewer access resolves before mounting report hooks. Managers require exact team subject; personal delivery requires exact viewer subject and daily_rep kind. Reps cannot see manager email/print. Generic Y9 and error copy avoids server-message leaks. Loading/error/empty boundaries and unavailable buttons present. Preview doesn't send email, push or generate a server PDF.

QA screenshots: design-qa/P3.png, P4.png, P10.png plus rep captures. Chrome mock browser: 7 checks, zero page errors; manager and rep on all three screens, missing personal brief and full report navigation. Native widths verified 640/420/794. Layout also centered responsively at 1440.

Validation: 14 new tests (privacy, evidence thresholds, outcomes, causal claims, wrong subject/kind, pre-fetch access, loading/error/empty). Full suite 673 pass, 36 skip, same 2 integrations-catalog failures as clean baseline (659 pass). Typecheck exactly the same 8 baseline errors. Changed lint, tokens and backend-boundary checks pass. Mock production build passes (existing chunk-size/environment warnings). Shared gaps logged in #69.
