import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { OutcomeAssociation, Pattern } from "@/lib/data";
import { AssociationsTable } from "../outcomes/AssociationsTable";
import { PatternCard } from "./PatternCard";

/** §4 rules on the I7–I11 pieces: confidence + n always, Low = no action, n_closed < 30 hidden. */

const html = async (node: ReactNode) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />).replace(/<!-- -->/g, "");
};

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: "p",
  scope: "rep",
  headline: "Mia goes to the demo before minute 5 on first calls.",
  confidence: "medium",
  sampleSize: 12,
  firstSeenAt: "2026-09-21",
  behaviorKey: "demo_before_discovery",
  affectedRepIds: ["u_mia"],
  status: "emerging",
  ...over,
});

const action = [{ label: "Open profile", onClick: () => {} }];

describe("PatternCard", () => {
  it("shows confidence + n and the action at Medium", async () => {
    const out = await html(
      <PatternCard pattern={pattern()} eyebrow="REP PATTERN" actions={action} />,
    );
    expect(out).toContain("CONFIDENCE MEDIUM");
    expect(out).toContain("12 calls");
    expect(out).toContain("Open profile");
  });

  it("Low confidence = observation only, no action", async () => {
    const out = await html(
      <PatternCard
        pattern={pattern({ confidence: "low" })}
        eyebrow="REP PATTERN"
        actions={action}
      />,
    );
    expect(out).toContain("CONFIDENCE LOW");
    expect(out).toContain("OBSERVATION ONLY");
    expect(out).not.toContain("Open profile");
  });

  it("a resolved pattern has no live evidence and no action", async () => {
    const out = await html(
      <PatternCard
        pattern={pattern({ status: "resolved", sampleSize: 0 })}
        eyebrow="REP PATTERN"
        actions={action}
      />,
    );
    expect(out).toContain("NO LIVE EVIDENCE — RESOLVED");
    expect(out).not.toContain("CONFIDENCE");
    expect(out).not.toContain("Open profile");
  });
});

describe("AssociationsTable", () => {
  const assoc = (over: Partial<OutcomeAssociation> = {}): OutcomeAssociation => ({
    behaviorKey: "discovery_depth",
    behaviorName: "Discovery depth",
    outcome: "won",
    withRate: 0.41,
    withoutRate: 0.18,
    nWith: 22,
    nWithout: 19,
    nClosed: 41,
    confidence: "medium",
    confounders: [],
    ...over,
  });

  it("shows rates, gap and confidence + n at n_closed ≥ 30", async () => {
    const out = await html(<AssociationsTable rows={[assoc()]} />);
    expect(out).toContain("41%");
    expect(out).toContain("18%");
    expect(out).toContain("+23 pts");
    expect(out).toContain("MED · n=41");
    expect(out).not.toMatch(/\bcaus/i);
  });

  it("hides the numbers under 30 closed outcomes", async () => {
    const out = await html(
      <AssociationsTable rows={[assoc({ nClosed: 7, withRate: 0.55, withoutRate: 0.3 })]} />,
    );
    expect(out).toContain("NOT ENOUGH DATA · 7/30 CLOSED");
    expect(out).not.toContain("55%");
    expect(out).not.toContain("+25 pts");
  });
});
