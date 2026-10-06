export const billingKeys = {
  plan: () => ["billing", "plan"] as const,
  invoices: () => ["billing", "invoices"] as const,
  usage: () => ["billing", "usage"] as const,
};
