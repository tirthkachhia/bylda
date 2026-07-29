// Step Execution Guidance — the hand-holding layer.
// Every step tells the user, in plain 5th-grade words:
//   what it is → why it matters → exactly how to do it (3 small moves) →
//   how they know they're done.
// Rendered by StepExecutionGuide (checklists) and NextStepHero (Home).

export interface StepDirection {
  /** The move, as a command: "Click the purple button below." */
  action: string;
  /** One short helper sentence. */
  detail: string;
}

export interface StepGuidance {
  stepId: string;
  title: string;
  /** One sentence: what this thing is, in plain words. */
  plainWhat: string;
  /** One sentence: why it matters right now. */
  why: string;
  /** Exactly how to do it — small numbered moves. */
  directions: StepDirection[];
  /** "You are done when:" checklist. */
  doneWhen: string[];
  minutes: number;
  /** Where the purple button goes. */
  toolRoute: string | null;
  /** Label for the purple button. */
  buttonLabel: string;
  /**
   * The mentor who teaches this step, speaking in first person — copy
   * migrated from the retired curriculum's lesson summaries so the teaching
   * voice lives on the step itself instead of a parallel lesson record.
   */
  mentor?: { name: string; line: string };
  /** "Before you start" note — teaching folded in from a prerequisite lesson. */
  prerequisite?: string;
}

export const TOOL_ROUTES: Record<string, string> = {
  "idea-validator": "/app/launchpad/idea-validator",
  "kill-my-idea": "/app/launchpad/kill-my-idea",
  "pitch-generator": "/app/launchpad/pitch-generator",
  "gtm-strategy": "/app/launchpad/gtm-strategy",
  offer: "/app/launchpad/offer",
  "first-10-customers": "/app/launchpad/first-10-customers",
  followup: "/app/launchpad/followup",
  "generate-ops-plan": "/app/launchpad/ops-plan",
  // BYLDA (operate & scale) tools
  "kpi-dashboard": "/app/launchpad/kpi-dashboard",
  "seo-audit": "/app/launchpad/seo-audit",
  "launch-checklist": "/app/launchpad/launch-checklist",
  "email-sequence": "/app/launchpad/email-sequence",
  "ad-copy": "/app/launchpad/ad-copy",
};

const GUIDANCE_MAP: Record<string, StepGuidance> = {
  "idea-validator": {
    stepId: "step-idea-validator",
    title: "Check your idea",
    plainWhat: "Find out if your idea is strong — before you spend time and money on it.",
    why: "If the idea is weak, you want to know today, not after months of work.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Idea Checker." },
      {
        action: "Describe your idea in a few sentences.",
        detail: "Say who it helps and what problem it fixes.",
      },
      {
        action: "Read your score and the feedback.",
        detail: "Write down the top 3 things to fix.",
      },
    ],
    doneWhen: ["You have a score for your idea.", "You wrote down the 3 biggest things to fix."],
    minutes: 8,
    toolRoute: TOOL_ROUTES["idea-validator"],
    buttonLabel: "Start: open the Idea Checker",
  },

  "kill-my-idea": {
    stepId: "step-kill-my-idea",
    title: "Stress-test your idea",
    plainWhat: "Bylda argues against your idea, like a tough customer would.",
    why: "It is better to hear the hard questions now than in a real sales call.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens Kill My Idea." },
      {
        action: "Paste your idea and read Bylda's objections.",
        detail: "Bylda lists the reasons people might say no.",
      },
      {
        action: "Write one answer for each objection.",
        detail: "If an objection is right, write how you will fix it.",
      },
    ],
    doneWhen: ["You read the top 5 objections.", "You wrote an answer for each one."],
    minutes: 6,
    toolRoute: TOOL_ROUTES["kill-my-idea"],
    buttonLabel: "Start: open Kill My Idea",
  },

  "pitch-generator": {
    stepId: "step-pitch-generator",
    title: "Write your 30-second pitch",
    plainWhat: "A pitch is the short story you tell about your business.",
    why: "People decide fast. A clear 30-second pitch makes them want to hear more.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Pitch Writer." },
      {
        action: "Answer the short questions about your business.",
        detail: "Bylda writes the pitch for you.",
      },
      {
        action: "Say the pitch out loud 5 times.",
        detail: "Change any word that does not sound like you.",
      },
    ],
    doneWhen: [
      "Your pitch takes 30 seconds or less to say.",
      "A friend hears it and understands what you sell.",
    ],
    minutes: 10,
    toolRoute: TOOL_ROUTES["pitch-generator"],
    buttonLabel: "Start: open the Pitch Writer",
  },

  "gtm-strategy": {
    stepId: "step-gtm-strategy",
    title: "Make your customer plan",
    plainWhat: "A simple plan that says where to find customers and what to say to them.",
    why: "Knowing what you sell is not enough. You need to know where the buyers are.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Plan Builder." },
      {
        action: "Tell Bylda about your business and your customer.",
        detail: "Use simple words. Bylda builds a 90-day plan.",
      },
      {
        action: "Read the plan and pick ONE channel to start.",
        detail: "One channel done well beats five done badly.",
      },
    ],
    doneWhen: [
      "You picked one place to find customers.",
      "You know what to say when you reach out.",
      "You have a week-by-week plan.",
    ],
    minutes: 10,
    toolRoute: TOOL_ROUTES["gtm-strategy"],
    buttonLabel: "Start: open the Plan Builder",
    mentor: {
      name: "Alex Chen",
      line: "We build your customer map this week: which channel, what message, what we test first. One move, then the plan.",
    },
  },

  offer: {
    stepId: "step-offer-builder",
    title: "Build your offer",
    plainWhat: "Your offer is the thing you sell: what it is, who it's for, and the price.",
    why: "You can't get your first customer until you can say what you sell and what it costs.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Offer Builder." },
      {
        action: "Answer 4 short questions.",
        detail: "Use simple words. Bylda turns your answers into a full offer.",
      },
      {
        action: "Read what Bylda wrote, then click Save.",
        detail: "Fix anything that sounds wrong first.",
      },
    ],
    doneWhen: [
      "You can read your offer out loud in about 30 seconds.",
      "It says who it helps, what they get, and what it costs.",
    ],
    minutes: 12,
    toolRoute: TOOL_ROUTES["offer"],
    buttonLabel: "Start: open the Offer Builder",
    mentor: {
      name: "Maya Okafor",
      line: "Before anything else, we lock the sentence: who it's for, what they get, what it costs. Two framings, we pick the sharper one.",
    },
  },

  "first-10-customers": {
    stepId: "step-first-10-customers",
    title: "Get your first 10 customers",
    plainWhat: "A 30-day plan to find 10 people who will pay you.",
    why: "Your first 10 customers prove your business is real.",
    directions: [
      {
        action: "Click the purple button below.",
        detail: "It opens the First 10 Customers planner.",
      },
      {
        action: "Tell Bylda your offer, your customer, and your price.",
        detail: "Bylda builds a day-by-day plan just for you.",
      },
      {
        action: "Message one real person today.",
        detail: "One person, one message, right now. Then save them in Customers.",
      },
    ],
    doneWhen: ["You have a list of at least 20 people to contact.", "You sent your first message."],
    minutes: 15,
    toolRoute: TOOL_ROUTES["first-10-customers"],
    buttonLabel: "Start: open the planner",
    mentor: {
      name: "Mo Latif",
      line: "Ten real people, names in the pipeline, a reason to talk to each. We start conversations, not campaigns.",
    },
    // Folded in from the retired persona-builder lesson (Maya Okafor).
    prerequisite:
      "Name your exact customer first — their exact problem, and the words they use for it. Specificity wins: a list of ten right people beats a hundred maybes.",
  },

  followup: {
    stepId: "step-followup",
    title: "Set up your follow-up emails",
    plainWhat: "5 short emails that go out over 2 weeks, so no lead forgets you.",
    why: "Most people buy after 5 to 8 reminders — not after the first message.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Follow-Up Writer." },
      {
        action: "Tell Bylda about your business and customer.",
        detail: "Bylda writes all 5 emails for you.",
      },
      {
        action: "Read each email and make it sound like you.",
        detail: "Short is good — 3 to 4 sentences each.",
      },
    ],
    doneWhen: ["You have 5 emails saved and ready.", "You know which day each one goes out."],
    minutes: 15,
    toolRoute: TOOL_ROUTES["followup"],
    buttonLabel: "Start: open the Follow-Up Writer",
    mentor: {
      name: "Mo Latif",
      line: "Most deals close on touch five to eight. We write the follow-up cadence once, so no one slips.",
    },
  },

  "generate-ops-plan": {
    stepId: "step-operations-plan",
    title: "Write down how your business runs",
    plainWhat: "A simple map of how you get customers, do the work, and get paid.",
    why: "When it is written down, you can hand work to other people — or to Bylda.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Operations Planner." },
      {
        action: "Describe how things work today, step by step.",
        detail: "Be honest — include the messy parts.",
      },
      {
        action: "Circle the 3 tasks you repeat every week.",
        detail: "Those are the first ones to automate.",
      },
    ],
    doneWhen: ["Your main process is written down.", "You picked 3 tasks to automate or hand off."],
    minutes: 20,
    toolRoute: TOOL_ROUTES["generate-ops-plan"],
    buttonLabel: "Start: open the Operations Planner",
  },

  // ── BYLDA (operate & scale) tools — same plain, 5th-grade hand-holding ──
  "kpi-dashboard": {
    stepId: "step-kpi-dashboard",
    title: "Pick the numbers you'll watch",
    plainWhat: "The few key numbers that tell you if your business is healthy this week.",
    why: "You can't fix what you can't see. These numbers show you where to look first.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the KPI Dashboard Builder." },
      {
        action: "Tell Bylda your business type and size.",
        detail: "Use simple words. Bylda picks the 10 numbers that matter most for you.",
      },
      {
        action: "Choose the 5 you'll check every week.",
        detail: "Write them somewhere you'll see every Monday.",
      },
    ],
    doneWhen: [
      "You have your top 5 numbers chosen.",
      "You know what a good and bad number looks like.",
    ],
    minutes: 10,
    toolRoute: TOOL_ROUTES["kpi-dashboard"],
    buttonLabel: "Start: open the KPI Builder",
    mentor: {
      name: "Dhruv Patel",
      line: "Three numbers that tell you the truth about the business, refreshed weekly. We decide from data, not vibes.",
    },
  },

  "seo-audit": {
    stepId: "step-seo-audit",
    title: "Help people find you on Google",
    plainWhat: "A checklist that shows why your website isn't showing up — and how to fix it.",
    why: "Most buyers search Google first. If you're not there, they find someone else.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the SEO Audit tool." },
      {
        action: "Paste your website link and your main keyword.",
        detail: "The keyword is what a customer would type to find you.",
      },
      {
        action: "Do the top 3 fixes Bylda lists first.",
        detail: "Start at the top — those matter the most.",
      },
    ],
    doneWhen: ["You have your list of fixes.", "You finished the top 3."],
    minutes: 8,
    toolRoute: TOOL_ROUTES["seo-audit"],
    buttonLabel: "Start: check my website",
  },

  "launch-checklist": {
    stepId: "step-launch-checklist",
    title: "Get ready for launch day",
    plainWhat: "A countdown list of everything to do before you go live, in order.",
    why: "A launch with a plan beats a launch you rush. Nothing important gets forgotten.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Launch Checklist." },
      {
        action: "Tell Bylda what you're launching and when.",
        detail: "Bylda builds a 30, 14, 7, and 1-day to-do list for you.",
      },
      {
        action: "Do today's tasks, then check them off.",
        detail: "Just do what's due today. Come back tomorrow for the next set.",
      },
    ],
    doneWhen: ["You have your countdown checklist.", "Today's tasks are done."],
    minutes: 6,
    toolRoute: TOOL_ROUTES["launch-checklist"],
    buttonLabel: "Start: build my checklist",
  },

  "email-sequence": {
    stepId: "step-email-sequence",
    title: "Set up your follow-up emails",
    plainWhat: "A set of short emails that go out over time, so no customer forgets you.",
    why: "Most people buy after a few reminders — not the first email. This does the reminding.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Email Sequence Writer." },
      {
        action: "Tell Bylda your business and who you're emailing.",
        detail: "Bylda writes all the emails for you.",
      },
      {
        action: "Read each email and make it sound like you.",
        detail: "Keep them short — 3 to 4 sentences each.",
      },
    ],
    doneWhen: ["Your emails are saved and ready.", "You know which day each one goes out."],
    minutes: 8,
    toolRoute: TOOL_ROUTES["email-sequence"],
    buttonLabel: "Start: write my emails",
    mentor: {
      name: "Mo Latif",
      line: "Most deals close on touch five to eight. We write the follow-up cadence once, so no one slips.",
    },
  },

  "ad-copy": {
    stepId: "step-ad-copy",
    title: "Write ads that get clicks",
    plainWhat: "Ready-to-use ad text for Facebook, Google, or other platforms.",
    why: "Good ad words bring in customers for less money. Bylda writes them in seconds.",
    directions: [
      { action: "Click the purple button below.", detail: "It opens the Ad Copy Generator." },
      {
        action: "Tell Bylda your product, your customer, and the platform.",
        detail: "Bylda writes 5 different versions to try.",
      },
      {
        action: "Pick your 2 favorites to run first.",
        detail: "Test two, keep the one that works better.",
      },
    ],
    doneWhen: ["You have ad text ready to use.", "You picked the 2 to run first."],
    minutes: 8,
    toolRoute: TOOL_ROUTES["ad-copy"],
    buttonLabel: "Start: write my ads",
  },
};

// Alternate keys used by other catalogs/routes for the same tools.
const KEY_ALIASES: Record<string, string> = {
  "ops-plan": "generate-ops-plan",
  "validate-idea": "idea-validator",
  "generate-offer": "offer",
  "generate-followup-sequence": "followup",
  "gtm-strategy-builder": "gtm-strategy",
  "generate-gtm-strategy": "gtm-strategy",
  "first-10-customers-finder": "first-10-customers",
};

export function getStepGuidance(toolKey: string | null): StepGuidance | null {
  if (!toolKey) return null;
  return GUIDANCE_MAP[toolKey] ?? GUIDANCE_MAP[KEY_ALIASES[toolKey]] ?? null;
}

/** Plain generic guidance for steps that have no tool mapping yet. */
export function makeFallbackGuidance(
  title: string,
  description: string | null | undefined,
  toolKey: string | null,
): StepGuidance {
  const route = toolKey ? (TOOL_ROUTES[toolKey] ?? null) : null;
  return {
    stepId: `step-${toolKey ?? "manual"}`,
    title,
    plainWhat: description || "A small step on your path. Do it, then mark it done.",
    why: "Each finished step moves your business forward.",
    directions: route
      ? [
          { action: "Click the purple button below.", detail: "It opens the right tool." },
          { action: "Follow the questions on the screen.", detail: "Use simple words." },
          { action: "Save your result.", detail: "Then come back and mark this step done." },
        ]
      : [
          { action: "Read the step above.", detail: "It says exactly what to do." },
          {
            action: "Do it now, in the real world.",
            detail: "Small and done beats big and planned.",
          },
          { action: "Come back and mark it done.", detail: "Bylda will show your next step." },
        ],
    doneWhen: ["You did the step.", "You marked it done so Bylda can give you the next one."],
    minutes: 10,
    toolRoute: route,
    buttonLabel: route ? "Start this step" : "I did it — mark it done",
  };
}
