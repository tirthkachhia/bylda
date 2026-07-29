import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Rocket, Cpu, Zap, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "How Bylda works" },
      { name: "description", content: "From signup to activation in three steps." },
    ],
  }),
  component: DemoPage,
});

const STEPS = [
  {
    n: 1,
    icon: Rocket,
    title: "Tell us about your business",
    body: "2-minute onboarding — we tailor LaunchPad and Bylda OS to your offer, ICP, and goals.",
  },
  {
    n: 2,
    icon: Zap,
    title: "Generate your first asset",
    body: "Run any LaunchPad tool. Get a customer-ready output in under 90 seconds.",
  },
  {
    n: 3,
    icon: Cpu,
    title: "Activate a Bylda OS system",
    body: "Connect your inbox, calendar, and CRM. Your business runs itself in the background.",
  },
];

function DemoPage() {
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
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary mb-2">
              How it works
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              From signup to revenue, fast.
            </h1>
          </div>
          <div className="space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bylda-card p-6 flex gap-5">
                <div className="h-10 w-10 rounded-md border border-border bg-surface-elevated grid place-items-center shrink-0">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Step {s.n}
                  </p>
                  <h2 className="text-lg font-semibold mt-0.5">{s.title}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
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
