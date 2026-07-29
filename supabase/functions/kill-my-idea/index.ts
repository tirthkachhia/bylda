import { runTool } from "../_shared/helpers.ts";

Deno.serve((req) =>
  runTool({
    req,
    toolKey: "kill-my-idea",
    systemPrompt: `You are a brutally honest startup critic — a seasoned VC partner who has seen thousands of ideas fail.
Your job is NOT to encourage. Your job is to find every fatal flaw, challenge every assumption, and stress-test the idea against hard market realities.
Be specific, not generic. Reference real market dynamics, common startup failure patterns, and concrete execution risks.
A low survival_score is not an insult — it's a service. Be harsh but constructive: always end with what it would take to survive.`,
    buildUserPrompt: (i) =>
      `Critically analyse why this startup idea might fail:\n\nIdea: ${i.idea}\nBusiness context: ${i.business || "n/a"}`,
    schema: {
      name: "kill_idea",
      description: "Return a brutal critical analysis of why a startup idea might fail.",
      parameters: {
        type: "object",
        properties: {
          survival_score: {
            type: "number",
            description:
              "0-100 survival score. Below 40 = likely dead. 40-65 = critical condition. 65-80 = fighting chance. 80+ = strong despite risks.",
          },
          verdict: {
            type: "string",
            description:
              "One blunt sentence verdict on the idea's odds (e.g. 'Dead on arrival', 'Critical condition — needs major rethinking', 'Fighting chance if you fix the core flaw').",
          },
          the_kill_shot: {
            type: "string",
            description: "The single most likely reason this idea dies. Be specific and merciless.",
          },
          fatal_flaws: {
            type: "array",
            items: { type: "string" },
            description: "3-5 core structural problems that could kill the business.",
          },
          market_risks: {
            type: "array",
            items: { type: "string" },
            description: "3-4 specific market, competition, or timing risks.",
          },
          execution_risks: {
            type: "array",
            items: { type: "string" },
            description: "3-4 team, operational, or go-to-market execution risks.",
          },
          dangerous_assumptions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                assumption: { type: "string" },
                reality: { type: "string" },
              },
              required: ["assumption", "reality"],
            },
            description:
              "3-4 assumptions the founder is likely making, and what reality actually looks like.",
          },
          if_you_proceed: {
            type: "array",
            items: { type: "string" },
            description:
              "3-5 specific things the founder must address or validate before this idea has a chance.",
          },
        },
        required: [
          "survival_score",
          "verdict",
          "the_kill_shot",
          "fatal_flaws",
          "market_risks",
          "execution_risks",
          "dangerous_assumptions",
          "if_you_proceed",
        ],
        additionalProperties: false,
      },
    },
    assetCategory: "kill-analysis",
    assetTitle: (i) => `Kill Analysis: ${String(i.idea || "Untitled idea").slice(0, 60)}`,
  }),
);
