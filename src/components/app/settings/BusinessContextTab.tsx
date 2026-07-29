/**
 * BusinessContextTab — the human-readable, editable view of the Business
 * Context Graph (business_context table). This is what every AI call reads;
 * editing here is how a business "tells Bylda it changed". Saving bumps the
 * context version (DB trigger) and kicks a briefing regeneration.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, Save, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateAiDashboard, businessContextQuery } from "@/lib/queries";
import { EmptyState } from "@/components/app/EmptyState";
import { toast } from "sonner";

type Block = Record<string, unknown>;

const s = (block: Block | null | undefined, key: string): string => {
  const v = block?.[key];
  return typeof v === "string" ? v : "";
};
const arr = (block: Block | null | undefined, key: string): string => {
  const v = block?.[key];
  return Array.isArray(v) ? v.join(", ") : "";
};
const toArr = (v: string): string[] =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

interface FormState {
  name: string;
  description: string;
  industry: string;
  niche: string;
  target: string;
  customerDescription: string;
  stage: string;
  revenueBand: string;
  teamSize: string;
  monetization: string;
  goal90d: string;
  scaleGoal: string;
  bottlenecks: string;
  channels: string;
}

export function BusinessContextTab() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...businessContextQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data || form) return;
    const d = q.data;
    setForm({
      name: s(d.identity as Block, "name"),
      description: s(d.identity as Block, "description"),
      industry: s(d.identity as Block, "industry"),
      niche: s(d.identity as Block, "niche"),
      target: s(d.customer as Block, "target"),
      customerDescription: s(d.customer as Block, "description"),
      stage: s(d.stage as Block, "stage"),
      revenueBand: s(d.stage as Block, "revenue_band"),
      teamSize: s(d.stage as Block, "team_size"),
      monetization: s(d.model as Block, "monetization"),
      goal90d: s(d.goals as Block, "goal_90d"),
      scaleGoal: s(d.goals as Block, "scale_goal"),
      bottlenecks: arr(d.motion as Block, "bottlenecks"),
      channels: arr(d.motion as Block, "channels"),
    });
  }, [q.data, form]);

  if (q.isLoading) {
    return (
      <div
        className="flex items-center gap-2 py-10 text-[13px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your business context…
      </div>
    );
  }

  if (!q.data) {
    return (
      <EmptyState
        icon={Brain}
        title="No business context yet"
        description="Bylda builds this from onboarding. Run through it once and every AI output becomes specific to your business."
        action={
          <Link to="/onboarding">
            <Button size="sm">Set up your context</Button>
          </Link>
        }
      />
    );
  }

  if (!form) return null;
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!currentOrgId || saving) return;
    setSaving(true);
    try {
      const d = q.data!;
      const { error } = await supabase
        .from("business_context")
        .update({
          identity: {
            ...(d.identity as Block),
            name: form.name || null,
            description: form.description || null,
            industry: form.industry || null,
            niche: form.niche || null,
          },
          customer: {
            ...(d.customer as Block),
            target: form.target || null,
            description: form.customerDescription || null,
          },
          stage: {
            ...(d.stage as Block),
            stage: form.stage || null,
            revenue_band: form.revenueBand || null,
            team_size: form.teamSize || null,
          },
          model: { ...(d.model as Block), monetization: form.monetization || null },
          goals: {
            ...(d.goals as Block),
            goal_90d: form.goal90d || null,
            scale_goal: form.scaleGoal || null,
          },
          motion: {
            ...(d.motion as Block),
            bottlenecks: toArr(form.bottlenecks),
            channels: toArr(form.channels),
          },
        })
        .eq("organization_id", currentOrgId);
      if (error) throw error;
      toast.success("Business context updated — Bylda will use this from now on");
      qc.invalidateQueries({ queryKey: ["business_context", currentOrgId] });
      // Context changed → refresh the AI briefing in the background.
      generateAiDashboard({ organization_id: currentOrgId })
        .then(() => qc.invalidateQueries({ queryKey: ["ai_dashboard", currentOrgId] }))
        .catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const version = (q.data.version as number) ?? 1;

  return (
    <div className="max-w-2xl space-y-6">
      <div
        className="flex items-start gap-3 rounded-xl border p-4"
        style={{
          borderColor: "color-mix(in oklab, var(--primary) 25%, transparent)",
          background: "color-mix(in oklab, var(--primary) 5%, transparent)",
        }}
      >
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          This is what Bylda knows about your business — every tool, briefing, and recommendation
          reads from it. Keep it current and outputs stay specific.{" "}
          <span className="font-mono text-[11px]">context v{version}</span>
        </p>
      </div>

      <Section title="Identity">
        <Field label="Business name" value={form.name} onChange={set("name")} />
        <Field
          label="What it does (one sentence)"
          value={form.description}
          onChange={set("description")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Industry" value={form.industry} onChange={set("industry")} />
          <Field label="Niche" value={form.niche} onChange={set("niche")} />
        </div>
      </Section>

      <Section title="Customer">
        <Field label="Target customer" value={form.target} onChange={set("target")} />
        <Field
          label="Describe them"
          value={form.customerDescription}
          onChange={set("customerDescription")}
          placeholder="e.g. solo dentists in Texas doing $30-80k/mo"
        />
      </Section>

      <Section title="Stage & model">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Stage" value={form.stage} onChange={set("stage")} />
          <Field label="Revenue band" value={form.revenueBand} onChange={set("revenueBand")} />
          <Field label="Team size" value={form.teamSize} onChange={set("teamSize")} />
        </div>
        <Field
          label="How you make money"
          value={form.monetization}
          onChange={set("monetization")}
        />
      </Section>

      <Section title="Goals & motion">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="90-day goal" value={form.goal90d} onChange={set("goal90d")} />
          <Field label="12-month goal" value={form.scaleGoal} onChange={set("scaleGoal")} />
        </div>
        <Field
          label="Bottlenecks (comma-separated)"
          value={form.bottlenecks}
          onChange={set("bottlenecks")}
        />
        <Field
          label="Acquisition channels (comma-separated)"
          value={form.channels}
          onChange={set("channels")}
        />
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save context
        </Button>
        <Link
          to="/onboarding"
          className="text-[12px] underline-offset-2 hover:underline"
          style={{ color: "var(--muted-foreground)" }}
        >
          Re-run onboarding instead
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[12px] font-medium">{label}</div>
      <Input value={value} onChange={onChange} placeholder={placeholder} className="h-10" />
    </div>
  );
}
