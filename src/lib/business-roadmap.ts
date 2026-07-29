// Business Roadmap — the zoomed-out Foundation → Build → Launch → Grow →
// Scale → Exit view shown on /app/roadmap, spanning both Launchpad (create)
// and Bylda (operate).
//
// Stage position is NOT computed here. The canonical stage is
// deriveLaunchpadProgress (src/lib/ecosystem.ts) — the same computation the
// mission-control stage bar and sidebar render — and this roadmap re-labels
// it into its own vocabulary via LAUNCHPAD_TO_ROADMAP. The per-stage
// checklists below are display detail on top of that position, not a second
// stage derivation.
//
// Every checklist item is backed by a real signal — either a succeeded run
// of a real Launchpad tool (src/lib/mock.ts's launchpadCatalog — the actual
// catalog behind /app/launchpad/:tool and tool_runs, not the unrelated
// marketing catalog in src/lib/catalog.ts), a toggled-on automation
// (automation_configs, checked via activeAutomationSlugs), or a structural
// fact (leads saved, deals won, team size) — never a self-reported checkbox.

import type { BusinessGraph } from "@/hooks/use-business-graph";
import { launchpadCatalog } from "@/lib/mock";
import { AUTOMATION_SYSTEMS } from "@/lib/catalog";
import { deriveLaunchpadProgress, wonLeadCount, type LaunchpadStageId } from "@/lib/ecosystem";

export type RoadmapStageId = "foundation" | "build" | "launch" | "grow" | "scale" | "exit";

export type RoadmapItemStatus = "completed" | "available" | "locked";

export interface RoadmapExtraSignals {
  /** Organization member count, from organizationMembersQuery */
  orgMemberCount: number;
  /** automation_slug values with an active config, from automation_configs */
  activeAutomationSlugs: string[];
}

export interface RoadmapItemDef {
  id: string;
  label: string;
  /** Real signal that marks this item done — never self-reported */
  done: (graph: BusinessGraph, extra: RoadmapExtraSignals) => boolean;
  /** Where doing this item happens */
  to: string;
}

export interface RoadmapStageDef {
  id: RoadmapStageId;
  label: string;
  /** One-line reason this stage matters, shown in the "why this matters" rail */
  headline: string;
  /** The number this stage is expected to move, shown alongside the headline */
  impact: string;
  items: RoadmapItemDef[];
}

/** A one-shot Launchpad tool run is done — checked against the real
 *  tool_runs.tool_key value (toolKey), not the route slug (key), since the
 *  two differ for a few legacy tools (e.g. idea-validator → validate-idea). */
function toolDone(routeKey: string) {
  const toolKey = launchpadCatalog.find((t) => t.key === routeKey)?.toolKey ?? routeKey;
  return (graph: BusinessGraph) => graph.signals.succeededToolKeys.includes(toolKey);
}

/** An always-on automation is turned on — checked against automation_configs,
 *  not tool_runs (automations are toggled, not run once). */
function automationDone(slug: string) {
  return (_graph: BusinessGraph, extra: RoadmapExtraSignals) =>
    extra.activeAutomationSlugs.includes(slug);
}

/** Human label for a real Launchpad tool's route key or an automation's slug. */
export function toolNameForSlug(slug: string): string {
  return (
    launchpadCatalog.find((t) => t.key === slug)?.name ??
    AUTOMATION_SYSTEMS.find((a) => a.slug === slug)?.name ??
    slug
  );
}

export const ROADMAP_STAGES: RoadmapStageDef[] = [
  {
    id: "foundation",
    label: "Foundation",
    headline: "A validated idea with a priced offer is the only safe place to build from.",
    impact: "Cuts wasted build time on ideas nobody wants",
    items: [
      {
        id: "idea-validator",
        label: "Validate your idea",
        done: toolDone("idea-validator"),
        to: "/app/launchpad/idea-validator",
      },
      {
        id: "kill-my-idea",
        label: "Stress-test it against real demand",
        done: toolDone("kill-my-idea"),
        to: "/app/launchpad/kill-my-idea",
      },
      {
        id: "persona-builder",
        label: "Know your ideal customer",
        done: toolDone("persona-builder"),
        to: "/app/launchpad/persona-builder",
      },
      {
        id: "pricing-calculator",
        label: "Define your offer and price it",
        done: (graph) => graph.signals.hasOffer && toolDone("pricing-calculator")(graph),
        to: "/app/launchpad/pricing-calculator",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    headline: "Set up the assets and systems that make the offer ready to sell.",
    impact: "+18% reply rate · +12hrs saved / week once systems run themselves",
    items: [
      {
        id: "crm-automation",
        label: "Build your sales pipeline",
        done: automationDone("crm-automation"),
        to: "/app/automations",
      },
      {
        id: "import-contacts",
        label: "Import & organize contacts",
        done: (graph) => graph.signals.leadCount > 0,
        to: "/app/contacts",
      },
      {
        id: "landing-page-creator",
        label: "Build your landing page",
        done: toolDone("landing-page-creator"),
        to: "/app/launchpad/landing-page-creator",
      },
      {
        id: "ai-followup-sequences",
        label: "Create follow-up automation",
        done: (graph, extra) =>
          graph.signals.hasFollowupSequence ||
          automationDone("ai-followup-sequences")(graph, extra),
        to: "/app/automations",
      },
      {
        id: "kpi-dashboard",
        label: "Set up your reporting dashboard",
        done: toolDone("kpi-dashboard"),
        to: "/app/launchpad/kpi-dashboard",
      },
    ],
  },
  {
    id: "launch",
    label: "Launch",
    headline: "Go live and bring in the leads that prove the business works.",
    impact: "The moment the funnel starts running for real",
    items: [
      {
        id: "launch-checklist",
        label: "Run your launch checklist",
        done: toolDone("launch-checklist"),
        to: "/app/launchpad/launch-checklist",
      },
      {
        id: "first-10-customers-finder",
        label: "Get your first 10 leads live",
        done: toolDone("first-10-customers-finder"),
        to: "/app/launchpad/first-10-customers-finder",
      },
      {
        id: "ad-copy",
        label: "Run your first campaign",
        done: toolDone("ad-copy"),
        to: "/app/launchpad/ad-copy",
      },
    ],
  },
  {
    id: "grow",
    label: "Grow",
    headline: "Turn the first sale into a repeatable way to get customers.",
    impact: "The point growth stops depending on luck",
    items: [
      {
        id: "first-deal",
        label: "Close your first deal",
        done: (graph) => wonLeadCount(graph) > 0,
        to: "/app/contacts",
      },
      {
        id: "seo-audit",
        label: "Improve your visibility",
        done: toolDone("seo-audit"),
        to: "/app/launchpad/seo-audit",
      },
      {
        id: "gtm-strategy-builder",
        label: "Write your growth plan",
        done: toolDone("gtm-strategy-builder"),
        to: "/app/launchpad/gtm-strategy-builder",
      },
      {
        id: "email-sequence",
        label: "Set up a nurture sequence",
        done: toolDone("email-sequence"),
        to: "/app/launchpad/email-sequence",
      },
    ],
  },
  {
    id: "scale",
    label: "Scale",
    headline: "Make the business run without you in every conversation.",
    impact: "Hours back every week, without losing leads",
    items: [
      {
        id: "automations-active",
        label: "Automate your operations",
        done: (graph) => graph.signals.activeAutomationCount >= 3,
        to: "/app/automations",
      },
      {
        id: "build-a-team",
        label: "Build a team",
        done: (_graph, extra) => extra.orgMemberCount > 1,
        to: "/app/scale/team",
      },
      {
        id: "ai-appointment-setting",
        label: "Train your AI SDR",
        done: automationDone("ai-appointment-setting"),
        to: "/app/automations",
      },
      {
        id: "voice-ai",
        label: "Scale outreach with voice AI",
        done: automationDone("voice-ai"),
        to: "/app/automations",
      },
      {
        id: "sms-automation",
        label: "Add SMS to your funnel",
        done: automationDone("sms-automation"),
        to: "/app/automations",
      },
    ],
  },
  {
    id: "exit",
    label: "Exit",
    headline: "Document the business so it's worth something without you.",
    impact: "What a buyer or investor will actually ask for",
    items: [
      {
        id: "business-plan-generator",
        label: "Document your business plan",
        done: toolDone("business-plan-generator"),
        to: "/app/launchpad/business-plan-generator",
      },
      {
        id: "funding-readiness-score",
        label: "Check your funding readiness",
        done: toolDone("funding-readiness-score"),
        to: "/app/launchpad/funding-readiness-score",
      },
      {
        id: "investor-email-writer",
        label: "Write your investor outreach",
        done: toolDone("investor-email-writer"),
        to: "/app/launchpad/investor-email-writer",
      },
    ],
  },
];

export interface RoadmapItemState extends RoadmapItemDef {
  status: RoadmapItemStatus;
}

export interface RoadmapStageState extends RoadmapStageDef {
  items: RoadmapItemState[];
  percentComplete: number;
  done: boolean;
  current: boolean;
  upcoming: boolean;
}

export interface RoadmapProgress {
  stages: RoadmapStageState[];
  currentIndex: number;
  current: RoadmapStageState;
}

/** Display mapping from the canonical Launchpad stage (deriveLaunchpadProgress)
 *  to this roadmap's zoomed-out vocabulary. Scale is reached once every
 *  Launchpad stage through Revenue is proven; Exit has no automatic
 *  advancement yet (it's Bylda-side, beyond first revenue). */
const LAUNCHPAD_TO_ROADMAP: Record<LaunchpadStageId, RoadmapStageId> = {
  idea: "foundation",
  validate: "foundation",
  offer: "foundation",
  build: "build",
  launch: "launch",
  revenue: "grow",
};

/** Roadmap view state. Stage position comes from the one canonical stage
 *  computation (deriveLaunchpadProgress) re-labeled via LAUNCHPAD_TO_ROADMAP —
 *  never derived independently from this file's checklist items. The
 *  checklists only drive per-stage percentComplete and item statuses. */
export function deriveRoadmapProgress(
  graph: BusinessGraph,
  extra: RoadmapExtraSignals,
): RoadmapProgress {
  const launchpad = deriveLaunchpadProgress(graph);
  const mappedId: RoadmapStageId =
    launchpad.current.id === "revenue" && launchpad.current.done
      ? "scale"
      : LAUNCHPAD_TO_ROADMAP[launchpad.current.id];
  const currentIndex = Math.max(
    0,
    ROADMAP_STAGES.findIndex((s) => s.id === mappedId),
  );

  const stages: RoadmapStageState[] = ROADMAP_STAGES.map((stage, i) => {
    const itemsDone = stage.items.map((item) => item.done(graph, extra));
    const doneCount = itemsDone.filter(Boolean).length;
    const firstOpenIdx = itemsDone.findIndex((d) => !d);

    const items: RoadmapItemState[] = stage.items.map((item, j) => {
      let status: RoadmapItemStatus;
      if (itemsDone[j]) status = "completed";
      else if (i > currentIndex) status = "locked";
      else if (i < currentIndex)
        status = "available"; // leftover in a passed stage — still actionable
      else status = j === firstOpenIdx ? "available" : "locked";
      return { ...item, status };
    });

    return {
      ...stage,
      items,
      percentComplete: Math.round((doneCount / stage.items.length) * 100),
      done: i < currentIndex,
      current: i === currentIndex,
      upcoming: i > currentIndex,
    };
  });

  return {
    stages,
    currentIndex,
    current: stages[currentIndex],
  };
}
