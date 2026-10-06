import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasShell } from "./CanvasShell";

vi.mock("@/components/bylda/shell/AppShell", () => ({
  AppShell: ({
    children,
    sidebarExtra,
    headerExtra,
  }: {
    children: React.ReactNode;
    sidebarExtra: React.ReactNode;
    headerExtra: React.ReactNode;
  }) => (
    <div>
      {sidebarExtra}
      {headerExtra}
      {children}
    </div>
  ),
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const hosts: { root: ReturnType<typeof createRoot>; host: HTMLDivElement }[] = [];
afterEach(() => {
  for (const { root, host } of hosts.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  hosts.push({ root, host });
  const handlers = { onBack: vi.fn(), onHome: vi.fn(), onAsk: vi.fn(), onOpen: vi.fn() };
  act(() =>
    root.render(
      <CanvasShell title="Today" canBack currentView="brief" {...handlers}>
        <div>Existing workspace content</div>
      </CanvasShell>,
    ),
  );
  return { host, ...handlers };
}
describe("redesigned canvas keeps the existing workspace actions", () => {
  it("renders the existing page content", () => {
    expect(mount().host.textContent).toContain("Existing workspace content");
  });
  it("opens the same approval and call views", () => {
    const h = mount();
    for (const [label, view] of [
      ["Approvals", "approvals"],
      ["Calls & Meetings", "calls"],
      ["Follow-Ups", "followups"],
    ]) {
      const button = Array.from(h.host.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      )!;
      act(() => button.click());
      expect(h.onOpen).toHaveBeenLastCalledWith(view);
    }
  });
  it("keeps back and home callbacks", () => {
    const h = mount();
    for (const [label, callback] of [
      ["Back", h.onBack],
      ["Today", h.onHome],
    ] as const) {
      const button = Array.from(h.host.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      )!;
      act(() => button.click());
      expect(callback).toHaveBeenCalledOnce();
    }
  });
  it("keeps the command shortcut focused on the original Ask input", () => {
    const h = mount();
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true }),
      ),
    );
    expect(document.activeElement).toBe(h.host.querySelector("input"));
  });
});
