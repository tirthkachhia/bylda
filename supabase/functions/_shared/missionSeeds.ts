// Mission seed definitions — the single source of truth for first-mission
// content. Used by complete-onboarding (and provision-workspace for legacy
// compatibility). The N8N copy of this logic is deprecated; see n8n/README.md.

export type Lane = "Idea" | "Offer" | "Customer" | "Systems";
export type Stage = "Idea" | "Validate" | "Launch" | "Operate" | "Scale";

export interface StepSeed {
  title: string;
  description: string;
  tool_key: string | null;
}

export interface MissionSeed {
  title: string;
  description: string;
  steps: StepSeed[];
}

// Build personalized step descriptions that include the user's actual idea.
// Written at a 5th-grade reading level: clear WHY, WHAT to do, and WHAT to expect.
export function buildMissionSeed(lane: Lane, idea: string): MissionSeed {
  const ideaSnippet = idea.length > 80 ? idea.slice(0, 77) + "…" : idea;
  const ideaContext = ideaSnippet ? ` for "${ideaSnippet}"` : "";

  switch (lane) {
    case "Idea":
      return {
        title: "Validate Your Business Idea",
        description:
          `Before you spend time or money building anything, you need to know if people actually want it. ` +
          `This mission will help you test your idea${ideaContext} so you don't waste months going in the wrong direction. ` +
          `Think of it like checking your homework before you hand it in.`,
        steps: [
          {
            title: "Step 1 — Score Your Idea with the Idea Validator",
            description:
              `Click the "Run Tool" button to open the Idea Validator. ` +
              `In the text box, describe your business idea${ideaContext} as clearly as you can — ` +
              `who it's for, what problem it solves, and how you plan to make money. ` +
              `Bylda will give your idea a score from 0 to 100, plus a list of its strengths (the good parts), ` +
              `weaknesses (things to fix), and risks (things that could go wrong). ` +
              `READ every piece of feedback carefully — this is your roadmap for what to improve before you launch.`,
            tool_key: "idea-validator",
          },
          {
            title: "Step 2 — Pressure-Test It with Kill My Idea",
            description:
              `Now let Bylda play devil's advocate. Open the "Kill My Idea" tool and paste in your idea${ideaContext} again. ` +
              `Bylda will argue AGAINST your idea as hard as it can — like a skeptical investor who doesn't want to give you money. ` +
              `This is NOT meant to make you feel bad. It's meant to surface every possible objection BEFORE a real customer sees it. ` +
              `After reading Bylda's counter-arguments, write down the top 3 objections and your answers to them. ` +
              `If your answers are solid, your idea is strong. If you can't answer an objection, that's your homework.`,
            tool_key: "kill-my-idea",
          },
          {
            title: "Step 3 — Write Your One-Sentence Elevator Pitch",
            description:
              `Open a notes app or a doc. Write one sentence that explains your business to someone who has never heard of it. ` +
              `Use this fill-in-the-blank formula: "I help [WHO] to [DO WHAT] so that [BENEFIT]." ` +
              `Example: "I help small restaurant owners track their inventory automatically so they never run out of ingredients." ` +
              `Your sentence should be so simple that a 10-year-old could understand it. ` +
              `When you're happy with it, copy it somewhere safe — you will use this sentence in EVERY future step. ` +
              `Mark this step complete when your sentence is written and you'd feel comfortable saying it out loud.`,
            tool_key: null,
          },
        ],
      };

    case "Offer":
      return {
        title: "Build Your Core Offer",
        description:
          `You have an idea — now you need to turn it into something people can actually BUY. ` +
          `An "offer" is the complete package: what you sell, how much it costs, who it's for, and why they should choose you over everyone else. ` +
          `This mission will build your offer${ideaContext} from scratch, step by step.`,
        steps: [
          {
            title: "Step 1 — Design Your Offer with the Offer Builder",
            description:
              `Click "Run Tool" to open the Offer Builder. Fill in these details about your business${ideaContext}: ` +
              `(1) Who is your perfect customer? Be specific — "small business owners in the US with 1-10 employees" is better than "businesses." ` +
              `(2) What exact result do you deliver? Example: "a 5-page website live within 7 days." ` +
              `(3) How much will you charge? ` +
              `(4) What do they get for that price? List every deliverable. ` +
              `Bylda will take all of this and write a professional offer description you can put on your website and send to prospects. ` +
              `Copy the output into a Google Doc titled "My Core Offer" — you'll update this as you learn more from real customers.`,
            tool_key: "offer",
          },
          {
            title: "Step 2 — Map Your Go-To-Market Strategy",
            description:
              `Now that you know WHAT you're selling, you need a plan for HOW you'll sell it. ` +
              `Open the GTM Strategy tool and enter your offer details${ideaContext}. ` +
              `Bylda will build you a 90-day plan that covers: ` +
              `(1) Which type of customer to go after first (your "target segment"), ` +
              `(2) WHERE to find them — social media, cold email, networking, etc., ` +
              `(3) WHAT to say to get their attention (your "messaging"), ` +
              `(4) A week-by-week action calendar for the first 12 weeks. ` +
              `Print this plan or save it somewhere you'll see every day. Pick ONE channel and stick to it for at least 30 days before trying another.`,
            tool_key: "gtm-strategy",
          },
          {
            title: "Step 3 — Write Your Positioning Sentence",
            description:
              `This is the most important sentence in your business. It tells your ideal customer exactly why they should pick YOU over every other option. ` +
              `Fill in this formula: "We help [WHO] achieve [SPECIFIC RESULT] without [BIGGEST PAIN POINT] in [TIMEFRAME]." ` +
              `Example: "We help freelance designers get paid on time without chasing clients in under 24 hours." ` +
              `Bad example: "We help businesses with their needs." (Too vague!) ` +
              `Put this sentence at the TOP of your website, in your email signature, and in your social media bio. ` +
              `If a stranger reads it and immediately thinks "that's for me!" — you've nailed it. ` +
              `Mark complete when you've placed this sentence in at least 2 places people will see it.`,
            tool_key: null,
          },
        ],
      };

    case "Customer":
      return {
        title: "Land Your First 10 Paying Customers",
        description:
          `The fastest way to kill a business is to wait for customers to find you. ` +
          `This mission will give you a specific plan to go GET your first 10 customers for your business${ideaContext}. ` +
          `These won't be random people — they'll be real, paying customers who chose YOU. ` +
          `Follow each step in order. Don't skip ahead.`,
        steps: [
          {
            title: "Step 1 — Generate Your First 10 Customers Blueprint",
            description:
              `Open the "First 10 Customers" tool. Describe your business${ideaContext}, your target customer, and your price point. ` +
              `Bylda will give you a personalized list of strategies to get 10 customers in 30 days or less. ` +
              `The strategies will be specific to YOUR type of business — not generic advice. ` +
              `IMPORTANT: After reading the output, pick the TOP 2 strategies that feel most realistic for you right now. ` +
              `Write them down. Your only job this week is to execute on those 2 strategies. ` +
              `Ignore the rest until you've landed at least 3 customers from your top 2.`,
            tool_key: "first-10-customers",
          },
          {
            title: "Step 2 — Build a 5-Step Follow-Up Email Sequence",
            description:
              `Most sales don't happen on the first contact. Studies show it takes 5-8 touchpoints before someone buys. ` +
              `Open the Follow-Up Sequence tool. Enter your business${ideaContext} and your target customer type. ` +
              `Bylda will write 5 ready-to-send emails that follow up with a prospect over 2 weeks. ` +
              `Each email has a different job: introduce, provide value, handle objection, share proof, and ask for the sale. ` +
              `Copy these emails into your email tool (Gmail, Outlook, etc.) as TEMPLATES. ` +
              `Every time you reach out to a prospect, start the sequence. ` +
              `Never send a one-off email and wait — always have the next email scheduled within 3 days.`,
            tool_key: "followup",
          },
          {
            title: "Step 3 — Send Your First Real Outreach Message TODAY",
            description:
              `This step cannot be done later. Do it now. ` +
              `Think of ONE real person who fits your target customer profile. ` +
              `It can be someone you know, someone in a Facebook group, someone on LinkedIn, or a local business. ` +
              `Send them a message using this exact structure: ` +
              `"Hi [Name], I noticed [something specific about them]. I help [your target customer] to [your result]. ` +
              `Would you be open to a quick 15-minute call this week to see if I can help you?" ` +
              `Send the message. Right now. Not tomorrow. Not after you fix your website. NOW. ` +
              `Come back and mark this step complete after you've sent it. ` +
              `Add their name to your Leads board in Bylda so you can track what happens next.`,
            tool_key: null,
          },
        ],
      };

    case "Systems":
      return {
        title: "Build the Engine That Runs Your Business",
        description:
          `You have revenue — now it's time to stop being the bottleneck. ` +
          `Right now, your business probably depends on YOU doing everything. ` +
          `This mission will help you build systems so your business${ideaContext} can grow without you working 80-hour weeks. ` +
          `Think of it like building a machine that works even when you're not watching it.`,
        steps: [
          {
            title: "Step 1 — Create a Full Go-To-Market Strategy Your Team Can Run",
            description:
              `Open the GTM Strategy tool. Enter your business details${ideaContext} including your current revenue, customer type, and team size. ` +
              `Ask Bylda to build a GTM strategy that can be executed by a team member, not just you. ` +
              `The output will include: target segments to go after, channels to use, messaging scripts, and a 90-day calendar. ` +
              `AFTER you get the output, do this: for each step in the plan, write the name of WHO on your team (or a future hire) is responsible. ` +
              `If every step says "Me," that means you need to hire or delegate before you can scale. ` +
              `This document becomes the marketing playbook for your business.`,
            tool_key: "gtm-strategy",
          },
          {
            title: "Step 2 — Design Your Operations Plan",
            description:
              `An operations plan is like the instruction manual for your business. ` +
              `Open the Operations Plan tool and describe how your business currently works${ideaContext}. ` +
              `Include: how you get customers, how you deliver your product or service, how you get paid, and how you handle problems. ` +
              `Bylda will output a structured operations plan covering your team roles, key processes, tools to use, and automation opportunities. ` +
              `Focus especially on the "automation opportunities" section — these are tasks that can be done by software so you don't have to do them manually. ` +
              `Circle the top 3 tasks you personally do every week that take the most time. Those are your first automation targets.`,
            tool_key: "generate-ops-plan",
          },
          {
            title: "Step 3 — Pick One Task to Automate This Week",
            description:
              `Look at the 3 tasks you circled in Step 2. Pick the ONE that happens most often and takes the most time. ` +
              `Now write a "handoff document" for that task. It should answer: ` +
              `(1) What triggers this task? (What happens that makes it need to be done?) ` +
              `(2) What are the exact steps to complete it? (Write them out like you're explaining to a brand new employee.) ` +
              `(3) What does "done" look like? ` +
              `Once you have this document, go to the Automations page (left sidebar under Tools) and look for a pre-built workflow that matches your task. ` +
              `If you don't find an exact match, go to the Workflow Builder (same page) and create a custom automation. ` +
              `Or, take the handoff document to Zapier or Make.com to build it there. ` +
              `Mark this step complete when the automation is live and has run at least once successfully without you touching it.`,
            tool_key: null,
          },
        ],
      };
  }
}

// Operating Baseline — the operator-mode first "mission": not idea validation,
// but wiring the cockpit. Personalized with the operator's actual bottleneck.
export function buildOperatorBaseline(
  businessName: string,
  bottlenecks: string[],
  reportingGaps: string[],
): MissionSeed {
  const name = businessName || "your business";
  const topBottleneck = bottlenecks[0] || "your biggest operational drag";
  const gaps =
    reportingGaps.length > 0 ? reportingGaps.slice(0, 3).join(", ") : "revenue, pipeline, churn";

  return {
    title: "Set Up Your Operating Baseline",
    description:
      `Before Bylda can help you scale ${name}, it needs to see how the machine runs today. ` +
      `This baseline wires up your numbers, your systems, and your first automation — ` +
      `so every recommendation after this is based on YOUR real operation, not guesses. ` +
      `Most operators finish this in under an hour.`,
    steps: [
      {
        title: "Step 1 — Confirm Your KPI Set",
        description:
          `You told Bylda you don't currently see these numbers weekly: ${gaps}. ` +
          `Open the KPI Dashboard tool and describe ${name} — your business model, stage, and team size. ` +
          `Bylda will propose the 10 numbers that matter most for a business like yours, with benchmarks and red-flag thresholds. ` +
          `Pick the 5 you'll commit to reviewing every week. Write them down where you plan — this becomes your weekly scorecard.`,
        tool_key: "kpi-dashboard",
      },
      {
        title: "Step 2 — Map Your Operations",
        description:
          `Open the Operations Plan tool and describe how ${name} actually works today: ` +
          `how customers come in, how you deliver, how you get paid, and where things pile up. ` +
          `Be honest about the messy parts — that's where the leverage is. ` +
          `Bylda will return a structured ops plan with team roles, key processes, and a ranked list of automation opportunities. ` +
          `Keep the output open for Step 3.`,
        tool_key: "generate-ops-plan",
      },
      {
        title: `Step 3 — Attack Your #1 Bottleneck: ${topBottleneck}`,
        description:
          `You named "${topBottleneck}" as the thing slowing you down most. ` +
          `Bylda has built a list of automations specifically designed to solve your bottleneck. ` +
          `Go to the Automations page (in the left sidebar) and look for the workflows that target "${topBottleneck}". ` +
          `Deploy the one that matches your workflow best. ` +
          `If none fit exactly, go to the Workflow Builder and sketch the trigger → action chain for the task you do most often. ` +
          `Mark this step complete when one automation is live and has run at least once.`,
        tool_key: null,
      },
      {
        title: "Step 4 — Connect Your First Integration",
        description:
          `Bylda works best plugged into your real data. ` +
          `Go to the Integrations page (in the left sidebar under Tools) and connect the tool you rely on most for data: Stripe (payments), HubSpot (CRM), Slack (team comms), or Google Calendar. ` +
          `Once connected, Bylda automatically pulls your real numbers — no more manual data entry. ` +
          `Mark complete when at least one integration shows "connected" and is syncing data.`,
        tool_key: null,
      },
    ],
  };
}

// Server-side lane classification (mirror of src/lib/lane-classifier.ts rules,
// extended with mode + goal awareness for the two-track onboarding).
export function classifyLaneServer(opts: {
  mode: "create" | "operate";
  stage?: string;
  challenge?: string;
  goal?: string;
  revenueBand?: string;
}): Lane {
  const { mode, stage = "Idea", challenge = "", goal = "" } = opts;

  if (mode === "operate") {
    const growthBlocked = /lead|sales|customer|conversion/i.test(challenge);
    const earlyRevenue = /0-5k|5-20k/i.test(opts.revenueBand ?? "");
    return growthBlocked && earlyRevenue ? "Customer" : "Systems";
  }

  const ch = challenge.toLowerCase();
  const g = goal.toLowerCase();
  if (["Operate", "Scale"].includes(stage) && /fundrais|product/.test(ch)) return "Systems";
  if (stage === "Launch" && /fundrais/.test(ch)) return "Systems";
  if (["Launch", "Operate", "Scale"].includes(stage) && /customer|marketing/.test(ch))
    return "Customer";
  if (/first customers/.test(g) && ["Validate", "Launch"].includes(stage)) return "Customer";
  if (["Validate", "Launch"].includes(stage)) return "Offer";
  return "Idea";
}
