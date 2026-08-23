import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { blockIfGuest } from "@/lib/guest";
import { invokeEdge } from "@/lib/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/crm/setup")({
  component: CrmIntelligenceSetup,
});

type ReviewMode = "conservative" | "balanced" | "fast";

type Answers = {
  business_description: string;
  buyer_and_motion: string;
  call_goal: string;
  must_capture: string[];
  custom_capture: string;
  review_mode: ReviewMode;
};

type GeneratedField = {
  key: string;
  label: string;
  description: string;
  crmTarget: string;
  required?: boolean;
  sensitivity?: "standard" | "review" | "restricted";
};

type GeneratedProfile = {
  key: string;
  label: string;
  objective: string;
  summary: string;
  insightQuestions: string[];
  complianceRules: string[];
  fields: GeneratedField[];
  autoWriteMinConfidence: number;
  reviewMode: ReviewMode;
  generatedBy: string;
};

type ProfileRow = {
  status: string;
  generated_at: string;
  questionnaire_answers: Partial<Answers>;
  generated_profile: GeneratedProfile;
};

type GenerateResponse = {
  ok: boolean;
  profile: {
    generated_profile: GeneratedProfile;
    generated_at: string;
    status: string;
  };
};

const DEFAULT_ANSWERS: Answers = {
  business_description: "",
  buyer_and_motion: "",
  call_goal: "",
  must_capture: ["Call outcome", "Next step", "Primary objection"],
  custom_capture: "",
  review_mode: "balanced",
};

const GOALS = [
  { id: "Qualify the opportunity", detail: "Fit, urgency, authority, and timing" },
  { id: "Book the next appointment", detail: "Capture the commitment and owner" },
  { id: "Close or enroll the buyer", detail: "Decision factors and final blockers" },
  { id: "Renew or expand an account", detail: "Health, risk, and growth signals" },
];

const CAPTURE_OPTIONS = [
  "Call outcome",
  "Next step",
  "Primary objection",
  "Budget or premium",
  "Decision timeline",
  "Decision maker",
  "Product or coverage need",
  "Competitor or current provider",
];

const REVIEW_MODES: Array<{
  id: ReviewMode;
  label: string;
  detail: string;
  threshold: string;
}> = [
  {
    id: "conservative",
    label: "Review more",
    detail: "Best for regulated or high-stakes sales.",
    threshold: "90% confidence",
  },
  {
    id: "balanced",
    label: "Balanced",
    detail: "Automate clear facts and review uncertain values.",
    threshold: "82% confidence",
  },
  {
    id: "fast",
    label: "Automate more",
    detail: "Best for high-volume, lower-risk workflows.",
    threshold: "72% confidence",
  },
];

const QUESTIONS = [
  "What does your team sell?",
  "Who buys, and how does the sale happen?",
  "What should a successful call accomplish?",
  "What should Bylda write to the CRM?",
];

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#69717d]">
      {children}
    </label>
  );
}

function CrmIntelligenceSetup() {
  const { currentOrgId, currentOrg } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [saved, setSaved] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("crm_intelligence_profiles")
        .select("status,generated_at,questionnaire_answers,generated_profile")
        .eq("organization_id", currentOrgId)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        const row = data as unknown as ProfileRow;
        setSaved(row);
        setAnswers({ ...DEFAULT_ANSWERS, ...row.questionnaire_answers });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  const canContinue = useMemo(() => {
    if (step === 0) return answers.business_description.trim().length >= 10;
    if (step === 1) return answers.buyer_and_motion.trim().length >= 10;
    if (step === 2) return Boolean(answers.call_goal);
    return answers.must_capture.length > 0;
  }, [answers, step]);

  const toggleCapture = (field: string) => {
    setAnswers((current) => ({
      ...current,
      must_capture: current.must_capture.includes(field)
        ? current.must_capture.filter((item) => item !== field)
        : [...current.must_capture, field],
    }));
  };

  const generate = async () => {
    if (blockIfGuest("Sign up to create a CRM intelligence profile.")) return;
    if (!currentOrgId) return;
    setGenerating(true);
    try {
      const result = await invokeEdge<GenerateResponse>(
        "generate-crm-intelligence-profile",
        { organization_id: currentOrgId, answers },
        { timeoutMs: 90_000, retries: 1 },
      );
      setSaved({
        status: result.profile.status,
        generated_at: result.profile.generated_at,
        questionnaire_answers: answers,
        generated_profile: result.profile.generated_profile,
      });
      setEditing(false);
      toast.success("CRM intelligence is active");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build your CRM setup");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#4e83ce]" />
      </div>
    );
  }

  if (saved && !editing) {
    return (
      <ProfileSummary row={saved} orgName={currentOrg?.name} onEdit={() => setEditing(true)} />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[980px] pb-12">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5687ca]">
            <Sparkles className="h-3.5 w-3.5" /> CRM intelligence setup
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-[#17191d]">
            Teach Bylda what matters in your sales calls.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#717781]">
            Four quick answers create the extraction rules, review thresholds, and CRM fields your
            team actually needs. You can change this later.
          </p>
        </div>
        <Link
          to="/app/crm/calls"
          className="hidden text-[11px] font-semibold text-[#717781] hover:text-[#17191d] sm:block"
        >
          Skip for now
        </Link>
      </div>

      <div className="grid overflow-hidden rounded-[24px] border border-black/[0.09] bg-[#f8f8f5] shadow-[0_22px_60px_rgba(18,24,34,0.08)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-black/[0.08] bg-[#111419] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2e6fbf]">
              <DatabaseZap className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[12px] font-bold">Your CRM blueprint</div>
              <div className="mt-0.5 text-[9px] text-[#747e8c]">About 90 seconds</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {QUESTIONS.map((question, index) => (
              <button
                key={question}
                type="button"
                onClick={() => index < step && setStep(index)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  index === step
                    ? "bg-white/[0.09] text-white"
                    : index < step
                      ? "text-[#9ba5b3]"
                      : "text-[#555f6d]",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold",
                    index < step
                      ? "border-[#4e83ce] bg-[#315f9d] text-white"
                      : index === step
                        ? "border-[#75a7f0] text-[#9ac3fb]"
                        : "border-white/[0.1]",
                  )}
                >
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="hidden text-[10px] font-medium leading-4 sm:block lg:block">
                  {question}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-8 hidden rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 lg:block">
            <div className="flex gap-2">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#75a7f0]" />
              <p className="text-[9px] leading-4 text-[#788391]">
                Sensitive data is blocked automatically. Every extracted value must have transcript
                evidence.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex min-h-[520px] flex-col p-6 sm:p-9">
          <div className="flex-1">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a9098]">
              Question {step + 1} of 4
            </div>

            {step === 0 && (
              <QuestionShell
                title="What does your team sell?"
                description="Be specific enough that Bylda can recognize the right qualification and compliance rules."
              >
                <FieldLabel>Product, service, or coverage</FieldLabel>
                <textarea
                  autoFocus
                  value={answers.business_description}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      business_description: event.target.value,
                    }))
                  }
                  placeholder="Example: We sell term life and final-expense insurance to families in Florida."
                  className="min-h-36 w-full resize-none rounded-2xl border border-black/[0.11] bg-white px-4 py-3 text-[13px] leading-6 text-[#20242a] outline-none transition focus:border-[#6092d6] focus:ring-4 focus:ring-[#6092d6]/10"
                />
              </QuestionShell>
            )}

            {step === 1 && (
              <QuestionShell
                title="Who buys, and how does the sale happen?"
                description="Describe the buyer, typical call, and anything that changes whether they qualify."
              >
                <FieldLabel>Buyer and sales motion</FieldLabel>
                <textarea
                  autoFocus
                  value={answers.buyer_and_motion}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, buyer_and_motion: event.target.value }))
                  }
                  placeholder="Example: Inbound consumers speak with a licensed agent. We qualify state, coverage need, current carrier, renewal timing, and book an application review."
                  className="min-h-36 w-full resize-none rounded-2xl border border-black/[0.11] bg-white px-4 py-3 text-[13px] leading-6 text-[#20242a] outline-none transition focus:border-[#6092d6] focus:ring-4 focus:ring-[#6092d6]/10"
                />
              </QuestionShell>
            )}

            {step === 2 && (
              <QuestionShell
                title="What should a successful call accomplish?"
                description="Pick the primary outcome. Bylda will still capture secondary next steps and risks."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setAnswers((current) => ({ ...current, call_goal: goal.id }))}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        answers.call_goal === goal.id
                          ? "border-[#4e83ce] bg-[#edf4fd] shadow-[0_0_0_3px_rgba(78,131,206,0.08)]"
                          : "border-black/[0.09] bg-white hover:border-black/[0.18]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Target
                          className={cn(
                            "h-4 w-4",
                            answers.call_goal === goal.id ? "text-[#3f75bd]" : "text-[#9298a0]",
                          )}
                        />
                        {answers.call_goal === goal.id && (
                          <CheckCircle2 className="h-4 w-4 text-[#3f75bd]" />
                        )}
                      </div>
                      <div className="mt-4 text-[12px] font-bold text-[#24272c]">{goal.id}</div>
                      <div className="mt-1 text-[10px] leading-4 text-[#7a8089]">{goal.detail}</div>
                    </button>
                  ))}
                </div>
              </QuestionShell>
            )}

            {step === 3 && (
              <QuestionShell
                title="What should Bylda write to the CRM?"
                description="Select the fields every rep normally types after a call. AI will add industry-specific fields and safety rules."
              >
                <div className="flex flex-wrap gap-2">
                  {CAPTURE_OPTIONS.map((field) => {
                    const selected = answers.must_capture.includes(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleCapture(field)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold transition",
                          selected
                            ? "border-[#4e83ce] bg-[#edf4fd] text-[#356cae]"
                            : "border-black/[0.1] bg-white text-[#6f7680]",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />} {field}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <FieldLabel>Anything unique to your team? (optional)</FieldLabel>
                  <input
                    value={answers.custom_capture}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, custom_capture: event.target.value }))
                    }
                    placeholder="Example: licensed agent follow-up, roof age, policy renewal date…"
                    className="h-11 w-full rounded-xl border border-black/[0.11] bg-white px-3 text-[12px] text-[#20242a] outline-none focus:border-[#6092d6]"
                  />
                </div>

                <div className="mt-6">
                  <FieldLabel>Automation comfort</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {REVIEW_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          setAnswers((current) => ({ ...current, review_mode: mode.id }))
                        }
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          answers.review_mode === mode.id
                            ? "border-[#4e83ce] bg-[#edf4fd]"
                            : "border-black/[0.09] bg-white",
                        )}
                      >
                        <div className="text-[10px] font-bold text-[#24272c]">{mode.label}</div>
                        <div className="mt-1 text-[9px] leading-4 text-[#7b8189]">
                          {mode.detail}
                        </div>
                        <div className="mt-2 text-[8px] font-bold uppercase tracking-wide text-[#4e83ce]">
                          {mode.threshold}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </QuestionShell>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-black/[0.08] pt-5">
            <Button
              variant="ghost"
              onClick={() => (step > 0 ? setStep(step - 1) : setEditing(false))}
              disabled={step === 0 && !saved}
              className="gap-2 text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canContinue}
                className="gap-2 rounded-xl bg-[#2f6fbf] px-5 text-[11px] hover:bg-[#285f9f]"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                onClick={generate}
                disabled={!canContinue || generating}
                className="gap-2 rounded-xl bg-[#2f6fbf] px-5 text-[11px] hover:bg-[#285f9f]"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building your CRM…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Build my CRM intelligence
                  </>
                )}
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function QuestionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-bold tracking-[-0.035em] text-[#1d2025]">{title}</h2>
      <p className="mt-2 max-w-xl text-[12px] leading-5 text-[#777e87]">{description}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ProfileSummary({
  row,
  orgName,
  onEdit,
}: {
  row: ProfileRow;
  orgName?: string;
  onEdit: () => void;
}) {
  const profile = row.generated_profile;
  const activeFields = profile.fields.filter((field) => field.sensitivity !== "restricted");
  const restricted = profile.fields.filter((field) => field.sensitivity === "restricted");

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-12">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3f8a61]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active CRM intelligence
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-[#17191d]">
            {profile.label}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#717781]">{profile.summary}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit} className="gap-2 rounded-xl text-[11px]">
            <RotateCcw className="h-3.5 w-3.5" /> Rebuild profile
          </Button>
          <Button asChild className="gap-2 rounded-xl bg-[#2f6fbf] text-[11px]">
            <Link to="/app/crm/calls">
              View calls <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5]">
          <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
            <div>
              <div className="text-[12px] font-bold text-[#20242a]">Fields Bylda will capture</div>
              <div className="mt-1 text-[10px] text-[#81868e]">
                Every value includes transcript evidence and confidence.
              </div>
            </div>
            <span className="rounded-full bg-[#e4edf9] px-2.5 py-1 text-[9px] font-bold text-[#3f75bd]">
              {activeFields.length} fields
            </span>
          </div>
          <div className="divide-y divide-black/[0.07]">
            {activeFields.map((field) => (
              <div
                key={field.key}
                className="grid gap-3 px-5 py-3.5 sm:grid-cols-[180px_1fr_auto] sm:items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#282c31]">{field.label}</span>
                  {field.required && (
                    <span className="rounded bg-[#e7edf5] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-[#607087]">
                      Required
                    </span>
                  )}
                </div>
                <div className="text-[10px] leading-4 text-[#777e87]">{field.description}</div>
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wide",
                    field.sensitivity === "review"
                      ? "bg-[#f6edd6] text-[#8a6a22]"
                      : "bg-[#dff1e7] text-[#28764d]",
                  )}
                >
                  {field.sensitivity === "review" ? "Review" : "Auto-ready"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[22px] border border-black/[0.09] bg-[#111419] p-5 text-white">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6f8fb9]">
              Write-back policy
            </div>
            <div className="mt-3 text-[22px] font-bold tracking-[-0.04em]">
              {Math.round(profile.autoWriteMinConfidence * 100)}%+
            </div>
            <div className="mt-1 text-[10px] text-[#7e8896]">
              Minimum confidence before a standard field becomes eligible for approval.
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-[9px] text-[#8d97a5]">
              <LockKeyhole className="h-3.5 w-3.5 text-[#75a7f0]" /> Restricted data never writes
              automatically
            </div>
          </section>

          <section className="rounded-[22px] border border-black/[0.09] bg-[#f8f8f5] p-5">
            <div className="text-[11px] font-bold text-[#24272c]">What Bylda will answer</div>
            <div className="mt-3 space-y-2.5">
              {profile.insightQuestions.slice(0, 5).map((question) => (
                <div key={question} className="flex gap-2 text-[10px] leading-4 text-[#707780]">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#4e83ce]" /> {question}
                </div>
              ))}
            </div>
          </section>

          {restricted.length > 0 && (
            <section className="rounded-[22px] border border-[#e7d8d8] bg-[#fbf6f5] p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a05c5c]">
                Automatically blocked
              </div>
              <div className="mt-2 text-[10px] leading-5 text-[#806f70]">
                {restricted.map((field) => field.label).join(", ")}
              </div>
            </section>
          )}

          <div className="px-1 text-[9px] text-[#91969d]">
            {orgName || "This workspace"} · Updated{" "}
            {new Date(row.generated_at).toLocaleDateString()}
          </div>
        </aside>
      </div>
    </div>
  );
}
