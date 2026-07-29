import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { templateApplicationsQuery, applyTemplate } from "@/lib/queries";
import {
  TEMPLATES,
  FOUNDER_TEMPLATES,
  OPERATOR_TEMPLATES,
  type AppTemplate,
} from "@/lib/templates-catalog";
import { blockIfGuest } from "@/lib/guest";
import { cn } from "@/lib/utils";
import {
  LayoutTemplate,
  CheckCircle2,
  ArrowRight,
  Rocket,
  Zap,
  X,
  ChevronRight,
  Sparkles,
  Target,
  Wrench,
  ClipboardList,
  ArrowLeft,
  BookOpen,
  Users,
  DollarSign,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/app/templates")({ component: TemplatesPage });

/* ─── Types ─────────────────────────────────────────────── */
const AUDIENCE_FILTERS = [
  { key: "all", label: "All templates" },
  { key: "founder", label: "Founder — building something new" },
  { key: "operator", label: "Operator — running an existing business" },
] as const;

type AudienceFilter = (typeof AUDIENCE_FILTERS)[number]["key"];

interface SetupQuestion {
  key: string;
  question: string;
  type: "select" | "text";
  options?: string[];
  placeholder?: string;
}

/* ─── Per-template setup questions ──────────────────────── */
const SETUP_QUESTIONS: Record<string, SetupQuestion[]> = {
  agency: [
    {
      key: "service_type",
      question: "What type of services do you offer?",
      type: "select",
      options: [
        "Marketing / Ads",
        "Web design / Dev",
        "Consulting / Strategy",
        "Operations / Automation",
        "Other",
      ],
    },
    {
      key: "target_clients",
      question: "Who is your ideal client?",
      type: "text",
      placeholder: "e.g. Small business owners, eCommerce brands, Local restaurants",
    },
    {
      key: "avg_deal_size",
      question: "What is your average deal size?",
      type: "select",
      options: ["Under $1,000", "$1,000 – $5,000", "$5,000 – $20,000", "Over $20,000"],
    },
  ],
  saas: [
    {
      key: "user_type",
      question: "Who is your primary user?",
      type: "select",
      options: [
        "Developers / Technical users",
        "Business owners / SMBs",
        "Enterprise teams",
        "Consumers",
      ],
    },
    {
      key: "billing_model",
      question: "What billing model are you targeting?",
      type: "select",
      options: ["Monthly subscriptions", "Annual plans", "Usage-based", "Freemium + paid"],
    },
    {
      key: "stage",
      question: "Where are you in development?",
      type: "select",
      options: [
        "Idea — haven't built yet",
        "Building MVP",
        "Beta with early users",
        "Live and charging",
      ],
    },
  ],
  "info-product": [
    {
      key: "format",
      question: "What format is your product?",
      type: "select",
      options: [
        "Online course",
        "Paid newsletter",
        "Community / Membership",
        "Coaching program",
        "Digital download",
      ],
    },
    {
      key: "expertise_area",
      question: "What topic or skill do you teach?",
      type: "text",
      placeholder: "e.g. Personal finance, Fitness, Business strategy, Design",
    },
    {
      key: "audience_size",
      question: "What is your current audience size?",
      type: "select",
      options: ["No audience yet", "Under 1,000 followers", "1,000 – 10,000", "Over 10,000"],
    },
  ],
  "local-service": [
    {
      key: "service_type",
      question: "What local service do you run?",
      type: "select",
      options: [
        "HVAC / Plumbing / Electrical",
        "Cleaning / Maid service",
        "Landscaping / Lawn care",
        "Construction / Remodeling",
        "Personal services (hair, nails, fitness)",
        "Other",
      ],
    },
    {
      key: "service_area",
      question: "What city or region do you serve?",
      type: "text",
      placeholder: "e.g. Dallas, TX — 30 mile radius",
    },
    {
      key: "team_size",
      question: "How big is your team?",
      type: "select",
      options: ["Just me", "2–5 people", "6–20 people", "20+ people"],
    },
  ],
  "ai-tool": [
    {
      key: "category",
      question: "What kind of AI tool are you building?",
      type: "select",
      options: [
        "AI agent / assistant",
        "AI writing tool",
        "AI image / creative tool",
        "AI analytics / data tool",
        "AI automation / workflow",
        "Other",
      ],
    },
    {
      key: "target_user",
      question: "Who is your primary user?",
      type: "select",
      options: ["Developers", "Marketers", "Content creators", "Business owners", "Enterprises"],
    },
    {
      key: "tech_stack",
      question: "Which AI provider are you building on?",
      type: "select",
      options: [
        "Claude / Anthropic",
        "OpenAI / GPT",
        "Open-source (Llama, etc.)",
        "Multiple / undecided",
      ],
    },
  ],
  medspa: [
    {
      key: "services",
      question: "What are your main services?",
      type: "select",
      options: [
        "Injectables (Botox, fillers)",
        "Laser / skin treatments",
        "Body contouring",
        "Facials + skincare",
        "Full-service (multiple)",
      ],
    },
    {
      key: "booking_system",
      question: "What do you use for bookings?",
      type: "select",
      options: ["Jane App", "Vagaro", "Square Appointments", "Phone/manual", "Other"],
    },
    {
      key: "monthly_revenue",
      question: "What is your current monthly revenue?",
      type: "select",
      options: ["Under $10K", "$10K – $50K", "$50K – $150K", "Over $150K"],
    },
  ],
  "home-improvement": [
    {
      key: "trade_type",
      question: "What trade do you operate in?",
      type: "select",
      options: [
        "HVAC",
        "Plumbing",
        "Roofing",
        "General contracting",
        "Landscaping",
        "Electrical",
        "Multiple trades",
      ],
    },
    {
      key: "job_source",
      question: "Where do most of your jobs come from?",
      type: "select",
      options: [
        "Referrals",
        "Google / SEO",
        "Google Local Services Ads",
        "Door-to-door / canvassing",
        "Facebook Ads",
      ],
    },
    {
      key: "team_size",
      question: "How many crews do you run?",
      type: "select",
      options: ["Solo / no crew", "1–2 crews", "3–5 crews", "5+ crews"],
    },
  ],
  "agency-operator": [
    {
      key: "client_count",
      question: "How many clients do you manage?",
      type: "select",
      options: ["1–5", "6–15", "16–30", "30+"],
    },
    {
      key: "main_bottleneck",
      question: "What is your biggest operational challenge?",
      type: "select",
      options: [
        "Client reporting takes too long",
        "Too many manual tasks",
        "Hard to track work status",
        "Communication across team",
        "Scaling without chaos",
      ],
    },
    {
      key: "tools_in_use",
      question: "What tools do you currently use?",
      type: "text",
      placeholder: "e.g. GoHighLevel, Slack, ClickUp, Google Sheets",
    },
  ],
  "service-business": [
    {
      key: "service_type",
      question: "What type of service do you run?",
      type: "select",
      options: [
        "Coaching / Consulting",
        "Cleaning / Maintenance",
        "Fitness / Wellness",
        "Beauty / Personal care",
        "Accounting / Legal",
        "Other",
      ],
    },
    {
      key: "client_frequency",
      question: "How often do clients use your service?",
      type: "select",
      options: ["One-time project", "Monthly retainer", "Weekly recurring", "As-needed (variable)"],
    },
    {
      key: "growth_goal",
      question: "What is your growth goal this quarter?",
      type: "select",
      options: [
        "Get my first 10 clients",
        "Grow from 10 to 50 clients",
        "Increase revenue per client",
        "Reduce my personal workload",
      ],
    },
  ],
};

/* ─── What each template unlocks ────────────────────────── */
const TEMPLATE_OUTCOMES: Record<string, string[]> = {
  agency: [
    "Pre-selected tools to build your offer and pitch",
    "Lead qualification automation",
    "CRM set up for client pipeline",
    "Follow-up sequence for prospects",
  ],
  saas: [
    "Idea validation and competitor analysis tools",
    "MVP planning and positioning tools",
    "Landing page and pitch deck builder",
    "Lead capture and nurture automation",
  ],
  "info-product": [
    "Niche scoring and audience research",
    "Pricing and offer tools",
    "Email sequence builder",
    "Sales page and ad copy generators",
  ],
  "local-service": [
    "Local competitor analysis",
    "First 10 customer acquisition plan",
    "SMS booking automation",
    "Follow-up sequences for leads",
  ],
  "ai-tool": [
    "MVP planning and idea validation",
    "Competitor and positioning analysis",
    "Landing page and pitch builder",
    "Lead qualification automation",
  ],
  medspa: [
    "KPI dashboard for tracking revenue",
    "SMS appointment reminders",
    "AI booking automation",
    "Follow-up sequences for consultations",
  ],
  "home-improvement": [
    "First customer acquisition system",
    "Estimate follow-up automation",
    "Lead qualification routing",
    "SMS for booking and reminders",
  ],
  "agency-operator": [
    "KPI tracking across clients",
    "Client follow-up automation",
    "Lead qualification system",
    "CRM pipeline management",
  ],
  "service-business": [
    "Pricing and offer builder",
    "Appointment setting automation",
    "SMS for scheduling and reminders",
    "Client retention follow-up sequences",
  ],
};

/* ─── Preview Modal ─────────────────────────────────────── */
function TemplatePreviewModal({
  template,
  isApplied,
  onClose,
  onApply,
  applying,
}: {
  template: AppTemplate;
  isApplied: boolean;
  onClose: () => void;
  onApply: (t: AppTemplate, answers: Record<string, string>) => Promise<void>;
  applying: boolean;
}) {
  const questions = SETUP_QUESTIONS[template.slug] ?? [];
  const outcomes = TEMPLATE_OUTCOMES[template.slug] ?? [];
  const [step, setStep] = useState<"preview" | "setup" | "done">(isApplied ? "done" : "preview");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const canProceed =
    questions.length === 0 || questions.every((q) => q.type === "text" || answers[q.key]);

  const handleApply = async () => {
    await onApply(template, answers);
    setStep("done");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between gap-3 p-5 border-b border-border bg-background z-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{template.emoji}</span>
            <div>
              <div className="text-[16px] font-bold text-foreground">{template.name}</div>
              <div className="text-[12px] text-muted-foreground capitalize">
                {template.audience} template
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {step === "preview" && (
            <>
              {/* What this does */}
              <div>
                <p className="text-[14px] text-foreground leading-relaxed">
                  {template.description}
                </p>
              </div>

              {/* What you get */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  <div className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                    What this template gives you
                  </div>
                </div>
                <div className="space-y-2">
                  {outcomes.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                      <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[9px] font-bold text-emerald-600 shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools + Automations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <div className="text-[12px] font-bold text-foreground">
                      {template.recommendedTools.length} Tools
                    </div>
                  </div>
                  <div className="space-y-1">
                    {template.recommendedTools.slice(0, 4).map((t) => (
                      <div key={t} className="text-[12px] text-muted-foreground capitalize">
                        {t.replace(/-/g, " ")}
                      </div>
                    ))}
                    {template.recommendedTools.length > 4 && (
                      <div className="text-[11px] text-muted-foreground/60">
                        +{template.recommendedTools.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <div className="text-[12px] font-bold text-foreground">
                      {template.recommendedAutomations.length} Automations
                    </div>
                  </div>
                  <div className="space-y-1">
                    {template.recommendedAutomations.map((a) => (
                      <div key={a} className="text-[12px] text-muted-foreground capitalize">
                        {a.replace(/-/g, " ")}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => (questions.length > 0 ? setStep("setup") : handleApply())}
                disabled={applying}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[14px] font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                <Sparkles className="h-5 w-5" />
                {questions.length > 0
                  ? "Get started — answer 3 quick questions"
                  : "Apply this template"}
                <ChevronRight className="h-5 w-5 opacity-70" />
              </button>
            </>
          )}

          {step === "setup" && (
            <>
              <div>
                <button
                  onClick={() => setStep("preview")}
                  className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <div className="text-[15px] font-bold text-foreground mb-1">
                  3 quick questions to personalize your setup
                </div>
                <div className="text-[13px] text-muted-foreground">
                  These help us show the right tools, automations, and priorities for your specific
                  situation.
                </div>
              </div>

              <div className="space-y-5">
                {questions.map((q, i) => (
                  <div key={q.key}>
                    <label className="block text-[13.5px] font-semibold text-foreground mb-2">
                      <span className="text-primary font-bold">{i + 1}.</span> {q.question}
                    </label>
                    {q.type === "select" ? (
                      <div className="grid grid-cols-1 gap-2">
                        {q.options?.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl border p-3 text-left text-[13px] font-medium transition-all",
                              answers[q.key] === opt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                            )}
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                answers[q.key] === opt
                                  ? "border-primary"
                                  : "border-muted-foreground/40",
                              )}
                            >
                              {answers[q.key] === opt && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        className="w-full rounded-xl border border-border bg-surface-1/40 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                        placeholder={q.placeholder}
                        value={answers[q.key] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleApply}
                disabled={applying || !canProceed}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[14px] font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                <CheckCircle2 className="h-5 w-5" />
                {applying ? "Setting up your workspace…" : "Apply template to my workspace"}
              </button>
            </>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-[16px] font-bold text-foreground mb-1">
                  {template.name} template applied!
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Your workspace is set up. Here's what to do next.
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="text-[12px] font-bold uppercase tracking-widest text-primary/70">
                  Your next steps
                </div>
                <div className="space-y-3">
                  {[
                    {
                      icon: Sparkles,
                      text: "Open Bylda and run your first tool",
                      to: "/app/launchpad",
                    },
                    { icon: Zap, text: "Enable your first automation", to: "/app/automations" },
                    { icon: Target, text: "Set up your CRM pipeline", to: "/app/bylda/crm" },
                  ].map((item, i) => (
                    <Link
                      key={i}
                      to={item.to}
                      onClick={onClose}
                      className="flex items-center justify-between rounded-xl bg-background border border-border p-3 hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {i + 1}
                        </div>
                        <span className="text-[13px] font-medium text-foreground">{item.text}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-1/40 p-4 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-foreground">Tip: </span>
                After you take an action outside this platform (like setting up your email or
                connecting a CRM), come back here and connect it under{" "}
                <Link to="/app/integrations" className="text-primary underline" onClick={onClose}>
                  Integrations
                </Link>{" "}
                so the platform can use that data in your automations and strategy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Template Card ─────────────────────────────────────── */
function TemplateCard({
  template,
  isApplied,
  onPreview,
}: {
  template: AppTemplate;
  isApplied: boolean;
  onPreview: (t: AppTemplate) => void;
}) {
  const outcomes = TEMPLATE_OUTCOMES[template.slug] ?? [];
  return (
    <div
      className={cn(
        "bylda-card rounded-2xl p-5 flex flex-col gap-4 cursor-pointer hover:border-primary/30 transition-all group",
        isApplied && "border-emerald-300 dark:border-emerald-700",
      )}
      onClick={() => onPreview(template)}
      style={
        isApplied
          ? { background: "color-mix(in oklab, rgba(52,211,153,0.04), var(--card))" }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[26px] leading-none">{template.emoji}</span>
          <div>
            <div className="font-display text-[15px] font-semibold leading-tight group-hover:text-primary transition-colors">
              {template.name}
            </div>
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider mt-0.5",
                template.audience === "founder"
                  ? "bg-primary/10 text-primary"
                  : "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
              )}
            >
              {template.audience}
            </span>
          </div>
        </div>
        {isApplied ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
        )}
      </div>

      {/* Description */}
      <p className="text-[12.5px] leading-relaxed text-muted-foreground flex-1 line-clamp-2">
        {template.description}
      </p>

      {/* What you get — preview */}
      {outcomes.length > 0 && (
        <div className="space-y-1">
          {outcomes.slice(0, 2).map((o, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
              {o}
            </div>
          ))}
        </div>
      )}

      {/* Stats + CTA */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Rocket className="h-3 w-3" />
            {template.recommendedTools.length} tools
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {template.recommendedAutomations.length} automations
          </span>
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all",
            isApplied
              ? "text-emerald-600"
              : "text-primary bg-primary/10 group-hover:bg-primary group-hover:text-white",
          )}
        >
          {isApplied ? "✓ Applied" : "Use this →"}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
function TemplatesPage() {
  const { currentOrgId } = useAuth();
  const orgId = currentOrgId ?? "";
  const qc = useQueryClient();

  const appsQ = useQuery({ ...templateApplicationsQuery(orgId), enabled: !!orgId });
  const appliedSlugs = new Set((appsQ.data ?? []).map((a) => a.template_slug));

  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [search, setSearch] = useState("");
  const [previewing, setPreviewing] = useState<AppTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  const visible = (
    audience === "all" ? TEMPLATES : audience === "founder" ? FOUNDER_TEMPLATES : OPERATOR_TEMPLATES
  ).filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())),
  );

  const handleApply = async (t: AppTemplate, _answers: Record<string, string>) => {
    if (blockIfGuest("Sign up to apply a template to your workspace.")) return;
    if (applying) return;
    setApplying(true);
    try {
      await applyTemplate(orgId, t.slug);
      await qc.invalidateQueries({ queryKey: ["template_applications", orgId] });
      toast.success(`"${t.name}" template applied to your workspace`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't apply template");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* ── Header ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(125,211,252,0.04) 100%)",
          border: "1px solid rgba(167,139,250,0.18)",
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest mb-1"
            style={{ color: "rgba(167,139,250,0.7)" }}
          >
            <LayoutTemplate className="h-3 w-3" /> Template Library
          </div>
          <h1
            className="font-display text-[22px] font-bold leading-tight"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            Start from a proven playbook
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
            Pick the template that matches your business. It configures your tools, automations, and
            priorities automatically.
          </p>

          {/* Quick guide */}
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { icon: Users, text: "1. Pick a template for your business type" },
              { icon: ClipboardList, text: "2. Answer 3 quick questions" },
              { icon: Rocket, text: "3. Your workspace is ready to go" },
            ].map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl bg-background/60 border border-border px-3 py-2 text-[12px] font-medium text-foreground"
              >
                <step.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                {step.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {AUDIENCE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setAudience(f.key)}
              className={cn(
                "rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-all whitespace-nowrap",
                audience === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              {f.key === "all" ? "All" : f.key === "founder" ? "Founder" : "Operator"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Applied badge ── */}
      {appliedSlugs.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-[12.5px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <strong>
              {appliedSlugs.size} template{appliedSlugs.size > 1 ? "s" : ""}
            </strong>{" "}
            applied to your workspace
          </span>
        </div>
      )}

      {/* ── Template grid ── */}
      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TemplateCard
              key={t.slug}
              template={t}
              isApplied={appliedSlugs.has(t.slug)}
              onPreview={setPreviewing}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <div className="text-[14px] font-semibold text-muted-foreground">
            No templates match that search
          </div>
          <button
            onClick={() => setSearch("")}
            className="mt-2 text-[13px] text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* ── Reconnect reminder ── */}
      <div className="rounded-2xl border border-border bg-surface-1/40 p-5">
        <div className="flex items-start gap-3">
          <DollarSign className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div>
            <div className="text-[13px] font-bold text-foreground mb-1">
              Already set up tools outside this platform?
            </div>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-3">
              If you've already connected Stripe, set up your email provider, created a CRM, or
              connected any other external tools — bring them back in here so the platform can use
              them in your automations and strategy.
            </p>
            <Link
              to="/app/integrations"
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
            >
              Connect your tools <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {previewing && (
        <TemplatePreviewModal
          template={previewing}
          isApplied={appliedSlugs.has(previewing.slug)}
          onClose={() => setPreviewing(null)}
          onApply={handleApply}
          applying={applying}
        />
      )}
    </div>
  );
}
