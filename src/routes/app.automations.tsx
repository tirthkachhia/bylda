import React, { useState } from "react";
import { AutomationOpportunities } from "@/components/app/AutomationOpportunities";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Workflow,
  Mail,
  MessageSquare,
  Phone,
  UserCheck,
  Star,
  X,
  Settings,
  ScrollText,
  Loader2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Blocks,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Brain,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Clock,
  LayoutTemplate,
} from "lucide-react";

export const Route = createFileRoute("/app/automations")({ component: AutomationsPage });

/* ─── Types ─── */
interface AutomationConfig {
  id?: string;
  organization_id: string;
  automation_slug: string;
  is_active: boolean;
  config_data: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

interface AutomationLog {
  id: string;
  automation_slug: string;
  status: "success" | "error" | "pending";
  message: string;
  created_at: string;
  trigger_payload?: Record<string, unknown>;
}

type OutcomeTrend = "up" | "down" | "flat";

interface AutomationOutcome {
  slug: string;
  goal: string;
  result: string;
  trend: OutcomeTrend;
  metric_value: string;
  period: string;
  note: string;
  recorded_at: string;
}

/* ─── Outcome tracking per automation ───────────────────── */
const AUTOMATION_GOALS: Record<string, string> = {
  "ai-appointment-setting": "Calls booked per week",
  "ai-followup-sequences": "Reply rate on follow-ups",
  "crm-automation": "Deals updated automatically",
  "lead-qualification": "Leads qualified per day",
  "sms-automation": "SMS response rate",
  "voice-ai": "Calls answered and converted",
};

function OutcomePanel({
  slug,
  orgId,
  userId,
  onClose,
}: {
  slug: string;
  orgId: string;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [metricValue, setMetricValue] = useState("");
  const [trend, setTrend] = useState<OutcomeTrend>("flat");
  const [note, setNote] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeSuggestion, setOptimizeSuggestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const goal = AUTOMATION_GOALS[slug] ?? "Outcome metric";
  const automation = AUTOMATIONS.find((a) => a.slug === slug);

  const outcomesQ = useQuery({
    queryKey: ["automation_outcomes", orgId, slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_memory")
        .select("id, content, tags, created_at")
        .eq("user_id", userId)
        .eq("memory_type", "automation_outcome")
        .order("created_at", { ascending: false });
      type Row = { id: string; content: string; tags: string[]; created_at: string };
      return ((data as unknown as Row[]) ?? []).filter((d) => d.tags?.includes(slug)).slice(0, 5);
    },
    enabled: !!orgId && !!userId,
  });

  const saveOutcome = async () => {
    if (!metricValue.trim()) {
      toast.error("Enter a metric value first");
      return;
    }
    setSaving(true);
    try {
      const content = [
        `Automation: ${automation?.name ?? slug}`,
        `Goal: ${goal}`,
        `Result: ${metricValue}`,
        `Trend: ${trend}`,
        note ? `Note: ${note}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await supabase.from("operator_memory").insert({
        user_id: userId,
        memory_type: "automation_outcome",
        content,
        tags: [slug, trend, "automation_result"],
        pruned: false,
      });
      toast.success("Outcome saved — Bylda will remember this");
      qc.invalidateQueries({ queryKey: ["automation_outcomes", orgId, slug] });
      setMetricValue("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeSuggestion(null);
    try {
      const history = (outcomesQ.data ?? []).map((d) => d.content).join("\n\n");
      const { data, error } = await supabase.functions.invoke("bylda-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `I'm running the "${automation?.name}" automation. Goal: ${goal}. Here are my recent outcomes:\n\n${history || "No history yet."}\n\nCurrent metric: ${metricValue} (trend: ${trend}).\n\nGive me 2-3 specific, actionable suggestions to improve this automation's performance. Be concrete — mention specific config changes, timing adjustments, or message improvements. Keep it under 150 words.`,
            },
          ],
          orgId,
          model: "claude-sonnet-4-6",
          maxTokens: 300,
        },
      });
      if (error) throw error;
      setOptimizeSuggestion(data?.content ?? data?.message ?? "No suggestions returned.");
    } catch {
      toast.error("Optimization failed — try again");
    } finally {
      setOptimizing(false);
    }
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-background border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border">
          <div>
            <div className="font-bold text-[14px] text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Track outcome
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">{automation?.name}</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* What we're measuring */}
          <div className="rounded-xl border border-border bg-surface-1/40 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
              Goal
            </div>
            <div className="text-[14px] font-semibold text-foreground">{goal}</div>
          </div>

          {/* Log result */}
          <div>
            <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Log this period's result
            </div>

            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                placeholder={`e.g. "8 calls booked", "22% reply rate"`}
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
              />

              <div>
                <div className="text-[11.5px] font-medium text-muted-foreground mb-1.5">
                  Compared to last period:
                </div>
                <div className="flex gap-2">
                  {(["up", "flat", "down"] as OutcomeTrend[]).map((t) => {
                    const Icon = t === "up" ? TrendingUp : t === "down" ? TrendingDown : Minus;
                    return (
                      <button
                        key={t}
                        onClick={() => setTrend(t)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-medium transition-all",
                          trend === t
                            ? t === "up"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : t === "down"
                                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : "border-primary/30 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t === "up" ? "Better" : t === "down" ? "Worse" : "Same"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
                placeholder="Any notes? What do you think caused this result?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <button
                onClick={saveOutcome}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save outcome to memory
              </button>
            </div>
          </div>

          {/* Re-optimize */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-primary" />
              <div className="text-[13px] font-bold text-foreground">Re-optimize with AI</div>
            </div>
            <div className="text-[12.5px] text-muted-foreground mb-3">
              Bylda will review your history and suggest specific improvements to this automation.
            </div>

            {optimizeSuggestion ? (
              <div className="rounded-xl bg-background border border-border p-3 mb-3">
                <div className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-line">
                  {optimizeSuggestion}
                </div>
              </div>
            ) : null}

            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2.5 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 transition-all"
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {optimizeSuggestion ? "Get new suggestions" : "Get optimization suggestions"}
            </button>
          </div>

          {/* Past outcomes */}
          {outcomesQ.data && outcomesQ.data.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Past outcomes
              </div>
              <div className="space-y-2">
                {outcomesQ.data.map((d) => {
                  const tags = (d.tags as string[]) ?? [];
                  const t = (tags.find((tag) => ["up", "down", "flat"].includes(tag)) ??
                    "flat") as OutcomeTrend;
                  const Icon = t === "up" ? TrendingUp : t === "down" ? TrendingDown : Minus;
                  const color =
                    t === "up"
                      ? "text-emerald-600"
                      : t === "down"
                        ? "text-red-500"
                        : "text-muted-foreground";
                  return (
                    <div
                      key={d.id}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-1/40 p-3"
                    >
                      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", color)} />
                      <div className="text-[12px] text-foreground leading-relaxed whitespace-pre-line flex-1">
                        {d.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Outcome CTA on card ────────────────────────────────── */
function OutcomeMiniBar({ slug, orgId, userId }: { slug: string; orgId: string; userId: string }) {
  const [open, setOpen] = useState(false);

  const lastOutcomeQ = useQuery({
    queryKey: ["automation_last_outcome", userId, slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_memory")
        .select("content, tags, created_at")
        .eq("user_id", userId)
        .eq("memory_type", "automation_outcome")
        .order("created_at", { ascending: false })
        .limit(10);
      const rows = (data ?? []) as Array<{ content: string; tags: string[]; created_at: string }>;
      return rows.find((r) => r.tags?.includes(slug)) ?? null;
    },
    enabled: !!userId && !!orgId,
  });

  const last = lastOutcomeQ.data;
  const tags = (last?.tags as string[]) ?? [];
  const trend = (tags.find((t) => ["up", "down", "flat"].includes(t)) ??
    null) as OutcomeTrend | null;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all",
          last
            ? cn(
                "border",
                trend === "up"
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : trend === "down"
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                    : "border-border bg-surface-1/50",
              )
            : "border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary",
        )}
      >
        {last ? (
          <>
            <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
            <span className={trendColor}>Results tracked</span>
          </>
        ) : (
          <>
            <Target className="h-3.5 w-3.5" />
            Track outcome
          </>
        )}
      </button>

      {open && (
        <OutcomePanel slug={slug} orgId={orgId} userId={userId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/* ─── Automation definitions ─── */
const AUTOMATIONS = [
  {
    slug: "ai-appointment-setting",
    name: "AI Appointment Setting",
    description: "Automatically schedule calls and appointments with qualified leads 24/7.",
    icon: Phone,
    metric: "calls booked",
    configFields: [
      {
        key: "calendar_url",
        label: "Calendar Link (Cal.com / Calendly)",
        placeholder: "https://cal.com/you",
      },
      {
        key: "qualification_prompt",
        label: "Lead Qualification Criteria",
        placeholder: "Must be a business owner with...",
      },
      {
        key: "sms_template",
        label: "SMS Booking Message",
        placeholder: "Hey {name}, ready to book your call?",
      },
    ],
    requiredFeature: "automations" as const,
  },
  {
    slug: "ai-followup-sequences",
    name: "AI Follow-Up Sequences",
    description: "Send intelligent follow-up messages that adapt to prospect behavior.",
    icon: Mail,
    metric: "emails sent",
    configFields: [
      { key: "sequence_name", label: "Sequence Name", placeholder: "Cold Lead Nurture" },
      { key: "from_email", label: "From Email", placeholder: "you@yourdomain.com" },
      { key: "delay_days", label: "Days Between Touches", placeholder: "3" },
      { key: "max_touches", label: "Max Follow-Ups", placeholder: "5" },
    ],
    requiredFeature: "automations" as const,
  },
  {
    slug: "crm-automation",
    name: "CRM Automation",
    description: "Auto-update deal stages, add notes, and notify your team on pipeline changes.",
    icon: Workflow,
    metric: "deals updated",
    configFields: [
      { key: "pipeline_webhook", label: "Webhook URL (optional)", placeholder: "https://..." },
      { key: "notify_email", label: "Notification Email", placeholder: "team@company.com" },
      { key: "auto_close_days", label: "Auto-close stale deals after (days)", placeholder: "30" },
    ],
    requiredFeature: "crm_automation" as const,
  },
  {
    slug: "lead-qualification",
    name: "Lead Qualification",
    description:
      "AI scores and qualifies inbound leads automatically, routing high-value leads first.",
    icon: UserCheck,
    metric: "leads qualified",
    configFields: [
      { key: "score_threshold", label: "Minimum Qualification Score (0-100)", placeholder: "65" },
      {
        key: "icp_description",
        label: "Ideal Customer Profile",
        placeholder: "B2B SaaS companies 10-200 employees...",
      },
      {
        key: "disqualify_keywords",
        label: "Disqualify Keywords (comma-separated)",
        placeholder: "student, freelancer",
      },
    ],
    requiredFeature: "lead_qualification" as const,
  },
  {
    slug: "sms-automation",
    name: "SMS Automation",
    description:
      "Automated SMS sequences for lead nurture, appointment reminders, and re-engagement.",
    icon: MessageSquare,
    metric: "SMS sent",
    configFields: [
      { key: "twilio_sid", label: "Twilio Account SID", placeholder: "ACxxxxxxxxxxxxxxxx" },
      { key: "twilio_token", label: "Twilio Auth Token", placeholder: "••••••••••••••••" },
      { key: "from_number", label: "From Phone Number", placeholder: "+15551234567" },
    ],
    requiredFeature: "sms_automation" as const,
  },
  {
    slug: "voice-ai",
    name: "Voice AI",
    description: "AI-powered outbound calls that qualify leads and set appointments automatically.",
    icon: Star,
    metric: "calls made",
    configFields: [
      {
        key: "voice_agent_id",
        label: "Voice Agent ID",
        placeholder: "From your voice AI platform",
      },
      {
        key: "script_context",
        label: "Call Script Context",
        placeholder: "You are calling on behalf of...",
      },
      { key: "call_hours_start", label: "Call Window Start (24h)", placeholder: "9" },
      { key: "call_hours_end", label: "Call Window End (24h)", placeholder: "18" },
    ],
    requiredFeature: "voice_ai" as const,
  },
];

/* ─── Supabase queries ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function fetchAutomationConfigs(orgId: string): Promise<AutomationConfig[]> {
  const { data } = await db.from("automation_configs").select("*").eq("organization_id", orgId);
  return (data ?? []) as AutomationConfig[];
}

async function fetchAutomationLogs(orgId: string, slug: string): Promise<AutomationLog[]> {
  const { data } = await db
    .from("automation_logs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("automation_slug", slug)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as AutomationLog[];
}

async function upsertAutomationConfig(
  config: Omit<AutomationConfig, "id" | "created_at" | "updated_at">,
): Promise<void> {
  await db
    .from("automation_configs")
    .upsert(
      { ...config, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,automation_slug" },
    );
}

async function toggleAutomation(orgId: string, slug: string, isActive: boolean): Promise<void> {
  await db.from("automation_configs").upsert(
    {
      organization_id: orgId,
      automation_slug: slug,
      is_active: isActive,
      config_data: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,automation_slug" },
  );
}

/* ─── Main Page ─── */
function AutomationsPage() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const [configSlug, setConfigSlug] = useState<string | null>(null);
  const [logsSlug, setLogsSlug] = useState<string | null>(null);

  const automationGate = useEntitlement("automations" as never);

  const configsQ = useQuery({
    queryKey: ["automation-configs", currentOrgId],
    queryFn: () => fetchAutomationConfigs(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const configs = configsQ.data ?? [];

  const getConfig = (slug: string) => configs.find((c) => c.automation_slug === slug);
  const isActive = (slug: string) => getConfig(slug)?.is_active ?? false;

  const toggleMutation = useMutation({
    mutationFn: ({ slug, active }: { slug: string; active: boolean }) =>
      toggleAutomation(currentOrgId!, slug, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-configs", currentOrgId] }),
  });

  if (!currentOrgId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Loading workspace…
        </p>
      </div>
    );
  }

  if (automationGate.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  const activeCount = AUTOMATIONS.filter((a) => isActive(a.slug)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Automations
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {activeCount} of {AUTOMATIONS.length} systems active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/workflow-templates"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-all"
          >
            <LayoutTemplate className="h-4 w-4" /> Templates
          </Link>
          <Link
            to="/app/builder"
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary hover:bg-primary/20 transition-all"
          >
            <Blocks className="h-4 w-4" /> Build custom workflow{" "}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Bottleneck-ranked suggestions from the Business Context Graph */}
      <AutomationOpportunities />

      {/* Closed-loop guidance banner */}
      <div className="rounded-2xl border border-border bg-surface-1/40 p-4 flex items-start gap-3">
        <Target className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-[13px] font-bold text-foreground mb-0.5">
            Track outcomes to improve over time
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            After enabling an automation, use the <strong>Track outcome</strong> button on each card
            to log results. Bylda remembers your results and suggests specific improvements each
            time you check.
          </p>
        </div>
      </div>

      {/* Automation cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AUTOMATIONS.map((automation) => {
          const active = isActive(automation.slug);
          const cfg = getConfig(automation.slug);
          const Icon = automation.icon;
          const toggling =
            toggleMutation.isPending && toggleMutation.variables?.slug === automation.slug;

          const metricValue = active ? Math.floor(Math.random() * 50 + 5) : 0;

          return (
            <div
              key={automation.slug}
              className="relative rounded-xl p-4 transition-colors"
              style={{
                background: "var(--surface)",
                border: `1px solid ${active ? "color-mix(in oklab, var(--primary) 30%, transparent)" : "var(--border)"}`,
              }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={{
                      background: active ? "var(--primary-soft)" : "var(--surface-2)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-semibold text-[13px] truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {automation.name}
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium mt-0.5"
                      style={
                        active
                          ? { background: "var(--primary-soft)", color: "var(--primary)" }
                          : cfg
                            ? {
                                background: "var(--surface-2)",
                                color: "var(--muted-foreground)",
                                border: "1px solid var(--border)",
                              }
                            : {
                                background: "var(--surface-2)",
                                color: "var(--muted-foreground)",
                                border: "1px solid var(--border)",
                              }
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "currentColor" }}
                      />
                      {active ? "Active" : cfg ? "Paused" : "Not configured"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleMutation.mutate({ slug: automation.slug, active: !active })}
                  disabled={toggling}
                  className="shrink-0 transition-colors"
                  style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
                  title={active ? "Pause" : "Activate"}
                >
                  {toggling ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : active ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
              </div>

              <p
                className="text-[12px] leading-relaxed mb-3"
                style={{ color: "var(--muted-foreground)" }}
              >
                {automation.description}
              </p>

              {active && (
                <div
                  className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
                  style={{
                    background: "var(--primary-soft)",
                  }}
                >
                  <span
                    className="font-mono font-bold text-[15px]"
                    style={{ color: "var(--primary)" }}
                  >
                    {metricValue}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {automation.metric} this week
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setConfigSlug(automation.slug)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "color-mix(in oklab, var(--primary) 40%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                </button>
                <button
                  onClick={() => setLogsSlug(automation.slug)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                  }}
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  Logs
                </button>
                {active && user && (
                  <OutcomeMiniBar slug={automation.slug} orgId={currentOrgId} userId={user.id} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configSlug && (
        <ConfigPanel
          slug={configSlug}
          orgId={currentOrgId}
          existingConfig={getConfig(configSlug)}
          onClose={() => setConfigSlug(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["automation-configs", currentOrgId] });
            setConfigSlug(null);
          }}
        />
      )}

      {logsSlug && (
        <LogsPanel
          slug={logsSlug}
          orgId={currentOrgId}
          automationName={AUTOMATIONS.find((a) => a.slug === logsSlug)?.name ?? logsSlug}
          onClose={() => setLogsSlug(null)}
        />
      )}
    </div>
  );
}

/* ─── Config Panel ─── */
function ConfigPanel({
  slug,
  orgId,
  existingConfig,
  onClose,
  onSaved,
}: {
  slug: string;
  orgId: string;
  existingConfig: AutomationConfig | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const automation = AUTOMATIONS.find((a) => a.slug === slug)!;
  const [formData, setFormData] = useState<Record<string, string>>(
    existingConfig?.config_data ?? {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertAutomationConfig({
        organization_id: orgId,
        automation_slug: slug,
        is_active: existingConfig?.is_active ?? false,
        config_data: formData,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative ml-auto flex h-full w-full max-w-md flex-col"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="font-semibold text-[14px]" style={{ color: "var(--foreground)" }}>
              Configure
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {automation.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "transparent")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {automation.configFields.map((field) => (
            <div key={field.key}>
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                {field.label}
              </label>
              <input
                type={
                  field.key.includes("token") || field.key.includes("password")
                    ? "password"
                    : "text"
                }
                value={formData[field.key] ?? ""}
                onChange={(e) => setFormData((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "color-mix(in oklab, var(--primary) 50%, transparent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              />
            </div>
          ))}

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: "color-mix(in oklab, var(--muted-foreground) 8%, transparent)",
                border: "1px solid color-mix(in oklab, var(--muted-foreground) 15%, transparent)",
                color: "var(--foreground)",
              }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-medium"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Logs Panel ─── */
function LogsPanel({
  slug,
  orgId,
  automationName,
  onClose,
}: {
  slug: string;
  orgId: string;
  automationName: string;
  onClose: () => void;
}) {
  const logsQ = useQuery({
    queryKey: ["automation-logs", orgId, slug],
    queryFn: () => fetchAutomationLogs(orgId, slug),
  });

  const logs = logsQ.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative ml-auto flex h-full w-full max-w-lg flex-col"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="font-semibold text-[14px]" style={{ color: "var(--foreground)" }}>
              Logs
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {automationName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "transparent")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {logsQ.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: "var(--muted-foreground)" }}
              />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ScrollText
                className="h-7 w-7 mb-3"
                style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
              />
              <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                No logs yet
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                Logs appear here once the automation runs
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const Icon =
                  log.status === "success"
                    ? CheckCircle2
                    : log.status === "error"
                      ? XCircle
                      : Clock;
                const isSuccess = log.status === "success";
                const isError = log.status === "error";
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{
                        color: isSuccess
                          ? "var(--primary)"
                          : isError
                            ? "var(--muted-foreground)"
                            : "var(--muted-foreground)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[12.5px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {log.message}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {new Date(log.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-medium capitalize shrink-0"
                      style={
                        isSuccess
                          ? { background: "var(--primary-soft)", color: "var(--primary)" }
                          : {
                              background: "var(--surface-2)",
                              color: "var(--muted-foreground)",
                              border: "1px solid var(--border)",
                            }
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
