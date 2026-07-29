import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Building2,
  Target,
  FlaskConical,
  Trophy,
  Users,
  Lightbulb,
  Plus,
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  BookOpen,
  DollarSign,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

/* ─── Memory category definitions ───────────────────────── */
type MemoryCategory =
  | "company_profile"
  | "strategy"
  | "experiment"
  | "win"
  | "loss"
  | "customer_insight"
  | "decision";

interface MemoryEntry {
  id: string;
  memory_type: string;
  content: string;
  tags: string[];
  created_at: string;
}

interface CategoryConfig {
  type: MemoryCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  description: string;
  addLabel: string;
  placeholder: string;
  fields?: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type: "text" | "textarea" | "select";
    options?: string[];
  }>;
}

const CATEGORIES: CategoryConfig[] = [
  {
    type: "company_profile",
    label: "Company Profile",
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    description: "Core facts about your business — used in every AI output",
    addLabel: "Update profile",
    placeholder: "Describe your company, model, and mission",
    fields: [
      {
        key: "company_name",
        label: "Company name",
        type: "text",
        placeholder: "e.g. Northwind Labs",
      },
      {
        key: "business_model",
        label: "Business model",
        type: "select",
        options: [
          "SaaS",
          "Services / Agency",
          "Info product / Course",
          "E-commerce",
          "Local service",
          "Marketplace",
          "Other",
        ],
      },
      {
        key: "stage",
        label: "Current stage",
        type: "select",
        options: [
          "Idea",
          "Pre-revenue",
          "Early revenue ($0–$10K MRR)",
          "Growing ($10K–$100K MRR)",
          "Scaling ($100K+ MRR)",
        ],
      },
      {
        key: "icp",
        label: "Ideal customer",
        type: "text",
        placeholder: "e.g. B2B SaaS founders, 10-50 employee companies",
      },
      {
        key: "core_problem",
        label: "Problem you solve",
        type: "textarea",
        placeholder: "What is broken today that you fix?",
      },
    ],
  },
  {
    type: "strategy",
    label: "Strategy",
    icon: Target,
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/20",
    description: "Key strategic decisions and direction",
    addLabel: "Add strategy note",
    placeholder: "e.g. We're doubling down on outbound for Q3. Target: 50 demos.",
    fields: [
      {
        key: "title",
        label: "What is the strategy?",
        type: "text",
        placeholder: "e.g. Focus on outbound sales for Q3",
      },
      {
        key: "rationale",
        label: "Why this strategy?",
        type: "textarea",
        placeholder: "What data or insight led to this decision?",
      },
      {
        key: "success_metric",
        label: "How will you know it worked?",
        type: "text",
        placeholder: "e.g. 50 demos booked, 10 new customers",
      },
    ],
  },
  {
    type: "experiment",
    label: "Experiments",
    icon: FlaskConical,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
    description: "Things you tried — what worked, what didn't",
    addLabel: "Log experiment",
    placeholder: "e.g. Tested cold email with personalized first lines",
    fields: [
      {
        key: "what",
        label: "What did you try?",
        type: "text",
        placeholder: "e.g. Cold outreach with personalised video",
      },
      {
        key: "hypothesis",
        label: "What did you expect?",
        type: "text",
        placeholder: "e.g. Higher reply rate than plain text",
      },
      {
        key: "result",
        label: "What actually happened?",
        type: "textarea",
        placeholder: "e.g. 12% reply rate vs 4% baseline — 3x better",
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "select",
        options: [
          "Winner — keep doing this",
          "Promising — needs refinement",
          "Mixed — context-dependent",
          "Failed — don't repeat this",
        ],
      },
    ],
  },
  {
    type: "win",
    label: "Wins",
    icon: Trophy,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    description: "Milestones, breakthroughs, and good outcomes",
    addLabel: "Log a win",
    placeholder: "e.g. Closed first $5K deal with XYZ Corp",
    fields: [
      {
        key: "what_happened",
        label: "What was the win?",
        type: "text",
        placeholder: "e.g. Closed first $5K deal",
      },
      {
        key: "how",
        label: "How did it happen?",
        type: "textarea",
        placeholder: "What led to this win? What can be repeated?",
      },
      {
        key: "impact",
        label: "Impact",
        type: "text",
        placeholder: "e.g. $5K MRR, 1 new enterprise logo",
      },
    ],
  },
  {
    type: "loss",
    label: "Lessons",
    icon: Lightbulb,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    description: "Things that didn't work — turned into learnings",
    addLabel: "Log a lesson",
    placeholder: "e.g. Launched to wrong audience — too broad",
    fields: [
      {
        key: "what_failed",
        label: "What didn't work?",
        type: "text",
        placeholder: "e.g. Outbound to HR directors didn't convert",
      },
      {
        key: "why",
        label: "Why do you think it failed?",
        type: "textarea",
        placeholder: "Root cause analysis",
      },
      {
        key: "lesson",
        label: "What will you do differently?",
        type: "text",
        placeholder: "e.g. Target ops leaders instead of HR",
      },
    ],
  },
  {
    type: "customer_insight",
    label: "Customer Insights",
    icon: Users,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
    description: "Things you've learned about your customers",
    addLabel: "Add customer insight",
    placeholder: "e.g. Customers care about speed more than features",
    fields: [
      {
        key: "insight",
        label: "What did you learn?",
        type: "textarea",
        placeholder: "e.g. Customers don't want more features — they want less time to value",
      },
      {
        key: "source",
        label: "How did you learn this?",
        type: "select",
        options: [
          "Customer interview",
          "Survey",
          "Support ticket",
          "Sales call",
          "Churn reason",
          "Usage data",
          "Other",
        ],
      },
      {
        key: "action",
        label: "What will you change?",
        type: "text",
        placeholder: "e.g. Simplify onboarding from 12 steps to 3",
      },
    ],
  },
];

/* ─── Add Entry Modal ────────────────────────────────────── */
function AddEntryModal({
  category,
  userId,
  onClose,
  onSaved,
}: {
  category: CategoryConfig;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const handleSave = async () => {
    const fields = category.fields ?? [];
    const allValues = Object.entries(values).filter(([, v]) => v.trim());
    if (allValues.length === 0 && fields.length > 0) {
      toast.error("Fill in at least one field before saving.");
      return;
    }
    setSaving(true);
    try {
      const contentParts = fields
        .filter((f) => values[f.key]?.trim())
        .map((f) => `${f.label}: ${values[f.key]}`);
      const content = contentParts.length > 0 ? contentParts.join("\n") : (values["__free"] ?? "");
      const tags = [
        category.type,
        values.outcome ?? "",
        values.business_model ?? "",
        values.stage ?? "",
      ].filter(Boolean);

      await supabase.from("operator_memory").insert({
        user_id: userId,
        memory_type: category.type,
        content,
        tags,
        pruned: false,
      });
      toast.success(`${category.label} entry saved to your memory`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const Icon = category.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                category.bg,
                "border",
                category.border,
              )}
            >
              <Icon className={cn("h-5 w-5", category.color)} />
            </div>
            <div>
              <div className="text-[14px] font-bold text-foreground">{category.addLabel}</div>
              <div className="text-[11.5px] text-muted-foreground">{category.description}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Fields */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {(category.fields ?? []).map((field) => (
            <div key={field.key}>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  className="w-full rounded-xl border border-border bg-surface-1/40 px-3 py-2.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  value={values[field.key] ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {field.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface-1/40 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : (
                <input
                  className="w-full rounded-xl border border-border bg-surface-1/40 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-surface-1/30">
          <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            This will be remembered and used in all future AI outputs
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Save to memory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Memory Entry Card ──────────────────────────────────── */
function EntryCard({
  entry,
  category,
  onDelete,
}: {
  entry: MemoryEntry;
  category: CategoryConfig;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = category.icon;
  const preview = entry.content.split("\n")[0] ?? entry.content;
  const hasMore = entry.content.split("\n").length > 1;

  return (
    <div className={cn("rounded-xl border p-3 transition-all", category.bg, category.border)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", category.color)} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground leading-relaxed">
            {expanded ? entry.content : preview}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "text-[11px] font-medium mt-1 flex items-center gap-0.5",
                category.color,
              )}
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" /> Less
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" /> More
                </>
              )}
            </button>
          )}
          <div className="text-[11px] text-muted-foreground mt-1.5">
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="h-6 w-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Completeness Score ─────────────────────────────────── */
function CompletenessScore({ entries }: { entries: MemoryEntry[] }) {
  const categories: MemoryCategory[] = [
    "company_profile",
    "strategy",
    "experiment",
    "win",
    "customer_insight",
  ];
  const filledCats = new Set(entries.map((e) => e.memory_type as MemoryCategory));
  const score = Math.round((filledCats.size / categories.length) * 100);
  const missing = categories.filter((c) => !filledCats.has(c));
  const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.type, c]));

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        score >= 80
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div
            className={cn(
              "text-[13px] font-bold",
              score >= 80 ? "text-emerald-700 dark:text-emerald-300" : "text-primary",
            )}
          >
            Business context: {score}% complete
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {score >= 80
              ? "Great! Bylda has strong context about your business."
              : "The more you add, the smarter every AI output gets."}
          </div>
        </div>
        <div className="shrink-0">
          <div
            className="text-[22px] font-black"
            style={{ color: score >= 80 ? "#34D399" : "var(--primary)" }}
          >
            {score}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: score >= 80 ? "#34D399" : "var(--primary)" }}
        />
      </div>

      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted-foreground">Still missing:</span>
          {missing.map((type) => {
            const cat = catMap[type];
            if (!cat) return null;
            return (
              <span
                key={type}
                className="text-[11px] font-medium text-muted-foreground border border-border/60 rounded-full px-2 py-0.5"
              >
                {cat.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────── */
export function BusinessMemory({ userId, orgId }: { userId: string; orgId: string }) {
  const qc = useQueryClient();
  const [addingCategory, setAddingCategory] = useState<CategoryConfig | null>(null);
  const [activeFilter, setActiveFilter] = useState<MemoryCategory | "all">("all");

  const entriesQ = useQuery({
    queryKey: ["business_memory", userId],
    queryFn: async () => {
      const types = CATEGORIES.map((c) => c.type);
      const { data } = await supabase
        .from("operator_memory")
        .select("id, memory_type, content, tags, created_at")
        .eq("user_id", userId)
        .in("memory_type", types)
        .eq("pruned", false)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as MemoryEntry[];
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("operator_memory").update({ pruned: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_memory", userId] }),
    onError: () => toast.error("Couldn't remove entry"),
  });

  const entries = entriesQ.data ?? [];
  const filtered =
    activeFilter === "all" ? entries : entries.filter((e) => e.memory_type === activeFilter);

  const getCategoryEntries = (type: MemoryCategory) =>
    entries.filter((e) => e.memory_type === type);

  return (
    <div className="space-y-6">
      {/* Context completeness */}
      <CompletenessScore entries={entries} />

      {/* What this does */}
      <div className="rounded-2xl border border-border bg-background p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div>
          <div className="text-[13px] font-bold text-foreground mb-1">
            What business memory does
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Every entry you add here is remembered by Bylda and used automatically in your Launchpad
            tools, research, and strategy outputs. The more context you give, the more personalized
            every AI output becomes.
          </p>
        </div>
      </div>

      {/* Category grid */}
      <div>
        <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">
          Add to your memory
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => {
            const count = getCategoryEntries(cat.type).length;
            const Icon = cat.icon;
            return (
              <button
                key={cat.type}
                onClick={() => setAddingCategory(cat)}
                className={cn(
                  "group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:shadow-md",
                  cat.bg,
                  cat.border,
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <Icon className={cn("h-5 w-5", cat.color)} />
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        cat.bg,
                        cat.color,
                      )}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <div>
                  <div className={cn("text-[13px] font-bold", cat.color)}>{cat.label}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
                    {cat.description}
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold mt-auto",
                    cat.color,
                  )}
                >
                  <Plus className="h-3 w-3" /> {cat.addLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries timeline */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Memory timeline
            </div>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Filter */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                activeFilter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              All ({entries.length})
            </button>
            {CATEGORIES.filter((c) => getCategoryEntries(c.type).length > 0).map((c) => (
              <button
                key={c.type}
                onClick={() => setActiveFilter(c.type)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                  activeFilter === c.type
                    ? cn("border-current", c.color, c.bg)
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label} ({getCategoryEntries(c.type).length})
              </button>
            ))}
          </div>

          <div className="space-y-2 group">
            {entriesQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-muted-foreground">
                No entries yet in this category.
              </div>
            ) : (
              filtered.map((entry) => {
                const cat = CATEGORIES.find((c) => c.type === entry.memory_type);
                if (!cat) return null;
                return (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    category={cat}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !entriesQ.isLoading && (
        <div className="text-center py-12">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary/60" />
          </div>
          <div className="text-[15px] font-semibold text-foreground mb-1">
            Your business memory is empty
          </div>
          <div className="text-[13px] text-muted-foreground max-w-sm mx-auto mb-4">
            Start by adding your company profile. This gives Bylda the context it needs to
            personalize every output.
          </div>
          <button
            onClick={() => setAddingCategory(CATEGORIES[0])}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" /> Add company profile
          </button>
        </div>
      )}

      {/* Reconnect reminder */}
      <div className="rounded-2xl border border-border bg-surface-1/40 p-4 flex items-start gap-3">
        <DollarSign className="h-4.5 w-4.5 shrink-0 text-primary mt-0.5" />
        <div>
          <div className="text-[12.5px] font-semibold text-foreground mb-0.5">
            Did something important happen outside this platform?
          </div>
          <p className="text-[12px] text-muted-foreground">
            Closed a deal, ran a campaign, got a customer insight? Log it here so Bylda remembers it
            and uses it in your strategy.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() =>
                setAddingCategory(CATEGORIES.find((c) => c.type === "win") ?? CATEGORIES[0])
              }
              className="text-[12px] font-semibold text-emerald-600 hover:underline flex items-center gap-1"
            >
              <Trophy className="h-3.5 w-3.5" /> Log a win <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() =>
                setAddingCategory(CATEGORIES.find((c) => c.type === "experiment") ?? CATEGORIES[0])
              }
              className="text-[12px] font-semibold text-purple-600 hover:underline flex items-center gap-1"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Log an experiment{" "}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Add modal */}
      {addingCategory && (
        <AddEntryModal
          category={addingCategory}
          userId={userId}
          onClose={() => setAddingCategory(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["business_memory", userId] })}
        />
      )}
    </div>
  );
}
