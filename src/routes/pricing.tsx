import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { PLANS, PLAN_ORDER } from "@/lib/plan";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Bylda" },
      {
        name: "description",
        content: "Simple plans that scale with you. Free, $49, $149, and $299/month.",
      },
    ],
  }),
  component: PricingPage,
});

const COMPARE = [
  { label: "LaunchPad tools", values: ["2", "All 10", "All 10", "All 10"] },
  { label: "Bylda OS systems", values: ["—", "1", "4", "All 6"] },
  { label: "Tool runs / mo", values: ["10", "200", "1,500", "Unlimited"] },
  { label: "Integrations", values: ["—", "Basic", "Full", "Full + custom"] },
  { label: "Support", values: ["Community", "Email", "Priority", "Dedicated"] },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl h-14 px-4 sm:px-6 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <Button asChild size="sm">
            <Link to="/signup" search={{ plan: undefined }}>
              Start free
            </Link>
          </Button>
        </div>
      </header>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary mb-2">
              Pricing
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Operator-grade pricing.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Start free. Upgrade when you outgrow it. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_ORDER.map((p) => {
              const plan = PLANS[p];
              const featured = p === "operate";
              return (
                <div
                  key={p}
                  className={`bylda-card p-6 flex flex-col ${featured ? "border-primary/50 bylda-glow" : ""}`}
                >
                  {featured && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[10px] font-medium px-2 py-0.5 mb-3 self-start">
                      <Sparkles className="h-3 w-3" /> Most popular
                    </div>
                  )}
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight">${plan.price}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
                  <Button
                    asChild
                    className="w-full mt-5"
                    variant={featured ? "default" : "outline"}
                    size="sm"
                  >
                    <Link to="/signup" search={{ plan: p }}>
                      {plan.price === 0 ? "Start free" : "Choose plan"}
                    </Link>
                  </Button>
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-16 bylda-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-sm font-semibold">Compare features</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-4 font-medium">Feature</th>
                    {PLAN_ORDER.map((p) => (
                      <th key={p} className="text-left p-4 font-medium">
                        {PLANS[p].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="p-4 text-muted-foreground">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="p-4">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link to="/signup" search={{ plan: undefined }}>
                Start free <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
