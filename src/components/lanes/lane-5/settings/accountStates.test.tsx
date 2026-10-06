import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "owner",
  loading: false,
  error: null as Error | null,
  empty: true,
  reads: 0,
}));
vi.mock("@/lib/data", () => ({
  useViewer: () => ({ data: { role: state.role }, isLoading: false, error: null }),
  usePlan: () => {
    state.reads++;
    return {
      data: {
        tier: "Scale",
        status: "active",
        seats: 20,
        seatsUsed: 14,
        periodEnd: null,
        cancelAtPeriodEnd: false,
      },
      isLoading: state.loading,
      error: state.error,
    };
  },
  useInvoices: () => ({ data: [], isEmpty: true, isLoading: false, error: null }),
  useUsage: () => {
    state.reads++;
    return { data: [], isEmpty: true, isLoading: state.loading, error: state.error };
  },
  useApiKeys: () => {
    state.reads++;
    return { data: [], isEmpty: true, isLoading: state.loading, error: state.error };
  },
  useAuditLog: () => {
    state.reads++;
    return {
      data: state.empty
        ? []
        : [
            {
              id: "a",
              actorName: "Owner",
              action: "updated",
              entity: "Workspace",
              createdAt: "2026-09-01T10:00:00Z",
            },
          ],
      isEmpty: state.empty,
      isLoading: state.loading,
      error: state.error,
      refetch: () => undefined,
    };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: React.PropsWithChildren<{ to: string; search?: boolean }>) => {
    void search;
    return (
      <a href={to} {...props}>
        {children}
      </a>
    );
  },
}));
import { E15SettingsBillingPlan } from "./E15SettingsBillingPlan";
import { E16SettingsUsage } from "./E16SettingsUsage";
import { E17SettingsAPIKeys } from "./E17SettingsAPIKeys";
import { E18SettingsAuditLog } from "./E18SettingsAuditLog";
const screens = [E15SettingsBillingPlan, E16SettingsUsage, E17SettingsAPIKeys, E18SettingsAuditLog];
describe("account access and data states", () => {
  beforeEach(() => {
    state.role = "owner";
    state.loading = false;
    state.error = null;
    state.empty = true;
    state.reads = 0;
  });
  it.each(screens)("does not run restricted hooks for a rep", (Screen) => {
    state.role = "rep";
    expect(renderToStaticMarkup(<Screen />)).toContain("These settings are restricted.");
    expect(state.reads).toBe(0);
  });
  it("restricts billing to owners while admin can view the audit log", () => {
    state.role = "admin";
    expect(renderToStaticMarkup(<E15SettingsBillingPlan />)).toContain("Only workspace owners");
    expect(state.reads).toBe(0);
    expect(renderToStaticMarkup(<E18SettingsAuditLog />)).toContain("No audit entries yet.");
    expect(state.reads).toBe(1);
  });
  it("never exports stale audit data while loading or after a read error", () => {
    state.empty = false;
    state.loading = true;
    let html = renderToStaticMarkup(<E18SettingsAuditLog />);
    expect(html).toContain("Loading");
    expect(html).not.toContain("data:text/csv");
    state.loading = false;
    state.error = new Error("Audit read failed");
    html = renderToStaticMarkup(<E18SettingsAuditLog />);
    expect(html).toContain("Audit read failed");
    expect(html).not.toContain("data:text/csv");
  });
  it("renders empty usage and keys rather than invented data", () => {
    expect(renderToStaticMarkup(<E16SettingsUsage />)).toContain("No usage records yet.");
    expect(renderToStaticMarkup(<E17SettingsAPIKeys />)).toContain("No API keys yet.");
  });
});
