import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ role: "owner", loading: false, error: null as Error | null }));
vi.mock("@/lib/data", () => ({
  useViewer: () => ({ data: { role: state.role }, isLoading: false, error: null }),
  useMethodologies: () => ({
    data: [],
    isEmpty: true,
    isLoading: state.loading,
    error: state.error,
    refetch: () => undefined,
  }),
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
import { E9MethodologyIndex } from "./E9MethodologyIndex";
describe("methodology data boundaries", () => {
  beforeEach(() => {
    state.role = "owner";
    state.loading = false;
    state.error = null;
  });
  it("shows empty data without fabricated methodologies", () => {
    const html = renderToStaticMarkup(<E9MethodologyIndex />);
    expect(html).toContain("No methodologies yet.");
    expect(html).not.toContain("Enterprise MEDDPICC");
  });
  it("renders loading and retryable errors", () => {
    state.loading = true;
    expect(renderToStaticMarkup(<E9MethodologyIndex />)).toContain("Loading");
    state.loading = false;
    state.error = new Error("Methodology read failed");
    const html = renderToStaticMarkup(<E9MethodologyIndex />);
    expect(html).toContain("Methodology read failed");
    expect(html).toContain("Retry");
  });
  it.each(["rep", "viewer", "manager"])(
    "denies %s before rendering methodology controls",
    (role) => {
      state.role = role;
      const html = renderToStaticMarkup(<E9MethodologyIndex />);
      expect(html).toContain("Methodology settings are restricted.");
      expect(html).not.toContain("New methodology");
    },
  );
});
