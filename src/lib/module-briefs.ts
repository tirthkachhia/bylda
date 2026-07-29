/**
 * Module briefs & concrete build steps.
 *
 * Every Academy module already teaches the "why" (learnContent) and the
 * outcome. This layer adds two things the founder asked for:
 *
 *   1. A tailored BRIEF — a short "why this matters for a business like yours +
 *      how to make it effective" note that adapts to the founder's business
 *      archetype (ecommerce, SaaS, service, content, or a general default).
 *   2. Concrete BUILD STEPS — an ordered, do-this-now checklist (buy the
 *      domain, connect the processor, create these accounts…) so the module
 *      feels like building the real business, not just reading theory.
 *
 * The archetype is inferred from the WorkspaceProfile the app already collects,
 * so no extra onboarding is required.
 */

import type { WorkspaceProfile } from "./workspaceProfile";

export type BusinessArchetype = "ecommerce" | "saas" | "service" | "content" | "general";

export const ARCHETYPE_LABELS: Record<BusinessArchetype, string> = {
  ecommerce: "e-commerce brand",
  saas: "software product",
  service: "service business",
  content: "content / creator business",
  general: "business",
};

/** Infer the founder's business archetype from the profile text (best-effort). */
export function inferBusinessArchetype(profile: WorkspaceProfile): BusinessArchetype {
  const hay = [profile.description, profile.revenue_model, profile.target_market]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const has = (...words: string[]) => words.some((w) => hay.includes(w));

  if (
    has(
      "ecommerce",
      "e-commerce",
      "store",
      "shopify",
      "product",
      "dropship",
      "brand",
      "retail",
      "sell physical",
      "merch",
    )
  )
    return "ecommerce";
  if (has("saas", "software", "app", "platform", "subscription", "api", "tool", "dashboard", "mrr"))
    return "saas";
  if (
    has(
      "agency",
      "consult",
      "freelance",
      "service",
      "coaching",
      "done-for-you",
      "client",
      "contractor",
    )
  )
    return "service";
  if (
    has(
      "content",
      "creator",
      "newsletter",
      "course",
      "audience",
      "youtube",
      "podcast",
      "influencer",
      "media",
    )
  )
    return "content";
  return "general";
}

export interface BuildStep {
  title: string;
  detail: string;
}

export interface ModuleBrief {
  /** Why this module matters for a business like theirs. */
  why: string;
  /** How to make it effective — the practical edge. */
  how: string;
}

type PerArchetype<T> = Partial<Record<BusinessArchetype, T>> & { general: T };

/** Tailored "why + how" brief per module, per archetype (with a general default). */
const BRIEFS: Record<string, PerArchetype<ModuleBrief>> = {
  "idea-validation": {
    general: {
      why: "Most businesses die from building something nobody wants. Validating first means every hour and dollar after this points at a real, paying problem.",
      how: "Talk to 5 potential buyers before you build. If they lean in, describe the pain in their own words, and ask 'when can I get it?' — that's your GO signal.",
    },
    ecommerce: {
      why: "In e-commerce, a weak product in a crowded niche bleeds ad spend forever. Validation confirms there's demand and margin before you order inventory.",
      how: "Check search volume and competitor reviews for the pain they complain about, then pre-sell or run a small ad test. Real clicks and 'add to cart' beat opinions.",
    },
    saas: {
      why: "Software is expensive to build and easy to over-scope. Validating the core job-to-be-done keeps you from shipping features nobody logs in for.",
      how: "Get 5 target users to describe their current workaround. If they already hack it together in spreadsheets, you've found a problem worth automating.",
    },
    service: {
      why: "A service business lives or dies on whether people will pay for the outcome. Validation confirms the outcome is painful and valuable enough to charge for.",
      how: "Offer to solve the problem for 3 people at a real price this week. A yes (with a deposit) validates faster than any survey.",
    },
    content: {
      why: "Audiences form around a specific, repeatable promise. Validating the angle means you build a following that actually converts, not just vanity views.",
      how: "Post 3 pieces on the exact angle and watch saves/shares, not likes. The topic people share is the one worth building around.",
    },
  },
  "offer-creation": {
    general: {
      why: "The offer is what people actually buy — a clear promise at a price that feels like a no-brainer. A strong offer makes marketing easy; a weak one makes it impossible.",
      how: "Name the transformation, not the features. Price against the value of the outcome, then remove risk with a guarantee so the 'yes' is obvious.",
    },
    ecommerce: {
      why: "Your offer is product + price + positioning + bundle. Getting it right lifts conversion and average order value on the same traffic.",
      how: "Anchor with a hero product, add a bundle or upsell for AOV, and lead with the one benefit that matters most to the buyer.",
    },
    saas: {
      why: "Your offer is your pricing tiers and the promise of each. Clear tiers reduce decision friction and set up expansion revenue later.",
      how: "Use 3 tiers, make the middle one the obvious pick, and tie the price to a value metric (seats, usage) that grows with the customer.",
    },
    service: {
      why: "Productizing your service into a named package with a fixed price and scope kills scope-creep and lets you sell without custom quotes every time.",
      how: "Package the outcome as a fixed-scope, fixed-price deliverable. Add a premium tier so some buyers self-select up.",
    },
    content: {
      why: "Your offer is how the audience pays you — a paid product, membership, or sponsorship. A clear offer turns attention into income.",
      how: "Start with one flagship product tied to your core topic. Presell it to your warmest followers before you build the whole thing.",
    },
  },
  branding: {
    general: {
      why: "Brand is the feeling around your offer — it's why people trust you over a cheaper stranger. Consistent voice and message make every touchpoint compound.",
      how: "Pick one core message and one voice, then repeat them everywhere. Consistency, not cleverness, is what builds recognition.",
    },
    ecommerce: {
      why: "In e-commerce, brand is the difference between a commodity and something people pay a premium for and tell friends about.",
      how: "Build a recognizable look (logo, palette, packaging feel) and a story about who it's for. Show the product in the customer's real life.",
    },
    content: {
      why: "For a content business the brand IS the product — your voice and point of view are what people follow and share.",
      how: "Lock a signature format and tone, then be relentlessly consistent so people know a piece is yours before they see your name.",
    },
  },
  website: {
    general: {
      why: "Your site is your 24/7 salesperson. It has to communicate the offer and capture the lead in under 8 seconds or the visitor is gone.",
      how: "One page, one promise, one call-to-action above the fold. Add proof (testimonials, logos) and remove every distracting link.",
    },
    ecommerce: {
      why: "Your storefront is where the money is made — every second of load time and every confusing step costs you sales.",
      how: "Fast product pages, trust badges, reviews near the buy button, and a checkout that's 2 clicks. Test the mobile flow first — that's where most buyers are.",
    },
    saas: {
      why: "Your landing page has to make a skeptical buyer 'get it' fast and start a trial or demo — that's the top of your whole funnel.",
      how: "Lead with the outcome and a product screenshot, show the before/after, and make 'Start free' the only obvious action.",
    },
    service: {
      why: "Your site's job is to book calls. Prospects need to trust you and see the outcome before they'll give you their time.",
      how: "Show results, testimonials, and a clear 'Book a call' CTA. A short case study beats a long about-page every time.",
    },
  },
  "lead-generation": {
    general: {
      why: "Revenue solves almost every startup problem, and revenue starts with a repeatable way to reach people who have the problem you solve.",
      how: "Pick ONE channel your buyers already use and go deep. Track a simple funnel: reached → replied → booked → bought.",
    },
    ecommerce: {
      why: "For e-commerce, predictable customer acquisition (and its cost) is the engine. If you can profitably acquire one customer, you can scale.",
      how: "Test one paid channel (Meta/TikTok) with 3 creatives, measure cost-per-purchase against your margin, and double down on the winner.",
    },
    saas: {
      why: "SaaS grows on a repeatable pipeline — outbound, content, or a self-serve loop. First customers also become your best product feedback.",
      how: "Do things that don't scale first: personal outreach to 10 ideal users a day. Convert them by hand, then automate what worked.",
    },
    service: {
      why: "A service business needs a steady flow of qualified conversations. Your first 10 clients come from targeted outreach, not waiting to be found.",
      how: "Build a list of 50 ideal prospects and send personalized outreach with a specific, relevant offer. Aim for calls, not pitches.",
    },
    content: {
      why: "For a creator, leads are subscribers and warm followers. Consistent publishing plus a lead magnet turns strangers into an audience you own.",
      how: "Offer a valuable freebie in exchange for an email, then nurture with your best content. Grow the list you control, not just the platform's.",
    },
  },
  automation: {
    general: {
      why: "Manual work caps your growth. Automating follow-up and admin is the unfair advantage that lets you serve more without hiring.",
      how: "Automate the highest-frequency, most-boring task first (follow-ups, receipts, reminders). Every hour you free up goes back into growth.",
    },
    ecommerce: {
      why: "Abandoned-cart and post-purchase flows recover revenue you already earned the click for — often the fastest ROI in e-commerce.",
      how: "Set up abandoned-cart, welcome, and post-purchase email/SMS flows first. They run 24/7 and typically pay for the whole stack.",
    },
    saas: {
      why: "Onboarding and lifecycle automation drive activation and retention — the metrics that actually determine whether SaaS survives.",
      how: "Automate the onboarding email sequence and in-app nudges toward the 'aha' moment. Trigger by behavior, not just time.",
    },
    service: {
      why: "Automating scheduling, intake, and follow-up removes the admin that keeps service founders stuck doing $0/hour work.",
      how: "Put booking, reminders, and proposal follow-ups on autopilot so leads never go cold while you're delivering the work.",
    },
  },
  sales: {
    general: {
      why: "Sales is a repeatable skill, not a talent. A framework, script, and objection handlers let you convert consistently instead of hoping.",
      how: "Follow a structure: understand the problem, tie your offer to it, handle the top 3 objections, then ask for the close directly.",
    },
    saas: {
      why: "For higher-ticket SaaS, a tight demo-to-close motion is the difference between trials that fizzle and revenue that lands.",
      how: "Run demos around the customer's use case, not a feature tour. End every call with a clear next step and a date.",
    },
    service: {
      why: "Service deals are won on the call. A repeatable sales conversation lets you charge premium prices without feeling salesy.",
      how: "Diagnose before you prescribe, present the packaged offer, handle price by reframing to ROI, and ask for the yes.",
    },
  },
  scaling: {
    general: {
      why: "Scaling needs systems, capital, and clarity. The plan and projections you build here are what let you grow deliberately instead of reactively.",
      how: "Model your unit economics, find the one constraint holding back growth, and put capital and systems behind removing it.",
    },
    ecommerce: {
      why: "E-commerce scales on cash flow and margin. Understanding your economics tells you how hard you can push acquisition and inventory.",
      how: "Nail contribution margin and payback period, then reinvest into the channels and SKUs with the best return.",
    },
    saas: {
      why: "SaaS scales on retention and efficient acquisition. Projections and a funding plan help you decide when to pour fuel on the fire.",
      how: "Watch net revenue retention and CAC payback. Once they're healthy, growth capital compounds instead of leaks.",
    },
  },
};

/** Concrete, do-it-now build steps per module, tailored where the archetype matters. */
const STEPS: Record<string, PerArchetype<BuildStep[]>> = {
  "idea-validation": {
    general: [
      {
        title: "Write your idea in one sentence",
        detail:
          "‘I help [who] achieve [outcome] by [how].’ If you can't, the idea isn't clear enough yet.",
      },
      {
        title: "Run the Idea Validator",
        detail: "Get a scored GO/ITERATE/KILL verdict and a market read on demand and competition.",
      },
      {
        title: "Talk to 5 real potential buyers",
        detail: "Ask about the problem, not your solution. Listen for urgency and existing spend.",
      },
      {
        title: "Stress-test with Kill My Idea",
        detail: "Face the strongest objections now, while changing direction is still cheap.",
      },
    ],
    ecommerce: [
      {
        title: "Pick the product and the buyer",
        detail: "One hero product, one specific customer. Note the pain it removes.",
      },
      {
        title: "Check demand & margin",
        detail:
          "Search volume, competitor reviews, and landed cost vs. sell price — you need room to profit after ads.",
      },
      {
        title: "Run the Idea Validator",
        detail: "Get a GO/ITERATE/KILL verdict on the niche before ordering inventory.",
      },
      {
        title: "Pre-sell or ad-test",
        detail: "A small ad or pre-order page tells you if strangers will actually pay.",
      },
    ],
  },
  "offer-creation": {
    general: [
      {
        title: "Define the transformation",
        detail: "Before → after. What does life look like once your offer works?",
      },
      {
        title: "Set the price",
        detail: "Use the Pricing tool to anchor price to the value of the outcome, not your costs.",
      },
      {
        title: "Generate your pitch",
        detail: "Run the Pitch Generator to turn the offer into a clear promise you can repeat.",
      },
      {
        title: "Add a risk-reversal",
        detail: "A guarantee or trial removes the fear that stops the ‘yes’.",
      },
    ],
    ecommerce: [
      {
        title: "Choose your hero offer",
        detail: "Lead product + price + the one benefit that matters most.",
      },
      {
        title: "Build a bundle or upsell",
        detail: "Raise average order value with a complementary add-on at checkout.",
      },
      {
        title: "Set pricing & margin",
        detail: "Confirm the price leaves margin after cost, shipping, and ad spend.",
      },
      {
        title: "Write the promise",
        detail: "One line a stranger understands in 3 seconds — run the Pitch Generator.",
      },
    ],
    saas: [
      {
        title: "Design 3 pricing tiers",
        detail: "Make the middle tier the obvious pick; tie price to a value metric.",
      },
      {
        title: "Name each tier's promise",
        detail: "What outcome does each unlock? Features are proof, not the promise.",
      },
      {
        title: "Set a value metric",
        detail: "Seats, usage, or workspaces — something that grows as the customer succeeds.",
      },
      {
        title: "Generate the pitch",
        detail: "Turn the tiers into a landing-ready promise with the Pitch Generator.",
      },
    ],
  },
  branding: {
    general: [
      {
        title: "Lock your core message",
        detail: "One sentence you'll repeat everywhere. Consistency builds recognition.",
      },
      {
        title: "Define your voice",
        detail: "Pick 3 adjectives for how you sound, then write to them every time.",
      },
      {
        title: "Create first content",
        detail: "Use the Blog/Content tool to publish your first on-brand piece.",
      },
      {
        title: "Set up your presence",
        detail: "Claim your handle on the one platform your buyers actually use.",
      },
    ],
    ecommerce: [
      {
        title: "Design a recognizable look",
        detail: "Logo, palette, and packaging feel that reads premium at a glance.",
      },
      {
        title: "Tell the ‘who it's for’ story",
        detail: "Position around the customer's identity, not just the product specs.",
      },
      {
        title: "Shoot lifestyle imagery",
        detail: "Show the product in the customer's real life — social proof and desire in one.",
      },
      {
        title: "Publish your first content",
        detail: "Run the Content tool to launch an on-brand post or email.",
      },
    ],
  },
  website: {
    general: [
      {
        title: "Buy your domain",
        detail: "Grab a clean .com on Namecheap or Cloudflare. Short and memorable beats clever.",
      },
      {
        title: "Generate landing copy",
        detail: "Use the Landing Page tool: one promise, one CTA, proof, no distractions.",
      },
      {
        title: "Publish the page",
        detail: "Ship it on a simple builder and point your domain's DNS at it.",
      },
      {
        title: "Add lead capture",
        detail: "Wire the form to collect emails so no visitor is wasted.",
      },
    ],
    ecommerce: [
      {
        title: "Buy your domain",
        detail: "Register a clean .com and connect it to your store platform (e.g. Shopify).",
      },
      {
        title: "Set up the store & product pages",
        detail: "Fast pages, clear photos, reviews near the buy button.",
      },
      {
        title: "Connect a payment processor",
        detail: "Set up Stripe/Shop Pay so you can actually take money — test a live checkout.",
      },
      {
        title: "Add trust & a 2-click checkout",
        detail: "Trust badges, returns policy, and the shortest possible mobile checkout.",
      },
    ],
    saas: [
      {
        title: "Buy your domain",
        detail: "Register the .com and point DNS at your marketing page and app subdomain.",
      },
      {
        title: "Generate the landing page",
        detail: "Outcome headline, product screenshot, before/after, ‘Start free’ CTA.",
      },
      {
        title: "Wire up sign-up",
        detail: "Connect auth so a visitor can start a trial in one click.",
      },
      {
        title: "Add analytics",
        detail: "Drop in basic analytics so you can see where trials drop off.",
      },
    ],
    service: [
      {
        title: "Buy your domain",
        detail: "Register a professional .com and a matching business email.",
      },
      {
        title: "Build a book-a-call page",
        detail: "Results, testimonials, and a single ‘Book a call’ CTA.",
      },
      {
        title: "Connect a scheduler",
        detail: "Wire Calendly/Cal.com so prospects can book without back-and-forth.",
      },
      {
        title: "Add one case study",
        detail: "A short before/after story does more than a long about-page.",
      },
    ],
  },
  "lead-generation": {
    general: [
      {
        title: "Pick ONE channel",
        detail: "Where do your buyers already hang out? Go deep on one before adding a second.",
      },
      {
        title: "Build a list of 50 prospects",
        detail: "Use First 10 Customers to find and qualify people with the problem.",
      },
      {
        title: "Write your outreach",
        detail: "A short, specific, relevant message — offer value, ask for a conversation.",
      },
      {
        title: "Track the funnel",
        detail: "Reached → replied → booked → bought. Fix the biggest drop-off first.",
      },
    ],
    ecommerce: [
      {
        title: "Create 3 ad creatives",
        detail: "Different hooks for the same product — let the market pick the winner.",
      },
      {
        title: "Launch a small paid test",
        detail: "Set a modest daily budget on Meta/TikTok and measure cost-per-purchase.",
      },
      {
        title: "Compare CAC to margin",
        detail: "If a customer costs less than the margin they bring, you have an engine.",
      },
      {
        title: "Scale the winner",
        detail: "Kill losers fast, pour budget into the profitable creative and audience.",
      },
    ],
    service: [
      {
        title: "Define your ideal client",
        detail: "Industry, size, and the exact trigger that makes them need you now.",
      },
      {
        title: "Build a 50-prospect list",
        detail: "Use First 10 Customers to source and qualify targeted leads.",
      },
      {
        title: "Send personalized outreach",
        detail:
          "Reference something specific; offer a clear, relevant outcome — book calls, don't pitch.",
      },
      {
        title: "Follow up 3 times",
        detail: "Most replies come after the first message. Persistence (politely) wins deals.",
      },
    ],
  },
  automation: {
    general: [
      {
        title: "List your repetitive tasks",
        detail:
          "Write down everything you do more than 3x a week — that's your automation backlog.",
      },
      {
        title: "Automate follow-up first",
        detail: "Use the GTM/automation tools to never let a lead go cold again.",
      },
      {
        title: "Connect your CRM pipeline",
        detail: "Every lead lands in one place with a clear next step and owner.",
      },
      {
        title: "Add lead capture triggers",
        detail: "New form fill → tagged, emailed, and queued automatically.",
      },
    ],
    ecommerce: [
      {
        title: "Set up abandoned-cart flow",
        detail: "Recover the sales you already paid for the click on — usually the fastest ROI.",
      },
      {
        title: "Build a welcome series",
        detail: "New subscribers get a 3-email intro that drives a first purchase.",
      },
      {
        title: "Add post-purchase flow",
        detail: "Thank, cross-sell, and request a review to lift repeat rate and social proof.",
      },
      {
        title: "Connect email/SMS",
        detail: "Wire Klaviyo or similar so the flows run 24/7 without you.",
      },
    ],
    saas: [
      {
        title: "Map the ‘aha’ moment",
        detail: "The action that makes a user get value — everything should push toward it.",
      },
      {
        title: "Automate onboarding emails",
        detail: "A behavior-triggered sequence that walks users to activation.",
      },
      {
        title: "Add in-app nudges",
        detail: "Prompt the next best action based on what the user has (and hasn't) done.",
      },
      {
        title: "Trigger by behavior",
        detail: "Fire messages on events, not just time, so they always feel relevant.",
      },
    ],
  },
  sales: {
    general: [
      {
        title: "Script the conversation",
        detail: "Use the Pitch Generator to structure: problem → offer → proof → close.",
      },
      {
        title: "List your top 3 objections",
        detail: "Write the honest answer to each so you're never caught flat-footed.",
      },
      {
        title: "Practice the close",
        detail: "Ask directly for the decision and a date. Silence after the ask is your friend.",
      },
      {
        title: "Review every lost deal",
        detail: "One note per loss reveals the pattern you can fix next week.",
      },
    ],
    service: [
      {
        title: "Build your call framework",
        detail: "Diagnose before prescribing; present the packaged offer, not a custom quote.",
      },
      {
        title: "Prepare ROI reframes",
        detail: "Translate your price into the return the client gets — handle price by value.",
      },
      {
        title: "Create a proposal template",
        detail: "Fixed scope, fixed price, clear next step — send within an hour of the call.",
      },
      {
        title: "Ask for the yes",
        detail: "End every call with a specific commitment and a start date.",
      },
    ],
  },
  scaling: {
    general: [
      {
        title: "Build your business plan",
        detail: "Use the Business Plan tool to turn the model into a document you can act on.",
      },
      {
        title: "Model revenue projections",
        detail: "Run the Revenue Projector to see the path and the assumptions behind it.",
      },
      {
        title: "Find the one constraint",
        detail: "Name the single bottleneck capping growth right now — fix that first.",
      },
      {
        title: "Check funding readiness",
        detail: "Run the Funding Score to see if (and when) outside capital makes sense.",
      },
    ],
    ecommerce: [
      {
        title: "Nail your unit economics",
        detail: "Contribution margin and payback period per order — the numbers that gate scale.",
      },
      {
        title: "Project revenue & cash",
        detail: "Model inventory and ad spend against cash flow so growth doesn't starve you.",
      },
      {
        title: "Double down on winners",
        detail: "Reinvest into the best SKUs and channels; cut the rest.",
      },
      {
        title: "Assess funding readiness",
        detail: "Run the Funding Score to decide if capital would accelerate or distract.",
      },
    ],
  },
};

function pick<T>(map: PerArchetype<T>, archetype: BusinessArchetype): T {
  return map[archetype] ?? map.general;
}

/** Tailored why/how brief for a module, adapted to the founder's business. */
export function getModuleBrief(moduleId: string, archetype: BusinessArchetype): ModuleBrief | null {
  const map = BRIEFS[moduleId];
  return map ? pick(map, archetype) : null;
}

/** Concrete build steps for a module, adapted to the founder's business. */
export function getBuildSteps(moduleId: string, archetype: BusinessArchetype): BuildStep[] {
  const map = STEPS[moduleId];
  return map ? pick(map, archetype) : [];
}
