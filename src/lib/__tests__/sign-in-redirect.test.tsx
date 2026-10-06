import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...(a as [])) } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { Route as SignInRoute } from "@/routes/auth.sign-in";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setValue(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

let mounted: Root | null = null;
afterEach(async () => {
  await act(async () => mounted?.unmount());
  mounted = null;
  signInWithPassword.mockClear();
});

/** Mounts the real sign-in route, submits the real form, returns where the router ended up. */
async function signInThrough(search: string): Promise<string> {
  const root = createRootRoute();
  const signIn = createRoute({
    getParentRoute: () => root,
    path: "/auth/sign-in",
    validateSearch: SignInRoute.options.validateSearch,
    component: SignInRoute.options.component,
  });
  const app = createRoute({
    getParentRoute: () => root,
    path: "/app",
    component: () => <i>app</i>,
  });
  const appAny = createRoute({
    getParentRoute: () => root,
    path: "/app/$",
    component: () => <i>app</i>,
  });
  const router = createRouter({
    routeTree: root.addChildren([signIn, app, appAny]),
    history: createMemoryHistory({ initialEntries: [`/auth/sign-in${search}`] }),
  });

  const el = document.createElement("div");
  mounted = createRoot(el);
  await act(async () => {
    mounted?.render(<RouterProvider router={router} />);
    await router.load();
  });

  await act(async () => {
    setValue(el.querySelector('input[type="email"]') as HTMLInputElement, "dana@acme.test");
    setValue(el.querySelector('input[type="password"]') as HTMLInputElement, "correct-horse");
  });
  await act(async () => {
    el.querySelector("form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/app/), {
    timeout: 3000,
  });
  expect(signInWithPassword).toHaveBeenCalledTimes(1);
  return router.state.location.href;
}

const q = (redirect: string) => `?redirect=${encodeURIComponent(redirect)}`;

describe("/auth/sign-in honors ?redirect", () => {
  it("valid: returns to the page the guard sent the visitor from", async () => {
    expect(await signInThrough(q("/app/calls?tab=mine"))).toBe("/app/calls?tab=mine");
  });

  it("missing: goes to /app", async () => {
    expect(await signInThrough("")).toBe("/app");
  });

  it.each([
    "https://evil.com/app",
    "//evil.com",
    "/\\evil.com",
    "/app@evil.com",
    "/auth/sign-in",
    "/app/../evil",
  ])("malicious %j: goes to /app, never off-site", async (redirect) => {
    expect(await signInThrough(q(redirect))).toBe("/app");
  });
});
