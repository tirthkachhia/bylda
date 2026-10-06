import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Insight, Pattern } from "@/lib/data";
import { ImportantCard } from "../home/ImportantCard";
import { SelectedPanel } from "../patterns/SelectedPanel";
import { NotEnoughCalls } from "./NotEnoughCalls";

// The context panel portals into the shell; SSR has no shell, so render it inline.
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual<object>("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));

const html = async (node: ReactNode) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />).replace(/<!-- -->/g, "");
};

const insight = (over: Partial<Insight> = {}): Insight => ({
  id: "i",
  kind: "pattern",
  headline: "Calls longer than 42 minutes aren’t producing better outcomes.",
  body: null,
  confidence: "medium",
  sampleSize: 486,
  sampleLabel: "n = 486 calls",
  callsAnalyzed: 486,
  affectedRepIds: [],
  evidence: [],
  action: { type: "open_behavior", label: "View behavior", behaviorKey: "k" },
  causalTested: false,
  tone: "neutral",
  tag: "Call length",
  createdAt: "2026-09-30T08:00:00Z",
  ...over,
});

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: "p",
  scope: "rep",
  headline: "Demo before discovery",
  confidence: "medium",
  sampleSize: 5,
  firstSeenAt: "2026-09-21",
  behaviorKey: "demo_before_discovery",
  affectedRepIds: ["u_mia"],
  status: "emerging",
  ...over,
});
const names = new Map([["u_mia", "Mia Kowalski"]]);

describe("I1 important-today card", () => {
  it("shows confidence and n, and the action at Medium", async () => {
    const out = await html(<ImportantCard insight={insight()} />);
    expect(out).toContain("CONFIDENCE");
    expect(out).toContain("n = 486 calls");
    expect(out).toContain("View behavior");
  });
  it("is observation only at Low: no action button", async () => {
    const out = await html(<ImportantCard insight={insight({ confidence: "low" })} />);
    expect(out).toContain("OBSERVATION ONLY");
    expect(out).not.toContain("View behavior");
  });
});

describe("I3 selected panel", () => {
  it("offers the coaching action for one rep at Medium", async () => {
    const out = await html(<SelectedPanel pattern={pattern()} insight={null} repNames={names} />);
    expect(out).toContain("Create coaching focus for Mia");
    expect(out).toContain("n = 5 calls");
  });
  it("has no action at Low confidence", async () => {
    const out = await html(
      <SelectedPanel pattern={pattern({ confidence: "low" })} insight={null} repNames={names} />,
    );
    expect(out).not.toContain("Create coaching focus");
    expect(out).toContain("OBSERVATION ONLY");
  });
  it("has no action for a multi-rep pattern", async () => {
    const out = await html(
      <SelectedPanel
        pattern={pattern({ affectedRepIds: ["u_mia", "u_x"] })}
        insight={null}
        repNames={names}
      />,
    );
    expect(out).not.toContain("Create coaching focus");
  });
  it("shows no confidence and no action for a resolved pattern", async () => {
    const out = await html(
      <SelectedPanel
        pattern={pattern({ status: "resolved", sampleSize: 0 })}
        insight={null}
        repNames={names}
      />,
    );
    expect(out).not.toContain("CONFIDENCE");
    expect(out).not.toContain("Create coaching focus");
    expect(out).toContain("NO LIVE EVIDENCE");
  });
});

describe("not enough calls", () => {
  it("names the team's real count and the 50-call floor", async () => {
    const out = await html(<NotEnoughCalls eyebrow="INTELLIGENCE" analyzed={12} />);
    expect(out).toContain("12 calls");
    expect(out).toContain("about 50");
  });
});
