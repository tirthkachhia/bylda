// Lead scoring — a small, transparent, deterministic engine.
// Turns a contact's signals (contactability, status, recency, intent tags) into
// a 0–100 score with a human-readable breakdown. Pure and side-effect free so
// it's trivially unit-testable; `now` is injectable for recency tests.

export interface LeadScoreInput {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  company_id?: string | null;
  status?: string | null;
  tags?: string[] | null;
  last_contacted_at?: string | null;
}

export interface LeadScoreBreakdown {
  score: number;
  reasons: string[];
}

const STATUS_WEIGHT: Record<string, number> = {
  new: 5,
  contacted: 15,
  qualified: 30,
  engaged: 40,
  nurture: 10,
  cold: 2,
  archived: 0,
};

// Tags that signal buying intent get an extra bump.
const HIGH_INTENT_TAGS = new Set(["hot", "ready", "demo", "trial", "quote", "proposal"]);

const DAY = 86_400_000;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Score with an explanation of every point added. */
export function scoreLeadDetailed(
  input: LeadScoreInput,
  now: Date = new Date(),
): LeadScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  if (input.email) {
    score += 15;
    reasons.push("Has email (+15)");
  }
  if (input.phone) {
    score += 10;
    reasons.push("Has phone (+10)");
  }
  if (input.company || input.company_id) {
    score += 10;
    reasons.push("Linked to a company (+10)");
  }

  const statusPts = STATUS_WEIGHT[(input.status ?? "").toLowerCase()] ?? 0;
  if (statusPts > 0) {
    score += statusPts;
    reasons.push(`Status "${input.status}" (+${statusPts})`);
  }

  if (input.last_contacted_at) {
    const ageDays = (now.getTime() - new Date(input.last_contacted_at).getTime()) / DAY;
    let recencyPts = 0;
    if (ageDays <= 7) recencyPts = 20;
    else if (ageDays <= 30) recencyPts = 10;
    else if (ageDays <= 90) recencyPts = 5;
    if (recencyPts > 0) {
      score += recencyPts;
      reasons.push(`Contacted recently (+${recencyPts})`);
    }
  }

  const tags = input.tags ?? [];
  if (tags.length > 0) {
    const tagPts = Math.min(15, tags.length * 3);
    score += tagPts;
    reasons.push(`${tags.length} tag(s) (+${tagPts})`);
    if (tags.some((t) => HIGH_INTENT_TAGS.has(t.toLowerCase()))) {
      score += 10;
      reasons.push("High-intent tag (+10)");
    }
  }

  return { score: clamp(score), reasons };
}

/** Just the 0–100 number. */
export function computeLeadScore(input: LeadScoreInput, now: Date = new Date()): number {
  return scoreLeadDetailed(input, now).score;
}
