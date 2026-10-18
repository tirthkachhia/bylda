import { describe, expect, it } from "vitest";
import {
  collapseBlocks,
  groupExchanges,
} from "../../../supabase/functions/_shared/coaching/exchanges";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";

let counter = 0;
const turn = (
  speaker: ParsedTurn["speaker"],
  text: string,
  start_s: number,
  label = "neutral",
  overlap = false,
): ParsedTurn => ({
  index: counter++,
  speaker,
  start: "",
  end: "",
  start_s,
  end_s: start_s + 2,
  text,
  tone: { label: label as ParsedTurn["tone"]["label"], note: "" },
  overlap,
});

describe("collapseBlocks", () => {
  it("merges consecutive same-speaker turns and keeps every tone label", () => {
    counter = 0;
    const blocks = collapseBlocks([
      turn("rep", "Hi.", 0, "warm"),
      turn("rep", "This is Ethan.", 2, "enthusiastic", true),
      turn("customer", "Hello.", 5),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      speaker: "rep",
      turnIndexes: [0, 1],
      text: "Hi. This is Ethan.",
      toneLabels: ["warm", "enthusiastic"],
      start_s: 0,
      end_s: 4,
      overlap: true,
    });
    expect(blocks[1].speaker).toBe("customer");
  });

  it("folds unknown speech into the previous block with an [unclear] marker", () => {
    counter = 0;
    const blocks = collapseBlocks([
      turn("customer", "Yes.", 0),
      turn("unknown", "mumbling", 2),
      turn("rep", "Great.", 4),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe("Yes. [unclear: mumbling]");
    expect(blocks[0].turnIndexes).toEqual([0, 1]);
  });

  it("treats a leading unknown as the customer", () => {
    counter = 0;
    const blocks = collapseBlocks([turn("unknown", "Hello?", 0), turn("rep", "Hi Verna.", 1)]);
    expect(blocks[0]).toMatchObject({ speaker: "customer", text: "Hello?" });
  });
});

describe("groupExchanges", () => {
  it("pairs each rep block with the customer block that follows", () => {
    counter = 0;
    const exchanges = groupExchanges([
      turn("rep", "Hi, this is Ethan.", 0),
      turn("customer", "Who?", 3),
      turn("rep", "From Acme.", 5),
      turn("rep", "We spoke last week.", 7),
      turn("customer", "Oh right.", 10),
    ]);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0]).toMatchObject({
      index: 0,
      start_s: 0,
      end_s: 5,
      rep: { text: "Hi, this is Ethan." },
      customer: { text: "Who?" },
    });
    expect(exchanges[1]).toMatchObject({
      index: 1,
      rep: { text: "From Acme. We spoke last week." },
      customer: { text: "Oh right." },
    });
  });

  it("gives a customer-first call a baseline exchange with no rep", () => {
    counter = 0;
    const exchanges = groupExchanges([
      turn("customer", "Hello?", 0),
      turn("rep", "Hi Verna.", 2),
      turn("customer", "Yes.", 4),
    ]);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0]).toMatchObject({ index: 0, rep: null, customer: { text: "Hello?" } });
    expect(exchanges[1]).toMatchObject({ index: 1, rep: { text: "Hi Verna." } });
  });

  it("keeps a trailing rep block as an exchange with no customer reply", () => {
    counter = 0;
    const exchanges = groupExchanges([
      turn("rep", "Hi.", 0),
      turn("customer", "Hi.", 2),
      turn("rep", "Talk Thursday then. Bye.", 4),
    ]);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[1]).toMatchObject({
      rep: { text: "Talk Thursday then. Bye." },
      customer: null,
    });
  });

  it("handles back-to-back rep blocks separated only by unknown speech", () => {
    counter = 0;
    const exchanges = groupExchanges([
      turn("rep", "First point.", 0),
      turn("unknown", "static", 2),
      turn("rep", "Second point.", 4),
      turn("customer", "Okay.", 6),
    ]);
    // unknown folds into the first rep block, so both rep turns merge into one exchange
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].rep?.text).toBe("First point. [unclear: static] Second point.");
  });

  it("produces sequential indices on a long alternating call", () => {
    counter = 0;
    const turns: ParsedTurn[] = [];
    for (let i = 0; i < 228; i++)
      turns.push(
        turn(i % 2 === 0 ? "rep" : "customer", `t${i}`, i * 7, i % 3 ? "neutral" : "warm"),
      );
    const exchanges = groupExchanges(turns);
    expect(exchanges).toHaveLength(114);
    expect(exchanges.map((e) => e.index)).toEqual([...Array(114).keys()]);
    expect(exchanges.every((e) => e.rep && e.customer)).toBe(true);
    expect(exchanges[113].end_s).toBe(227 * 7 + 2);
  });

  it("returns nothing for no turns", () => {
    expect(groupExchanges([])).toEqual([]);
  });
});
