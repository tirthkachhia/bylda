# Launchpad Bylda — Cinematic Brand Film (canonical shot list)

**Working title:** _Two Worlds, One System_
**Format:** Dual-character (Founder × Operator) emotional transformation film.
**Runtime:** ~110s · 14 scenes · 16:9 master.
**Thesis:** People don't fail from lack of effort. They fail because their systems are
disconnected. Bylda is the transition from fragmentation → unified execution.
**Tagline:** From idea → scale. **Brand line:** The AI Operating System for Founders.

## Characters

- **Founder** — visionary, drowning in execution (idea, MVP, customers, funding).
- **Operator** — high-output executor juggling many clients/tools (HubSpot, Slack, Notion, Sheets…).
  They run in split-screen until the **Transformation** scene, where the two worlds merge.

## Visual & audio system

- **Chaos (1–4):** dark blue-gray, screen-glow underlight, tight handheld, rapid cuts; notification overload, key clicks, low tension hum.
- **Transition (4→5):** white bloom, audio drop to silence, single heartbeat.
- **Bylda (5–14):** clean white + Bylda orange `#F0653A` + signal blue, stable wide shots, slow orbital, calm pacing; ambient synth, orchestral lift, crisp UI cues.
- Master is **text-driven** (VO lines rendered as on-screen narrative) so it plays muted on web/social; AI VO + score can be layered when the Higgsfield audio tool is approved.

---

## 14-Scene shot list (scene · dur · VO / on-screen text · source clip)

| #   | Scene                                                                                                                     | Dur | Voiceover / On-screen                                                                                                                                                      | Source                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **The Dream** — Founder's "Launchpad Idea" doc + 50 tabs; Operator's Monday board, Slack, Gmail, Notion, HubSpot all open | 7s  | "Every great business starts with an idea."                                                                                                                                | `s1` split (kling)          |
| 2   | **The Overload** — notifications exploding, missed lead, overdue task, flat revenue                                       | 7s  | "Then the complexity arrives."                                                                                                                                             | `s2` chaos (kling)          |
| 3   | **Drowning** — jumping HubSpot↔Slack↔Notion↔Gmail↔Sheets, every click a new problem                                       | 6s  | "More tools. More systems. More noise."                                                                                                                                    | `s2` chaos (alt)            |
| 4   | **Breaking Point** — screens freeze, silence                                                                              | 8s  | **THE PROBLEM ISN'T YOU.** / **THE PROBLEM IS THE SYSTEM.**                                                                                                                | `s4` freeze (kling)         |
| 5   | **Discovery** — white reset, Mission-Control boot, nodes connecting                                                       | 7s  | "What if your business had one place to operate?"                                                                                                                          | `s5` boot (kling)           |
| 6   | **Mission Control** — Bylda Home: revenue, leads, tasks, customers, growth score                                          | 8s  | "One source of truth."                                                                                                                                                     | `s6` dashboard i2v          |
| 7   | **AI Planning** — goal ($1M ARR) → marketing/sales/product/ops/hiring → roadmap auto-builds                               | 8s  | "From vision to execution."                                                                                                                                                | new `s7p` (kling)           |
| 8   | **CRM Intelligence** — leads enter, pipeline updates itself, follow-ups scheduled                                         | 8s  | "Every opportunity tracked."                                                                                                                                               | `s7` pipeline i2v           |
| 9   | **Automation Engine** — builder flow: lead → AI qualify → email → task → meeting                                          | 8s  | "Every process connected."                                                                                                                                                 | new `s9` builder i2v        |
| 10  | **Team Execution** — workspace: projects, tasks, departments, AI assistants, one platform                                 | 7s  | "Every team aligned."                                                                                                                                                      | new `s10t` admin i2v        |
| 11  | **Growth** — metrics rising, revenue up, founder smiles, operator relaxed                                                 | 7s  | "Execution creates momentum."                                                                                                                                              | `s10` metrics + `s11` smile |
| 12  | **Transformation** — split screen merges; Founder + Operator become one                                                   | 7s  | "Different roles. One operating system."                                                                                                                                   | `s8` merge (kling)          |
| 13  | **Scale** — dashboard zooms out into a living business ecosystem (sales/marketing/product/ops/finance/customers)          | 7s  | "From idea. To launch. To scale."                                                                                                                                          | new `s13` ecosystem         |
| 14  | **Final CTA** — push through dashboard, everything fades to the Bylda logo                                                | 9s  | "You don't need more tools. You need a system. Launchpad Bylda." · `LAUNCHPAD BYLDA` / `THE AI OPERATING SYSTEM FOR FOUNDERS` / `FROM IDEA → SCALE` / `START YOUR MISSION` | built end card              |

---

## Production

- **Models:** `kling3_0` for all motion — image-to-video seeded from **real Bylda screenshots** for every product scene (6, 7, 8, 9, 10, 13 use authentic UI: dashboard, pipeline, workflow builder, admin hub); text-to-video for the cinematic/abstract beats (1–5, 11-merge). `seedance_2_0` rejected the moody character shots as false-positive NSFW, so characters are done with kling.
- **Assembly:** ffmpeg — per-scene trim + unifying grade + vignette, on-screen narrative text with fade in/out, `xfade` transitions (white-bloom on the 4→5 breakpoint and into the CTA), built CTA card from the real dashboard (blurred, slow push, 4-line lock-up).
- **Source screenshots → Higgsfield media:** dashboard `cd0b3d78`, pipeline `ee302c57`, builder `f693d6ce`, admin `a987e7c6`.
- **Credits:** kling clips ≈20 each, so the full 14-scene film is ~250–300 credits.
- **Deliverable:** `bylda-brand-film.mp4` (16:9 master), stored in Supabase `tutorial-videos` bucket; a 9:16 social cutdown can follow.

_Canonical spec for the Bylda brand film. Supersedes the earlier 12-scene draft._
