import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { useAuth } from "@/lib/auth";
import { blockIfGuest } from "@/lib/guest";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { businessContextQuery } from "@/lib/queries";
import { loadWorkspaceProfile, mergeBusinessContextIntoProfile } from "@/lib/workspaceProfile";
import { PreBriefedToolLauncher } from "@/components/launchpad/PreBriefedToolLauncher";
import {
  Search,
  Sparkles,
  ChevronRight,
  Users,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  Globe,
  DollarSign,
  Megaphone,
  Brain,
  CheckCircle2,
  ArrowRight,
  Loader2,
  RotateCcw,
  Save,
  BookOpen,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/app/research")({ component: ResearchPage });

/* ─── Types ─────────────────────────────────────────────── */
interface StrategyOutput {
  marketOverview: string;
  marketSize: string;
  demandSignals: string[];
  icp: {
    who: string;
    pain: string;
    desired: string;
    triggers: string[];
  };
  competitors: Array<{ name: string; angle: string; weakness: string }>;
  positioningAngle: string;
  pricingDirection: string;
  acquisitionChannels: Array<{ channel: string; why: string; howToStart: string }>;
  keyRisks: string[];
  nextActions: Array<{ action: string; why: string; howLong: string }>;
  verdict: "strong" | "viable" | "risky" | "rethink";
  verdictReason: string;
}

interface ResearchForm {
  idea: string;
  niche: string;
  targetCustomer: string;
  problem: string;
  competitors: string;
  stage: "idea" | "validating" | "launched" | "scaling";
}

const STAGE_OPTIONS = [
  { value: "idea", label: "Just an idea", description: "Exploring if this is worth pursuing" },
  { value: "validating", label: "Validating", description: "Testing demand before building" },
  { value: "launched", label: "Launched", description: "Already live, want to grow faster" },
  { value: "scaling", label: "Scaling", description: "It's working, want to scale it" },
] as const;

const VERDICT_CONFIG = {
  strong: {
    label: "Strong Opportunity",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  viable: {
    label: "Viable Opportunity",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    icon: TrendingUp,
  },
  risky: {
    label: "Risky — Proceed Carefully",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
  },
  rethink: {
    label: "Needs Rethinking",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    icon: RotateCcw,
  },
};

/* ─── Saved research query ───────────────────────────────── */
function useResearchHistory(userId: string) {
  return useQuery({
    queryKey: ["research_history", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("operator_memory")
        .select("id, content, tags, created_at")
        .eq("user_id", userId)
        .eq("memory_type", "research")
        .eq("pruned", false)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!userId,
  });
}

/* ─── Research prompt builder ────────────────────────────── */
function buildResearchPrompt(form: ResearchForm): string {
  return `You are a senior business strategist and market researcher. Analyze the following business opportunity and return a comprehensive, honest strategy report.

BUSINESS IDEA: ${form.idea}
TARGET NICHE: ${form.niche}
TARGET CUSTOMER: ${form.targetCustomer}
PROBLEM BEING SOLVED: ${form.problem}
KNOWN COMPETITORS: ${form.competitors || "Not specified"}
CURRENT STAGE: ${form.stage}

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "marketOverview": "2-3 sentence overview of the market landscape and current demand",
  "marketSize": "Estimated market size with TAM/SAM/SOM context",
  "demandSignals": ["signal 1", "signal 2", "signal 3"],
  "icp": {
    "who": "Specific description of the ideal customer",
    "pain": "The exact pain they feel daily",
    "desired": "What outcome they want",
    "triggers": ["trigger that makes them buy now", "trigger 2", "trigger 3"]
  },
  "competitors": [
    { "name": "Competitor A", "angle": "their positioning", "weakness": "their gap you can exploit" },
    { "name": "Competitor B", "angle": "their positioning", "weakness": "their gap" }
  ],
  "positioningAngle": "One clear sentence: who you are for, what you do differently, and why it matters",
  "pricingDirection": "Recommended pricing model and range with reasoning",
  "acquisitionChannels": [
    { "channel": "Channel name", "why": "Why it works for this audience", "howToStart": "First concrete action" },
    { "channel": "Channel 2", "why": "Why", "howToStart": "First action" },
    { "channel": "Channel 3", "why": "Why", "howToStart": "First action" }
  ],
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "nextActions": [
    { "action": "First action to take", "why": "Why this matters most", "howLong": "Time estimate" },
    { "action": "Second action", "why": "Why", "howLong": "Time" },
    { "action": "Third action", "why": "Why", "howLong": "Time" }
  ],
  "verdict": "strong|viable|risky|rethink",
  "verdictReason": "One clear sentence explaining the overall assessment"
}`;
}

/* ─── Section card wrapper ───────────────────────────────── */
function Section({
  icon: Icon,
  title,
  color = "text-foreground",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className={cn("h-5 w-5", color)} />
        <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Pill({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const colors = {
    default: "bg-surface-1 text-muted-foreground border-border",
    green:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    amber:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-medium",
        colors[variant],
      )}
    >
      {children}
    </span>
  );
}

/* ─── Strategy Output Component ─────────────────────────── */
function StrategyResult({
  data,
  onSave,
  saving,
}: {
  data: StrategyOutput;
  onSave: () => void;
  saving: boolean;
}) {
  const verdict = VERDICT_CONFIG[data.verdict];
  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div className={cn("rounded-2xl border-2 p-5", verdict.bg, verdict.border)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <VerdictIcon className={cn("h-6 w-6 shrink-0", verdict.color)} />
            <div>
              <div className={cn("text-[15px] font-bold", verdict.color)}>{verdict.label}</div>
              <div className="text-[13px] text-muted-foreground mt-0.5">{data.verdictReason}</div>
            </div>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save to Memory
          </button>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Market Overview */}
        <Section icon={Globe} title="Market Overview" color="text-blue-500">
          <p className="text-[13.5px] text-foreground leading-relaxed mb-3">
            {data.marketOverview}
          </p>
          <div className="text-[12px] font-semibold text-muted-foreground mb-1.5">MARKET SIZE</div>
          <Pill variant="blue">{data.marketSize}</Pill>
          {data.demandSignals.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[12px] font-semibold text-muted-foreground mb-1">
                DEMAND SIGNALS
              </div>
              {data.demandSignals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                  {s}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ICP */}
        <Section icon={Users} title="Ideal Customer Profile" color="text-purple-500">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                WHO THEY ARE
              </div>
              <p className="text-[13.5px] text-foreground">{data.icp.who}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                DAILY PAIN
              </div>
              <p className="text-[13.5px] text-foreground">{data.icp.pain}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                WHAT THEY WANT
              </div>
              <p className="text-[13.5px] text-foreground">{data.icp.desired}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                BUY TRIGGERS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.icp.triggers.map((t, i) => (
                  <Pill key={i} variant="green">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Positioning */}
        <Section icon={Target} title="Your Positioning Angle" color="text-primary">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-[14px] font-medium text-foreground leading-relaxed mb-4">
            "{data.positioningAngle}"
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
              PRICING DIRECTION
            </div>
            <p className="text-[13.5px] text-foreground">{data.pricingDirection}</p>
          </div>
        </Section>

        {/* Competitors */}
        <Section icon={BarChart3} title="Competitive Landscape" color="text-amber-500">
          <div className="space-y-3">
            {data.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-1/40 p-3">
                <div className="text-[13px] font-semibold text-foreground mb-1">{c.name}</div>
                <div className="text-[12px] text-muted-foreground mb-1.5">{c.angle}</div>
                <div className="flex items-start gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span className="text-[12px] text-amber-700 dark:text-amber-300">
                    {c.weakness}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Acquisition Channels */}
      <Section icon={Megaphone} title="Acquisition Channels" color="text-emerald-500">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.acquisitionChannels.map((ch, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-1/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[11px] font-bold text-emerald-600">
                  {i + 1}
                </div>
                <div className="text-[13px] font-semibold text-foreground">{ch.channel}</div>
              </div>
              <p className="text-[12px] text-muted-foreground mb-2">{ch.why}</p>
              <div className="flex items-start gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <span className="text-[12px] text-foreground font-medium">{ch.howToStart}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Two columns: Risks + Next Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={AlertTriangle} title="Key Risks" color="text-red-500">
          <div className="space-y-2">
            {data.keyRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                {r}
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Zap} title="Your Next 3 Actions" color="text-primary">
          <div className="space-y-3">
            {data.nextActions.map((a, i) => (
              <div key={i} className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">{a.action}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{a.why}</div>
                    <Pill variant="blue">{a.howLong}</Pill>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
function ResearchPage() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrgId ?? "";
  const userId = user?.id ?? "";

  // Pre-brief from the workspace profile so the idea field never renders
  // as an empty required textbox when Bylda already knows the business.
  const [form, setForm] = useState<ResearchForm>(() => {
    const profile = loadWorkspaceProfile();
    return {
      idea: profile.description ?? "",
      niche: "",
      targetCustomer: profile.target_market ?? "",
      problem: "",
      competitors: "",
      stage: "idea",
    };
  });

  // Hydrate from the server-side Business Context Graph (same source
  // run-tool's context assembly reads) — fills fields still empty locally.
  const bpCtxQ = useQuery({ ...businessContextQuery(orgId), enabled: !!orgId });
  useEffect(() => {
    if (!bpCtxQ.data) return;
    const merged = mergeBusinessContextIntoProfile(bpCtxQ.data);
    setForm((f) => ({
      ...f,
      idea: f.idea || (merged.description ?? ""),
      targetCustomer: f.targetCustomer || (merged.target_market ?? ""),
    }));
  }, [bpCtxQ.data]);

  const [result, setResult] = useState<StrategyOutput | null>(null);
  const [rawInput, setRawInput] = useState<ResearchForm | null>(null);
  const [saving, setSaving] = useState(false);

  const historyQ = useResearchHistory(userId);

  const researchMutation = useMutation({
    mutationFn: async (f: ResearchForm) => {
      const prompt = buildResearchPrompt(f);
      // invokeEdge (not raw functions.invoke): bounded timeout + typed errors,
      // same lifecycle guarantees as every Launchpad tool run — the raw
      // invoke had no timeout, so a stalled call spun "Researching…" forever.
      const data = await invokeEdge<{ content?: string; message?: string }>(
        "bylda-chat",
        {
          messages: [{ role: "user", content: prompt }],
          system:
            "You are a senior business strategist. Return only valid JSON, no commentary, no code blocks.",
          orgId,
          model: "claude-sonnet-4-6",
          maxTokens: 3000,
        },
        { timeoutMs: 120_000 },
      );
      const raw: string = data?.content ?? data?.message ?? "";
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      let parsed: StrategyOutput;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse strategy output. Please try again.");
        parsed = JSON.parse(jsonMatch[0]);
      }
      return parsed;
    },
    onSuccess: (data) => {
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Research failed. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blockIfGuest("Sign up to run AI market research.")) return;
    if (!form.idea.trim()) {
      toast.error("Please describe your business idea.");
      return;
    }
    setRawInput(form);
    researchMutation.mutate(form);
  };

  const handleSaveToMemory = async () => {
    if (!result || !userId) return;
    setSaving(true);
    try {
      const summary = {
        idea: rawInput?.idea,
        niche: rawInput?.niche,
        stage: rawInput?.stage,
        verdict: result.verdict,
        positioning: result.positioningAngle,
        savedAt: new Date().toISOString(),
      };
      await supabase.from("operator_memory").insert({
        user_id: userId,
        memory_type: "research",
        content: JSON.stringify({ summary, strategy: result }),
        tags: [rawInput?.niche ?? "", rawInput?.stage ?? "", result.verdict].filter(Boolean),
        pruned: false,
      });
      await qc.invalidateQueries({ queryKey: ["research_history", userId] });
      toast.success("Strategy saved to your memory");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setResult(null);
    setRawInput(null);
    researchMutation.reset();
  };

  const isLoading = researchMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* ── Page header ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Search className="h-5 w-5 text-primary" />
          <h1 className="text-[22px] font-bold text-foreground">Research & Strategy</h1>
        </div>
        <p className="text-[14px] text-muted-foreground">
          Enter your business idea and get a full market analysis, competitor breakdown, positioning
          angle, and step-by-step action plan — powered by AI.
        </p>
      </div>

      {/* ── Result or Form ── */}
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-foreground">{rawInput?.idea}</div>
              <div className="text-[12px] text-muted-foreground">
                {rawInput?.niche} · {rawInput?.stage}
              </div>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" /> New research
            </button>
          </div>
          <StrategyResult data={result} onSave={handleSaveToMemory} saving={saving} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input card */}
          <div className="rounded-2xl border border-border bg-background p-6 space-y-5">
            <div className="text-[13px] font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> Tell us about your idea
            </div>

            {/* Pre-briefed fields — known values render read-only in the
                "Bylda knows" panel; only unknown fields render as inputs. */}
            <PreBriefedToolLauncher
              fieldDefs={[
                {
                  key: "idea",
                  label: "Business idea",
                  type: "textarea",
                  required: true,
                  placeholder:
                    "Describe your idea clearly. What does it do? Who is it for? What problem does it solve?",
                },
                {
                  key: "niche",
                  label: "Niche or industry",
                  type: "text",
                  placeholder: "e.g. Home improvement, SaaS, Local services",
                },
                {
                  key: "targetCustomer",
                  label: "Target customer",
                  type: "text",
                  placeholder: "e.g. Small business owners, Homeowners in the US",
                },
                {
                  key: "problem",
                  label: "Problem being solved",
                  type: "text",
                  placeholder: "What's broken today? What frustrates your target customer?",
                },
                {
                  key: "competitors",
                  label: "Known competitors",
                  type: "text",
                  placeholder: "e.g. Competitor A, Competitor B, or 'not sure yet'",
                },
              ]}
              fields={{
                idea: form.idea,
                niche: form.niche,
                targetCustomer: form.targetCustomer,
                problem: form.problem,
                competitors: form.competitors,
              }}
              setField={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
              revision={typeof bpCtxQ.data?.version === "number" ? bpCtxQ.data.version : null}
            />

            {/* Stage */}
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Where are you right now?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STAGE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, stage: s.value }))}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      form.stage === s.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface-1/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    <div className="text-[13px] font-semibold">{s.label}</div>
                    <div className="text-[11.5px] mt-0.5 opacity-80">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !form.idea.trim()}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-[15px] font-bold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Researching your idea… this takes about 15 seconds
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Run market research & build strategy
                <ChevronRight className="h-5 w-5 opacity-70" />
              </>
            )}
          </button>

          {isLoading && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary animate-pulse" /> What Bylda is doing right
                now:
              </div>
              {[
                "Analyzing market demand for your niche",
                "Identifying your ideal customer profile",
                "Scanning the competitive landscape",
                "Building your positioning angle",
                "Finding the best acquisition channels",
                "Defining your top 3 next actions",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[12.5px]">
                  <div
                    className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                  {step}
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      {/* ── Past research ── */}
      {!result && historyQ.data && historyQ.data.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div className="text-[13px] font-bold text-foreground">Past research</div>
          </div>
          <div className="space-y-2">
            {historyQ.data.map((item) => {
              let parsedContent: { summary?: Record<string, string>; strategy?: StrategyOutput } =
                {};
              try {
                parsedContent = JSON.parse(item.content ?? "{}");
              } catch {
                /* ignore */
              }
              const summary = parsedContent.summary ?? {};
              const tags = (item.tags as string[] | null) ?? [];
              const verdict = (summary.verdict ??
                tags.find((t) => ["strong", "viable", "risky", "rethink"].includes(t)) ??
                "viable") as keyof typeof VERDICT_CONFIG;
              const vc = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.viable;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    try {
                      if (parsedContent.strategy) {
                        setResult(parsedContent.strategy);
                        setRawInput({
                          idea: summary.idea ?? "",
                          niche: summary.niche ?? "",
                          targetCustomer: "",
                          problem: "",
                          competitors: "",
                          stage: (summary.stage as ResearchForm["stage"]) ?? "idea",
                        });
                      }
                    } catch {
                      toast.error("Could not load saved research");
                    }
                  }}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 hover:border-primary/30 text-left transition-all"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-foreground truncate">
                      {summary.idea ?? "Research"}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {summary.niche} · {new Date(item.created_at ?? "").toLocaleDateString()}
                    </div>
                  </div>
                  <Pill
                    variant={
                      verdict === "strong"
                        ? "green"
                        : verdict === "risky"
                          ? "amber"
                          : verdict === "rethink"
                            ? "red"
                            : "blue"
                    }
                  >
                    {vc.label}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
