// TASK-086 · Agent output normalization
// Normalizes heterogeneous AI tool response shapes from different edge functions
// into a consistent NormalizedOutput format for UI consumption.

export interface NormalizedOutput {
  type: "success" | "error" | "empty";
  headline: string | null;
  body: string | null;
  bullets: string[];
  score: number | null;
  sections: { title: string; content: string }[];
  raw: Record<string, unknown>;
}

type UnknownRecord = Record<string, unknown>;

function extractString(obj: UnknownRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function extractNumber(obj: UnknownRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const n = parseFloat(val);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractBullets(obj: UnknownRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val
        .map((v) =>
          typeof v === "string"
            ? v
            : typeof v === "object" && v !== null
              ? Object.values(v).join(" ")
              : String(v),
        )
        .filter(Boolean);
    }
    if (typeof val === "string" && val.includes("\n")) {
      return val
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

function extractSections(obj: UnknownRecord): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const SECTION_KEYS = [
    ["market_analysis", "Market Analysis"],
    ["competitive_landscape", "Competition"],
    ["target_customer", "Target Customer"],
    ["go_to_market", "Go-to-Market"],
    ["pricing_strategy", "Pricing"],
    ["risk_assessment", "Risks"],
    ["recommendation", "Recommendation"],
    ["next_steps", "Next Steps"],
    ["channels", "Channels"],
    ["messaging", "Messaging"],
    ["unique_mechanism", "Unique Mechanism"],
    ["offer_stack", "Offer Stack"],
  ];
  for (const [key, title] of SECTION_KEYS) {
    const val = obj[key];
    if (!val) continue;
    let content: string;
    if (typeof val === "string") content = val;
    else if (Array.isArray(val)) content = val.join("\n");
    else if (typeof val === "object") content = JSON.stringify(val, null, 2);
    else content = String(val);
    if (content.trim()) sections.push({ title, content: content.trim() });
  }
  return sections;
}

export function normalizeAgentOutput(raw: unknown): NormalizedOutput {
  const empty: NormalizedOutput = {
    type: "empty",
    headline: null,
    body: null,
    bullets: [],
    score: null,
    sections: [],
    raw: {},
  };

  if (!raw || typeof raw !== "object") return empty;

  const obj = raw as UnknownRecord;

  if (obj.error || obj.status === "error") {
    return {
      type: "error",
      headline: "Something went wrong",
      body: extractString(obj, "error", "message", "detail") ?? "An error occurred.",
      bullets: [],
      score: null,
      sections: [],
      raw: obj,
    };
  }

  const result = (obj.result ?? obj.data ?? obj) as UnknownRecord;
  if (!result || typeof result !== "object") return empty;

  return {
    type: "success",
    headline: extractString(
      result as UnknownRecord,
      "headline",
      "offer_name",
      "idea",
      "title",
      "name",
      "summary",
    ),
    body: extractString(
      result as UnknownRecord,
      "summary",
      "overview",
      "description",
      "body",
      "content",
      "reply",
      "analysis",
      "pitch",
    ),
    bullets: extractBullets(
      result as UnknownRecord,
      "key_insights",
      "insights",
      "bullets",
      "points",
      "strengths",
      "weaknesses",
      "opportunities",
      "risks",
      "recommendations",
      "steps",
    ),
    score: extractNumber(
      result as UnknownRecord,
      "score",
      "market_score",
      "viability_score",
      "funding_score",
      "confidence",
    ),
    sections: extractSections(result as UnknownRecord),
    raw: result as UnknownRecord,
  };
}

export function formatScore(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Strong", color: "#10b981" };
  if (score >= 60) return { label: "Solid", color: "#f59e0b" };
  if (score >= 40) return { label: "Moderate", color: "#f97316" };
  return { label: "Weak", color: "#ef4444" };
}
