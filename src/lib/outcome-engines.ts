// Outcome Engines — goals, in plain words.
// Users pick what they want to get done; each goal sequences the existing
// Launchpad tools (plus real-world steps) behind the scenes.
// Frontend-only; reuses existing tool routes.

import type { ComponentType, CSSProperties } from "react";
import {
  Lightbulb,
  Megaphone,
  Target,
  Users,
  Mail,
  Workflow,
  TrendingUp,
  Blocks,
  BookOpen,
  Plug,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */

export type OutcomeCategory = "build" | "launch" | "grow" | "automate" | "optimize" | "scale";

export interface OutcomeStep {
  title: string;
  /** What the user does, in plain language */
  description: string;
  /** Launchpad tool slug — null means a real-world step */
  toolSlug: string | null;
  /** Route to execute (tool page or relevant app page) */
  to: string;
  estimatedMinutes: number;
}

export interface OutcomeEngine {
  id: string;
  category: OutcomeCategory;
  name: string;
  /** One line: what the user walks away with */
  outcome: string;
  /** Why this matters, in one plain sentence */
  impact: string;
  estimatedMinutes: number;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  steps: OutcomeStep[];
  /** Outcome IDs that naturally follow this one */
  leadsTo: string[];
}

/* ─── Category metadata (drives nav + page headers) ─────────── */

export const OUTCOME_CATEGORIES: Record<
  OutcomeCategory,
  { label: string; tagline: string; modes: Array<"create" | "operate"> }
> = {
  build: {
    label: "Build",
    tagline: "Turn your idea into something you can sell",
    modes: ["create"],
  },
  launch: {
    label: "Launch",
    tagline: "Get your first paying customers",
    modes: ["create"],
  },
  grow: {
    label: "Grow",
    tagline: "Make sales repeatable, not lucky",
    modes: ["create"],
  },
  automate: {
    label: "Automate",
    tagline: "Make boring work run by itself",
    modes: ["operate"],
  },
  optimize: {
    label: "Optimize",
    tagline: "Same effort, more results",
    modes: ["operate"],
  },
  scale: {
    label: "Scale",
    tagline: "Make the business run without you",
    modes: ["operate"],
  },
};

/* ─── Goal definitions ──────────────────────────────────────── */

export const OUTCOME_ENGINES: OutcomeEngine[] = [
  /* ── BUILD ── */
  {
    id: "validate-idea",
    category: "build",
    name: "Check your idea",
    outcome: "a clear answer: build it, fix it, or drop it.",
    impact: "Find out if people want it — before you build it.",
    estimatedMinutes: 20,
    icon: Lightbulb,
    steps: [
      {
        title: "Score your idea",
        description: "Bylda grades your idea and tells you what's strong and what's weak.",
        toolSlug: "idea-validator",
        to: "/app/launchpad/idea-validator",
        estimatedMinutes: 8,
      },
      {
        title: "Stress-test it",
        description: "Bylda argues against your idea, like a tough customer. Find the holes first.",
        toolSlug: "kill-my-idea",
        to: "/app/launchpad/kill-my-idea",
        estimatedMinutes: 6,
      },
      {
        title: "Write your one-line promise",
        description: 'Fill in: "I help [WHO] do [WHAT] so they get [RESULT]." Keep it simple.',
        toolSlug: null,
        to: "/app/mission-control",
        estimatedMinutes: 6,
      },
    ],
    leadsTo: ["build-offer"],
  },
  {
    id: "build-offer",
    category: "build",
    name: "Build your offer",
    outcome: "a clear offer with a price, ready to sell.",
    impact: "You can't sell anything until you can say what it is and what it costs.",
    estimatedMinutes: 30,
    icon: Megaphone,
    steps: [
      {
        title: "Design your offer",
        description: "Answer 4 short questions. Bylda writes the offer for you.",
        toolSlug: "offer",
        to: "/app/launchpad/offer",
        estimatedMinutes: 12,
      },
      {
        title: "Make your customer plan",
        description: "Bylda shows you where to find customers and what to say to them.",
        toolSlug: "gtm-strategy",
        to: "/app/launchpad/gtm-strategy",
        estimatedMinutes: 10,
      },
      {
        title: "Write your one-line promise",
        description: "Fill in one simple sentence about who you help. Use it everywhere.",
        toolSlug: null,
        to: "/app/mission-control",
        estimatedMinutes: 8,
      },
    ],
    leadsTo: ["land-first-customers", "create-pitch"],
  },
  {
    id: "create-pitch",
    category: "build",
    name: "Write your 30-second pitch",
    outcome: "words that make people want to hear more.",
    impact: "You'll use this pitch in every email, call, and meeting.",
    estimatedMinutes: 15,
    icon: Target,
    steps: [
      {
        title: "Let Bylda write your pitch",
        description: "Answer short questions. Bylda turns them into a pitch.",
        toolSlug: "pitch-generator",
        to: "/app/launchpad/pitch-generator",
        estimatedMinutes: 10,
      },
      {
        title: "Say it out loud 5 times",
        description: "Change any word that doesn't sound like you. Then you're ready.",
        toolSlug: null,
        to: "/app/mission-control",
        estimatedMinutes: 5,
      },
    ],
    leadsTo: ["land-first-customers"],
  },

  /* ── LAUNCH ── */
  {
    id: "land-first-customers",
    category: "launch",
    name: "Get your first 10 customers",
    outcome: "10 paying customers — proof your business is real.",
    impact: "This is the only number that matters right now.",
    estimatedMinutes: 45,
    icon: Users,
    steps: [
      {
        title: "Get your 30-day plan",
        description: "Bylda builds a day-by-day plan to land 10 customers.",
        toolSlug: "first-10-customers",
        to: "/app/launchpad/first-10-customers",
        estimatedMinutes: 15,
      },
      {
        title: "Get your 5 follow-up emails",
        description: "Bylda writes the emails that keep leads warm for 2 weeks.",
        toolSlug: "followup",
        to: "/app/launchpad/followup",
        estimatedMinutes: 15,
      },
      {
        title: "Message one real person today",
        description: "One person, one message, right now. Then save them in Customers.",
        toolSlug: null,
        to: "/app/contacts",
        estimatedMinutes: 15,
      },
    ],
    leadsTo: ["build-growth-system"],
  },
  {
    id: "automate-followup",
    category: "launch",
    name: "Set up follow-up that sends itself",
    outcome: "follow-up emails that go out on their own — no lead is forgotten.",
    impact: "Most people buy after 5 to 8 reminders. Bylda sends them for you.",
    estimatedMinutes: 20,
    icon: Mail,
    steps: [
      {
        title: "Write the emails",
        description: "Bylda writes 5 short emails that fit your business.",
        toolSlug: "followup",
        to: "/app/launchpad/followup",
        estimatedMinutes: 10,
      },
      {
        title: "Turn it on",
        description: "Flip the switch. Every new lead now gets the emails automatically.",
        toolSlug: null,
        to: "/app/automations",
        estimatedMinutes: 10,
      },
    ],
    leadsTo: ["build-growth-system"],
  },

  /* ── GROW ── */
  {
    id: "build-growth-system",
    category: "grow",
    name: "Build a growth machine",
    outcome: "a way to get customers that doesn't need you every day.",
    impact: "Your business stops being capped by your hours.",
    estimatedMinutes: 60,
    icon: TrendingUp,
    steps: [
      {
        title: "Write your growth playbook",
        description: "A plan so clear that someone else could run it for you.",
        toolSlug: "gtm-strategy",
        to: "/app/launchpad/gtm-strategy",
        estimatedMinutes: 15,
      },
      {
        title: "Map how your business runs",
        description: "Bylda writes down your steps and picks what to automate first.",
        toolSlug: "generate-ops-plan",
        to: "/app/launchpad/ops-plan",
        estimatedMinutes: 20,
      },
      {
        title: "Ask 5 customers for a referral",
        description: "Send a 3-sentence ask to your last 5 customers. Referrals on purpose.",
        toolSlug: null,
        to: "/app/contacts",
        estimatedMinutes: 25,
      },
    ],
    leadsTo: ["automate-process"],
  },

  /* ── AUTOMATE (operator) ── */
  {
    id: "automate-process",
    category: "automate",
    name: "Automate one task",
    outcome: "one boring task that now runs 100% without you.",
    impact: "Every task you automate gives you time back, forever.",
    estimatedMinutes: 40,
    icon: Workflow,
    steps: [
      {
        title: "Write the task down",
        description: "What starts it, the exact steps, and what 'done' looks like.",
        toolSlug: "generate-ops-plan",
        to: "/app/launchpad/ops-plan",
        estimatedMinutes: 15,
      },
      {
        title: "Turn on the automation",
        description: "Pick a ready-made workflow that matches, or build your own.",
        toolSlug: null,
        to: "/app/automations",
        estimatedMinutes: 25,
      },
    ],
    leadsTo: ["connect-systems"],
  },
  {
    id: "connect-systems",
    category: "automate",
    name: "Connect your tools",
    outcome: "your real numbers flowing into Bylda by themselves.",
    impact: "No more typing numbers in by hand — your dashboard fills itself.",
    estimatedMinutes: 15,
    icon: Plug,
    steps: [
      {
        title: "Connect the tool you use most",
        description: "Link payments, your contact list, or your calendar. One is enough to start.",
        toolSlug: null,
        to: "/app/integrations",
        estimatedMinutes: 15,
      },
    ],
    leadsTo: ["automate-process"],
  },

  /* ── OPTIMIZE (operator) ── */
  {
    id: "optimize-growth",
    category: "optimize",
    name: "Tune up your sales",
    outcome: "a sharper plan that turns more leads into customers.",
    impact: "Same effort, more money.",
    estimatedMinutes: 35,
    icon: TrendingUp,
    steps: [
      {
        title: "Rebuild your plan with real numbers",
        description: "Give Bylda your real results. Get a plan that fixes the leaks.",
        toolSlug: "gtm-strategy",
        to: "/app/launchpad/gtm-strategy",
        estimatedMinutes: 15,
      },
      {
        title: "Refresh your follow-up emails",
        description: "Update them with what you've learned about why people say no.",
        toolSlug: "followup",
        to: "/app/launchpad/followup",
        estimatedMinutes: 10,
      },
      {
        title: "Walk through every open deal",
        description: "For each one, decide the next move and when you'll make it.",
        toolSlug: null,
        to: "/app/bylda/crm",
        estimatedMinutes: 10,
      },
    ],
    leadsTo: ["build-playbook"],
  },

  /* ── SCALE (operator) ── */
  {
    id: "build-playbook",
    category: "scale",
    name: "Write your team playbook",
    outcome: "step-by-step guides so someone else can do the work.",
    impact: "You stop being the person everything depends on.",
    estimatedMinutes: 60,
    icon: BookOpen,
    steps: [
      {
        title: "Write down how the business runs",
        description: "Bylda maps your steps, roles, and tools.",
        toolSlug: "generate-ops-plan",
        to: "/app/launchpad/ops-plan",
        estimatedMinutes: 20,
      },
      {
        title: "Write guides for your top 3 tasks",
        description:
          "For each: when to do it, the steps like a recipe, and what 'done' looks like.",
        toolSlug: null,
        to: "/app/sop-library",
        estimatedMinutes: 40,
      },
    ],
    leadsTo: ["automate-process"],
  },
  {
    id: "build-custom-workflow",
    category: "scale",
    name: "Build a custom workflow",
    outcome: "an automation made just for how your business works.",
    impact: "Your special way of working, running on its own.",
    estimatedMinutes: 30,
    icon: Blocks,
    steps: [
      {
        title: "Draw the steps in the builder",
        description: "Pick what starts it and what happens next. Drag, drop, done.",
        toolSlug: null,
        to: "/app/builder",
        estimatedMinutes: 30,
      },
    ],
    leadsTo: [],
  },
];

/* ─── Lookups ───────────────────────────────────────────────── */

export function getOutcomesByCategory(category: OutcomeCategory): OutcomeEngine[] {
  return OUTCOME_ENGINES.filter((e) => e.category === category);
}

export function getOutcomeById(id: string): OutcomeEngine | undefined {
  return OUTCOME_ENGINES.find((e) => e.id === id);
}

export function isValidCategory(c: string): c is OutcomeCategory {
  return c in OUTCOME_CATEGORIES;
}

/** A goal is done when every tool step has a succeeded run. */
export function isOutcomeDone(o: OutcomeEngine, succeededToolKeys: string[]): boolean {
  const toolSteps = o.steps.filter((s) => s.toolSlug);
  if (toolSteps.length === 0) return false;
  return toolSteps.every((s) => succeededToolKeys.includes(s.toolSlug as string));
}

/** A goal is locked when a goal that leads to it isn't done yet. */
export function isOutcomeLocked(o: OutcomeEngine, succeededToolKeys: string[]): boolean {
  const prerequisites = OUTCOME_ENGINES.filter((e) => e.leadsTo.includes(o.id));
  if (prerequisites.length === 0) return false;
  // Unlocked as soon as ANY path to it is complete.
  return !prerequisites.some((p) => isOutcomeDone(p, succeededToolKeys));
}
