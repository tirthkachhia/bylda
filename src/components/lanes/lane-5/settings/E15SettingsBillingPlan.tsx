import { useState } from "react";
import { cn, DataBoundary, Tag } from "@/components/bylda";
import { usePlan, useInvoices, type Plan } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsNote,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalAccountAction, LocalAccountLayout, LocalAccountSummaryRow } from "./LocalAccount";
import { displayDate, invoiceAmount, safeInvoiceUrl } from "./accountModel";
const tiers = ["Free", "Team", "Growth", "Scale"];
export function E15SettingsBillingPlan() {
  return (
    <LocalAccountLayout active="Billing & plan" ownerOnly>
      <BillingContent />
    </LocalAccountLayout>
  );
}
function BillingContent() {
  const plan = usePlan();
  const invoices = useInvoices();
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  return (
    <>
      <LocalSettingsHeading
        title="Billing & plan"
        subtitle="Owner only. View your subscription, seats and invoices."
      />
      <DataBoundary query={plan}>{(value) => <PlanSettings plan={value} />}</DataBoundary>
      <DataBoundary query={invoices} empty={<LocalSettingsEmpty noun="invoices" />}>
        {(items) => (
          <>
            <dl className="-mt-5">
              <LocalAccountSummaryRow label="Invoices">
                <button
                  type="button"
                  className="text-left hover:underline outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring"
                  aria-expanded={invoicesOpen}
                  onClick={() => setInvoicesOpen(!invoicesOpen)}
                >
                  {items.map((item) => item.number).join(" · ")} ·{" "}
                  {invoicesOpen ? "Hide details" : "View details"}
                </button>
              </LocalAccountSummaryRow>
            </dl>
            {invoicesOpen && (
              <LocalSettingsTable headings={["INVOICE", "ISSUED", "AMOUNT", "STATUS", "DOCUMENT"]}>
                {items.map((item) => {
                  const url = safeInvoiceUrl(item.url);
                  return (
                    <tr key={item.id}>
                      <td className={cell}>{item.number}</td>
                      <td className={cell}>{displayDate(item.issuedAt)}</td>
                      <td className={cell}>{invoiceAmount(item)}</td>
                      <td className={cell}>
                        <Tag>{item.status}</Tag>
                      </td>
                      <td className={cell}>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            View invoice
                          </a>
                        ) : (
                          <span className="text-by-text-tertiary">Not available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </LocalSettingsTable>
            )}
          </>
        )}
      </DataBoundary>
      <LocalSettingsNote title="PRICING — TO VALIDATE">
        Validated tier prices aren't available. Confirm pricing before changing your plan; checkout
        and plan changes aren't connected.
      </LocalSettingsNote>
    </>
  );
}
function PlanSettings({ plan }: { plan: Plan }) {
  return (
    <>
      <div className="grid grid-cols-4 items-start gap-3 max-lg:grid-cols-2">
        {tiers.map((tier) => {
          const current = plan.tier.toLowerCase() === tier.toLowerCase();
          return (
            <article
              key={tier}
              className={cn(
                "flex min-h-52 flex-col gap-3 rounded-by-card border bg-by-surface-raised p-4",
                current ? "border-by-text-primary" : "border-by-border-engraved",
              )}
            >
              <h2 className="type-mono-micro uppercase text-by-text-tertiary">{tier}</h2>
              <p className="type-display-l">—</p>
              <p className="type-ui-small text-by-text-secondary">Price not available</p>
              <div className="mt-auto">
                {current ? (
                  <Tag>Current plan</Tag>
                ) : (
                  <LocalAccountAction
                    label={tier === "Scale" ? "Upgrade" : "Switch"}
                    variant={tier === "Scale" ? "secondary" : "ghost"}
                  />
                )}
              </div>
            </article>
          );
        })}
      </div>
      <dl>
        <LocalAccountSummaryRow label="Plan">
          <span className="type-ui-small">
            {plan.tier} · {plan.status}
          </span>
        </LocalAccountSummaryRow>
        <LocalAccountSummaryRow label="Seats">
          <span className="type-ui-small">
            {plan.seatsUsed.toLocaleString("en-US")} used
            {plan.seats === null
              ? " · Seat limit not available"
              : ` of ${plan.seats.toLocaleString("en-US")}`}
          </span>
        </LocalAccountSummaryRow>
        <LocalAccountSummaryRow label="Billing period ends">
          <span className="type-ui-small">
            {displayDate(plan.periodEnd)}
            {plan.cancelAtPeriodEnd ? " · Cancellation scheduled" : ""}
          </span>
        </LocalAccountSummaryRow>
        <LocalAccountSummaryRow label="Payment method">
          <span className="type-ui-small text-by-text-tertiary">Not available</span>
        </LocalAccountSummaryRow>
      </dl>
    </>
  );
}
