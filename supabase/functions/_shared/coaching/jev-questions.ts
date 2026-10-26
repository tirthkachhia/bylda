// What we ask TypeSafe Jev about each exchange, and the state we give it.
// Pure module. Wire shapes pinned from docs.typesafe.ai on 2026-10-17:
//   Score levels  -> { summary, signals[] }
//   Choice options-> { what, not_for?, examples[] } | null
//   Noul criteria -> { true: {what, examples[]}, false: {...} }
//   instructions  -> { question, focus?, note? }
// Tone labels are deliberately NOT in the state: Jev judges the words.
import type { Exchange } from "./exchanges.ts";

export const JEV_MODEL = "jev-latest";
export const DEFAULT_CALL_GOAL =
  "Outbound sales call. The rep's goal is to qualify the prospect and move them to a concrete next step (a demo, application, or scheduled follow-up).";
export const DEFAULT_BUDGET_TOKENS = 24_000;
export const MAX_GUIDELINES = 20;
export const MAX_GUIDELINE_CHARS = 200;

/** Level keys in score order. The score is a probability-weighted index into this list. */
export const TEMPERATURE_LEVELS = ["cold", "warm", "hot", "critical", "committed"] as const;
/** Display names, same order. */
export const TEMPERATURE_LABELS = ["Cold", "Warm", "Hot", "Critical", "Committed"] as const;
/** Highest temperature score (index of the last level). Code that normalizes by the scale uses this. */
export const TEMPERATURE_MAX = TEMPERATURE_LEVELS.length - 1;
export const REP_MOVE_LEVELS = [
  "pushed_past",
  "missed_opening",
  "advanced",
  "advanced_with_question",
] as const;

export const TEMPERATURE_QUESTION = {
  type: "score",
  instructions: {
    question:
      "Judge the customer's current temperature toward moving forward with `call_goal`, based on what the customer has said in `exchanges` so far.",
    focus:
      "Weight the latest exchange (`latest_exchange_number`) most heavily, but use the whole conversation to interpret it.",
    note: "Judge only the customer's words. Ignore how the rep performed. Once the customer has agreed to proceed, they are Committed for the rest of the call unless they pull back; short answers while completing logistics are compliance, not coldness.",
  },
  criteria: [
    {
      summary: "Cold: the customer is trying to end the call or shows no interest",
      signals: [
        "Refuses, says they are not interested, or says they are all set",
        "Asks to be removed, or to just be sent an email",
        "One-word answers with no questions back, when nothing has been agreed",
        "Repeatedly asks who is calling or why",
      ],
    },
    {
      summary: "Warm: the customer keeps the conversation going",
      signals: [
        "Answers questions with some detail",
        "Asks a clarifying question about the offer or the company",
        "Raises a specific concern that invites a response rather than ending the call",
      ],
    },
    {
      summary: "Hot: the customer is engaged with their own situation and the offer",
      signals: [
        "Describes their own problem, current setup, or budget in detail",
        "Asks about price, timeline, implementation, coverage, or integrations",
        "Mentions who else would need to be involved or what they would need to decide",
        "Says this could help them",
      ],
    },
    {
      summary: "Critical: the customer asks to move forward now",
      signals: [
        "Requests a demo, trial, proposal, quote, or application",
        "Proposes or accepts a specific date or time",
        "Says they want to proceed, sign, or get started",
      ],
    },
    {
      summary: "Committed: the customer has agreed and is completing the purchase or booking",
      signals: [
        "Provides identity, address, payment, or bank details the rep asked for",
        "Spells a name, confirms a date, or picks an option to finish the paperwork",
        "Answers logistics questions briefly after already saying yes",
        "Asks what happens next after agreeing",
      ],
    },
  ],
} as const;

export const REP_MOVE_QUESTION = {
  type: "score",
  instructions: {
    question:
      "In the latest exchange (`latest_exchange_number`), how well did the rep's turn respond to what the customer had just said and move the call toward `call_goal`?",
    focus: "Judge the rep's words in that one exchange, in the context of the exchanges before it.",
    note: "Judge the move, not the outcome. A good move can still get a cold reply.",
  },
  criteria: [
    {
      summary: "Pushed past the customer",
      signals: [
        "Ignored or talked over the customer's question or objection",
        "Kept pitching after the customer signalled hesitation or asked to stop",
        "Changed the subject instead of answering",
      ],
    },
    {
      summary: "Answered but missed the opening",
      signals: [
        "Addressed the customer's point but did not build on it",
        "Gave a generic or scripted reply where a specific one was available",
        "Missed a clear signal (a question, a concern, a need) the customer offered",
      ],
    },
    {
      summary: "Answered and advanced",
      signals: [
        "Addressed the customer's point directly",
        "Connected the reply to the customer's stated situation",
        "Moved the conversation one step forward",
      ],
    },
    {
      summary: "Acknowledged, answered, and advanced with a question",
      signals: [
        "Acknowledged what the customer said before responding",
        "Answered specifically, using the customer's own words or situation",
        "Ended with a question or a concrete next step that invited the customer onward",
      ],
    },
  ],
} as const;

export const RISK_QUESTION = {
  type: "noul",
  instructions: {
    question:
      "In the latest exchange (`latest_exchange_number`), did the rep say something that gives the customer a new reason to hesitate or that a compliance reviewer would flag?",
    focus: "Only the rep's words in that exchange.",
  },
  criteria: {
    true: {
      what: "An unverifiable claim (regulations, deadlines, guarantees), pressure, a contradiction of something said earlier, minimising the customer's stated concern, or asking for sensitive data (bank, SSN, card) by voice",
      examples: [
        "New federal guidelines mean you have to decide today",
        "You sound healthy, so approval won't be a problem",
        "Just read me the account number",
      ],
    },
    false: {
      what: "Nothing new for the customer to hesitate about; claims are specific and checkable",
      examples: [
        "The premium is $42 a month for $50,000 of coverage",
        "I'll send the link so you can enter that securely",
      ],
    },
  },
} as const;

export function buildPlaybookStepQuestion(guidelines: Record<string, string>) {
  const criteria: Record<string, { what: string } | null> = {};
  for (const [key, text] of Object.entries(guidelines)) criteria[key] = { what: text };
  criteria.none = {
    what: "The rep's turn in the latest exchange does not carry out any of the listed guidelines",
  };
  return {
    type: "choice",
    instructions: {
      question:
        "Which guideline in `playbook_guidelines` is the rep carrying out in the latest exchange (`latest_exchange_number`)?",
      focus: "Pick the single guideline the rep's words most directly execute, or `none`.",
    },
    criteria,
  } as const;
}

/** Playbook content -> guideline list: one per non-empty line, list markers stripped, capped. */
export function guidelinesFromPlaybook(content: string | null | undefined): string[] {
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length >= 8)
    .slice(0, MAX_GUIDELINES)
    .map((line) => line.slice(0, MAX_GUIDELINE_CHARS));
}

export type RenderedExchange = { n: number; rep: string | null; customer: string | null };

export function renderExchange(exchange: Exchange): RenderedExchange {
  return {
    n: exchange.index + 1,
    rep: exchange.rep?.text ?? null,
    customer: exchange.customer?.text ?? null,
  };
}

export const estimateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

/** Exchanges always kept at the start of the state: what the call is about. */
export const WINDOW_ANCHOR = 2;
/** Most recent exchanges kept. Temperature is a local judgment; the distant past adds cost, not signal. */
export const DEFAULT_WINDOW = 12;

/**
 * Sliding window: the first WINDOW_ANCHOR exchanges plus the last `windowSize`.
 * Still strictly backward-looking (never includes exchanges after the latest one).
 * Turns the prefix loop's quadratic token cost into a linear one.
 */
export function selectWindow(
  rendered: RenderedExchange[],
  windowSize: number,
): { kept: RenderedExchange[]; omitted: number } {
  if (windowSize <= 0 || rendered.length <= WINDOW_ANCHOR + windowSize)
    return { kept: rendered, omitted: 0 };
  const head = rendered.slice(0, WINDOW_ANCHOR);
  const tail = rendered.slice(rendered.length - windowSize);
  return { kept: [...head, ...tail], omitted: rendered.length - head.length - tail.length };
}

/**
 * Keep the opening (first two exchanges) and as many of the most recent ones as
 * fit the budget. Returns how many middle exchanges were dropped.
 */
export function fitToBudget(
  rendered: RenderedExchange[],
  budgetTokens: number,
): { kept: RenderedExchange[]; omitted: number } {
  if (estimateTokens(rendered) <= budgetTokens) return { kept: rendered, omitted: 0 };
  const head = rendered.slice(0, 2);
  const rest = rendered.slice(2);
  const tail: RenderedExchange[] = [];
  let used = estimateTokens(head);
  for (let i = rest.length - 1; i >= 0; i--) {
    const cost = estimateTokens(rest[i]);
    if (used + cost > budgetTokens) break;
    tail.unshift(rest[i]);
    used += cost;
  }
  return { kept: [...head, ...tail], omitted: rest.length - tail.length };
}

export type JevState = {
  call_goal: string;
  playbook_guidelines: Record<string, string>;
  exchanges: RenderedExchange[];
  latest_exchange_number: number;
  earlier_exchanges_omitted: number;
};

export type JevRequest = {
  state: JevState;
  questions: Record<string, unknown>;
  truncated: boolean;
};

/**
 * The request for exchange `k` (0-based). State is a backward-looking window over
 * exchanges 0..k (anchor + most recent), then trimmed to the token budget if still
 * too large. Questions depend on who spoke in exchange k.
 */
export function buildJevRequest(input: {
  goal?: string;
  guidelines: string[];
  exchanges: Exchange[];
  k: number;
  budgetTokens?: number;
  /** 0 disables the window (full prefix). */
  windowSize?: number;
}): JevRequest {
  const latest = input.exchanges[input.k];
  if (!latest) throw new Error(`No exchange at index ${input.k}`);
  const rendered = input.exchanges.slice(0, input.k + 1).map(renderExchange);
  const windowed = selectWindow(rendered, input.windowSize ?? DEFAULT_WINDOW);
  const budgeted = fitToBudget(windowed.kept, input.budgetTokens ?? DEFAULT_BUDGET_TOKENS);
  const kept = budgeted.kept;
  const omitted = windowed.omitted + budgeted.omitted;
  const guidelineMap = Object.fromEntries(
    input.guidelines.slice(0, MAX_GUIDELINES).map((text, i) => [`g${i + 1}`, text]),
  );
  const state: JevState = {
    call_goal: input.goal?.trim() || DEFAULT_CALL_GOAL,
    playbook_guidelines: guidelineMap,
    exchanges: kept,
    latest_exchange_number: input.k + 1,
    earlier_exchanges_omitted: omitted,
  };
  const questions: Record<string, unknown> = { customer_temperature: TEMPERATURE_QUESTION };
  if (latest.rep) {
    questions.rep_move = REP_MOVE_QUESTION;
    questions.rep_introduced_risk = RISK_QUESTION;
    if (Object.keys(guidelineMap).length)
      questions.playbook_step = buildPlaybookStepQuestion(guidelineMap);
  }
  return { state, questions, truncated: omitted > 0 };
}
