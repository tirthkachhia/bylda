// Groups structured turns into exchanges: one rep block followed by the customer's
// reply. Jev scores the conversation "as of each exchange". Pure module.
import type { ParsedTurn } from "./transcript-parse.ts";

export type BlockSpeaker = "rep" | "customer";

/** Consecutive turns by one speaker, merged. */
export type Block = {
  speaker: BlockSpeaker;
  turnIndexes: number[];
  text: string;
  toneLabels: string[];
  start_s: number | null;
  end_s: number | null;
  overlap: boolean;
};

/**
 * A rep block and the customer block that answers it. `rep` is null for a
 * customer block before the rep has spoken (the baseline); `customer` is null for
 * a trailing rep block with no reply (usually the close).
 */
export type Exchange = {
  index: number;
  rep: Block | null;
  customer: Block | null;
  start_s: number | null;
  end_s: number | null;
};

function newBlock(turn: ParsedTurn, speaker: BlockSpeaker, text: string): Block {
  return {
    speaker,
    turnIndexes: [turn.index],
    text,
    toneLabels: [turn.tone.label],
    start_s: turn.start_s,
    end_s: turn.end_s,
    overlap: turn.overlap,
  };
}

function appendTurn(block: Block, turn: ParsedTurn, text: string) {
  block.turnIndexes.push(turn.index);
  block.text = `${block.text} ${text}`.trim();
  block.toneLabels.push(turn.tone.label);
  block.end_s =
    block.end_s === null || turn.end_s === null ? null : Math.max(block.end_s, turn.end_s);
  block.overlap = block.overlap || turn.overlap;
}

/**
 * Merge attributable speech only. Unknown speech remains in the canonical
 * transcript and the behavioral analysis, never in another speaker's score.
 */
export function collapseBlocks(turns: ParsedTurn[]): Block[] {
  const blocks: Block[] = [];
  for (const turn of turns) {
    const last = blocks[blocks.length - 1];
    if (turn.speaker === "unknown") {
      // Unknown speech cannot become evidence attributed to either participant.
      continue;
    }
    if (last && last.speaker === turn.speaker) appendTurn(last, turn, turn.text);
    else blocks.push(newBlock(turn, turn.speaker, turn.text));
  }
  return blocks;
}

/** Pair blocks into exchanges, left to right. */
export function groupExchanges(turns: ParsedTurn[]): Exchange[] {
  const exchanges: Exchange[] = [];
  let open: Exchange | null = null;
  for (const block of collapseBlocks(turns)) {
    if (block.speaker === "rep") {
      if (open) exchanges.push(open);
      open = { index: 0, rep: block, customer: null, start_s: block.start_s, end_s: block.end_s };
    } else if (open) {
      open.customer = block;
      open.end_s =
        open.end_s === null || block.end_s === null ? null : Math.max(open.end_s, block.end_s);
      exchanges.push(open);
      open = null;
    } else {
      exchanges.push({
        index: 0,
        rep: null,
        customer: block,
        start_s: block.start_s,
        end_s: block.end_s,
      });
    }
  }
  if (open) exchanges.push(open);
  exchanges.forEach((exchange, index) => {
    exchange.index = index;
  });
  return exchanges;
}
