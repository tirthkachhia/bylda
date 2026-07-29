// Perplexity Sonar client — research enrichment only.
// Returns grounded facts + citations for the synthesis model to build on;
// it NEVER writes the user-facing answer. If PERPLEXITY_API_KEY is unset or
// the API fails/times out, callers get { ok: false } and must run unenriched
// — enrichment is an enhancer, never a dependency.

const PPLX_URL = "https://api.perplexity.ai/chat/completions";
const PPLX_TIMEOUT_MS = 25_000;

export type PerplexityTier = "sonar" | "sonar-pro";

export interface ResearchResult {
  ok: boolean;
  content: string; // grounded research text
  citations: string[]; // source URLs
  model: string;
  error?: string;
}

interface PplxSearchResult {
  url?: string;
}

interface PplxResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  search_results?: PplxSearchResult[];
}

export async function fetchResearch(opts: {
  query: string;
  tier: PerplexityTier;
  systemHint?: string; // e.g. "Focus on 2026 market data for e-commerce."
  maxTokens?: number;
}): Promise<ResearchResult> {
  const key = Deno.env.get("PERPLEXITY_API_KEY");
  if (!key) {
    console.warn("[perplexity] PERPLEXITY_API_KEY not set — skipping enrichment");
    return { ok: false, content: "", citations: [], model: opts.tier, error: "no_key" };
  }

  const body = {
    model: opts.tier,
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant. Return only factual, current, sourced findings relevant to the query. " +
          "Be concise and specific: real numbers, named competitors, current prices, dated trends. " +
          "Do NOT write advice, verdicts, or marketing copy — only the grounded facts another model will synthesize. " +
          (opts.systemHint ?? ""),
      },
      { role: "user", content: opts.query },
    ],
    max_tokens: opts.maxTokens ?? 900,
    temperature: 0.2,
  };

  try {
    const res = await fetch(PPLX_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PPLX_TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[perplexity] ${res.status}: ${txt.slice(0, 300)}`);
      return {
        ok: false,
        content: "",
        citations: [],
        model: opts.tier,
        error: `http_${res.status}`,
      };
    }
    const data = (await res.json()) as PplxResponse;
    const content = data?.choices?.[0]?.message?.content ?? "";
    // Citations arrive top-level and/or inside search_results — support both.
    // If neither is present at runtime, log the raw keys once so the
    // extraction can be adjusted against the real shape, never assumed.
    const citations: string[] =
      data?.citations ??
      (Array.isArray(data?.search_results)
        ? data.search_results.map((s) => s.url).filter((u): u is string => !!u)
        : []);
    if (content && citations.length === 0) {
      console.warn("[perplexity] no citations found; response keys:", Object.keys(data ?? {}));
    }
    return { ok: true, content, citations, model: opts.tier };
  } catch (e) {
    console.error("[perplexity] fetch failed", e);
    return { ok: false, content: "", citations: [], model: opts.tier, error: "fetch_failed" };
  }
}
