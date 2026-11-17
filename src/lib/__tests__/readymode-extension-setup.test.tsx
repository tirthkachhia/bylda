import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadyModeExtensionSetup } from "@/components/app/coaching/ReadyModeExtensionSetup";

const fixtures = vi.hoisted(() => ({
  invoke: vi.fn(),
  rep: "a5f1b992-90cb-4bda-a989-000000000004",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user" }, currentOrgId: "org" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: fixtures.invoke } },
}));
vi.mock("@/components/app/coaching/RepPicker", () => ({
  RepPicker: ({ onChange }: { onChange: (rep: string) => void }) =>
    createElement("button", { onClick: () => onChange(fixtures.rep) }, "Choose Alex"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
let root: Root | undefined;
const writeText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

it("requires a rep and supports creating, copying and revoking the extension connection", async () => {
  let connected = false;
  const code = JSON.stringify({ version: 1, token: "a".repeat(64) });
  fixtures.invoke.mockImplementation(async (_name, { body }) => {
    if (body.action === "connect") {
      connected = true;
      return { data: { connected, connection_code: code } };
    }
    if (body.action === "disconnect") connected = false;
    return { data: { connected } };
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <ReadyModeExtensionSetup />
      </QueryClientProvider>,
    );
  });
  const button = (text: string) =>
    [...host.querySelectorAll("button")].find((el) => el.textContent === text)!;
  expect(button("Create connection code").disabled).toBe(true);
  expect(host.querySelector("a[download]")?.getAttribute("href")).toBe(
    "/downloads/bylda-readymode-extension.zip",
  );
  await act(async () => button("Choose Alex").click());
  await act(async () => button("Create connection code").click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(fixtures.invoke).toHaveBeenCalledWith("readymode-extension", {
    body: { action: "connect", organization_id: "org", rep_id: fixtures.rep },
  });
  expect(host.querySelector("textarea")?.value).toBe(code);
  expect(host.textContent).toContain("Extension connection active");
  await act(async () => button("Copy connection code").click());
  expect(writeText).toHaveBeenCalledWith(code);
  await act(async () => button("Revoke connection").click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(host.querySelector("textarea")).toBeNull();
  expect(host.textContent).toContain("No extension connected");
});
