import { describe, expect, it } from "vitest";
import { C04 } from "../contracts/flow1";
import { rowSchema, shapeOf, shapesCompatible } from "../contracts/types";

/** Proves the contract tests would CATCH a backend that drifts from the contract. */
describe("contract guard catches drift", () => {
  const schema = rowSchema(C04.table!);

  it("rejects an insight row with no sample_n (never render without it)", () => {
    const { sample_n: _drop, ...bad } = C04.example!;
    expect(schema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown confidence value", () => {
    expect(schema.safeParse({ ...C04.example!, confidence: "very_high" }).success).toBe(false);
  });

  it("rejects extra, undocumented columns (strict)", () => {
    expect(schema.safeParse({ ...C04.example!, score: 3 }).success).toBe(false);
  });

  it("flags a mapper whose output lost a field the screens use", () => {
    const vm = C04.map!(C04.example!) as Record<string, unknown>;
    const { sampleSize: _gone, ...broken } = vm;
    expect(shapesCompatible(shapeOf(broken), shapeOf(C04.mock()))).toBe(false);
  });
});
