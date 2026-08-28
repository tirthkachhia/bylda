import { describe, expect, it } from "vitest";
import {
  SALES_VERTICAL_PROFILES,
  buildCrmWritebackPreview,
  buildVerticalSystemPrompt,
  filterCrmContext,
  hydrateSalesVerticalProfile,
  normalizeCallExtraction,
  normalizeVerticalFields,
  resolveSalesVertical,
} from "../../supabase/functions/_shared/sales-verticals";

describe("sales vertical resolution", () => {
  it("selects solar and insurance profiles from workspace language", () => {
    expect(resolveSalesVertical("Residential Solar").key).toBe("solar");
    expect(resolveSalesVertical("Agency", "Life insurance").key).toBe("insurance");
  });

  it("falls back safely for an unknown industry", () => {
    expect(resolveSalesVertical("industrial fasteners").key).toBe("generic");
  });
});

describe("evidence-backed field normalization", () => {
  it("keeps only profile fields with evidence and clamps confidence", () => {
    const fields = normalizeVerticalFields(SALES_VERTICAL_PROFILES.solar, [
      {
        key: "monthly_electric_bill",
        value: "$240",
        confidence: 1.4,
        evidence_quote: "Usually around $240",
      },
      { key: "current_carrier", value: "Acme", confidence: 0.9, evidence_quote: "Acme" },
      { key: "roof_age", value: "", confidence: 0.8, evidence_quote: "ten years" },
      { key: "shading", value: "two trees", confidence: 0.7, evidence_quote: "two trees shade it" },
    ]);
    expect(fields).toEqual([
      {
        key: "monthly_electric_bill",
        label: "Monthly electric bill",
        value: "$240",
        confidence: 1,
        evidence_quote: "Usually around $240",
      },
      {
        key: "shading",
        label: "Shading",
        value: "two trees",
        confidence: 0.7,
        evidence_quote: "two trees shade it",
      },
    ]);
  });

  it("never makes restricted insurance data eligible for write-back", () => {
    const fields = normalizeVerticalFields(SALES_VERTICAL_PROFILES.insurance, [
      {
        key: "line_of_business",
        value: "Life",
        confidence: 0.96,
        evidence_quote: "looking for life insurance",
      },
      { key: "ssn", value: "***-**-1234", confidence: 0.99, evidence_quote: "my social is ..." },
      {
        key: "current_premium",
        value: "$180 monthly",
        confidence: 0.95,
        evidence_quote: "$180 a month",
      },
    ]);
    const preview = buildCrmWritebackPreview(SALES_VERTICAL_PROFILES.insurance, fields);
    expect(preview.find((field) => field.key === "line_of_business")?.eligible).toBe(true);
    expect(preview.find((field) => field.key === "ssn")).toMatchObject({
      eligible: false,
      crm_target: "blocked.ssn",
    });
    expect(preview.find((field) => field.key === "current_premium")?.eligible).toBe(false);
  });

  it("marks required solar facts missing instead of inventing them", () => {
    const result = normalizeCallExtraction(SALES_VERTICAL_PROFILES.solar, {
      summary: "The homeowner wants a battery consultation.",
      objections: [],
      competitor_mentions: [],
      next_steps_extracted: ["Schedule a site survey"],
      deal_insights: {},
      compliance_flags: [],
      vertical_fields: [
        {
          key: "battery_interest",
          value: "Interested",
          confidence: 0.92,
          evidence_quote: "I want battery backup",
        },
      ],
    });
    expect(result.missing_required_fields).toEqual(
      expect.arrayContaining([
        "call_outcome",
        "deal_stage",
        "homeowner_status",
        "utility_provider",
        "monthly_electric_bill",
      ]),
    );
  });
});

describe("vertical separation", () => {
  it("asks different questions for solar and insurance", () => {
    const solar = buildVerticalSystemPrompt(SALES_VERTICAL_PROFILES.solar);
    const insurance = buildVerticalSystemPrompt(SALES_VERTICAL_PROFILES.insurance);
    expect(solar).toContain("roof");
    expect(solar).not.toContain("licensed-agent");
    expect(insurance).toContain("licensed-agent");
    expect(insurance).not.toContain("roof");
  });

  it("filters restricted or unrelated CRM custom fields before model context", () => {
    expect(
      filterCrmContext(SALES_VERTICAL_PROFILES.insurance, {
        line_of_business: "Auto",
        renewal_date: "2026-10-01",
        ssn: "do not send",
        solar_roof_age: "12",
      }),
    ).toEqual({ line_of_business: "Auto", renewal_date: "2026-10-01" });
  });
});

describe("questionnaire-generated CRM profiles", () => {
  it("hydrates a safe custom field list and applies its confidence threshold", () => {
    const custom = hydrateSalesVerticalProfile(
      {
        label: "Independent insurance enrollment",
        objective: "Qualify the coverage need and book a licensed review.",
        insightQuestions: ["What coverage gap is the family solving?"],
        complianceRules: ["Require licensed review before enrollment."],
        autoWriteMinConfidence: 0.9,
        fields: [
          {
            key: "call_outcome",
            label: "Call outcome",
            description: "The supported result.",
            crmTarget: "lead.custom_fields.bylda_call_outcome",
            required: true,
            sensitivity: "standard",
          },
          {
            key: "next_step",
            label: "Next step",
            description: "The agreed follow-up.",
            crmTarget: "lead.custom_fields.bylda_next_step",
            required: true,
            sensitivity: "standard",
          },
          {
            key: "licensed_review",
            label: "Licensed review",
            description: "The scheduled licensed-agent review.",
            crmTarget: "lead.custom_fields.bylda_licensed_review",
            required: true,
            sensitivity: "standard",
          },
        ],
      },
      SALES_VERTICAL_PROFILES.insurance,
    );
    const preview = buildCrmWritebackPreview(custom, [
      {
        key: "licensed_review",
        label: "Licensed review",
        value: "Tuesday at 2 PM",
        confidence: 0.86,
        evidence_quote: "Tuesday at two works",
      },
    ]);
    expect(custom.label).toBe("Independent insurance enrollment");
    expect(preview[0]).toMatchObject({ eligible: false });
    expect(preview[0].reason).toContain("90%");
  });

  it("rejects unsafe model-provided CRM targets", () => {
    const profile = hydrateSalesVerticalProfile(
      {
        fields: [
          {
            key: "one",
            label: "One",
            description: "One",
            crmTarget: "users.password",
          },
          {
            key: "two",
            label: "Two",
            description: "Two",
            crmTarget: "lead.custom_fields.bylda_two",
          },
          {
            key: "three",
            label: "Three",
            description: "Three",
            crmTarget: "lead.custom_fields.bylda_three",
          },
        ],
      },
      SALES_VERTICAL_PROFILES.solar,
    );
    expect(profile).toBe(SALES_VERTICAL_PROFILES.solar);
  });
});
