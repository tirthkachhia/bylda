import { describe, expect, it } from "vitest";
import {
  assignMentor,
  CURRICULUM_STAGES,
  formatForTool,
  isAcceptableCasefile,
  MENTOR_ROSTER,
  mentorsForStage,
  type OutputFormat,
} from "@/lib/mentors";

const FORMATS: OutputFormat[] = [
  "score-verdict",
  "contrast",
  "intelligence-report",
  "step-plan",
  "pipeline-snapshot",
];

describe("mentor roster", () => {
  it("has exactly six mentors", () => {
    expect(MENTOR_ROSTER).toHaveLength(6);
  });

  it("covers every output format exactly once (no overlaps, no orphans)", () => {
    for (const format of FORMATS) {
      const owners = MENTOR_ROSTER.filter((m) => m.ownedFormat === format);
      expect(owners, `format ${format}`).toHaveLength(1);
    }
  });

  it("has exactly one automation mentor with no owned format", () => {
    expect(MENTOR_ROSTER.filter((m) => m.ownedFormat === null)).toHaveLength(1);
  });

  it("covers every stage with at least one mentor", () => {
    for (const stage of CURRICULUM_STAGES) {
      expect(mentorsForStage(stage).length, `stage ${stage}`).toBeGreaterThan(0);
    }
  });
});

describe("delegation", () => {
  it("assigns the format owner when stage and format both match", () => {
    expect(assignMentor("Validate", "contrast").id).toBe("maya-okafor");
    expect(assignMentor("Validate", "score-verdict").id).toBe("dhruv-patel");
    expect(assignMentor("Launch", "intelligence-report").id).toBe("alex-chen");
    expect(assignMentor("Launch", "step-plan").id).toBe("james-rivera");
    expect(assignMentor("Operate", "pipeline-snapshot").id).toBe("mo-latif");
  });

  it("routes automation lessons (no format) to Priya inside her stages", () => {
    expect(assignMentor("Launch", null).id).toBe("priya-nair");
    expect(assignMentor("Scale", null).id).toBe("priya-nair");
  });

  it("never orphans a lesson: falls back to the format owner out of stage", () => {
    // contrast is owned by Maya (Idea–Validate); at Scale she still owns it.
    expect(assignMentor("Scale", "contrast").id).toBe("maya-okafor");
  });

  it("resolves a mentor for every stage × format combination", () => {
    for (const stage of CURRICULUM_STAGES) {
      for (const format of [...FORMATS, null]) {
        expect(assignMentor(stage, format)).toBeTruthy();
      }
    }
  });
});

describe("output formats", () => {
  it("maps score-verdict tools to the acceptance trigger", () => {
    expect(isAcceptableCasefile("idea-validator")).toBe(true);
    expect(isAcceptableCasefile("validate-idea")).toBe(true);
    expect(isAcceptableCasefile("funding-readiness-score")).toBe(true);
    expect(isAcceptableCasefile("generate-offer")).toBe(false);
    expect(isAcceptableCasefile("gtm-strategy")).toBe(false);
  });

  it("classifies the main tool families", () => {
    expect(formatForTool("generate-offer")).toBe("contrast");
    expect(formatForTool("gtm-strategy-builder")).toBe("intelligence-report");
    expect(formatForTool("launch-checklist")).toBe("step-plan");
    expect(formatForTool("first-10-customers-finder")).toBe("pipeline-snapshot");
    expect(formatForTool("crm-automation")).toBeNull();
  });
});
