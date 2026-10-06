import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "owner",
  loading: false,
  empty: false,
  error: null as Error | null,
}));
vi.mock("@/lib/data", () => {
  const query = (data: unknown) => ({
    data,
    isLoading: state.loading,
    isEmpty: state.empty,
    error: state.error,
  });
  return {
    useViewer: () => ({ data: { role: state.role }, isLoading: false, error: null }),
    REP_INSIGHT_MIN_CALLS: 10,
    useAnalysisPreferences: () =>
      query({
        minCallSeconds: 120,
        excludeInternalCalls: true,
        languages: ["en"],
        redactPii: true,
      }),
    useNotificationPreferences: () =>
      query({
        channel: "slack",
        types: { behavior_regression: true, report_ready: false },
        quietHours: { from: "19:00", to: "08:00" },
      }),
    useRetentionPolicy: () =>
      query({ recordingsDays: 90, transcriptsDays: 365, deleteOnRequest: false }),
  };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
import { E6SettingsAnalysisPreferences } from "./E6SettingsAnalysisPreferences";
import { E7SettingsNotifications } from "./E7SettingsNotifications";
import { E8SettingsRetentionPrivacy } from "./E8SettingsRetentionPrivacy";
beforeEach(() => {
  state.role = "owner";
  state.loading = false;
  state.empty = false;
  state.error = null;
});
describe("preference scope and incomplete contracts", () => {
  it("keeps owner-only retention inaccessible to admins and workspace analysis inaccessible to reps", () => {
    state.role = "admin";
    expect(renderToStaticMarkup(<E8SettingsRetentionPrivacy />)).toContain("Only workspace owners");
    expect(renderToStaticMarkup(<E8SettingsRetentionPrivacy />)).not.toContain("Sarah");
    expect(renderToStaticMarkup(<E8SettingsRetentionPrivacy />)).not.toContain(
      "Keep call audio for",
    );
    expect(renderToStaticMarkup(<E6SettingsAnalysisPreferences />)).toContain("2 minutes");
    state.role = "rep";
    expect(renderToStaticMarkup(<E6SettingsAnalysisPreferences />)).not.toContain("2 minutes");
    expect(renderToStaticMarkup(<E7SettingsNotifications />)).toContain(
      "Your personal preferences",
    );
  });
  it("never invents notification cells for absent types or other channels", () => {
    const html = renderToStaticMarkup(<E7SettingsNotifications />);
    expect((html.match(/role="switch"/g) ?? []).length).toBe(2);
    expect(html).toContain("Behavior regression on my team · Slack");
    expect(html).toContain("Report ready · Slack");
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Push: not specified");
    expect(html).toContain('value="08:00"');
  });
  it("uses the fixed insight threshold and exact day durations without unsupported policy promises", () => {
    const analysis = renderToStaticMarkup(<E6SettingsAnalysisPreferences />);
    expect(analysis).toContain("10");
    expect(analysis).not.toContain("20 calls");
    const retention = renderToStaticMarkup(<E8SettingsRetentionPrivacy />);
    expect(retention).toContain("365 days");
    expect(retention).not.toContain("24 hours");
    expect(retention).not.toContain("us-east-1");
    expect(retention).toContain('disabled=""');
  });
  it("renders loading, empty and actionable errors on all three query surfaces", () => {
    for (const Screen of [
      E6SettingsAnalysisPreferences,
      E7SettingsNotifications,
      E8SettingsRetentionPrivacy,
    ]) {
      state.loading = true;
      expect(renderToStaticMarkup(<Screen />)).toContain("Loading");
      state.loading = false;
      state.empty = true;
      expect(renderToStaticMarkup(<Screen />)).not.toContain("2 minutes");
      state.empty = false;
      state.error = new Error("Preference read failed");
      expect(renderToStaticMarkup(<Screen />)).toContain("Preference read failed");
      state.error = null;
    }
  });
});
