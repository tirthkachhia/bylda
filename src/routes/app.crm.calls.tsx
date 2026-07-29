/**
 * CALLS — /app/crm/calls
 *
 * Conversation intelligence over the call_transcripts table. Each transcript
 * (stored by the telephony/transcription integration) can be run through the
 * analyze-call edge function on demand to extract objections, competitor
 * mentions, talk ratio and sentiment for the deal it belongs to.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall, Sparkles, Smile, Meh, Frown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCall } from "@/lib/crm";
import { CustomersNav } from "@/components/app/CustomersNav";
import { toast } from "sonner";

export const Route = createFileRoute("/app/crm/calls")({ component: CallsPage });

// call_transcripts isn't in the generated Supabase types yet; cast like the
// other CRM surfaces do for not-yet-typed tables. Result is typed as Transcript[].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Transcript = {
  id: string;
  call_id: string;
  transcript_text: string | null;
  sentiment_score: number | null;
  created_at: string;
};

function sentimentIcon(score: number | null) {
  if (score == null) return { Icon: Meh, color: "var(--text-faint)", label: "—" };
  if (score >= 0.3) return { Icon: Smile, color: "var(--success)", label: "Positive" };
  if (score <= -0.3) return { Icon: Frown, color: "var(--destructive)", label: "Negative" };
  return { Icon: Meh, color: "var(--warning)", label: "Neutral" };
}

function CallsPage() {
  const { currentOrgId } = useAuth();
  const [rows, setRows] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await db
      .from("call_transcripts")
      .select("id, call_id, transcript_text, sentiment_score, created_at")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Transcript[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function analyze(callId: string) {
    setAnalyzing(callId);
    try {
      const r = await analyzeCall(callId);
      toast.success(
        `Analyzed — ${r.objections} objection${r.objections === 1 ? "" : "s"}, ${r.competitor_mentions} competitor mention${r.competitor_mentions === 1 ? "" : "s"}`,
      );
      await load();
    } catch {
      toast.error("Couldn't analyze this call");
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <CustomersNav />
        </div>
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">Calls</h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            {rows.length} transcript{rows.length === 1 ? "" : "s"} · run Bylda on any call for
            objections, competitors, and sentiment
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <PhoneCall className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">
              No call transcripts yet
            </p>
            <p className="max-w-xs text-xs text-[--text-muted]">
              Connect a telephony or transcription integration and your recorded calls will appear
              here, ready for Bylda to analyze.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const s = sentimentIcon(t.sentiment_score);
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-[--border] bg-[--bg-surface] p-4"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--accent-light)" }}
                  >
                    <PhoneCall className="h-4 w-4 text-[--accent]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: s.color }}
                      >
                        <s.Icon className="h-3.5 w-3.5" /> {s.label}
                      </span>
                      <span className="text-[11px] text-[--text-muted]">
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[13px] text-[--text-secondary]">
                      {t.transcript_text || "No transcript text."}
                    </p>
                  </div>
                  <button
                    onClick={() => analyze(t.call_id)}
                    disabled={analyzing === t.call_id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
                    style={{ borderColor: "var(--primary-border)", color: "var(--primary)" }}
                  >
                    <Sparkles
                      className={`h-3.5 w-3.5 ${analyzing === t.call_id ? "animate-pulse" : ""}`}
                    />
                    {analyzing === t.call_id ? "Analyzing…" : "Analyze"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
