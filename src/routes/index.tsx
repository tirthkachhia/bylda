import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CircleDot,
  Clock3,
  Database,
  Mail,
  MessageSquareText,
  PhoneCall,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ component: LandingPage });

const workflow = [
  {
    step: "01",
    title: "Brief the rep",
    detail: "Deal context, open blockers, and the question that moves it forward.",
    icon: Sparkles,
  },
  {
    step: "02",
    title: "Capture the call",
    detail: "Use the recording and transcript from the dialer already in your stack.",
    icon: PhoneCall,
  },
  {
    step: "03",
    title: "Verify the work",
    detail: "Review the outcome, next step, stage, objection, and budget with evidence.",
    icon: BadgeCheck,
  },
  {
    step: "04",
    title: "Write it back",
    detail: "Approve one update to your CRM and send the grounded follow-up.",
    icon: Database,
  },
];

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) navigate({ to: "/app/crm/calls" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f4f4ef] text-[#111318] selection:bg-[#b9d4ff]">
      <header className="sticky top-0 z-50 border-b border-black/[0.08] bg-[#f4f4ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="Bylda home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-[#5d626b] md:flex">
            <a href="#product" className="transition hover:text-black">
              Product
            </a>
            <a href="#workflow" className="transition hover:text-black">
              How it works
            </a>
            <Link to="/pricing" className="transition hover:text-black">
              Pricing
            </Link>
            <Link to="/about" className="transition hover:text-black">
              Company
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth/sign-in"
              className="px-3 py-2 text-[13px] font-semibold text-[#555b65] hover:text-black"
            >
              Sign in
            </Link>
            <Link
              to="/auth/sign-up"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#111318] px-4 text-[12px] font-semibold text-white hover:bg-[#2b3038]"
            >
              Start pilot <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-black/[0.08]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_15%,rgba(107,151,229,0.2),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-[1240px] gap-12 px-5 pb-16 pt-20 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:pb-24 lg:pt-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/[0.1] bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-[#454b55]">
                <CircleDot className="h-3.5 w-3.5 text-[#3275d8]" /> Built for CRM-native revenue
                teams
              </div>
              <h1 className="max-w-[680px] text-[48px] font-bold leading-[0.98] tracking-[-0.062em] sm:text-[68px] lg:text-[78px]">
                Every call leaves the CRM <span className="text-[#3275d8]">better.</span>
              </h1>
              <p className="mt-7 max-w-[570px] text-[17px] leading-7 text-[#60656e]">
                Bylda turns sales conversations into verified CRM updates, buyer-grounded
                follow-ups, and deal memory—without replacing your dialer or CRM.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth/sign-up"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111318] px-6 text-[13px] font-semibold text-white hover:bg-[#2b3038]"
                >
                  Start a pilot <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/auth/sign-in"
                  search={{ redirect: "/app/crm/calls" } as never}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/[0.12] bg-white/60 px-6 text-[13px] font-semibold hover:bg-white"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Open live demo
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-medium text-[#6d727b]">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3275d8]" /> No CRM migration
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3275d8]" /> Human-approved updates
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3275d8]" /> Evidence on every field
                </span>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="max-w-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3275d8]">
                The closed loop
              </div>
              <h2 className="mt-4 text-[38px] font-bold leading-[1.04] tracking-[-0.05em] sm:text-[48px]">
                The conversation becomes the work.
              </h2>
              <p className="mt-5 text-[15px] leading-7 text-[#666b73]">
                Reps stay in the conversation. Bylda handles the admin while keeping every decision
                reviewable.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[24px] border border-black/[0.1] bg-black/[0.1] sm:grid-cols-2">
              {workflow.map(({ step, title, detail, icon: Icon }) => (
                <article key={step} className="min-h-[220px] bg-[#fafaf7] p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#8a8e95]">{step}</span>
                    <Icon className="h-5 w-5 text-[#3275d8]" />
                  </div>
                  <h3 className="mt-10 text-[20px] font-bold tracking-[-0.025em]">{title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-[#6c717a]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="bg-[#111318] text-white">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
            <div className="mb-12 max-w-2xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78a9f2]">
                One shared source of truth
              </div>
              <h2 className="mt-4 text-[38px] font-bold leading-[1.04] tracking-[-0.05em] sm:text-[50px]">
                What the buyer said—not what the pipeline hopes.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <DarkFeature
                icon={MessageSquareText}
                title="Call intelligence"
                body="Outcomes, objections, competitors, pricing, and next steps extracted with linked transcript evidence."
              />
              <DarkFeature
                icon={Mail}
                title="Grounded follow-up"
                body="A ready-to-send recap built from commitments actually made on the call—not a generic template."
              />
              <DarkFeature
                icon={BarChart3}
                title="Explainable forecast"
                body="Managers see deal risk and pipeline movement backed by real buyer behavior across every conversation."
              />
            </div>
            <div className="mt-4 flex flex-col gap-5 rounded-[24px] border border-white/[0.1] bg-white/[0.035] p-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1b2f4e] text-[#80acf0]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Designed for human control</h3>
                  <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[#9097a3]">
                    Nothing writes to the CRM until a rep approves it. Every proposed value shows
                    its source and confidence.
                  </p>
                </div>
              </div>
              <Link
                to="/about"
                className="shrink-0 text-[12px] font-semibold text-[#8bb5f5] hover:text-white"
              >
                Security & approach →
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="rounded-[30px] border border-black/[0.09] bg-white px-6 py-14 text-center shadow-[0_24px_80px_rgba(22,27,35,0.07)] sm:px-12">
            <Clock3 className="mx-auto h-6 w-6 text-[#3275d8]" />
            <h2 className="mx-auto mt-5 max-w-2xl text-[38px] font-bold leading-[1.05] tracking-[-0.05em] sm:text-[50px]">
              See the finished work before your next call.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[14px] leading-6 text-[#666b73]">
              Connect a call source and CRM, then run a controlled pilot with your existing sales
              process.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link
                to="/auth/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#3275d8] px-6 text-[13px] font-semibold text-white hover:bg-[#2867be]"
              >
                Start pilot <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex h-12 items-center rounded-full border border-black/[0.12] px-6 text-[13px] font-semibold hover:bg-[#f5f5f1]"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.08]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 text-[12px] text-[#737780] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo className="text-[#111318]" markClassName="h-8 w-8 rounded-[9px]" />
          <div className="flex gap-5">
            <Link to="/pricing">Pricing</Link>
            <Link to="/about">Company</Link>
            <a href="mailto:hello@usebylda.com">Contact</a>
          </div>
          <span>© 2026 Bylda, Inc.</span>
        </div>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative lg:pl-6">
      <div className="overflow-hidden rounded-[26px] border border-black/[0.12] bg-[#111318] shadow-[0_32px_90px_rgba(25,30,38,0.22)]">
        <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#aeb5c0]">
            <span className="h-2 w-2 rounded-full bg-[#4bd58b]" /> Call complete · 26:14
          </div>
          <span className="text-[9px] uppercase tracking-[0.14em] text-[#646d7b]">
            Review before write-back
          </span>
        </div>
        <div className="grid gap-px bg-white/[0.08] sm:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[#111318] p-5 sm:p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667181]">
              Northstar Logistics
            </div>
            <h3 className="mt-2 text-[22px] font-bold tracking-[-0.035em] text-white">
              Technical review agreed
            </h3>
            <p className="mt-2 text-[12px] leading-5 text-[#8992a0]">
              Maya confirmed budget and needs implementation inside two weeks.
            </p>
            <div className="mt-6 space-y-3">
              <PreviewField label="Deal stage" value="Evaluation" confidence="98%" />
              <PreviewField label="Budget" value="$28k–$35k" confidence="94%" />
              <PreviewField
                label="Next step"
                value="Technical review · Tue 2 PM"
                confidence="99%"
              />
            </div>
          </div>
          <div className="bg-[#0c0f14] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#748095]">
              <MessageSquareText className="h-3.5 w-3.5" /> Evidence
            </div>
            <blockquote className="mt-5 border-l-2 border-[#3275d8] pl-4 text-[12px] leading-6 text-[#b1b8c3]">
              “We have budget in the thirty-thousand range. Tuesday at two works for the technical
              review.”
            </blockquote>
            <div className="mt-4 font-mono text-[9px] text-[#596271]">
              17:31–24:08 · Maya Rodriguez
            </div>
            <button className="mt-8 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3275d8] text-[11px] font-semibold text-white">
              <Check className="h-3.5 w-3.5" /> Approve CRM update
            </button>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-2 hidden rounded-2xl border border-black/[0.1] bg-white p-4 shadow-xl sm:block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6f5ed] text-[#258456]">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold">Follow-up drafted</div>
            <div className="mt-0.5 text-[9px] text-[#737780]">Grounded in 4 call moments</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string;
  confidence: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-[#606a79]">
        <span>{label}</span>
        <span className="text-[#66c996]">{confidence}</span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-[#e5e9ef]">{value}</div>
    </div>
  );
}

function DarkFeature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof PhoneCall;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[22px] border border-white/[0.1] bg-white/[0.035] p-7">
      <Icon className="h-5 w-5 text-[#7ba8ed]" />
      <h3 className="mt-8 text-[19px] font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="mt-3 text-[13px] leading-6 text-[#9199a6]">{body}</p>
    </article>
  );
}
