import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { GUEST_ORG_ID, guestStore } from "@/lib/guest";
import { resolveSalesVertical } from "../../../supabase/functions/_shared/sales-verticals";
import { cn } from "@/lib/utils";
import type { CrmAnswers } from "./types";

const QUESTIONS = [
  "What does your team sell?",
  "Who buys, and how does the sale happen?",
  "What should a successful call accomplish?",
  "What should Bylda write to the CRM?",
];

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

const DEFAULT_ANSWERS: CrmAnswers = {
  business_description: "",
  buyer_and_motion: "",
  call_goal: "",
  must_capture: ["Call outcome", "Next step", "Primary objection"],
  custom_capture: "",
  review_mode: "balanced",
};

function confidenceFor(mode: CrmAnswers["review_mode"]) {
  if (mode === "fast") return 0.72;
  if (mode === "conservative") return 0.9;
  return 0.82;
}

async function saveProfileLocally(
  orgId: string,
  userId: string | null,
  answers: CrmAnswers,
) {
  const vertical = resolveSalesVertical(answers.business_description, answers.buyer_and_motion);
  const profile = {
    key: vertical.key,
    label: `${vertical.label} sales`,
    aliases: vertical.aliases,
    objective: answers.call_goal || vertical.objective,
    insightQuestions: vertical.insightQuestions,
    complianceRules: vertical.complianceRules,
    fields: vertical.fields,
    summary: `Bylda will capture ${vertical.label.toLowerCase()} qualification, next steps, and CRM-ready call evidence.`,
    autoWriteMinConfidence: confidenceFor(answers.review_mode),
    reviewMode: answers.review_mode,
    generatedBy: "intake_template",
  };
  const db = supabase as any;
  const { error } = await db.from("crm_intelligence_profiles").upsert(
    {
      organization_id: orgId,
      created_by: userId,
      status: "active",
      questionnaire_answers: answers,
      generated_profile: profile,
      base_sales_profile: vertical.key,
      auto_write_min_confidence: profile.autoWriteMinConfidence,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    try {
      sessionStorage.setItem(`bylda-crm-profile:${orgId}`, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }
}

export function CrmSetupGate({
  orgId,
  userId,
  onSkip,
  onComplete,
}: {
  orgId: string | null;
  userId?: string | null;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<CrmAnswers>(DEFAULT_ANSWERS);
  const [generating, setGenerating] = useState(false);

  const canContinue = useMemo(() => {
    if (step === 0) return answers.business_description.trim().length >= 10;
    if (step === 1) return answers.buyer_and_motion.trim().length >= 10;
    if (step === 2) return Boolean(answers.call_goal);
    return answers.must_capture.length > 0;
  }, [answers, step]);

  const generate = async () => {
    setGenerating(true);
    try {
      const liveOrg = orgId && orgId !== GUEST_ORG_ID && !guestStore.get().isGuest;
      if (liveOrg) {
        try {
          await invokeEdge(
            "generate-crm-intelligence-profile",
            { organization_id: orgId, answers },
            { timeoutMs: 90_000, retries: 1 },
          );
        } catch {
          await saveProfileLocally(orgId, userId ?? null, answers);
        }
        toast.success("Got it. I’ll use this on every call.");
      } else {
        toast.message("Saved for this session. Let’s get into your day.");
      }
      onComplete();
    } catch (error) {
      toast.message("I’ll use your answers in this workspace.");
      onComplete();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bylda-canvas mx-auto flex min-h-full w-full max-w-[920px] flex-col justify-center px-5 py-10 font-sans text-[#111318]">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#3275d8]">
            Quick setup
          </div>
          <h1 className="max-w-xl font-canvas-display text-[36px] font-normal leading-[1.12] tracking-[-0.03em] text-[#111318]">
            Teach me what a good call looks like for your team.
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-6 text-[#60656e]">
            Four answers. Then I can prep calls, pull the next move, and keep the CRM clean without
            making you babysit fields.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 rounded-full px-3 py-2 text-[12px] font-medium text-[#60656e] transition hover:bg-[#eaf1fb] hover:text-[#111318]"
        >
          Skip for now
        </button>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-white shadow-[0_20px_50px_rgba(17,19,24,0.06)]">
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-[#e6e8ee] p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-1.5">
              {QUESTIONS.map((question, index) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[12px] transition",
                    index === step ? "bg-[#eaf1fb] text-[#111318]" : "text-[#60656e]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                      index < step
                        ? "bg-[#111318] text-white"
                        : index === step
                          ? "border border-[#3275d8] text-[#3275d8]"
                          : "border border-[#dbe4f2] text-[#8a9099]",
                    )}
                  >
                    {index < step ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="hidden leading-4 lg:block">{question}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-h-[460px] flex-col p-6 sm:p-8">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
              Question {step + 1} of 4
            </div>
            <h2 className="font-canvas-display text-[26px] font-normal tracking-[-0.03em] text-[#111318]">
              {QUESTIONS[step]}
            </h2>

            <div className="mt-6 flex-1">
              {step === 0 && (
                <textarea
                  autoFocus
                  value={answers.business_description}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      business_description: event.target.value,
                    }))
                  }
                  placeholder="Example: We sell term life to families in Florida."
                  className="min-h-40 w-full resize-none rounded-2xl border border-[#e6e8ee] bg-white px-4 py-3 text-[14px] leading-6 text-[#111318] outline-none focus:border-[#3275d8]"
                />
              )}
              {step === 1 && (
                <textarea
                  autoFocus
                  value={answers.buyer_and_motion}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      buyer_and_motion: event.target.value,
                    }))
                  }
                  placeholder="Example: Inbound consumers talk to a licensed agent. We qualify state, need, and book an application review."
                  className="min-h-40 w-full resize-none rounded-2xl border border-[#e6e8ee] bg-white px-4 py-3 text-[14px] leading-6 text-[#111318] outline-none focus:border-[#3275d8]"
                />
              )}
              {step === 2 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setAnswers((current) => ({ ...current, call_goal: goal.id }))}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        answers.call_goal === goal.id
                          ? "border-[#3275d8] bg-[#eaf1fb]"
                          : "border-[#e6e8ee] bg-white hover:border-[#dbe4f2]",
                      )}
                    >
                      <Target
                        className={cn(
                          "h-4 w-4",
                          answers.call_goal === goal.id ? "text-[#3275d8]" : "text-[#8a9099]",
                        )}
                      />
                      <div className="mt-3 text-[13px] font-semibold">{goal.id}</div>
                      <div className="mt-1 text-[11px] text-[#60656e]">{goal.detail}</div>
                    </button>
                  ))}
                </div>
              )}
              {step === 3 && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {CAPTURE_OPTIONS.map((field) => {
                      const selected = answers.must_capture.includes(field);
                      return (
                        <button
                          key={field}
                          type="button"
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              must_capture: selected
                                ? current.must_capture.filter((item) => item !== field)
                                : [...current.must_capture, field],
                            }))
                          }
                          className={cn(
                            "rounded-full border px-3 py-2 text-[11px] font-semibold transition",
                            selected
                              ? "border-[#3275d8] bg-[#eaf1fb] text-[#3275d8]"
                              : "border-[#e6e8ee] bg-white text-[#60656e]",
                          )}
                        >
                          {selected && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                          {field}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={answers.custom_capture}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, custom_capture: event.target.value }))
                    }
                    placeholder="Anything unique? Roof age, renewal date…"
                    className="mt-5 h-11 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 text-[13px] outline-none focus:border-[#3275d8]"
                  />
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[#e6e8ee] pt-5">
              <Button
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                className="gap-2 text-[12px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              {step < 3 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canContinue}
                  className="gap-2 rounded-full bg-[#111318] px-5 text-[12px] text-white hover:bg-[#2b3038]"
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  onClick={generate}
                  disabled={!canContinue || generating}
                  className="gap-2 rounded-full bg-[#111318] px-5 text-[12px] text-white hover:bg-[#2b3038]"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building this…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Start using Bylda
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
