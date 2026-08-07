import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Bylda" },
      {
        name: "description",
        content: "Transparent pilot and team pricing for Bylda call intelligence.",
      },
    ],
  }),
  component: PricingPage,
});

const plans = [
  {
    name: "Pilot",
    price: "$0",
    unit: "for 14 days",
    description: "Prove the workflow with a small sales team.",
    cta: "Start pilot",
    featured: false,
    features: ["Up to 3 reps", "50 processed calls", "CRM write-back preview", "Email support"],
  },
  {
    name: "Team",
    price: "$49",
    unit: "per rep / month",
    description: "The complete closed loop for active revenue teams.",
    cta: "Start with Team",
    featured: true,
    features: [
      "Unlimited call reviews",
      "CRM write-back",
      "Drafted follow-ups",
      "Deal memory",
      "Manager forecast",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    unit: "annual agreement",
    description: "Controls and support for larger organizations.",
    cta: "Talk to us",
    featured: false,
    features: [
      "Everything in Team",
      "SSO and role controls",
      "Custom retention",
      "Priority onboarding",
      "Dedicated support",
    ],
  },
];

const rows = [
  ["Call review", true, true, true],
  ["Evidence-linked fields", true, true, true],
  ["CRM write-back", "Preview", true, true],
  ["Manager forecasting", false, true, true],
  ["SSO and custom retention", false, false, true],
] as const;

function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f4f4ef] text-[#111318]">
      <header className="border-b border-black/[0.08]">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden text-[12px] font-semibold text-[#666b73] sm:block">
              Back to product
            </Link>
            <Link
              to="/auth/sign-up"
              className="rounded-full bg-[#111318] px-4 py-2.5 text-[12px] font-semibold text-white"
            >
              Start pilot
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3275d8]">
            Simple pricing
          </div>
          <h1 className="mt-4 text-[48px] font-bold leading-none tracking-[-0.055em] sm:text-[64px]">
            Prove value first. Pay when it works.
          </h1>
          <p className="mt-6 text-[16px] leading-7 text-[#666b73]">
            Start with real calls, real CRM fields, and a controlled pilot. No implementation
            package required to evaluate the product.
          </p>
        </div>
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`flex min-h-[430px] flex-col rounded-[24px] border p-7 ${plan.featured ? "border-[#3275d8] bg-[#111318] text-white shadow-[0_24px_70px_rgba(17,19,24,0.18)]" : "border-black/[0.1] bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold">{plan.name}</h2>
                {plan.featured && (
                  <span className="rounded-full bg-[#2d6fcf] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">
                    Most popular
                  </span>
                )}
              </div>
              <p
                className={`mt-4 min-h-12 text-[13px] leading-6 ${plan.featured ? "text-[#9ba3af]" : "text-[#6b7078]"}`}
              >
                {plan.description}
              </p>
              <div className="mt-7 text-[40px] font-bold tracking-[-0.05em]">{plan.price}</div>
              <div
                className={`mt-1 text-[11px] ${plan.featured ? "text-[#777f8c]" : "text-[#858990]"}`}
              >
                {plan.unit}
              </div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-center gap-2.5 text-[12px] ${plan.featured ? "text-[#c3c8d0]" : "text-[#5e636b]"}`}
                  >
                    <Check className="h-3.5 w-3.5 text-[#4f8de8]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/sign-up"
                className={`mt-auto flex h-11 items-center justify-center gap-2 rounded-full text-[12px] font-semibold ${plan.featured ? "bg-[#3275d8] text-white hover:bg-[#3d82e9]" : "border border-black/[0.12] hover:bg-[#f4f4ef]"}`}
              >
                {plan.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
        <section className="mt-16 overflow-hidden rounded-[24px] border border-black/[0.1] bg-white">
          <div className="border-b border-black/[0.08] p-6">
            <h2 className="text-[18px] font-bold tracking-[-0.02em]">Compare plans</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[12px]">
              <thead>
                <tr className="text-[#7a7f87]">
                  <th className="p-5 font-medium">Capability</th>
                  <th className="p-5 font-medium">Pilot</th>
                  <th className="p-5 font-medium">Team</th>
                  <th className="p-5 font-medium">Scale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, ...values]) => (
                  <tr key={label} className="border-t border-black/[0.07]">
                    <td className="p-5 font-semibold">{label}</td>
                    {values.map((value, i) => (
                      <td key={i} className="p-5 text-[#626770]">
                        {value === true ? (
                          <Check className="h-4 w-4 text-[#3275d8]" />
                        ) : value === false ? (
                          <Minus className="h-4 w-4 text-[#b0b3b8]" />
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-14 rounded-[24px] bg-[#dfeafb] px-6 py-10 text-center">
          <h2 className="text-[26px] font-bold tracking-[-0.035em]">Need help sizing the pilot?</h2>
          <p className="mt-3 text-[13px] text-[#5c6572]">
            Tell us how many reps and calls you have. We’ll recommend the smallest useful test.
          </p>
          <a
            href="mailto:hello@usebylda.com"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-[#111318] px-5 text-[12px] font-semibold text-white"
          >
            hello@usebylda.com
          </a>
        </div>
      </main>
    </div>
  );
}
