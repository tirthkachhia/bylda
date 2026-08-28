import { useState } from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "phantom",
    name: "Phantom",
    monthly: 89,
    blurb: "For teams that want the admin gone. Everything the rep needs, nothing they have to manage.",
    featured: false,
    features: [
      "Unlimited call capture & transcription",
      "Automatic CRM updates, two-way",
      "Deal intelligence & scoring",
      "AI follow-up drafting",
      "Daily Morning Brief",
      "Standard integrations",
    ],
  },
  {
    id: "team",
    name: "Team",
    monthly: 129,
    blurb: "For managers who want to coach from evidence and forecast from conversations.",
    featured: true,
    features: [
      "Everything in Phantom",
      "Manager dashboard & coaching flags",
      "Conversation-grounded forecasting",
      "Pipeline health & risk alerts",
      "Custom field mapping",
      "Outreach, Salesloft & Slack",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null as number | null,
    blurb: "For revenue orgs with real compliance requirements and a security team that reads the fine print.",
    featured: false,
    features: [
      "Everything in Team",
      "Private deployment in your cloud",
      "Data residency: US, EU, or UK",
      "SSO, SCIM & audit log export",
      "HIPAA BAA & custom DPA",
    ],
  },
];

export function PricingGate({
  orgId,
  email,
  name,
  onClose,
}: {
  orgId: string | null;
  email?: string | null;
  name?: string | null;
  onClose: () => void;
}) {
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const markSeen = () => {
    try {
      localStorage.setItem(`bylda-pricing-seen:${orgId ?? "local"}`, "1");
    } catch {
      /* ignore */
    }
  };

  const joinWaitlist = async (planId: string, planName: string) => {
    if (!email) {
      toast.error("Sign in with an email to join the waitlist.");
      return;
    }
    setBusy(planId);
    try {
      const { error } = await (supabase as any).from("waitlist_signups").insert({
        name: name?.trim() || email.split("@")[0],
        email,
        segment: planName,
        bottleneck: annual ? "annual" : "monthly",
        ref: planId,
        page: "/app",
        status: "waiting",
      });
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
          toast.message("You’re already on the list. We’ll reach out.");
        } else {
          throw error;
        }
      } else {
        toast.success(`You’re on the ${planName} waitlist.`);
      }
      markSeen();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t join the waitlist.");
    } finally {
      setBusy(null);
    }
  };

  const startTrial = async () => {
    setBusy("trial");
    try {
      if (orgId) {
        const { error } = await supabase.from("subscriptions").upsert(
          {
            organization_id: orgId,
            plan: "starter",
            status: "active",
            current_period_end: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          },
          { onConflict: "organization_id" },
        );
        if (error) {
          try {
            localStorage.setItem(`bylda-trial:${orgId}`, "1");
          } catch {
            /* ignore */
          }
        }
      }
      markSeen();
      toast.success("14-day trial is on. Use the workspace as a teammate.");
      onClose();
    } catch {
      markSeen();
      toast.success("Trial started for this workspace.");
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f9fd]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#3275d8]">
              Pricing
            </div>
            <h1 className="mt-3 font-canvas-display text-[36px] font-normal leading-[1.12] tracking-[-0.03em] text-[#111318] sm:text-[44px]">
              Priced like a teammate.
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-[#60656e]">
              One number per rep. Every conversation captured, every CRM write included. No
              per-minute charges, no per-integration fees, no surprise line items.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              markSeen();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#60656e] hover:bg-white"
            aria-label="Close pricing"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-8 inline-flex rounded-full border border-black/[0.08] bg-white p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-semibold",
              !annual ? "bg-[#111318] text-white" : "text-[#60656e]",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-semibold",
              annual ? "bg-[#111318] text-white" : "text-[#60656e]",
            )}
          >
            Annual <span className="ml-1 text-[10px] text-[#86b4f5]">SAVE 20%</span>
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = plan.monthly == null ? null : annual ? Math.round(plan.monthly * 0.8) : plan.monthly;
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-[28px] border p-6",
                  plan.featured
                    ? "border-[#3275d8] bg-[#111318] text-white shadow-[0_24px_70px_rgba(17,19,24,0.18)]"
                    : "border-black/[0.08] bg-white",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-semibold">{plan.name}</h2>
                  {plan.featured && (
                    <span className="rounded-full bg-[#3275d8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">
                      Most chosen
                    </span>
                  )}
                </div>
                <p className={cn("mt-3 min-h-14 text-[13px] leading-6", plan.featured ? "text-[#9ba3af]" : "text-[#60656e]")}>
                  {plan.blurb}
                </p>
                <div className="mt-6 font-canvas-display text-[40px] leading-none tracking-[-0.04em]">
                  {price == null ? "Custom" : `$${price}`}
                </div>
                <div className={cn("mt-2 text-[11px] uppercase tracking-[0.12em]", plan.featured ? "text-[#777f8c]" : "text-[#8a9099]")}>
                  {price == null ? "Talk to us" : "/ REP / MO"}
                </div>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-start gap-2 text-[12px] leading-5",
                        plan.featured ? "text-[#c3c8d0]" : "text-[#4b5563]",
                      )}
                    >
                      <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", plan.featured ? "text-[#8bb5f5]" : "text-[#3275d8]")} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void joinWaitlist(plan.id, plan.name)}
                  className={cn(
                    "mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-full text-[12px] font-semibold",
                    plan.featured
                      ? "bg-[#3275d8] text-white hover:bg-[#3d82e9]"
                      : "border border-black/[0.12] hover:bg-[#f7f9fd]",
                  )}
                >
                  {busy === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Join Waitlist <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void startTrial()}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#111318] px-6 text-[13px] font-semibold text-white hover:bg-[#2b3038]"
          >
            {busy === "trial" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Use as free trial
          </button>
          <button
            type="button"
            onClick={() => {
              markSeen();
              onClose();
            }}
            className="text-[12px] font-medium text-[#60656e] hover:text-[#111318]"
          >
            Continue without choosing
          </button>
        </div>
      </div>
    </div>
  );
}
