import {
  authenticateAndAuthorize,
  callClaude,
  corsHeaders,
  incrementUsage,
  jsonResponse,
  refundQuota,
} from "../_shared/helpers.ts";
import { assembleContext } from "../_shared/context.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateAndAuthorize(req, "analyze-website");
  if (authResult instanceof Response) return authResult;
  const ctx = authResult;

  let input: { url?: string };
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const rawUrl = (input.url || "").trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  // SSRF guard: block private/loopback/link-local hostnames and bare IPs in those ranges.
  const host = parsedUrl.hostname.toLowerCase();
  const isBlockedHost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    host === "::1" ||
    host.startsWith("[::1") ||
    host.startsWith("fc") ||
    host.startsWith("fd") || // unique local IPv6
    host.startsWith("fe80"); // link-local IPv6
  if (isBlockedHost) return jsonResponse({ error: "URL not allowed" }, 400);
  const url = parsedUrl.toString();

  const { data: run } = await ctx.supabase
    .from("tool_runs")
    .insert({
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      tool_key: "analyze-website",
      status: "running",
      input,
    })
    .select()
    .single();

  try {
    // Fetch the page — bounded: 15s timeout, 2 MB read cap, HTML-ish content only.
    // Without these a slow or hostile site pins the function until the platform kills it.
    const fetchAbort = new AbortController();
    const fetchTimer = setTimeout(() => fetchAbort.abort(), 15_000);
    let pageResp: Response;
    try {
      pageResp = await fetch(url, {
        headers: { "User-Agent": "Launchpad-Bylda-Analyzer/1.0" },
        signal: fetchAbort.signal,
        redirect: "follow",
      });
    } catch (fetchErr) {
      const aborted = fetchErr instanceof Error && fetchErr.name === "AbortError";
      throw new Error(aborted ? "SITE_TIMEOUT" : "SITE_UNREACHABLE");
    } finally {
      clearTimeout(fetchTimer);
    }
    if (!pageResp.ok) throw new Error("SITE_UNREACHABLE");
    const contentType = pageResp.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
      throw new Error("NOT_HTML");
    }

    const MAX_BYTES = 2 * 1024 * 1024;
    let html = "";
    if (pageResp.body) {
      const reader = pageResp.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await pageResp.text();
    }
    html = html.slice(0, 30000);

    // Snapshot to storage
    const snapshotPath = `${ctx.organizationId}/${ctx.userId}/${Date.now()}.html`;
    await ctx.supabase.storage.from("website-snapshots").upload(snapshotPath, html, {
      contentType: "text/html",
      upsert: false,
    });

    // Inject business context so the audit checks POSITIONING for this ICP,
    // not just generic UX/SEO hygiene.
    const assembled = await assembleContext(ctx.supabase, ctx.organizationId, {
      budgetChars: 2500,
    }).catch(() => ({ block: "", used: [] as string[] }));

    const output = await callClaude(
      "You are a senior conversion + SEO + UX consultant. Audit the supplied HTML and return actionable findings. " +
        "When business context is provided, evaluate positioning clarity for that specific target customer and " +
        "whether the page's promise matches their stated offer — not just generic best practices.",
      `${assembled.block ? assembled.block + "\n\n" : ""}Analyze this website (${url}). HTML excerpt:\n\n${html}`,
      {
        name: "analyze_website",
        description: "Return a structured website audit.",
        parameters: {
          type: "object",
          properties: {
            issues: { type: "array", items: { type: "string" } },
            opportunities: { type: "array", items: { type: "string" } },
            ux_notes: { type: "string" },
            seo_notes: { type: "string" },
            suggested_changes: { type: "array", items: { type: "string" } },
          },
          required: ["issues", "opportunities", "ux_notes", "seo_notes", "suggested_changes"],
          additionalProperties: false,
        },
      },
    );

    await ctx.supabase.from("tool_runs").update({ status: "succeeded", output }).eq("id", run!.id);

    const { data: analysis } = await ctx.supabase
      .from("website_analyses")
      .insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        url,
        snapshot_path: snapshotPath,
        issues: output.issues,
        opportunities: output.opportunities,
        ux_notes: output.ux_notes,
        seo_notes: output.seo_notes,
        suggested_changes: output.suggested_changes,
      })
      .select()
      .single();

    await incrementUsage(ctx, "analyze-website");

    return jsonResponse({ run_id: run!.id, analysis_id: analysis?.id, output });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyze-website] error", msg);
    await Promise.allSettled([
      ctx.supabase.from("tool_runs").update({ status: "failed", error: msg }).eq("id", run!.id),
      refundQuota(ctx, "analyze-website"),
    ]);
    if (msg === "RATE_LIMIT") return jsonResponse({ error: "Rate limit exceeded." }, 429);
    if (msg === "PAYMENT_REQUIRED") return jsonResponse({ error: "AI credits exhausted." }, 402);
    if (msg === "SITE_TIMEOUT")
      return jsonResponse({ error: "That site took too long to respond (15s). Try again." }, 422);
    if (msg === "SITE_UNREACHABLE")
      return jsonResponse({ error: "Couldn't reach that site. Check the URL and try again." }, 422);
    if (msg === "NOT_HTML")
      return jsonResponse({ error: "That URL doesn't serve an HTML page." }, 422);
    return jsonResponse({ error: "Failed to analyze website. Please try again." }, 500);
  }
});
