// Prebuilt automation recipes — GoHighLevel-style "start from a proven workflow"
// presets. Each recipe is a ready-to-edit sequence of builder blocks the user
// can load onto the canvas with one click, then customize and publish.
//
// Recipes reference block types from automation-blocks.ts. They are static
// content (no DB) so they always work, even on a brand-new workspace.

import type { BlockType } from "./automation-blocks";

export interface RecipeBlock {
  type: BlockType;
  label?: string;
  config?: Record<string, string>;
}

export type RecipeCategory =
  | "lead-nurture"
  | "booking"
  | "sales"
  | "retention"
  | "reputation"
  | "onboarding";

export interface AutomationRecipe {
  slug: string;
  name: string;
  description: string;
  category: RecipeCategory;
  emoji: string;
  triggerSummary: string;
  tags: string[];
  blocks: RecipeBlock[];
}

export const RECIPE_CATEGORY_META: Record<RecipeCategory, { label: string }> = {
  "lead-nurture": { label: "Lead Nurture" },
  booking: { label: "Booking & Appointments" },
  sales: { label: "Sales & Pipeline" },
  retention: { label: "Retention & Win-back" },
  reputation: { label: "Reviews & Reputation" },
  onboarding: { label: "Client Onboarding" },
};

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  {
    slug: "speed-to-lead",
    name: "Speed-to-Lead (5-minute response)",
    description:
      "The moment a new lead comes in, fire an instant SMS + email, then alert your team so no lead waits more than 5 minutes.",
    category: "lead-nurture",
    emoji: "⚡",
    triggerSummary: "When a new lead arrives",
    tags: ["new lead", "sms", "instant"],
    blocks: [
      { type: "trigger_new_lead", config: { source: "Any source" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "Hi {{lead.name}}, thanks for reaching out! When's a good time to chat?",
        },
      },
      {
        type: "action_send_email",
        config: {
          to: "{{lead.email}}",
          subject: "Thanks for reaching out, {{lead.name}}",
          body: "We just got your message and will follow up shortly. In the meantime, reply with the best time to talk.",
        },
      },
      {
        type: "action_notify_team",
        config: { channel: "Both", message: "🔥 New lead: {{lead.name}} — respond within 5 min" },
      },
      { type: "action_add_tag", config: { tag: "Speed-to-lead" } },
    ],
  },
  {
    slug: "long-term-nurture",
    name: "Long-Term Nurture (cold leads)",
    description:
      "Drip value to cold leads over several days, scoring engagement and escalating anyone who heats up to your team.",
    category: "lead-nurture",
    emoji: "🌱",
    triggerSummary: 'When tag "Cold lead" is added',
    tags: ["nurture", "drip", "email"],
    blocks: [
      { type: "trigger_tag_added", config: { tag: "Cold lead" } },
      {
        type: "ai_generate",
        config: {
          output_type: "Personalized email",
          context: "Lead a helpful, no-pressure value email based on their industry.",
        },
      },
      {
        type: "action_send_email",
        config: { to: "{{lead.email}}", subject: "A quick idea for {{lead.company}}" },
      },
      { type: "logic_wait", config: { duration: "3 days" } },
      { type: "ai_score", config: { what_to_score: "Email engagement", scale: "1–100" } },
      { type: "logic_if_branch", config: { condition: "Engagement score > 60" } },
      {
        type: "action_notify_team",
        config: { channel: "Slack channel", message: "Warm lead heating up: {{lead.name}}" },
      },
      { type: "goal_check", config: { goal: "Booked a call", if_not_met: "Send follow-up" } },
    ],
  },
  {
    slug: "appointment-reminders",
    name: "Appointment Reminders & No-Show Rescue",
    description:
      "Confirm bookings, send 24h + 1h reminders, and automatically re-book anyone who no-shows.",
    category: "booking",
    emoji: "📅",
    triggerSummary: "When an appointment is booked",
    tags: ["appointments", "reminders", "no-show"],
    blocks: [
      { type: "trigger_appointment_booked", config: { status: "Booked" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "You're booked! See you {{appointment.time}}. Reply C to confirm.",
        },
      },
      { type: "logic_wait_until", config: { until: "24 hours before appointment" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "Reminder: your appointment is tomorrow at {{appointment.time}}.",
        },
      },
      { type: "logic_wait_until", config: { until: "1 hour before appointment" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "See you in an hour! Here's the address/link: {{appointment.location}}",
        },
      },
      { type: "logic_if_branch", config: { condition: "Appointment = No-show" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "Sorry we missed you — want to grab a new time? {{calendar.link}}",
        },
      },
    ],
  },
  {
    slug: "abandoned-checkout",
    name: "Abandoned Checkout Recovery",
    description:
      "Win back customers who almost bought with a timed email + SMS nudge and an optional incentive.",
    category: "sales",
    emoji: "🛒",
    triggerSummary: "When a checkout is abandoned",
    tags: ["ecommerce", "recovery", "sales"],
    blocks: [
      { type: "trigger_abandoned_checkout", config: { min_value: "$50" } },
      { type: "logic_wait", config: { duration: "1 hour" } },
      {
        type: "action_send_email",
        config: {
          to: "{{lead.email}}",
          subject: "You left something behind 👀",
          body: "Your cart is still saved — finish checking out here: {{checkout.link}}",
        },
      },
      { type: "logic_wait", config: { duration: "1 day" } },
      { type: "logic_if_branch", config: { condition: "Purchase not completed" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "Still thinking it over? Here's 10% off to finish up: {{checkout.link}}",
        },
      },
      { type: "goal_check", config: { goal: "Made a purchase", if_not_met: "Mark as lost" } },
    ],
  },
  {
    slug: "pipeline-mover",
    name: "Pipeline Auto-Mover",
    description:
      "Keep your pipeline clean: qualify inbound leads with AI, move stages automatically, and assign an owner round-robin.",
    category: "sales",
    emoji: "📊",
    triggerSummary: "When a new lead arrives",
    tags: ["pipeline", "qualification", "routing"],
    blocks: [
      { type: "trigger_new_lead", config: { source: "Website form" } },
      {
        type: "ai_classify",
        config: { what_to_classify: "Lead intent", categories: "Hot, Warm, Cold" },
      },
      { type: "logic_if_branch", config: { condition: "Intent = Hot" } },
      { type: "action_move_stage", config: { stage: "Qualified" } },
      { type: "action_assign_owner", config: { mode: "Round-robin team", who: "Sales team" } },
      {
        type: "action_create_task",
        config: { title: "Call {{lead.name}} today", due_in: "1 hour" },
      },
      { type: "action_add_note", config: { note: "Auto-qualified by AI as a hot lead." } },
    ],
  },
  {
    slug: "review-request",
    name: "5-Star Review Request",
    description:
      "After a job is done or payment lands, ask happy customers for a Google review and route unhappy ones to private feedback.",
    category: "reputation",
    emoji: "⭐",
    triggerSummary: "When a payment is received",
    tags: ["reviews", "reputation", "google"],
    blocks: [
      { type: "trigger_payment", config: {} },
      { type: "logic_wait", config: { duration: "1 day" } },
      {
        type: "action_send_sms",
        config: { to: "{{lead.phone}}", message: "How did we do, {{lead.name}}? (1–5)" },
      },
      { type: "logic_if_branch", config: { condition: "Rating >= 4" } },
      { type: "action_review_request", config: { platform: "Google", channel: "SMS" } },
      { type: "logic_if_branch", config: { condition: "Rating < 4" } },
      {
        type: "action_notify_team",
        config: {
          channel: "Both",
          message: "⚠️ Low rating from {{lead.name}} — follow up personally",
        },
      },
    ],
  },
  {
    slug: "reengage-dormant",
    name: "Win-Back Dormant Customers",
    description:
      "Spot customers who've gone quiet and re-engage them with a personalized, AI-written offer.",
    category: "retention",
    emoji: "💤",
    triggerSummary: "On a schedule",
    tags: ["win-back", "retention", "re-engage"],
    blocks: [
      { type: "trigger_schedule", config: { schedule: "Every Monday" } },
      { type: "memory_read", config: { what_to_recall: "Past purchases and last contact date" } },
      { type: "logic_if_branch", config: { condition: "No activity in 60 days" } },
      {
        type: "ai_generate",
        config: {
          output_type: "Follow-up message",
          context: "Warm, personal win-back referencing what they bought before.",
        },
      },
      {
        type: "action_send_email",
        config: { to: "{{lead.email}}", subject: "We miss you, {{lead.name}}" },
      },
      { type: "action_add_tag", config: { tag: "Win-back sent" } },
    ],
  },
  {
    slug: "client-onboarding",
    name: "New Client Onboarding",
    description:
      "Give every new client a flawless first week: welcome, gather details, schedule kickoff, and notify the delivery team.",
    category: "onboarding",
    emoji: "🤝",
    triggerSummary: 'When tag "New client" is added',
    tags: ["onboarding", "clients", "kickoff"],
    blocks: [
      { type: "trigger_tag_added", config: { tag: "New client" } },
      {
        type: "action_send_email",
        config: {
          to: "{{lead.email}}",
          subject: "Welcome aboard, {{lead.name}}! 🎉",
          body: "Here's what happens next + a link to book your kickoff call.",
        },
      },
      {
        type: "action_create_task",
        config: { title: "Prep onboarding doc for {{lead.company}}", due_in: "1 day" },
      },
      { type: "logic_wait", config: { duration: "2 days" } },
      { type: "logic_if_branch", config: { condition: "Kickoff not booked" } },
      {
        type: "action_send_sms",
        config: {
          to: "{{lead.phone}}",
          message: "Hi {{lead.name}}! Don't forget to book your kickoff: {{calendar.link}}",
        },
      },
      {
        type: "action_notify_team",
        config: {
          channel: "Slack channel",
          message: "New client onboarding started: {{lead.company}}",
        },
      },
    ],
  },
];

export const RECIPE_BY_SLUG: Record<string, AutomationRecipe> = Object.fromEntries(
  AUTOMATION_RECIPES.map((r) => [r.slug, r]),
);
