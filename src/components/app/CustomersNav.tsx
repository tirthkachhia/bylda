// CustomersNav — kept as a thin alias so existing call sites don't churn.
// The actual strip lives in SectionTabs (shared across Customers/Path/Insights).

import { SectionTabs } from "@/components/app/SectionTabs";

export function CustomersNav() {
  return <SectionTabs section="customers" />;
}
