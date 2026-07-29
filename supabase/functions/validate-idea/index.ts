import { runTool } from "../_shared/helpers.ts";

Deno.serve((req) =>
  runTool({
    req,
    toolKey: "validate-idea",
    systemPrompt:
      "You are a startup analyst. Critically pressure-test business ideas with rigor and honesty.",
    buildUserPrompt: (i) =>
      `Validate this business idea:\n\nIdea: ${i.idea}\nTarget customer: ${i.target_customer || "n/a"}\nNiche: ${i.niche || "n/a"}`,
    schema: {
      name: "validate_idea",
      description: "Return a structured validation of a business idea.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number", description: "0-100 viability score" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          recommendation: { type: "string" },
        },
        required: ["score", "strengths", "weaknesses", "risks", "recommendation"],
        additionalProperties: false,
      },
    },
    assetCategory: "validation",
    assetTitle: (i) => `Validation: ${String(i.idea || "Untitled idea").slice(0, 60)}`,
  }),
);
