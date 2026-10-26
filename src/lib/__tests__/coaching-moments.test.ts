import { describe, expect, it } from "vitest";
import type { Block, Exchange } from "../../../supabase/functions/_shared/coaching/exchanges";
import {
  callVerdict,
  momentContext,
  momentHeadline,
} from "../../../supabase/functions/_shared/coaching/moments";

const block = (speaker: Block["speaker"], text: string): Block => ({
  speaker,
  turnIndexes: [0],
  text,
  toneLabels: ["neutral"],
  start_s: 0,
  end_s: 1,
  overlap: false,
});
const ex = (i: number, rep: string, customer: string): Exchange => ({
  index: i,
  rep: block("rep", rep),
  customer: block("customer", customer),
  start_s: i * 10,
  end_s: i * 10 + 5,
});

describe("momentHeadline", () => {
  const base = { delta: 0, risk_probability: 0, rep_move: 2.5, low_confidence: false };
  it("names a lost hot customer first, then risk, then weak replies", () => {
    expect(
      momentHeadline({ ...base, type: "temperature_drop", delta: -1.2 }, { customerWasHot: true }),
    ).toBe("Customer was ready to move; the rep introduced friction");
    expect(
      momentHeadline({ ...base, type: "temperature_drop", delta: -0.8, risk_probability: 0.8 }),
    ).toBe("Customer cooled after a risky statement");
    expect(momentHeadline({ ...base, type: "temperature_drop", delta: -0.6, rep_move: 0.5 })).toBe(
      "Customer cooled after a weak reply",
    );
    expect(momentHeadline({ ...base, type: "risk_flag", risk_probability: 0.9 })).toBe(
      "Statement a reviewer would flag",
    );
    expect(
      momentHeadline({ ...base, type: "risk_flag", risk_probability: 0.9, rep_move: 0.8 }),
    ).toBe("Risky statement and a weak reply");
    expect(
      momentHeadline(
        { ...base, type: "weak_move", rep_move: 0.6 },
        { customerAskedQuestion: true },
      ),
    ).toBe("Customer asked; the rep did not build on it");
    expect(momentHeadline({ ...base, type: "weak_move", rep_move: 0.6 })).toBe(
      "Weak reply while the customer was open",
    );
  });
});

describe("momentContext", () => {
  it("reads the previous customer turn and the prior temperature", () => {
    const exchanges = [ex(0, "Hi", "What does it cost?"), ex(1, "Fifty.", "Hm.")];
    expect(momentContext(exchanges, 1, 2.1)).toEqual({
      customerWasHot: true,
      customerAskedQuestion: true,
    });
    expect(momentContext(exchanges, 1, 1.0)).toEqual({
      customerWasHot: false,
      customerAskedQuestion: true,
    });
    expect(momentContext(exchanges, 0, null)).toEqual({
      customerWasHot: false,
      customerAskedQuestion: false,
    });
  });
});

describe("callVerdict", () => {
  it("writes the verdict in plain language with only meaningful numbers", () => {
    expect(
      callVerdict(
        {
          coaching_value_label: "high",
          peak_temperature: 2.89,
          final_temperature: 1.9,
          risk_count: 5,
          biggest_drop_exchange_index: 64,
        },
        { peakAt: "15:20", dropAt: "15:30" },
      ),
    ).toBe(
      "Worth reviewing. The customer reached Critical at 15:20 and the call ended Hot. 5 statements a reviewer would flag. Best moment to coach: 15:30.",
    );
    expect(
      callVerdict({
        coaching_value_label: "low",
        peak_temperature: 0.4,
        final_temperature: 0.2,
        risk_count: 0,
        biggest_drop_exchange_index: null,
      }),
    ).toBe("Low coaching value. The customer never got past Cold.");
    expect(
      callVerdict({
        coaching_value_label: "medium",
        peak_temperature: 1.2,
        final_temperature: 1.0,
        risk_count: 1,
        biggest_drop_exchange_index: 3,
      }),
    ).toBe(
      "Some coaching value. The customer never got past Warm. 1 statement a reviewer would flag.",
    );
  });
});
