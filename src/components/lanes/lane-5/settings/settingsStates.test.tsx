import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ loading: false, error: null as Error | null, role: "owner" }));
vi.mock("@/lib/data", () => ({
  useViewer: () => ({ data: { role: state.role }, isLoading: false, error: null }),
  useMembers: () => ({ data: [], isEmpty: true, isLoading: state.loading, error: state.error }),
  useTeams: () => ({ data: [], isLoading: false, error: null }),
  useInviteMembers: () => ({}),
  useRoleDefinitions: () => ({}),
  mocksForced: () => true,
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
import { E3SettingsUsers } from "./E3SettingsUsers";
describe("settings data states", () => {
  it("renders the empty member state without a fabricated count", () => {
    state.loading = false;
    state.error = null;
    state.role = "owner";
    const html = renderToStaticMarkup(<E3SettingsUsers />);
    expect(html).toContain("No members yet.");
    expect(html).not.toContain("12 members");
  });
  it("renders a load state and an actionable error instead of an empty table", () => {
    state.loading = true;
    expect(renderToStaticMarkup(<E3SettingsUsers />)).toContain("Loading");
    state.loading = false;
    state.error = new Error("Member read failed");
    expect(renderToStaticMarkup(<E3SettingsUsers />)).toContain("Member read failed");
    state.error = null;
  });
  it("refuses rep access before rendering member data", () => {
    state.role = "rep";
    const html = renderToStaticMarkup(<E3SettingsUsers />);
    expect(html).not.toContain("No members yet.");
    expect(html).not.toContain("Invite people");
    state.role = "owner";
  });
});
