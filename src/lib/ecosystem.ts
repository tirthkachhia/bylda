// Ecosystem model — one intelligence layer, two products.
//
//   Launchpad creates the business.  (guided, staged, mission-based)
//   Bylda runs the business.          (operational, modular, command center)
//
// They share account, memory, business context, and intelligence — but never
// navigation, home screens, or shell. This file is the single source of truth
// for that split: the Launchpad stage model, both products' navigation, and
// the handoff condition that moves a founder from building to operating.

import type { BusinessGraph } from "@/hooks/use-business-graph";

export type ProductId = "launchpad" | "bylda";

/* ─── Launchpad stage model ─────────────────────────────────────────────
 * Six stages, strictly linear: Idea → Validate → Offer → Build → Launch → Revenue.
 * A stage is "done" when the business has produced the proof it exists for —
 * derived from real signals (tool runs, leads, deals), never self-reported.
 */

export type LaunchpadStageId = "idea" | "validate" | "offer" | "build" | "launch" | "revenue";

export interface LaunchpadStageDef {
  id: LaunchpadStageId;
  label: string;
  /** Where working this stage happens */
  to: string;
  /** What this stage is for, in one plain line */
  headline: string;
  /** The proof that marks this stage done */
  proof: string;
}

export const LAUNCHPAD_STAGES: LaunchpadStageDef[] = [
  {
    id: "idea",
    label: "Idea",
    to: "/app/launchpad/idea-validator",
    headline: "Shape the idea into one clear promise",
    proof: "Idea written down and scored",
  },
  {
    id: "validate",
    label: "Validate",
    to: "/app/launchpad/kill-my-idea",
    headline: "Prove someone actually wants this",
    proof: "Idea stress-tested against real demand",
  },
  {
    id: "offer",
    label: "Offer",
    to: "/app/launchpad/offer",
    headline: "Decide what you sell and what it costs",
    proof: "Offer defined with a price",
  },
  {
    id: "build",
    label: "Build",
    to: "/app/launchpad/gtm-strategy",
    headline: "Set up the assets and systems that make the offer ready to sell.",
    proof: "Customer plan and systems set up",
  },
  {
    id: "launch",
    label: "Launch",
    to: "/app/outcomes/launch",
    headline: "Go live and bring in your first leads",
    proof: "First leads saved",
  },
  {
    id: "revenue",
    label: "Revenue",
    to: "/app/launchpad/first-customers",
    headline: "Turn conversations into your first sale",
    proof: "First deal won",
  },
];

export interface LaunchpadStageState extends LaunchpadStageDef {
  done: boolean;
  current: boolean;
  /** Stage comes after the current one — shown, but de-emphasized */
  upcoming: boolean;
}

export interface LaunchpadProgress {
  stages: LaunchpadStageState[];
  currentIndex: number;
  current: LaunchpadStageState;
  /** Everything before Revenue is proven — the business can operate in Bylda */
  readyForBylda: boolean;
  /** Proof the founder has already produced (for the casefile) */
  proven: string[];
  /** What still needs proof, with where to get it */
  needsProof: Array<{ label: string; to: string }>;
}

export function wonLeadCount(graph: BusinessGraph): number {
  return graph.leads.filter((l) => {
    const s = (l.stage ?? "").toLowerCase();
    return s.includes("won") || s.includes("closed");
  }).length;
}

/** Derive Launchpad progress from live business signals. */
export function deriveLaunchpadProgress(graph: BusinessGraph): LaunchpadProgress {
  const s = graph.signals;
  const stressTested =
    s.succeededToolKeys.some((k) =>
      ["kill-my-idea", "competitor-analysis", "competitor", "idea-vs-idea"].includes(k),
    ) || s.hasValidatedIdea;
  const won = wonLeadCount(graph);

  const doneById: Record<LaunchpadStageId, boolean> = {
    idea: s.hasValidatedIdea || s.toolRunCount > 0,
    validate: s.hasValidatedIdea && stressTested,
    offer: s.hasOffer,
    build: s.hasGtm,
    launch: s.leadCount > 0,
    revenue: won > 0,
  };

  let currentIndex = LAUNCHPAD_STAGES.findIndex((st) => !doneById[st.id]);
  if (currentIndex === -1) currentIndex = LAUNCHPAD_STAGES.length - 1;

  const stages: LaunchpadStageState[] = LAUNCHPAD_STAGES.map((st, i) => ({
    ...st,
    done: doneById[st.id],
    current: i === currentIndex,
    upcoming: i > currentIndex,
  }));

  const proven: string[] = [];
  if (doneById.validate) proven.push("Idea checked against real demand");
  if (doneById.offer) proven.push("Offer defined with a price");
  if (doneById.build) proven.push("Customer plan written");
  if (s.leadCount > 0) proven.push(`${s.leadCount} lead${s.leadCount === 1 ? "" : "s"} saved`);
  if (won > 0) proven.push(`${won} deal${won === 1 ? "" : "s"} won`);

  const needsProof: Array<{ label: string; to: string }> = [];
  if (!doneById.validate)
    needsProof.push({ label: "Proof that people want this", to: "/app/launchpad/idea-validator" });
  if (!doneById.offer)
    needsProof.push({ label: "An offer with a price on it", to: "/app/launchpad/offer" });
  if (!doneById.build)
    needsProof.push({ label: "A written customer plan", to: "/app/launchpad/gtm-strategy" });
  if (s.leadCount === 0)
    needsProof.push({ label: "Real people to talk to", to: "/app/launchpad/first-10-customers" });
  if (won === 0) needsProof.push({ label: "A first paying customer", to: "/app/contacts" });

  return {
    stages,
    currentIndex,
    current: stages[currentIndex],
    readyForBylda: doneById.build && doneById.launch,
    proven,
    needsProof: needsProof.slice(0, 3),
  };
}

/* ─── Navigation models ─────────────────────────────────────────────────
 * Two products, two navs — never combined into one sidebar.
 */

export interface EcosystemNavItem {
  id: string;
  label: string;
  to: string;
  match: (path: string) => boolean;
}

/** Launchpad support areas — the casefile drawer under the stage list. */
export const LAUNCHPAD_SUPPORT_NAV: EcosystemNavItem[] = [
  {
    id: "missions",
    label: "Missions",
    to: "/app/launchpad/missions",
    match: (p) => p === "/app/launchpad/missions",
  },
  { id: "roadmap", label: "Roadmap", to: "/app/roadmap", match: (p) => p === "/app/roadmap" },
  { id: "research", label: "Research", to: "/app/research", match: (p) => p === "/app/research" },
  { id: "assets", label: "Assets", to: "/app/assets", match: (p) => p === "/app/assets" },
  { id: "memory", label: "Memory", to: "/app/memory", match: (p) => p.startsWith("/app/memory") },
];

/** Bylda primary nav — the operating system layer. */
export const BYLDA_PRIMARY_NAV: EcosystemNavItem[] = [
  { id: "home", label: "Home", to: "/app/bylda-home", match: (p) => p === "/app/bylda-home" },
  {
    id: "crm",
    label: "CRM",
    to: "/app/contacts",
    match: (p) => p === "/app/contacts" || p === "/app/leads" || p === "/app/crm/companies",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    to: "/app/bylda/crm",
    match: (p) => p === "/app/bylda/crm" || p === "/app/bylda",
  },
  {
    id: "automations",
    label: "Automations",
    to: "/app/automations",
    match: (p) =>
      p === "/app/automations" || p === "/app/builder" || p === "/app/workflow-templates",
  },
  {
    id: "clients",
    label: "Clients",
    to: "/app/bylda/clients",
    match: (p) => p === "/app/bylda/clients",
  },
  {
    id: "tasks",
    label: "Tasks",
    to: "/app/crm/tasks",
    match: (p) => p === "/app/crm/tasks",
  },
  {
    id: "reporting",
    label: "Reporting",
    to: "/app/bylda/reports",
    match: (p) => p === "/app/bylda/reports",
  },
];

/** Bylda support areas — operational depth, collapsed by default. */
export const BYLDA_SUPPORT_NAV: EcosystemNavItem[] = [
  { id: "roadmap", label: "Roadmap", to: "/app/roadmap", match: (p) => p === "/app/roadmap" },
  {
    id: "inbox",
    label: "Inbox",
    to: "/app/crm/conversations",
    match: (p) => p === "/app/crm/conversations",
  },
  {
    id: "workflows",
    label: "Workflows",
    to: "/app/crm/automations",
    match: (p) => p === "/app/crm/automations",
  },
  {
    id: "campaigns",
    label: "Campaigns",
    to: "/app/crm/campaigns",
    match: (p) => p === "/app/crm/campaigns" || p.startsWith("/app/scale/campaigns"),
  },
  {
    id: "knowledge",
    label: "Knowledge",
    to: "/app/sop-library",
    match: (p) => p === "/app/sop-library" || p === "/app/templates",
  },
  {
    id: "activity",
    label: "Activity",
    to: "/app/activity",
    match: (p) => p === "/app/activity",
  },
  {
    id: "integrations",
    label: "Integrations",
    to: "/app/integrations",
    match: (p) => p === "/app/integrations",
  },
];

/* ─── Product homes & routing ─────────────────────────────────────────── */

export const PRODUCT_HOME: Record<ProductId, string> = {
  launchpad: "/app/mission-control",
  bylda: "/app/bylda-home",
};

/** Post-onboarding landing — never a generic dashboard. */
export function resolveLandingPath(mode: "create" | "operate" | null | undefined): string {
  return mode === "operate" ? PRODUCT_HOME.bylda : PRODUCT_HOME.launchpad;
}
