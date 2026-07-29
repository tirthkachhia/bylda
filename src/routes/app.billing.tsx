import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/app/WorkspaceHeader";
import { Button } from "@/components/ui/button";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Rocket,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Ban,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { planEntitlementsQuery, subscriptionQuery, usageQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { blockIfGuest } from "@/lib/guest";
import { CheckoutDialog } from "@/components/app/CheckoutDialog";
import { PaymentTestModeBanner } from "@/components/app/PaymentTestModeBanner";
import { isPaymentsEnabled, getStripeEnvironment } from "@/lib/stripe";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/billing")({ component: Billing });

const PLAN_PRICE_LOOKUP: Record<string, string | null> = {
  starter: null,
  launch: "launch_monthly",
  operate: "operate_monthly",
  scale: "scale_monthly",
};

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  starter: Sparkles,
  launch: Rocket,
  operate: Zap,
  scale: Crown,
};

const PLAN_TAGLINE: Record<string, string> = {
  starter: "Validate your first idea.",
  launch: "Build, pitch, and go to market.",
  operate: "Automate revenue operations.",
  scale: "Scale across teams and pipelines.",
};

const PLAN_ORDER = ["starter", "launch", "operate", "scale"];

type Invoice = {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: number;
  period_end: number;
};

function Billing() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const subQ = useQuery({ ...subscriptionQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const plansQ = useQuery(planEntitlementsQuery());
  const usageQ = useQuery({ ...usageQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const invoicesQ = useQuery({
    queryKey: ["invoices", currentOrgId],
    enabled: !!currentOrgId && !!subQ.data?.stripe_customer_id,
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase.functions.invoke("list-invoices", {
        body: { organizationId: currentOrgId, environment: getStripeEnvironment() },
      });
      if (error) throw error;
      return data?.invoices ?? [];
    },
  });

  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "cancel" }
    | { kind: "switch"; plan: string; lookup: string }
    | { kind: "downgrade-free" }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const sub = subQ.data;
  const currentPlan = sub?.plan ?? "starter";
  const usage = usageQ.data ?? [];
  const totalUsed = usage.reduce((s, r) => s + (r.count as number), 0);
  const currentEnt = plansQ.data?.find((p) => p.plan === currentPlan);
  const limit = currentEnt?.monthly_generation_limit ?? null;
  const pct = limit ? Math.min(100, (totalUsed / limit) * 100) : 0;
  const allowedToolCount = currentEnt?.allowed_tools.length ?? 0;
  const paymentsOn = isPaymentsEnabled();

  const hasStripeSub = !!sub?.stripe_subscription_id;
  const isPastDue = sub?.status === "past_due";
  const isCanceling = !!sub?.cancel_at_period_end;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;

  const refetchAll = () => {
    if (!currentOrgId) return;
    qc.invalidateQueries({ queryKey: ["subscription", currentOrgId] });
    qc.invalidateQueries({ queryKey: ["invoices", currentOrgId] });
  };

  const callManage = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { ...body, organizationId: currentOrgId, environment: getStripeEnvironment() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Stripe webhook sync may take a moment
      [800, 2000, 4000].forEach((ms) => setTimeout(refetchAll, ms));
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openBillingPortal = async () => {
    if (blockIfGuest("Sign up to manage your subscription.")) return;
    const result = await callManage({
      action: "billing_portal",
      returnUrl: window.location.href,
    });
    if (result?.url) {
      window.location.href = result.url;
    }
  };

  const onPlanClick = (plan: string) => {
    if (blockIfGuest("Sign up to manage your subscription.")) return;
    if (!currentOrgId) return;
    if (plan === currentPlan) return;

    const lookup = PLAN_PRICE_LOOKUP[plan];
    const targetIdx = PLAN_ORDER.indexOf(plan);
    const currentIdx = PLAN_ORDER.indexOf(currentPlan);

    // Downgrade to free starter
    if (plan === "starter") {
      if (hasStripeSub) {
        setConfirm({ kind: "downgrade-free" });
      } else {
        toast.error("No active subscription found. Refresh the page.");
      }
      return;
    }

    // Paid → paid switch (upgrade or downgrade)
    if (lookup && hasStripeSub) {
      setConfirm({ kind: "switch", plan, lookup });
      return;
    }

    // First paid purchase → checkout
    if (lookup && paymentsOn) {
      setCheckoutPriceId(lookup);
      return;
    }

    // Payments not configured
    toast.error("Payments are not configured. Contact support to upgrade.");
    void targetIdx;
    void currentIdx;
  };

  const sortedPlans = [...(plansQ.data ?? [])].sort((a, b) => a.price_usd - b.price_usd);
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);

  return (
    <div className="space-y-6">
      <PaymentTestModeBanner />
      <WorkspaceHeader
        variant="billing"
        icon={CreditCard}
        eyebrow="Account · billing"
        title="Billing & usage"
        description="Plans translate to platform access. Upgrade unlocks more tools and higher generation limits."
      />

      {/* Near-limit upgrade nudge */}
      {!isPastDue && limit !== null && pct >= 80 && currentPlan !== "scale" && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            background:
              pct >= 100
                ? "color-mix(in oklab, #ef4444 8%, var(--surface))"
                : "color-mix(in oklab, var(--primary) 8%, var(--surface))",
            border: `1px solid ${pct >= 100 ? "rgba(239,68,68,0.3)" : "color-mix(in oklab, var(--primary) 30%, transparent)"}`,
          }}
        >
          <div className="flex-1">
            <div
              className="font-display text-sm font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              {pct >= 100
                ? "You've hit your generation limit"
                : `You've used ${Math.round(pct)}% of your monthly generations`}
            </div>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
              {pct >= 100
                ? "Upgrade now to unlock more generations and keep building."
                : "Running low — upgrade before you hit the wall."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(currentPlan) + 1];
              if (nextPlan) onPlanClick(nextPlan);
            }}
          >
            Upgrade plan
          </Button>
        </div>
      )}

      {/* Past due banner — locks tools */}
      {isPastDue && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <div className="font-display text-sm font-semibold tracking-tight">
              Payment failed — AI tools are locked
            </div>
            <p className="mt-0.5 text-[12.5px] text-rose-100/80">
              We couldn't charge your card. Update your payment method to restore access.
            </p>
          </div>
          {hasStripeSub && (
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300/40"
              disabled={busy}
              onClick={openBillingPortal}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update payment"}
            </Button>
          )}
        </div>
      )}

      {/* Cancellation pending banner */}
      {isCanceling && periodEnd && !isPastDue && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <div className="font-display text-sm font-semibold tracking-tight">
              Subscription ends{" "}
              {periodEnd.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              You'll keep {currentPlan} access until then, then drop to Starter.
            </p>
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              callManage({ action: "resume" }).then(
                (result) => result?.ok && toast.success("Subscription resumed"),
              )
            }
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resume"}
          </Button>
        </div>
      )}

      {/* Current plan summary */}
      <div
        className="overflow-hidden rounded-2xl shadow-card"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="relative overflow-hidden px-6 py-5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--primary) 8%, var(--surface)), color-mix(in oklab, var(--accent) 5%, var(--surface)))",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(50rem 20rem at 100% 50%, color-mix(in oklab, var(--primary) 8%, transparent), transparent)",
            }}
          />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-card"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--accent))",
                  boxShadow:
                    "0 4px 16px color-mix(in oklab, var(--primary) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {(() => {
                  const Icon = PLAN_ICONS[currentPlan] ?? Sparkles;
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "var(--primary)" }}
                >
                  Current plan
                </div>
                <div
                  className="mt-0.5 font-display text-xl font-semibold capitalize tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {currentPlan}
                  {sub?.status && sub.status !== "active" && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {sub.status}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                  ${currentEnt?.price_usd ?? 0}/mo · {allowedToolCount} tools included
                  {periodEnd && hasStripeSub && (
                    <>
                      {" "}
                      · {isCanceling ? "ends" : "renews"} {periodEnd.toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <UsageCard label="Generations" used={totalUsed} limit={limit} pct={pct} />
              <UsageCard
                label="AI tools"
                used={allowedToolCount}
                limit={null}
                pct={0}
                suffix="enabled"
              />
            </div>
          </div>
        </div>

        {hasStripeSub && !isCanceling && !isPastDue && (
          <div
            className="flex items-center justify-end px-6 py-3"
            style={{ borderTop: "1px solid color-mix(in oklab, var(--border) 60%, transparent)" }}
          >
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => setConfirm({ kind: "cancel" })}
              disabled={busy}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#f87171";
                (e.currentTarget as HTMLElement).style.background =
                  "color-mix(in oklab, #ef4444 10%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel subscription
            </button>
          </div>
        )}
      </div>

      {/* Plan grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sortedPlans.map((p) => {
          const isCurrent = p.plan === currentPlan;
          const idx = PLAN_ORDER.indexOf(p.plan);
          const isUpgrade = idx > currentIdx;
          const isDowngrade = idx < currentIdx;
          const Icon = PLAN_ICONS[p.plan] ?? Sparkles;
          const features = (p.features as { highlights?: string[] }) ?? {};

          const baseHighlights = [
            `${p.monthly_generation_limit ?? "Unlimited"} generations / month`,
            `${p.allowed_tools.length} AI tools included`,
          ];
          const highlights = [...baseHighlights, ...(features.highlights ?? [])];

          return (
            <div
              key={p.plan}
              className="relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300"
              style={{
                background: isCurrent
                  ? "color-mix(in oklab, var(--primary) 6%, var(--surface))"
                  : "var(--surface)",
                border: `1px solid ${isCurrent ? "color-mix(in oklab, var(--primary) 35%, transparent)" : "var(--border)"}`,
                boxShadow: isCurrent
                  ? "var(--shadow-card), 0 0 20px color-mix(in oklab, var(--primary) 12%, transparent)"
                  : "var(--shadow-card)",
              }}
            >
              {isCurrent && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)",
                  }}
                />
              )}
              {isCurrent && (
                <div
                  className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-full px-3 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white"
                  style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
                >
                  Current
                </div>
              )}
              <div className="flex flex-1 flex-col p-5 pt-6">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-card"
                  style={{
                    background: isCurrent
                      ? "linear-gradient(135deg, var(--primary), var(--accent))"
                      : "var(--surface-2)",
                    color: isCurrent ? "white" : "var(--muted-foreground)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3">
                  <div
                    className="font-display text-[15px] font-semibold capitalize tracking-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    {p.plan}
                  </div>
                  <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {PLAN_TAGLINE[p.plan]}
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className="font-display text-[1.7rem] font-semibold leading-none tracking-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    ${p.price_usd}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    /mo
                  </span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-[12.5px]">
                  {highlights.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--success)" }}
                      />
                      <span style={{ color: "var(--foreground)", opacity: 0.85 }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-5 w-full rounded-xl py-2 text-[13px] font-semibold transition-all duration-200"
                  disabled={isCurrent || busy}
                  onClick={() => onPlanClick(p.plan)}
                  style={
                    isCurrent
                      ? {
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--muted-foreground)",
                          cursor: "not-allowed",
                        }
                      : isUpgrade
                        ? {
                            background: "linear-gradient(135deg, var(--primary), var(--accent))",
                            color: "white",
                            boxShadow:
                              "0 4px 16px color-mix(in oklab, var(--primary) 30%, transparent)",
                          }
                        : {
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                          }
                  }
                  onMouseEnter={(e) => {
                    if (!isCurrent && !busy && isUpgrade) {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 6px 20px color-mix(in oklab, var(--primary) 40%, transparent)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "none";
                    if (isUpgrade)
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 4px 16px color-mix(in oklab, var(--primary) 30%, transparent)";
                  }}
                >
                  {isCurrent
                    ? "Current plan"
                    : isUpgrade
                      ? `Upgrade to ${p.plan}`
                      : isDowngrade
                        ? `Downgrade to ${p.plan}`
                        : `Switch to ${p.plan}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      {hasStripeSub && (
        <div
          className="overflow-hidden rounded-2xl shadow-card"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="px-6 py-4"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
              background: "color-mix(in oklab, var(--surface-2) 40%, transparent)",
            }}
          >
            <div
              className="font-display text-[14px] font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Invoice history
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Receipts and PDFs from Stripe.
            </div>
          </div>
          <div className="px-6 py-4">
            {invoicesQ.isLoading ? (
              <div
                className="flex items-center gap-2 text-[12.5px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading invoices…
              </div>
            ) : (invoicesQ.data ?? []).length === 0 ? (
              <div className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                No invoices yet.
              </div>
            ) : (
              <div className="space-y-1">
                {invoicesQ.data!.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                      </div>
                      <div>
                        <div
                          className="font-display text-[13px] font-medium tracking-tight"
                          style={{ color: "var(--foreground)" }}
                        >
                          {inv.number ?? inv.id.slice(-10)}
                        </div>
                        <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                          {new Date(inv.created * 1000).toLocaleDateString()} ·{" "}
                          {(inv.amount_paid / 100).toLocaleString(undefined, {
                            style: "currency",
                            currency: inv.currency.toUpperCase(),
                          })}{" "}
                          · {inv.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {inv.hosted_invoice_url && (
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition"
                            style={{ color: "var(--muted-foreground)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "var(--surface-offset)";
                              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--muted-foreground)";
                            }}
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </button>
                        </a>
                      )}
                      {inv.invoice_pdf && (
                        <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition"
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.borderColor =
                                "color-mix(in oklab, var(--primary) 35%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                            }}
                          >
                            PDF
                          </button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CheckoutDialog
        open={!!checkoutPriceId}
        onOpenChange={(v) => {
          if (!v) {
            setCheckoutPriceId(null);
            // Refresh after close in case user completed checkout
            [800, 2500].forEach((ms) => setTimeout(refetchAll, ms));
          }
        }}
        priceId={checkoutPriceId}
        customerEmail={user?.email ?? undefined}
        userId={user?.id}
        organizationId={currentOrgId ?? undefined}
      />

      {/* Confirmations */}
      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          {confirm?.kind === "cancel" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll keep {currentPlan} access until{" "}
                  {periodEnd?.toLocaleDateString() ?? "the end of the period"}, then your account
                  will drop to Starter. You can resume anytime before then.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Keep plan</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={async () => {
                    const result = await callManage({ action: "cancel_at_period_end" });
                    if (result?.ok) toast.success("Cancellation scheduled");
                    setConfirm(null);
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel subscription"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "switch" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Switch to {confirm.plan}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your card will be charged a prorated amount today and your renewal date stays the
                  same. You'll get the new plan's tools and limits immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Stay on {currentPlan}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={async () => {
                    const result = await callManage({
                      action: "switch_plan",
                      newPriceLookupKey: confirm.lookup,
                    });
                    if (result?.ok) toast.success(`Switched to ${confirm.plan}`);
                    setConfirm(null);
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Switch to ${confirm.plan}`
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "downgrade-free" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Downgrade to Starter?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cancels your paid subscription. You'll keep {currentPlan} access until{" "}
                  {periodEnd?.toLocaleDateString() ?? "the period ends"}, then you'll be on the free
                  Starter plan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Keep {currentPlan}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={async () => {
                    const result = await callManage({ action: "cancel_at_period_end" });
                    if (result?.ok) toast.success("Downgrade scheduled");
                    setConfirm(null);
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Downgrade"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  pct,
  suffix,
}: {
  label: string;
  used: number;
  limit: number | null;
  pct: number;
  suffix?: string;
}) {
  const barColor = pct > 85 ? "#f87171" : pct > 60 ? "#fbbf24" : "var(--primary)";
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "color-mix(in oklab, var(--surface-2) 80%, transparent)",
        border: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
      }}
    >
      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className="font-display text-lg font-semibold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {used.toLocaleString()}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
          {suffix ? `/ ${suffix}` : `/ ${limit ?? "∞"}`}
        </span>
      </div>
      {limit !== null && (
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--surface-offset)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${barColor}` }}
          />
        </div>
      )}
    </div>
  );
}
