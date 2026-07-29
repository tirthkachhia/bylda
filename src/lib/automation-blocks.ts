// Shared automation block catalog — the single source of truth for the visual
// Builder (src/routes/app.builder.tsx), the recipe library, and the published
// template marketplace. Expanded to reach feature parity with GoHighLevel
// workflows and HubSpot sequences/workflows (triggers, actions, logic, AI).

import {
  Zap,
  Mail,
  MessageSquare,
  GitBranch,
  Clock,
  Brain,
  Target,
  Database,
  Globe,
  Calendar,
  Bell,
  CheckCircle2,
  Sparkles,
  Radio,
  ChevronRight,
  Tag,
  TagsIcon,
  Users,
  Phone,
  Voicemail,
  Star,
  ShoppingCart,
  UserPlus,
  Repeat,
  SplitSquareHorizontal,
  Hourglass,
  ListPlus,
  ListX,
  PenLine,
  StickyNote,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
export type BlockCategory = "trigger" | "action" | "logic" | "ai" | "memory";

export type BlockType =
  // Triggers
  | "trigger_new_lead"
  | "trigger_form_submit"
  | "trigger_schedule"
  | "trigger_webhook"
  | "trigger_payment"
  | "trigger_tag_added"
  | "trigger_appointment_booked"
  | "trigger_email_event"
  | "trigger_pipeline_stage"
  | "trigger_contact_replied"
  | "trigger_birthday"
  | "trigger_call_status"
  | "trigger_abandoned_checkout"
  | "trigger_contact_created"
  | "trigger_contact_changed"
  // Actions
  | "action_send_email"
  | "action_send_sms"
  | "action_update_crm"
  | "action_create_task"
  | "action_notify_team"
  | "action_webhook_out"
  | "action_add_tag"
  | "action_remove_tag"
  | "action_move_stage"
  | "action_create_opportunity"
  | "action_assign_owner"
  | "action_send_voicemail"
  | "action_add_to_workflow"
  | "action_remove_from_workflow"
  | "action_set_field"
  | "action_add_note"
  | "action_review_request"
  // Logic
  | "logic_if_branch"
  | "logic_wait"
  | "logic_wait_until"
  | "logic_loop"
  | "logic_split_test"
  // AI
  | "ai_classify"
  | "ai_generate"
  | "ai_score"
  // Memory & goals
  | "memory_write"
  | "memory_read"
  | "goal_check";

export interface BlockConfig {
  [key: string]: string;
}

/**
 * A single lane underneath a branching block (If/Else → Yes/No,
 * A/B Split → Path A/Path B). Each lane is its own ordered list of blocks,
 * so the canvas and the runtime can both treat a workflow as a tree.
 */
export interface WorkflowBranch {
  id: string;
  label: string;
  blocks: WorkflowBlock[];
}

export interface WorkflowBlock {
  id: string;
  type: BlockType;
  label: string;
  config: BlockConfig;
  /**
   * Present on branching blocks (logic_if_branch / logic_split_test). Each entry
   * is a nested lane of blocks that only runs when that branch is taken. Absent
   * (or empty) means the block runs linearly — keeps older flat workflows valid.
   */
  branches?: WorkflowBranch[];
}

export interface PaletteConfigField {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "textarea" | "select";
  options?: string[];
}

export interface PaletteBlock {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: BlockCategory;
  color: string;
  configFields: PaletteConfigField[];
}

/* ─── Palette ───────────────────────────────────────────── */
export const PALETTE_BLOCKS: PaletteBlock[] = [
  /* ── TRIGGERS ── */
  {
    type: "trigger_new_lead",
    label: "New Lead",
    description: "When a new lead arrives in your CRM",
    icon: Zap,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "source",
        label: "Lead source",
        type: "select",
        options: ["Any source", "Website form", "Ad campaign", "Manual entry"],
      },
    ],
  },
  {
    type: "trigger_form_submit",
    label: "Form Submitted",
    description: "When someone fills out a form or survey",
    icon: Globe,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "form_name",
        label: "Form name or URL",
        placeholder: "e.g. Contact form, Waitlist form",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_schedule",
    label: "Scheduled Time",
    description: "Run at a specific time or on repeat",
    icon: Calendar,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "schedule",
        label: "When to run",
        type: "select",
        options: ["Every day at 9am", "Every Monday", "First of month", "Every hour", "Custom"],
      },
    ],
  },
  {
    type: "trigger_webhook",
    label: "Webhook",
    description: "When data arrives from an outside app",
    icon: Radio,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "endpoint_note",
        label: "What triggers this?",
        placeholder: "e.g. Stripe payment, Typeform response",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_payment",
    label: "Payment Received",
    description: "When a customer pays via Stripe",
    icon: CheckCircle2,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "amount_filter",
        label: "Minimum amount (optional)",
        placeholder: "e.g. $100",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_tag_added",
    label: "Tag Added",
    description: "When a tag is applied to a contact",
    icon: Tag,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "tag",
        label: "Which tag?",
        placeholder: "e.g. VIP, Hot lead, Webinar registrant",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_appointment_booked",
    label: "Appointment Booked",
    description: "When a contact books a call or appointment",
    icon: Calendar,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "calendar",
        label: "Which calendar?",
        placeholder: "e.g. Discovery call, Demo",
        type: "text",
      },
      {
        key: "status",
        label: "Appointment status",
        type: "select",
        options: ["Booked", "Confirmed", "Showed", "No-show", "Cancelled"],
      },
    ],
  },
  {
    type: "trigger_email_event",
    label: "Email Event",
    description: "When an email is opened, clicked, or bounced",
    icon: Mail,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "event",
        label: "Which event?",
        type: "select",
        options: ["Opened", "Clicked a link", "Replied", "Bounced", "Unsubscribed"],
      },
    ],
  },
  {
    type: "trigger_pipeline_stage",
    label: "Stage Changed",
    description: "When an opportunity moves pipeline stage",
    icon: GitBranch,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "stage",
        label: "Moved into stage",
        placeholder: "e.g. Qualified, Proposal sent, Won",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_contact_replied",
    label: "Customer Replied",
    description: "When a contact replies by SMS or email",
    icon: MessageSquare,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "channel",
        label: "Reply channel",
        type: "select",
        options: ["Any", "SMS", "Email", "WhatsApp"],
      },
    ],
  },
  {
    type: "trigger_birthday",
    label: "Birthday / Date",
    description: "On a contact's birthday or a custom date field",
    icon: Star,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "date_field",
        label: "Which date?",
        placeholder: "e.g. Birthday, Renewal date, Contract end",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_call_status",
    label: "Call Status",
    description: "When an inbound or outbound call completes",
    icon: Phone,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "status",
        label: "Call result",
        type: "select",
        options: ["Completed", "Missed", "Voicemail", "Busy", "No answer"],
      },
    ],
  },
  {
    type: "trigger_abandoned_checkout",
    label: "Abandoned Checkout",
    description: "When a customer starts but doesn't finish a purchase",
    icon: ShoppingCart,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "min_value",
        label: "Minimum cart value (optional)",
        placeholder: "e.g. $50",
        type: "text",
      },
    ],
  },
  {
    type: "trigger_contact_created",
    label: "Contact Created",
    description: "When a brand-new contact is added",
    icon: UserPlus,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "source",
        label: "Created from",
        type: "select",
        options: ["Any source", "Import", "Form", "Manual", "API / integration"],
      },
    ],
  },
  {
    type: "trigger_contact_changed",
    label: "Property Changed",
    description: "When a contact field/property value changes",
    icon: PenLine,
    category: "trigger",
    color: "orange",
    configFields: [
      {
        key: "field",
        label: "Which property?",
        placeholder: "e.g. Lifecycle stage, Lead score, Status",
        type: "text",
      },
    ],
  },

  /* ── ACTIONS ── */
  {
    type: "action_send_email",
    label: "Send Email",
    description: "Send an email to a contact or list",
    icon: Mail,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "to",
        label: "Send to",
        placeholder: "e.g. {{lead.email}} or team@company.com",
        type: "text",
      },
      {
        key: "subject",
        label: "Subject line",
        placeholder: "e.g. Your {{product}} is ready!",
        type: "text",
      },
      {
        key: "body",
        label: "Email body",
        placeholder: "Write the email content here...",
        type: "textarea",
      },
    ],
  },
  {
    type: "action_send_sms",
    label: "Send SMS",
    description: "Send a text message via Twilio",
    icon: MessageSquare,
    category: "action",
    color: "blue",
    configFields: [
      { key: "to", label: "Phone number", placeholder: "e.g. {{lead.phone}}", type: "text" },
      {
        key: "message",
        label: "Message",
        placeholder: "Keep it under 160 characters",
        type: "textarea",
      },
    ],
  },
  {
    type: "action_update_crm",
    label: "Update CRM",
    description: "Change a lead's stage or add a note",
    icon: Database,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "field",
        label: "What to update",
        type: "select",
        options: ["Lead stage", "Lead score", "Add tag", "Add note", "Assign owner"],
      },
      { key: "value", label: "New value", placeholder: "e.g. Qualified, Hot lead", type: "text" },
    ],
  },
  {
    type: "action_create_task",
    label: "Create Task",
    description: "Add a to-do or follow-up task",
    icon: CheckCircle2,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "title",
        label: "Task title",
        placeholder: "e.g. Follow up with {{lead.name}}",
        type: "text",
      },
      {
        key: "due_in",
        label: "Due in",
        type: "select",
        options: ["1 hour", "1 day", "3 days", "1 week"],
      },
    ],
  },
  {
    type: "action_notify_team",
    label: "Notify Team",
    description: "Alert your team via Slack or email",
    icon: Bell,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "channel",
        label: "Where to notify",
        type: "select",
        options: ["Slack channel", "Email to team", "Both"],
      },
      {
        key: "message",
        label: "Message",
        placeholder: "e.g. New hot lead: {{lead.name}} — {{lead.company}}",
        type: "textarea",
      },
    ],
  },
  {
    type: "action_webhook_out",
    label: "Call Webhook",
    description: "Send data to any external app",
    icon: Globe,
    category: "action",
    color: "blue",
    configFields: [
      { key: "url", label: "Webhook URL", placeholder: "https://...", type: "text" },
      {
        key: "note",
        label: "What this connects to",
        placeholder: "e.g. Zapier, Make.com, custom app",
        type: "text",
      },
    ],
  },
  {
    type: "action_add_tag",
    label: "Add Tag",
    description: "Apply a tag to the contact",
    icon: Tag,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "tag",
        label: "Tag to add",
        placeholder: "e.g. Nurtured, Replied, Booked",
        type: "text",
      },
    ],
  },
  {
    type: "action_remove_tag",
    label: "Remove Tag",
    description: "Remove a tag from the contact",
    icon: TagsIcon,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "tag",
        label: "Tag to remove",
        placeholder: "e.g. Cold lead, Unresponsive",
        type: "text",
      },
    ],
  },
  {
    type: "action_move_stage",
    label: "Move Pipeline Stage",
    description: "Move the opportunity to a new stage",
    icon: GitBranch,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "stage",
        label: "Move to stage",
        placeholder: "e.g. Qualified, Proposal sent, Won",
        type: "text",
      },
    ],
  },
  {
    type: "action_create_opportunity",
    label: "Create Opportunity",
    description: "Open a new deal in a pipeline",
    icon: Target,
    category: "action",
    color: "blue",
    configFields: [
      { key: "pipeline", label: "Pipeline", placeholder: "e.g. Sales pipeline", type: "text" },
      { key: "value", label: "Estimated value", placeholder: "e.g. $2,500", type: "text" },
    ],
  },
  {
    type: "action_assign_owner",
    label: "Assign Owner",
    description: "Assign or round-robin the contact to a user",
    icon: Users,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "mode",
        label: "How to assign",
        type: "select",
        options: ["Round-robin team", "Specific user", "Least busy", "By territory"],
      },
      { key: "who", label: "User / team (optional)", placeholder: "e.g. Sales team", type: "text" },
    ],
  },
  {
    type: "action_send_voicemail",
    label: "Ringless Voicemail",
    description: "Drop a pre-recorded voicemail without ringing",
    icon: Voicemail,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "recording",
        label: "Recording / script",
        placeholder: "Reference the audio or describe the message",
        type: "textarea",
      },
    ],
  },
  {
    type: "action_add_to_workflow",
    label: "Add to Workflow",
    description: "Enroll the contact into another workflow",
    icon: ListPlus,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "workflow",
        label: "Which workflow?",
        placeholder: "e.g. Long-term nurture, Onboarding",
        type: "text",
      },
    ],
  },
  {
    type: "action_remove_from_workflow",
    label: "Remove from Workflow",
    description: "Unenroll the contact from a workflow",
    icon: ListX,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "workflow",
        label: "Which workflow?",
        placeholder: "e.g. Cold outreach, This workflow",
        type: "text",
      },
    ],
  },
  {
    type: "action_set_field",
    label: "Set Field Value",
    description: "Write a value to a contact property / custom field",
    icon: PenLine,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "field",
        label: "Field / property",
        placeholder: "e.g. Lifecycle stage",
        type: "text",
      },
      { key: "value", label: "New value", placeholder: "e.g. Customer, MQL", type: "text" },
    ],
  },
  {
    type: "action_add_note",
    label: "Add Note",
    description: "Log a note on the contact's timeline",
    icon: StickyNote,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "note",
        label: "Note",
        placeholder: "e.g. Auto-enrolled from webinar follow-up",
        type: "textarea",
      },
    ],
  },
  {
    type: "action_review_request",
    label: "Request Review",
    description: "Ask the customer for a Google / Facebook review",
    icon: Star,
    category: "action",
    color: "blue",
    configFields: [
      {
        key: "platform",
        label: "Where to send them",
        type: "select",
        options: ["Google", "Facebook", "Both", "Custom link"],
      },
      {
        key: "channel",
        label: "Send via",
        type: "select",
        options: ["SMS", "Email", "Both"],
      },
    ],
  },

  /* ── LOGIC ── */
  {
    type: "logic_if_branch",
    label: "If / Else",
    description: "Take a different path based on a condition",
    icon: GitBranch,
    category: "logic",
    color: "purple",
    configFields: [
      {
        key: "condition",
        label: "If this is true…",
        placeholder: "e.g. Lead score > 70, Email opened, Tag = VIP",
        type: "text",
      },
    ],
  },
  {
    type: "logic_wait",
    label: "Wait",
    description: "Pause before the next step runs",
    icon: Clock,
    category: "logic",
    color: "purple",
    configFields: [
      {
        key: "duration",
        label: "Wait for",
        type: "select",
        options: ["1 hour", "4 hours", "1 day", "2 days", "3 days", "1 week", "Until replied"],
      },
    ],
  },
  {
    type: "logic_wait_until",
    label: "Wait Until",
    description: "Hold until an event happens or a time window opens",
    icon: Hourglass,
    category: "logic",
    color: "purple",
    configFields: [
      {
        key: "until",
        label: "Wait until",
        placeholder: "e.g. Contact replies, Next business day 9am",
        type: "text",
      },
    ],
  },
  {
    type: "logic_loop",
    label: "Loop / Repeat",
    description: "Repeat a set of steps N times",
    icon: Repeat,
    category: "logic",
    color: "purple",
    configFields: [
      {
        key: "times",
        label: "Repeat",
        type: "select",
        options: ["2 times", "3 times", "5 times", "Until condition met"],
      },
    ],
  },
  {
    type: "logic_split_test",
    label: "A/B Split",
    description: "Randomly split contacts down two paths to test",
    icon: SplitSquareHorizontal,
    category: "logic",
    color: "purple",
    configFields: [
      {
        key: "split",
        label: "Split ratio",
        type: "select",
        options: ["50 / 50", "60 / 40", "70 / 30", "80 / 20", "90 / 10"],
      },
    ],
  },

  /* ── AI ── */
  {
    type: "ai_classify",
    label: "AI Classify",
    description: "Let AI label or categorize incoming data",
    icon: Brain,
    category: "ai",
    color: "emerald",
    configFields: [
      {
        key: "what_to_classify",
        label: "What to classify",
        placeholder: "e.g. Lead intent, Email reply, Support ticket",
        type: "text",
      },
      {
        key: "categories",
        label: "Possible labels",
        placeholder: "e.g. Hot, Warm, Cold — separate with commas",
        type: "text",
      },
    ],
  },
  {
    type: "ai_generate",
    label: "AI Write",
    description: "Have AI draft a message or document",
    icon: Sparkles,
    category: "ai",
    color: "emerald",
    configFields: [
      {
        key: "output_type",
        label: "What to write",
        type: "select",
        options: [
          "Personalized email",
          "Follow-up message",
          "SMS message",
          "Proposal draft",
          "Meeting summary",
        ],
      },
      {
        key: "context",
        label: "Extra context for AI",
        placeholder: "e.g. Use a friendly, helpful tone. Mention their industry.",
        type: "textarea",
      },
    ],
  },
  {
    type: "ai_score",
    label: "AI Score",
    description: "Have AI rate a lead, reply, or outcome",
    icon: Target,
    category: "ai",
    color: "emerald",
    configFields: [
      {
        key: "what_to_score",
        label: "What to score",
        placeholder: "e.g. Lead quality, Email engagement",
        type: "text",
      },
      {
        key: "scale",
        label: "Score scale",
        type: "select",
        options: ["1–10", "1–100", "Low / Medium / High"],
      },
    ],
  },

  /* ── MEMORY & GOALS ── */
  {
    type: "memory_write",
    label: "Remember This",
    description: "Save something to your platform memory",
    icon: Database,
    category: "memory",
    color: "rose",
    configFields: [
      {
        key: "what_to_save",
        label: "What to remember",
        placeholder: "e.g. Customer outcome, Campaign result, Lead insight",
        type: "text",
      },
      {
        key: "category",
        label: "Memory category",
        type: "select",
        options: [
          "Customer data",
          "Campaign result",
          "Strategy insight",
          "Experiment result",
          "General",
        ],
      },
    ],
  },
  {
    type: "memory_read",
    label: "Recall Memory",
    description: "Pull saved context to personalize the next step",
    icon: Brain,
    category: "memory",
    color: "rose",
    configFields: [
      {
        key: "what_to_recall",
        label: "What to recall",
        placeholder: "e.g. Past purchases, Last conversation, Preferences",
        type: "text",
      },
    ],
  },
  {
    type: "goal_check",
    label: "Goal Check",
    description: "Check if your target was hit. Stop or continue based on result.",
    icon: Target,
    category: "memory",
    color: "rose",
    configFields: [
      {
        key: "goal",
        label: "What is the goal?",
        placeholder: "e.g. Booked a call, Replied to email, Made a purchase",
        type: "text",
      },
      {
        key: "if_not_met",
        label: "If goal not met",
        type: "select",
        options: ["Send follow-up", "Re-try from start", "Mark as lost", "Escalate to team"],
      },
    ],
  },
];

export const CATEGORY_META: Record<BlockCategory, { label: string; color: string; bg: string }> = {
  trigger: {
    label: "Triggers",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
  },
  action: {
    label: "Actions",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  logic: {
    label: "Logic",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
  },
  ai: {
    label: "AI Steps",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  },
  memory: {
    label: "Memory & Goals",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
  },
};

export const BLOCK_COLOR: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
  },
};

export const BLOCK_CATEGORIES: BlockCategory[] = ["trigger", "action", "logic", "ai", "memory"];

export function getPaletteBlock(type: BlockType): PaletteBlock | undefined {
  return PALETTE_BLOCKS.find((b) => b.type === type);
}

/* ─── Branching ─────────────────────────────────────────────
 * Blocks that split the flow into parallel lanes. The first lane is the
 * "primary" path (Yes / Path A), the second is the alternate (No / Path B).
 * The runtime evaluates which lane to take; the canvas renders them side by side.
 */
export const BRANCH_SPECS: Partial<Record<BlockType, { id: string; label: string }[]>> = {
  logic_if_branch: [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ],
  logic_split_test: [
    { id: "a", label: "Path A" },
    { id: "b", label: "Path B" },
  ],
};

export function isBranchingType(type: BlockType): boolean {
  return type in BRANCH_SPECS;
}

/** Default (empty) lanes for a freshly-added branching block. */
export function makeBranches(type: BlockType): WorkflowBranch[] | undefined {
  const spec = BRANCH_SPECS[type];
  if (!spec) return undefined;
  return spec.map((s) => ({ id: s.id, label: s.label, blocks: [] }));
}

/* ─── Recursive tree helpers ────────────────────────────────
 * A workflow is a tree: an ordered list of blocks where branching blocks carry
 * nested lanes. These helpers keep the Builder's edits and the run preview in
 * sync without mutating in place.
 */

/** Total number of blocks, counting every nested branch lane. */
export function countBlocksDeep(blocks: WorkflowBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    for (const br of b.branches ?? []) n += countBlocksDeep(br.blocks);
  }
  return n;
}

/** Find a block anywhere in the tree by id. */
export function findBlockDeep(blocks: WorkflowBlock[], id: string): WorkflowBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    for (const br of b.branches ?? []) {
      const hit = findBlockDeep(br.blocks, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Return a new tree with `updates` applied to the block matching `id`. */
export function updateBlockDeep(
  blocks: WorkflowBlock[],
  id: string,
  updates: Partial<WorkflowBlock>,
): WorkflowBlock[] {
  return blocks.map((b) => {
    if (b.id === id) {
      return {
        ...b,
        ...updates,
        config: { ...b.config, ...(updates.config ?? {}) },
      };
    }
    if (b.branches) {
      return {
        ...b,
        branches: b.branches.map((br) => ({
          ...br,
          blocks: updateBlockDeep(br.blocks, id, updates),
        })),
      };
    }
    return b;
  });
}

/** Return a new tree with the block matching `id` removed (at any depth). */
export function removeBlockDeep(blocks: WorkflowBlock[], id: string): WorkflowBlock[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.branches
        ? {
            ...b,
            branches: b.branches.map((br) => ({
              ...br,
              blocks: removeBlockDeep(br.blocks, id),
            })),
          }
        : b,
    );
}

/**
 * Insert `block` at the end of a container. `containerId === null` targets the
 * top-level trunk; otherwise it targets the lane (`branchId`) of that block.
 */
export function insertBlockDeep(
  blocks: WorkflowBlock[],
  containerId: string | null,
  branchId: string | null,
  block: WorkflowBlock,
): WorkflowBlock[] {
  if (containerId === null) return [...blocks, block];
  return blocks.map((b) => {
    if (b.id === containerId && b.branches) {
      return {
        ...b,
        branches: b.branches.map((br) =>
          br.id === branchId ? { ...br, blocks: [...br.blocks, block] } : br,
        ),
      };
    }
    if (b.branches) {
      return {
        ...b,
        branches: b.branches.map((br) => ({
          ...br,
          blocks: insertBlockDeep(br.blocks, containerId, branchId, block),
        })),
      };
    }
    return b;
  });
}

/** Move a block up/down within whatever list it lives in. */
export function moveBlockDeep(blocks: WorkflowBlock[], id: string, dir: -1 | 1): WorkflowBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const next = idx + dir;
    if (next < 0 || next >= blocks.length) return blocks;
    const copy = [...blocks];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    return copy;
  }
  return blocks.map((b) =>
    b.branches
      ? {
          ...b,
          branches: b.branches.map((br) => ({
            ...br,
            blocks: moveBlockDeep(br.blocks, id, dir),
          })),
        }
      : b,
  );
}

/** Plain-English one-liner describing a sequence of blocks. */
export function buildSentencePreview(blocks: WorkflowBlock[]): string {
  if (blocks.length === 0) return "Add your first block to start building a workflow.";
  const parts: string[] = [];
  for (const block of blocks) {
    const def = getPaletteBlock(block.type);
    if (!def) continue;
    const label = block.label || def.label;
    switch (block.type) {
      case "trigger_new_lead":
        parts.push(`When a new lead arrives`);
        break;
      case "trigger_form_submit":
        parts.push(`When a form is submitted`);
        break;
      case "trigger_schedule":
        parts.push(`On a schedule`);
        break;
      case "trigger_webhook":
        parts.push(`When a webhook fires`);
        break;
      case "trigger_payment":
        parts.push(`When a payment is received`);
        break;
      case "trigger_tag_added":
        parts.push(`When tag "${block.config.tag || "…"}" is added`);
        break;
      case "trigger_appointment_booked":
        parts.push(`When an appointment is booked`);
        break;
      case "trigger_email_event":
        parts.push(`When an email is ${block.config.event?.toLowerCase() || "engaged with"}`);
        break;
      case "trigger_pipeline_stage":
        parts.push(`When the stage changes`);
        break;
      case "trigger_contact_replied":
        parts.push(`When a contact replies`);
        break;
      case "trigger_birthday":
        parts.push(`On a key date`);
        break;
      case "trigger_call_status":
        parts.push(`When a call completes`);
        break;
      case "trigger_abandoned_checkout":
        parts.push(`When a checkout is abandoned`);
        break;
      case "trigger_contact_created":
        parts.push(`When a contact is created`);
        break;
      case "trigger_contact_changed":
        parts.push(`When "${block.config.field || "a property"}" changes`);
        break;
      case "logic_wait":
        parts.push(`Wait ${block.config.duration || "…"}`);
        break;
      case "logic_wait_until":
        parts.push(`Wait until ${block.config.until || "…"}`);
        break;
      case "logic_if_branch": {
        const yes = block.branches?.[0]?.blocks ?? [];
        const no = block.branches?.[1]?.blocks ?? [];
        let s = `If ${block.config.condition || "condition is met"}`;
        if (yes.length || no.length) {
          s += ` [Yes: ${yes.length ? buildSentencePreview(yes) : "—"} | No: ${
            no.length ? buildSentencePreview(no) : "—"
          }]`;
        }
        parts.push(s);
        break;
      }
      case "logic_split_test": {
        const a = block.branches?.[0]?.blocks ?? [];
        const b = block.branches?.[1]?.blocks ?? [];
        let s = `Split test ${block.config.split || ""}`.trim();
        if (a.length || b.length) {
          s += ` [A: ${a.length ? buildSentencePreview(a) : "—"} | B: ${
            b.length ? buildSentencePreview(b) : "—"
          }]`;
        }
        parts.push(s);
        break;
      }
      case "action_add_tag":
        parts.push(`Add tag "${block.config.tag || "…"}"`);
        break;
      case "action_move_stage":
        parts.push(`Move to "${block.config.stage || "…"}"`);
        break;
      case "ai_classify":
        parts.push(`AI classifies the ${block.config.what_to_classify || "data"}`);
        break;
      case "ai_generate":
        parts.push(`AI writes a ${block.config.output_type || "message"}`);
        break;
      case "ai_score":
        parts.push(`AI scores the ${block.config.what_to_score || "result"}`);
        break;
      case "memory_write":
        parts.push(`Remember ${block.config.what_to_save || "the result"}`);
        break;
      case "goal_check":
        parts.push(`Check goal: ${block.config.goal || "…"}`);
        break;
      default:
        parts.push(label);
    }
  }
  return parts.join(" → ");
}
