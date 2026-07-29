import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { launchpadCatalog } from "@/lib/mock";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  FileText,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Lock,
  History as HistoryIcon,
  RotateCcw,
} from "lucide-react";
import { ByldaThinking } from "@/components/app/ByldaThinking";
import { ToolGuidePanel } from "@/components/app/ToolGuidePanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { blockIfGuest } from "@/lib/guest";
import {
  toolRunsQuery,
  subscriptionQuery,
  planEntitlementsQuery,
  businessContextQuery,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { OutputBody, OutputHeader, copyText } from "@/components/app/OutputRenderer";
import { ToolOutput, hasStructuredOutput } from "@/components/tools/ToolOutput";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { HANDOFFS } from "@/lib/handoffs";
import { NextToolPrompt } from "@/components/launchpad/NextToolPrompt";
import { loadDraft, clearDraft, useDraftAutosave, formatSavedAgo } from "@/lib/draftStore";
import { PaywallModal } from "@/components/app/PaywallModal";
import { runTool } from "@/lib/runTool";
import { useOwnerMode } from "@/lib/ownerMode";
import {
  PreBriefedToolLauncher,
  briefedButtonLabel,
} from "@/components/launchpad/PreBriefedToolLauncher";
import {
  loadWorkspaceProfile,
  saveWorkspaceProfile,
  extractAndSaveProfileFromFields,
  factsToPartialProfile,
  getProfilePrefills,
  mergeBusinessContextIntoProfile,
  type WorkspaceProfile,
  type LearnedFact,
} from "@/lib/workspaceProfile";
import { advanceMissionAfterRun, type RunMomentum } from "@/lib/mission-loop";
import { PostRunMomentum } from "@/components/app/PostRunMomentum";
import { syncProfileToBusinessContext } from "@/lib/profile-sync";

/* ─── Per-tool field config ──────────────────────────────────────────────── */
type FieldType = "text" | "textarea" | "select" | "number";
type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
};

const TOOL_FIELDS: Record<string, FieldDef[]> = {
  "idea-validator": [
    {
      key: "idea",
      label: "Business idea",
      type: "textarea",
      required: true,
      placeholder: "Describe your idea, who it's for, and the core problem it solves.",
    },
    {
      key: "targetMarket",
      label: "Target market",
      type: "text",
      placeholder: "e.g. B2B SaaS founders, SMB operators, US market",
    },
    {
      key: "problem",
      label: "Problem being solved",
      type: "textarea",
      placeholder: "What specific pain does this address? What's broken today?",
    },
  ],
  "pitch-generator": [
    {
      key: "startupName",
      label: "Startup / product name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "idea",
      label: "What you do",
      type: "textarea",
      required: true,
      placeholder: "Describe your product, who it's for, and the core value prop.",
    },
    {
      key: "targetMarket",
      label: "Target market",
      type: "text",
      placeholder: "e.g. SaaS founders, healthcare executives",
    },
    {
      key: "traction",
      label: "Traction",
      type: "text",
      placeholder: "e.g. $10k MRR, 200 waitlist signups, or pre-launch",
    },
  ],
  "gtm-strategy": [
    {
      key: "product",
      label: "Product / offer",
      type: "textarea",
      required: true,
      placeholder: "Describe what you're selling and the transformation it delivers.",
    },
    {
      key: "targetCustomer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. B2B SaaS companies with 10-100 employees",
    },
    {
      key: "budget",
      label: "Launch budget",
      type: "text",
      placeholder: "e.g. $5k/month, bootstrap, or pre-revenue",
    },
    {
      key: "timeline",
      label: "Timeline",
      type: "text",
      placeholder: "e.g. 90 days, 6 months",
    },
  ],
  offer: [
    {
      key: "product",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "Describe the transformation you deliver to customers.",
    },
    {
      key: "targetCustomer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. E-commerce founders doing $1M+/year",
    },
    {
      key: "pricePoint",
      label: "Price point",
      type: "text",
      placeholder: "e.g. $2,500/month, $10k one-time, or unknown",
    },
  ],
  "ops-plan": [
    {
      key: "business",
      label: "Business description",
      type: "textarea",
      required: true,
      placeholder: "Describe your business model, team size, and current operations.",
    },
    { key: "team_size", label: "Team size", type: "text", placeholder: "e.g. solo, 3, 12" },
    {
      key: "pains",
      label: "Operational bottlenecks",
      type: "textarea",
      placeholder: "Where are you losing time, money, or clients today?",
    },
  ],
  followup: [
    {
      key: "context",
      label: "Lead context",
      type: "textarea",
      required: true,
      placeholder: "Who is the lead? What did they express interest in? Last interaction?",
    },
    {
      key: "goal",
      label: "Goal",
      type: "text",
      required: true,
      placeholder: "e.g. Book a discovery call, close the deal, re-engage",
    },
    {
      key: "channels",
      label: "Channels",
      type: "text",
      placeholder: "e.g. email, LinkedIn, phone",
    },
  ],
  "website-audit": [
    {
      key: "url",
      label: "Website URL",
      type: "text",
      required: true,
      placeholder: "https://yourwebsite.com",
      hint: "Must be a live public URL — we'll fetch and analyze it.",
    },
  ],
  "kill-my-idea": [
    {
      key: "idea",
      label: "Startup idea",
      type: "textarea",
      required: true,
      placeholder:
        "Describe your idea — what it does, who it's for, the model, and why you think it'll work.",
    },
    {
      key: "assumptions",
      label: "Key assumptions",
      type: "textarea",
      placeholder: "What are you assuming about customers, market size, or competition?",
    },
  ],
  "funding-score": [
    {
      key: "startupName",
      label: "Startup name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "stage",
      label: "Stage",
      type: "select",
      options: ["Pre-idea", "Pre-launch", "Pre-seed", "Seed", "Series A", "Series B+"],
      required: true,
    },
    {
      key: "traction",
      label: "Traction & metrics",
      type: "textarea",
      placeholder: "MRR, users, growth rate, notable wins",
    },
    {
      key: "team",
      label: "Team description",
      type: "text",
      placeholder: "e.g. Solo technical founder, 2 ex-Google engineers",
    },
    {
      key: "revenue",
      label: "Current revenue",
      type: "text",
      placeholder: "e.g. $0, $8k MRR, $250k ARR",
    },
  ],
  "first-10-customers": [
    {
      key: "product",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What are you selling? What transformation does it deliver?",
    },
    {
      key: "targetCustomer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. Freelance designers, DTC brand founders",
    },
    {
      key: "price",
      label: "Price",
      type: "text",
      placeholder: "e.g. $500/month, $2,500 one-time",
    },
    {
      key: "channels",
      label: "Available channels",
      type: "text",
      placeholder: "e.g. LinkedIn, cold email, personal network, Twitter",
    },
  ],
  "business-plan": [
    {
      key: "startupName",
      label: "Business name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "idea",
      label: "Business description",
      type: "textarea",
      required: true,
      placeholder: "What does the business do, who does it serve, and what is the model?",
    },
    {
      key: "revenueModel",
      label: "Revenue model",
      type: "text",
      required: true,
      placeholder: "e.g. SaaS subscription, consulting retainer, transaction fees",
    },
    {
      key: "targetMarket",
      label: "Target market",
      type: "text",
      required: true,
      placeholder: "e.g. SMBs in the US, enterprise software teams",
    },
  ],
  "investor-emails": [
    {
      key: "startupName",
      label: "Startup name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "pitch",
      label: "Pitch summary",
      type: "textarea",
      required: true,
      placeholder: "What does your company do? What's the traction? Why now?",
    },
    {
      key: "traction",
      label: "Traction",
      type: "text",
      placeholder: "e.g. $25k MRR, 1,200 users, pilot with Fortune 500",
    },
    {
      key: "ask",
      label: "Ask",
      type: "text",
      placeholder: "e.g. $750k pre-seed, SAFE at $5M cap",
    },
  ],
  "idea-vs-idea": [
    {
      key: "ideaA",
      label: "Idea A",
      type: "textarea",
      required: true,
      placeholder: "Describe the first idea — what it does, the market, the model.",
    },
    {
      key: "ideaB",
      label: "Idea B",
      type: "textarea",
      required: true,
      placeholder: "Describe the second idea — what it does, the market, the model.",
    },
    {
      key: "founderContext",
      label: "Your background",
      type: "text",
      placeholder: "e.g. Ex-SaaS operator, no-code background, 2 years in sales",
    },
  ],
  "landing-page": [
    {
      key: "product",
      label: "Product / offer",
      type: "textarea",
      required: true,
      placeholder: "Describe what you're selling and the transformation it delivers.",
    },
    {
      key: "targetCustomer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. B2B founders, solo consultants, DTC brands",
    },
    {
      key: "mainBenefit",
      label: "Core benefit",
      type: "text",
      required: true,
      placeholder: "e.g. Cut churn by 30% without a single sales call",
    },
    {
      key: "tone",
      label: "Tone",
      type: "select",
      options: ["Professional", "Conversational", "Bold / Hype", "Minimalist", "Educational"],
    },
  ],
  competitor: [
    {
      key: "product",
      label: "Your product",
      type: "textarea",
      required: true,
      placeholder: "Describe what you offer and who it's for.",
    },
    {
      key: "competitors",
      label: "Competitors",
      type: "text",
      required: true,
      placeholder: "e.g. Notion, Asana, Monday.com — comma-separated",
    },
    {
      key: "differentiator",
      label: "Your differentiation",
      type: "text",
      placeholder: "What do you do that no one else does?",
    },
  ],
  pricing: [
    {
      key: "product",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "Describe your offer and the value delivered.",
    },
    {
      key: "targetCustomer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. SMB operators, enterprise teams",
    },
    {
      key: "currentPricing",
      label: "Current pricing",
      type: "text",
      placeholder: "e.g. $99/month, $5k project fee, or none yet",
    },
    {
      key: "revenueGoal",
      label: "Revenue goal",
      type: "text",
      placeholder: "e.g. $10k MRR in 90 days, $500k ARR",
    },
  ],
  "revenue-projector": [
    {
      key: "product",
      label: "Product / service",
      type: "text",
      required: true,
      placeholder: "What are you selling?",
    },
    {
      key: "currentMrr",
      label: "Current MRR",
      type: "text",
      placeholder: "e.g. $0, $5,000, $25,000",
    },
    {
      key: "avgDealSize",
      label: "Avg deal / contract size",
      type: "text",
      placeholder: "e.g. $500/month, $10k one-time",
    },
    {
      key: "growthLever",
      label: "Primary growth lever",
      type: "text",
      required: true,
      placeholder: "e.g. cold outbound, paid ads, content + SEO",
    },
  ],
  blog: [
    {
      key: "topic",
      label: "Topic",
      type: "textarea",
      required: true,
      placeholder: "What is the blog post about? Be specific about the angle.",
    },
    {
      key: "primary_keyword",
      label: "Primary SEO keyword",
      type: "text",
      placeholder: "e.g. 'founder operating system' or 'how to find first customers'",
    },
    {
      key: "audience",
      label: "Target audience",
      type: "text",
      placeholder: "e.g. early-stage founders, SaaS growth teams",
    },
  ],
  social: [
    {
      key: "platform",
      label: "Platform",
      type: "select",
      options: ["LinkedIn", "Twitter/X", "Instagram", "TikTok"],
      required: true,
    },
    {
      key: "topic",
      label: "Content topic",
      type: "textarea",
      required: true,
      placeholder: "What do you want to post about? Include context, angle, or hook ideas.",
    },
    {
      key: "cta",
      label: "Call to action",
      type: "text",
      placeholder: "e.g. Comment below, DM me, link in bio",
    },
    {
      key: "tone",
      label: "Tone",
      type: "select",
      options: ["Professional", "Casual", "Bold", "Educational", "Storytelling"],
    },
  ],
  "email-sequence": [
    {
      key: "sequence_type",
      label: "Sequence type",
      type: "select",
      options: ["Nurture", "Onboarding", "Re-engagement", "Promotional", "Cold outreach"],
      required: true,
    },
    {
      key: "topic",
      label: "Topic / product",
      type: "textarea",
      required: true,
      placeholder: "What is the sequence about? What transformation does it lead to?",
    },
    {
      key: "email_count",
      label: "Number of emails",
      type: "number",
      placeholder: "5",
    },
    {
      key: "audience",
      label: "Audience",
      type: "text",
      placeholder: "e.g. trial users, cold prospects, churned customers",
    },
  ],
  "sales-script": [
    {
      key: "script_type",
      label: "Script type",
      type: "select",
      options: ["Discovery call", "Demo", "Close", "Objection handling", "Follow-up call"],
      required: true,
    },
    {
      key: "scenario_notes",
      label: "Scenario notes",
      type: "textarea",
      required: true,
      placeholder:
        "Describe the product, the deal size, typical objections, and your unique value prop.",
    },
  ],
  "ad-creative": [
    {
      key: "offer",
      label: "Offer description",
      type: "textarea",
      required: true,
      placeholder: "What are you promoting? What's the CTA and the core value prop?",
    },
    {
      key: "audience_pain",
      label: "Audience pain point",
      type: "text",
      required: true,
      placeholder: "e.g. Spending 10 hours a week on manual reporting",
    },
    {
      key: "platform",
      label: "Platform",
      type: "select",
      options: ["Meta (Facebook/Instagram)", "Google", "LinkedIn", "TikTok"],
      required: true,
    },
  ],
  vsl: [
    {
      key: "product_summary",
      label: "Product summary",
      type: "textarea",
      required: true,
      placeholder: "What does your product do? Who is it for? What's the transformation?",
    },
    {
      key: "length_minutes",
      label: "Target length (minutes)",
      type: "number",
      placeholder: "10",
    },
  ],
  "cold-email": [
    {
      key: "icp",
      label: "ICP description",
      type: "textarea",
      required: true,
      placeholder: "Describe who you're emailing — industry, role, company size, pain points.",
    },
    {
      key: "offer",
      label: "Offer / value prop",
      type: "text",
      required: true,
      placeholder: "What are you offering and what outcome do they get?",
    },
    {
      key: "sender_name",
      label: "Your name",
      type: "text",
      required: true,
      placeholder: "e.g. Alex Chen",
    },
    {
      key: "sender_company",
      label: "Your company",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
  ],
  "niche-validator": [
    {
      key: "niche_idea",
      label: "Niche idea",
      type: "textarea",
      required: true,
      placeholder: "Describe the niche — what it is, who's in it, how it monetizes.",
    },
    {
      key: "geography",
      label: "Geography",
      type: "text",
      placeholder: "e.g. US, EU, global, Southeast Asia",
    },
  ],
  icp: [
    {
      key: "niche",
      label: "Niche / market",
      type: "text",
      required: true,
      placeholder: "e.g. B2B SaaS, DTC e-commerce, professional services",
    },
    {
      key: "offer",
      label: "Offer description",
      type: "textarea",
      required: true,
      placeholder: "What do you sell and what transformation does it deliver?",
    },
    {
      key: "current_customer_examples",
      label: "Current customer examples",
      type: "text",
      placeholder: "e.g. 3 e-commerce brands doing $500k+ annual revenue",
    },
  ],
  "pitch-deck": [
    {
      key: "company_name",
      label: "Company name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "problem",
      label: "Problem",
      type: "textarea",
      required: true,
      placeholder: "What critical problem are you solving? Why does it matter?",
    },
    {
      key: "solution",
      label: "Solution",
      type: "textarea",
      required: true,
      placeholder: "How do you solve it? What's the unique insight behind your approach?",
    },
    {
      key: "traction",
      label: "Traction",
      type: "text",
      placeholder: "e.g. $50k ARR, 500 users, 3 enterprise pilots",
    },
    {
      key: "ask_amount",
      label: "Ask amount",
      type: "text",
      placeholder: "e.g. $1.5M seed, $500k pre-seed SAFE",
    },
    {
      key: "deck_type",
      label: "Deck type",
      type: "select",
      options: ["Seed", "Series A", "Client pitch", "Demo day"],
    },
  ],
  "lead-magnet": [
    {
      key: "niche",
      label: "Niche",
      type: "text",
      required: true,
      placeholder: "e.g. SaaS founders, freelance designers",
    },
    {
      key: "icp_pain_point",
      label: "ICP pain point",
      type: "text",
      required: true,
      placeholder: "e.g. Can't convert trial users to paid",
    },
    {
      key: "format",
      label: "Format",
      type: "select",
      options: ["PDF guide", "Checklist", "Email course", "Template", "Webinar", "Video series"],
    },
  ],
  automation: [
    {
      key: "process_description",
      label: "Process to automate",
      type: "textarea",
      required: true,
      placeholder: "Describe the manual workflow — the steps, triggers, and what it produces.",
    },
    {
      key: "integrations",
      label: "Tools / integrations",
      type: "text",
      placeholder: "e.g. HubSpot, Notion, Slack, Gmail, Zapier",
    },
  ],
  "client-report": [
    {
      key: "client_id",
      label: "Client name",
      type: "text",
      required: true,
      placeholder: "e.g. Acme Corp, Johnson & Associates",
    },
    {
      key: "period_label",
      label: "Reporting period",
      type: "text",
      placeholder: "e.g. May 2026, Q2 2026",
    },
  ],
  "positioning-engine": [
    {
      key: "product_description",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What you're building and how it works",
    },
    {
      key: "audience",
      label: "Target audience",
      type: "text",
      required: true,
      placeholder: "Who this is for — be specific",
    },
    {
      key: "alternatives",
      label: "What they use today instead",
      type: "textarea",
      placeholder: 'Competitors, workarounds, status quo, "doing nothing"',
    },
    {
      key: "differentiator",
      label: "Your differentiator",
      type: "textarea",
      placeholder: "The one thing that makes you different — even a hunch is fine",
    },
  ],
  "niche-scorer": [
    {
      key: "niche_description",
      label: "Describe the niche",
      type: "textarea",
      required: true,
      placeholder: "Who it serves, what problem it solves, and where you'd find them",
    },
    {
      key: "audience_size",
      label: "Audience size signal",
      type: "select",
      options: ["Small (under 10k)", "Medium (10k–100k)", "Large (100k+)", "Not sure"],
    },
    {
      key: "competition_level",
      label: "Competition level",
      type: "select",
      options: ["Low — few real players", "Medium — some players", "High — crowded", "Not sure"],
    },
    {
      key: "monetization_signal",
      label: "How would you monetize it?",
      type: "text",
      placeholder: "e.g. subscription, one-time purchase, services, ads",
    },
  ],
  "mvp-planner": [
    {
      key: "problem",
      label: "The problem you're solving",
      type: "textarea",
      required: true,
      placeholder: "What pain point does this address, and for whom?",
    },
    {
      key: "target_user",
      label: "Target user",
      type: "text",
      required: true,
      placeholder: "Who will use this first?",
    },
    {
      key: "core_feature_hypothesis",
      label: "Core feature hypothesis",
      type: "textarea",
      placeholder: "The ONE thing your MVP must prove works",
    },
    {
      key: "build_resources",
      label: "Build resources",
      type: "select",
      options: ["Solo, no-code", "Solo + some code", "Solo developer", "Small team (2-4)"],
    },
    {
      key: "timeline",
      label: "Target timeline",
      type: "text",
      placeholder: "e.g. 4 weeks, 2 months",
    },
  ],
  "competitor-scanner": [
    {
      key: "business_description",
      label: "Your business",
      type: "textarea",
      required: true,
      placeholder: "What do you sell, and to whom?",
    },
    {
      key: "target_market",
      label: "Target market",
      type: "text",
      required: true,
      placeholder: "e.g. Small dental practices, DTC skincare brands",
    },
    {
      key: "geography",
      label: "Geography",
      type: "text",
      placeholder: "e.g. United States, global, Western Europe",
    },
  ],
  "gtm-strategy-builder": [
    {
      key: "product_description",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What are you selling? What transformation does it deliver?",
    },
    {
      key: "target_customer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. Solo therapy practice owners",
    },
    {
      key: "price_point",
      label: "Price point",
      type: "text",
      placeholder: "e.g. $99/month, $2,500 one-time",
    },
    {
      key: "stage",
      label: "Stage",
      type: "select",
      options: ["Pre-launch", "Just launched", "Early traction", "Growing"],
    },
  ],
  "first-10-customers-finder": [
    {
      key: "business_description",
      label: "Your business",
      type: "textarea",
      required: true,
      placeholder: "What are you selling? What transformation does it deliver?",
    },
    {
      key: "target_customer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. Freelance designers, DTC brand founders",
    },
    {
      key: "location_or_online",
      label: "Where they are",
      type: "text",
      placeholder: "e.g. Local — Austin TX, or online / remote",
    },
  ],
  "business-plan-generator": [
    {
      key: "business_name",
      label: "Business name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "description",
      label: "Business description",
      type: "textarea",
      required: true,
      placeholder: "What you do, who it's for, and how you make money",
    },
    {
      key: "target_market",
      label: "Target market",
      type: "text",
      required: true,
      placeholder: "e.g. Small dental practices, DTC skincare brands",
    },
    {
      key: "revenue_model",
      label: "Revenue model",
      type: "text",
      placeholder: "e.g. Subscription, one-time fee, commission",
    },
    {
      key: "stage",
      label: "Stage",
      type: "select",
      options: ["Pre-idea", "Pre-launch", "Pre-seed", "Seed", "Series A", "Series B+"],
    },
  ],
  "persona-builder": [
    {
      key: "business_description",
      label: "Your business",
      type: "textarea",
      required: true,
      placeholder: "What do you sell, and to whom?",
    },
    {
      key: "product_or_service",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What exactly are you offering?",
    },
    {
      key: "pain_point",
      label: "Core pain point",
      type: "textarea",
      placeholder: "The problem your best customers are desperate to solve",
    },
  ],
  "pricing-calculator": [
    {
      key: "product_description",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What are you selling, and what does it deliver?",
    },
    {
      key: "cost_to_deliver",
      label: "Cost to deliver",
      type: "text",
      placeholder: "e.g. $40/unit, 3 hours of my time, $0 (digital)",
    },
    {
      key: "competitor_prices",
      label: "Competitor prices",
      type: "text",
      placeholder: "e.g. $49–$199/month across the category",
    },
    {
      key: "target_margin_percent",
      label: "Target margin (%)",
      type: "number",
      placeholder: "70",
    },
  ],
  "ad-copy": [
    {
      key: "product_description",
      label: "Product / service",
      type: "textarea",
      required: true,
      placeholder: "What are you advertising, and what's the core promise?",
    },
    {
      key: "target_audience",
      label: "Target audience",
      type: "text",
      required: true,
      placeholder: "Who this is for — be specific",
    },
    {
      key: "platform",
      label: "Platform",
      type: "select",
      options: [
        "Meta (Facebook/Instagram)",
        "Google Ads",
        "TikTok",
        "LinkedIn",
        "X (Twitter)",
        "YouTube",
      ],
    },
    {
      key: "goal",
      label: "Campaign goal",
      type: "select",
      options: ["Lead generation", "Direct sales", "Sign-ups / trials", "Brand awareness"],
    },
  ],
  "investor-email-writer": [
    {
      key: "company_name",
      label: "Company name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind Labs",
    },
    {
      key: "one_liner",
      label: "One-liner",
      type: "text",
      required: true,
      placeholder: "What you do, in one sentence an investor would repeat",
    },
    {
      key: "traction_metrics",
      label: "Traction & metrics",
      type: "textarea",
      placeholder: "MRR, users, growth rate, notable wins",
    },
    {
      key: "funding_ask",
      label: "Funding ask",
      type: "text",
      placeholder: "e.g. Raising $500k pre-seed",
    },
    {
      key: "investor_type",
      label: "Investor type",
      type: "select",
      options: ["Angel", "Pre-seed VC", "Seed VC", "Series A+ VC", "Strategic / corporate"],
    },
  ],
  "landing-page-creator": [
    {
      key: "product_name",
      label: "Product name",
      type: "text",
      required: true,
      placeholder: "e.g. Northwind",
    },
    {
      key: "target_customer",
      label: "Target customer",
      type: "text",
      required: true,
      placeholder: "e.g. Solo therapy practice owners",
    },
    {
      key: "primary_benefit",
      label: "Primary benefit",
      type: "textarea",
      required: true,
      placeholder: "The #1 transformation this delivers",
    },
    {
      key: "price",
      label: "Price",
      type: "text",
      placeholder: "e.g. $99/month, $2,500 one-time",
    },
    {
      key: "social_proof",
      label: "Social proof",
      type: "textarea",
      placeholder: "Testimonials, logos, results, review counts — whatever you have",
    },
  ],
  "kpi-dashboard": [
    {
      key: "business_model",
      label: "Business model",
      type: "text",
      required: true,
      placeholder: "e.g. B2B SaaS, DTC e-commerce, local service business",
    },
    {
      key: "stage",
      label: "Stage",
      type: "select",
      options: ["Pre-launch", "Just launched", "Early traction", "Growing", "Scaling"],
    },
    {
      key: "team_size",
      label: "Team size",
      type: "number",
      placeholder: "1",
    },
  ],
  "seo-audit": [
    {
      key: "website_url",
      label: "Website URL",
      type: "text",
      required: true,
      placeholder: "https://yourcompany.com",
    },
    {
      key: "primary_keyword",
      label: "Primary keyword",
      type: "text",
      required: true,
      placeholder: "e.g. project management software for agencies",
    },
    {
      key: "industry",
      label: "Industry",
      type: "text",
      placeholder: "e.g. B2B SaaS, local home services, e-commerce",
    },
  ],
  "launch-checklist": [
    {
      key: "business_type",
      label: "Business type",
      type: "text",
      required: true,
      placeholder: "e.g. SaaS product, local service, info product",
    },
    {
      key: "launch_date",
      label: "Target launch date",
      type: "text",
      placeholder: 'e.g. 2026-09-01, or "in 6 weeks"',
    },
    {
      key: "target_audience",
      label: "Target audience",
      type: "text",
      placeholder: "Who this is for — be specific",
    },
    {
      key: "distribution_channels",
      label: "Distribution channels",
      type: "text",
      placeholder: "e.g. Product Hunt, cold email, LinkedIn, paid ads",
    },
  ],
  "funding-readiness-score": [
    {
      key: "business_description",
      label: "Your business",
      type: "textarea",
      required: true,
      placeholder: "What you do, who it's for, and how you make money",
    },
    {
      key: "monthly_revenue",
      label: "Monthly revenue",
      type: "text",
      placeholder: "e.g. $0, $8k MRR, $40k MRR",
    },
    {
      key: "growth_rate",
      label: "Growth rate",
      type: "text",
      placeholder: "e.g. 15% month-over-month",
    },
    {
      key: "team_size",
      label: "Team size",
      type: "number",
      placeholder: "2",
    },
    {
      key: "funding_target",
      label: "Funding target",
      type: "text",
      placeholder: "e.g. $500k pre-seed, $2M seed",
    },
  ],
};

/* Build the backend payload from per-tool fields */
function buildPayload(fields: Record<string, string>, title: string): Record<string, unknown> {
  // All field keys map directly to backend field names
  const payload: Record<string, unknown> = { ...fields, title };
  // Legacy aliases so the edge function fallbacks always find something
  const primaryText =
    fields.idea ||
    fields.product ||
    fields.topic ||
    fields.context ||
    fields.niche_idea ||
    fields.process_description ||
    fields.product_summary ||
    "";
  if (!payload.idea) payload.idea = primaryText;
  if (!payload.context) payload.context = primaryText;
  if (!payload.business) payload.business = title || primaryText;
  if (!payload.url && fields.url) payload.url = fields.url;
  if (!payload.offer && fields.offer) payload.offer = fields.offer;
  if (!payload.goal) payload.goal = fields.goal || "";
  if (!payload.target) payload.target = fields.targetCustomer || title || "";
  return payload;
}

type Search = {
  context?: string;
  title?: string;
  fromRun?: string;
  step?: string;
};

export const Route = createFileRoute("/app/launchpad/$tool")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    context: typeof s.context === "string" ? s.context : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    fromRun: typeof s.fromRun === "string" ? s.fromRun : undefined,
    step: typeof s.step === "string" ? s.step : undefined,
  }),
  loader: ({ params }) => {
    const tool = launchpadCatalog.find((t) => t.key === params.tool);
    if (!tool) throw notFound();
    return { tool };
  },
  component: ToolPage,
  notFoundComponent: () => (
    <div className="p-6">
      <div className="text-sm">
        This lesson doesn&rsquo;t exist.{" "}
        <Link to="/app/playbook" className="underline">
          Back to your program
        </Link>
      </div>
    </div>
  ),
});

function ToolPage() {
  const { tool } = Route.useLoaderData();
  const search = useSearch({ from: "/app/launchpad/$tool" }) as Search;
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [momentum, setMomentum] = useState<RunMomentum | null>(null);
  const [nextPromptDismissed, setNextPromptDismissed] = useState(false);
  const [learnedFacts, setLearnedFacts] = useState<LearnedFact[]>([]);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile>(() =>
    loadWorkspaceProfile(),
  );

  const isOwner = useOwnerMode();
  const subQ = useQuery({ ...subscriptionQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const plansQ = useQuery(planEntitlementsQuery());
  const planTier = subQ.data?.plan ?? "starter";

  // Business Context Graph — hydrates prefills server-side so tools are
  // context-first on any device, not just after a manual run on this one.
  const businessCtxQ = useQuery({
    ...businessContextQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  useEffect(() => {
    if (!businessCtxQ.data) return;
    const merged = mergeBusinessContextIntoProfile(businessCtxQ.data);
    setWorkspaceProfile(merged);
    // Backfill any still-empty form fields from the freshly hydrated profile.
    {
      const fills = getProfilePrefills(toolFieldDefs?.map((f) => f.key) ?? ["context"], merged);
      setFields((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(fills)) if (!next[k]) next[k] = v;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCtxQ.data, tool.key]);

  const currentEnt = plansQ.data?.find((p) => p.plan === planTier);
  const isToolLocked = !isOwner && !!currentEnt && !currentEnt.allowed_tools.includes(tool.toolKey);

  const requiredPlan = isToolLocked
    ? (["launch", "operate", "scale"] as const).find((p) =>
        plansQ.data?.find((e) => e.plan === p)?.allowed_tools.includes(tool.toolKey),
      )
    : undefined;

  const effectiveWired = isOwner ? true : tool.wired;
  const effectiveToolKey = tool.toolKey || (isOwner ? tool.key : "");

  const toolFieldDefs = TOOL_FIELDS[tool.key];

  // Derive a primary context string for legacy compat / char count
  const primaryFieldValue =
    fields[toolFieldDefs?.[0]?.key ?? ""] || fields.idea || fields.context || "";

  useEffect(() => {
    setOutput(null);
    setRunId(null);
    setRunError(null);
    setFeedback(null);
    setMomentum(null);
    setNextPromptDismissed(false);
    setLearnedFacts([]);
    setDraftRestored(false);

    // Load the latest profile
    const profile = loadWorkspaceProfile();
    setWorkspaceProfile(profile);
    const profileFills = getProfilePrefills(
      toolFieldDefs?.map((f) => f.key) ?? ["context"],
      profile,
    );

    if (search?.context || search?.title) {
      setTitle(search.title ?? "");
      // Pre-fill the primary field with the URL context param
      const primary = toolFieldDefs?.[0]?.key ?? "context";
      setFields({ ...profileFills, ...(search.context ? { [primary]: search.context } : {}) });
      return;
    }
    const draft = loadDraft(currentOrgId, tool.key);
    if (draft) {
      setTitle(draft.title ?? "");
      if (draft.fields && Object.keys(draft.fields).length > 0) {
        setFields({ ...profileFills, ...draft.fields });
        setDraftRestored(true);
      } else if (draft.context) {
        // Backward compat: put old context into primary field
        const primary = toolFieldDefs?.[0]?.key ?? "context";
        setFields({ ...profileFills, [primary]: draft.context });
        setDraftRestored(true);
      } else {
        setFields(profileFills);
      }
    } else {
      setTitle("");
      setFields(profileFills);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.key, currentOrgId]);

  const savedAt = useDraftAutosave(currentOrgId, tool.key, { title, fields });
  const savedLabel = draftRestored ? "Draft restored" : formatSavedAgo(savedAt);

  const runsQ = useQuery({ ...toolRunsQuery(currentOrgId ?? "", 50), enabled: !!currentOrgId });
  const toolRuns = useMemo(
    () => (runsQ.data ?? []).filter((r) => r.tool_key === effectiveToolKey).slice(0, 6),
    [runsQ.data, effectiveToolKey],
  );

  const handoffs = HANDOFFS[tool.key] ?? [];

  // Output contract fields (context receipt + structured next actions) are
  // rendered by this page, not OutputBody — strip them from the core payload.
  type NextAction = { type: string; target?: string; label: string; reason: string };
  const contextUsed: string[] = Array.isArray(output?.context_used)
    ? (output!.context_used as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const allNextActions: NextAction[] = Array.isArray(output?.recommended_next_actions)
    ? (output!.recommended_next_actions as NextAction[]).filter(
        (a) => a && typeof a.label === "string" && typeof a.reason === "string",
      )
    : [];
  const coreOutput = (() => {
    if (!output) return output;
    const rest = { ...output };
    delete (rest as Record<string, unknown>).context_used;
    delete (rest as Record<string, unknown>).recommended_next_actions;
    return rest;
  })();
  const slugByToolKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of launchpadCatalog) map.set(t.toolKey, t.key);
    return map;
  }, []);

  // The primary chained suggestion (NextToolPrompt) owns the top spot — drop
  // any dynamic action that duplicates it so there's one clear next move.
  const primaryNextToolKey = handoffs[0]?.toolKey;
  const nextActions = allNextActions.filter((a) => {
    if (!a.target || !primaryNextToolKey) return true;
    const slug = slugByToolKey.get(a.target) ?? a.target;
    return slug !== primaryNextToolKey;
  });

  const ideaValidatorRuns = useMemo(
    () =>
      (runsQ.data ?? []).filter((r) => r.tool_key === "validate-idea" && r.status === "succeeded")
        .length,
    [runsQ.data],
  );
  const isFreeStarter = isOwner ? false : planTier === "starter";
  const isIdeaValidator = effectiveToolKey === "validate-idea";
  const ideaValidatorBlocked =
    !isOwner && isFreeStarter && isIdeaValidator && ideaValidatorRuns >= 3;
  const isPastDue = !isOwner && subQ.data?.status === "past_due";

  // Determine whether required fields are filled
  const formValid = toolFieldDefs
    ? toolFieldDefs.filter((f) => f.required).every((f) => (fields[f.key] ?? "").trim().length > 0)
    : primaryFieldValue.trim().length > 0;

  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = async () => {
    // Double-submit guard — the button is disabled while generating, but a
    // second entry point (retry, keyboard) must never start a parallel run.
    if (generating) return;
    if (blockIfGuest("Sign up to run AI tools and unlock real outputs.")) return;
    if (!effectiveWired) {
      toast.error("This tool is launching soon.");
      return;
    }
    if (isPastDue) {
      toast.error("Payment failed — update your card in Billing to keep using AI tools.");
      return;
    }
    if (!formValid) {
      toast.error("Fill in the required fields first.");
      return;
    }
    if (ideaValidatorBlocked || isToolLocked) {
      setPaywallOpen(true);
      return;
    }
    setGenerating(true);
    setRunError(null);
    setStreamText("");
    setOutput(null);
    setRunId(null);
    setFeedback(null);
    setMomentum(null);
    setNextPromptDismissed(false);
    setLearnedFacts([]);
    // Run name default — matches the zero-retype philosophy: never a silent
    // requirement, always a sensible derived value the user can rename later.
    const effectiveTitle =
      title.trim() ||
      `${tool.name} — ${workspaceProfile.business_name || new Date().toLocaleDateString()}`;
    if (!title.trim()) setTitle(effectiveTitle);
    try {
      const payload = buildPayload(fields, effectiveTitle);
      const result = await runTool(
        effectiveToolKey,
        payload,
        { orgId: currentOrgId, userId: user?.id },
        search.fromRun ? { fromRunId: search.fromRun } : undefined,
      );
      setStreamText("");
      setOutput(result.output);
      if (result.run_id) setRunId(result.run_id);
      // Save relevant fields to workspace profile for future pre-fills, and
      // surface what Bylda just learned in the post-run receipt.
      const facts = extractAndSaveProfileFromFields(fields);
      setLearnedFacts(facts);
      setWorkspaceProfile(loadWorkspaceProfile());
      // Durable learning: push the changed facts into the org's Business
      // Context Graph so they survive this browser and feed every AI call.
      if (facts.length > 0 && currentOrgId) {
        const orgIdForSync = currentOrgId;
        void syncProfileToBusinessContext(orgIdForSync, factsToPartialProfile(facts)).then(
          (synced) => {
            if (synced) qc.invalidateQueries({ queryKey: ["business_context", orgIdForSync] });
          },
        );
      }
      // Close the loop: a successful run completes the mission step that
      // pointed here (?step= from a step CTA, or matched by tool key), so the
      // checklist advances without a manual tick. Fire-and-forget — the
      // output must never wait on mission bookkeeping.
      if (user?.id) {
        const userId = user.id;
        void advanceMissionAfterRun({
          userId,
          stepId: search.step,
          toolKeys: [tool.key, effectiveToolKey],
        }).then((m) => {
          if (!m) return;
          setMomentum(m);
          qc.invalidateQueries({ queryKey: ["current-mission", userId] });
        });
      }
      toast.success("Output ready");
      if (currentOrgId) {
        qc.invalidateQueries({ queryKey: ["tool_runs", currentOrgId] });
        qc.invalidateQueries({ queryKey: ["generated_assets", currentOrgId] });
        qc.invalidateQueries({ queryKey: ["usage", currentOrgId] });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setRunError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const saveToAssets = async () => {
    if (blockIfGuest("Sign up to save assets to your library.")) return;
    if (!currentOrgId || !user || !output) return;
    const { error } = await supabase.from("generated_assets").insert([
      {
        organization_id: currentOrgId,
        user_id: user.id,
        kind: tool.toolKey,
        title: title || tool.name,
        metadata: output as never,
      },
    ]);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved to library");
      qc.invalidateQueries({ queryKey: ["generated_assets", currentOrgId] });
    }
  };

  const sendFeedback = async (v: "up" | "down") => {
    setFeedback(v);
    if (!runId) return;
    try {
      await supabase
        .from("tool_runs")
        .update({ feedback: v, feedback_at: new Date().toISOString() })
        .eq("id", runId);
    } catch {
      /* non-blocking */
    }
  };

  const handleCopy = () => {
    if (!output) return;
    copyText(JSON.stringify(output, null, 2));
  };

  const downloadJSON = () => {
    if (!output) return;
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || tool.name).replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="space-y-6"
      data-coach="tool-runner"
      data-coach-label="Run this tool — Bylda brought you here"
    >
      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        title={
          isToolLocked ? `${tool.name} requires the ${requiredPlan ?? "next"} plan` : undefined
        }
        description={
          isToolLocked
            ? `You're on the ${planTier} plan. Upgrade to ${requiredPlan ?? "a higher plan"} to unlock this tool and more.`
            : undefined
        }
        ctaLabel={isToolLocked ? "View plans in Billing" : undefined}
      />

      {/* Breadcrumb + header */}
      <div className="flex flex-col gap-3">
        <div
          className="flex items-center gap-2 text-[12px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Link
            to="/app/playbook"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Your program
          </Link>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: "var(--foreground)" }}>{tool.name}</span>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1
              className="font-display text-[1.75rem] font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              {tool.name}
            </h1>
            <p
              className="mt-1 max-w-2xl text-[13.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {tool.desc}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isToolLocked ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "color-mix(in oklab, var(--warning) 12%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--warning) 30%, transparent)",
                  color: "var(--warning)",
                }}
              >
                <Lock className="h-3 w-3" />{" "}
                {requiredPlan
                  ? `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan`
                  : "Upgrade required"}
              </span>
            ) : !effectiveWired ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "color-mix(in oklab, var(--warning) 12%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--warning) 30%, transparent)",
                  color: "var(--warning)",
                }}
              >
                <Lock className="h-3 w-3" /> Launching soon
              </span>
            ) : output ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "color-mix(in oklab, var(--success) 12%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--success) 30%, transparent)",
                  color: "var(--success)",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> Output ready
              </span>
            ) : savedLabel ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "color-mix(in oklab, var(--primary) 60%, transparent)" }}
                />
                {savedLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Hand-holding guide — hidden once output exists so results get room */}
      {!output && !generating && <ToolGuidePanel toolKey={tool.key} />}

      {/* 60/40 workspace */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* LEFT — inputs */}
        <div className="space-y-4 lg:col-span-3">
          <div
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Inputs
              </div>
              <div className="flex items-center gap-3">
                {workspaceProfile.business_name && (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="text-[10.5px] transition-colors hover:text-foreground"
                    style={{ color: "var(--primary)" }}
                    title="Edit your workspace profile to pre-fill common fields"
                  >
                    ✦ {workspaceProfile.business_name} · Edit Profile
                  </button>
                )}
                {!workspaceProfile.business_name && (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="text-[10.5px] transition-colors hover:text-foreground"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Set up workspace profile to pre-fill common fields"
                  >
                    Set up profile →
                  </button>
                )}
              </div>
            </div>

            {/* What Bylda already knows — the context receipt before the run */}
            {businessCtxQ.data &&
              (() => {
                const block = (b: unknown) =>
                  b && typeof b === "object" ? (b as Record<string, unknown>) : {};
                const identity = block(businessCtxQ.data.identity);
                const customer = block(businessCtxQ.data.customer);
                const stageB = block(businessCtxQ.data.stage);
                const chips = [
                  typeof identity.industry === "string" && identity.industry
                    ? String(identity.industry)
                    : null,
                  typeof identity.description === "string" && identity.description
                    ? String(identity.description).slice(0, 60) +
                      (String(identity.description).length > 60 ? "…" : "")
                    : null,
                  typeof stageB.stage === "string" && stageB.stage ? `${stageB.stage} stage` : null,
                  typeof stageB.lane === "string" && stageB.lane ? `${stageB.lane} lane` : null,
                  typeof customer.target === "string" && customer.target
                    ? `→ ${customer.target}`
                    : null,
                ].filter(Boolean) as string[];
                if (chips.length === 0) return null;
                return (
                  <div
                    className="flex flex-wrap items-center gap-1.5 px-5 py-2.5"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "color-mix(in oklab, var(--primary) 3%, transparent)",
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--primary)" }}
                    >
                      Bylda knows:
                    </span>
                    {chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full px-2 py-0.5 text-[10.5px]"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {c}
                      </span>
                    ))}
                    <Link
                      to="/app/settings"
                      className="ml-auto text-[10.5px] underline-offset-2 hover:underline"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Edit context
                    </Link>
                  </div>
                );
              })()}

            {/* Workspace Profile Quick-edit panel */}
            {profileModalOpen && (
              <div
                className="px-5 py-4 space-y-3"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--primary) 3%, var(--surface-2))",
                }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--primary)" }}
                  >
                    Workspace Profile — auto pre-fills all tools
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    className="text-[11px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: "business_name",
                        label: "Business name",
                        placeholder: "e.g. Northwind Labs",
                      },
                      {
                        key: "target_market",
                        label: "Target market",
                        placeholder: "e.g. B2B SaaS founders",
                      },
                      {
                        key: "revenue_model",
                        label: "Revenue model",
                        placeholder: "e.g. SaaS subscription",
                      },
                      { key: "stage", label: "Stage", placeholder: "e.g. Pre-seed, Seed" },
                    ] as Array<{ key: keyof WorkspaceProfile; label: string; placeholder: string }>
                  ).map((pf) => (
                    <div key={pf.key}>
                      <div
                        className="mb-1 text-[10.5px] font-medium"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {pf.label}
                      </div>
                      <input
                        type="text"
                        placeholder={pf.placeholder}
                        value={workspaceProfile[pf.key] ?? ""}
                        onChange={(e) => {
                          const updated = { ...workspaceProfile, [pf.key]: e.target.value };
                          setWorkspaceProfile(updated);
                          saveWorkspaceProfile(updated);
                          // Immediately apply to current form fields
                          const fills = getProfilePrefills(
                            toolFieldDefs?.map((f) => f.key) ?? [],
                            updated,
                          );
                          setFields((prev) => ({ ...fills, ...prev }));
                        }}
                        className="w-full rounded-lg px-3 py-1.5 text-[12.5px] outline-none"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="col-span-2">
                  <div
                    className="mb-1 text-[10.5px] font-medium"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Business description
                  </div>
                  <textarea
                    rows={2}
                    placeholder="What your business does, who it serves, and your core value prop."
                    value={workspaceProfile.description ?? ""}
                    onChange={(e) => {
                      const updated = { ...workspaceProfile, description: e.target.value };
                      setWorkspaceProfile(updated);
                      saveWorkspaceProfile(updated);
                      const fills = getProfilePrefills(
                        toolFieldDefs?.map((f) => f.key) ?? [],
                        updated,
                      );
                      setFields((prev) => ({ ...fills, ...prev }));
                    }}
                    className="w-full resize-none rounded-lg px-3 py-1.5 text-[12.5px] outline-none"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <p className="text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
                  Saved automatically · fills matching fields across all tools
                </p>
              </div>
            )}

            <div className="space-y-5 px-5 py-5">
              {/* Run identity */}
              <Section
                label="Run name"
                hint="Give this run a memorable name — used as the asset title."
              >
                <Input
                  placeholder="e.g. Northwind Labs — initial launch"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                />
              </Section>

              {/* Per-tool fields — pre-briefed from the Business Context Graph.
                  Fields Bylda already knows render read-only in the "Bylda knows"
                  panel (inline-editable on click); only genuinely unknown
                  fields render as inputs. Tools without a field config get a
                  synthesized generic context field, prefilled the same way. */}
              <PreBriefedToolLauncher
                fieldDefs={
                  toolFieldDefs ?? [
                    {
                      key: "context",
                      label: "Context",
                      hint: "Be specific about your idea, audience, and the outcome you want.",
                      placeholder:
                        "Describe your business, audience, and goal. The more specific, the better the output.",
                      type: "textarea",
                      required: true,
                    },
                  ]
                }
                fields={fields}
                setField={setField}
                revision={
                  typeof businessCtxQ.data?.version === "number" ? businessCtxQ.data.version : null
                }
                carryNote={search.fromRun ? "output from your last run" : undefined}
              />

              {/* Clear + char count row */}
              {primaryFieldValue && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFields({});
                      setTitle("");
                      clearDraft(currentOrgId, tool.key);
                    }}
                    className="inline-flex items-center gap-1 text-[11.5px] transition-colors hover:text-foreground"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <RotateCcw className="h-3 w-3" /> Clear all
                  </button>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !formValid || !effectiveWired}
                className={cn(
                  "relative h-11 w-full rounded-xl text-[13.5px] font-semibold transition-all duration-200",
                  "flex items-center justify-center gap-2 overflow-hidden",
                  (generating || !formValid || !effectiveWired) && "cursor-not-allowed opacity-50",
                )}
                style={{
                  background: "var(--primary)",
                  color: "white",
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating with AI…
                  </>
                ) : ideaValidatorBlocked || isToolLocked ? (
                  <>
                    <Lock className="h-4 w-4" />{" "}
                    {requiredPlan
                      ? `Upgrade to ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}`
                      : "Upgrade to continue"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate —{" "}
                    {briefedButtonLabel(
                      toolFieldDefs ?? [
                        { key: "context", label: "Context", type: "textarea", required: true },
                      ],
                      fields,
                      typeof businessCtxQ.data?.version === "number"
                        ? businessCtxQ.data.version
                        : null,
                    )}
                  </>
                )}
              </button>

              {isFreeStarter && isIdeaValidator && (
                <p
                  className="text-center text-[11.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Free plan · {Math.min(ideaValidatorRuns, 3)} of 3 free validations used
                </p>
              )}
              {isToolLocked && requiredPlan && (
                <p
                  className="text-center text-[11.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Requires {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan ·{" "}
                  <Link
                    to="/app/billing"
                    className="underline transition-colors hover:text-foreground"
                  >
                    View plans
                  </Link>
                </p>
              )}
              {!effectiveWired && (
                <p
                  className="text-center text-[11.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  This tool is launching soon. Inputs save as drafts.
                </p>
              )}
            </div>
          </div>

          {effectiveWired && (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  borderBottom: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
                  background: "color-mix(in oklab, var(--surface-2) 40%, transparent)",
                }}
              >
                <div
                  className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <HistoryIcon className="h-3 w-3" /> Recent runs
                </div>
                <Link
                  to="/app/launchpad/history"
                  className="text-[11px] transition-colors hover:text-foreground"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  See all →
                </Link>
              </div>
              {runsQ.isLoading ? (
                <div className="space-y-px px-5 py-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/5 rounded" />
                        <Skeleton className="h-2.5 w-2/5 rounded" />
                      </div>
                      <Skeleton className="ml-4 h-3 w-3 shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              ) : toolRuns.length === 0 ? (
                <div
                  className="px-5 py-6 text-center text-[12.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  No runs yet. Your first generation will appear here.
                </div>
              ) : (
                <div
                  className="divide-y"
                  style={{ borderColor: "color-mix(in oklab, var(--border) 60%, transparent)" }}
                >
                  {toolRuns.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        const out = (r.output ?? null) as Record<string, unknown> | null;
                        setOutput(out);
                        setRunId(r.id);
                        setRunError(null);
                        // Viewing a past run — its momentum receipt is history, not news.
                        setMomentum(null);
                        setNextPromptDismissed(false);
                        setLearnedFacts([]);
                        const fb = (r as Record<string, unknown>).feedback as string | undefined;
                        setFeedback(fb === "up" ? "up" : fb === "down" ? "down" : null);
                      }}
                      className="flex w-full items-center justify-between px-5 py-2.5 text-left transition"
                      style={{ borderColor: "color-mix(in oklab, var(--border) 60%, transparent)" }}
                      onMouseEnter={(e: React.MouseEvent) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      }}
                      onMouseLeave={(e: React.MouseEvent) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <div className="min-w-0">
                        <div
                          className="truncate text-[13px] font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {(r.input as { business?: string; title?: string })?.business ||
                            (r.input as { title?: string })?.title ||
                            "Untitled run"}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {new Date(r.created_at).toLocaleString()} · {r.status}
                        </div>
                      </div>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — output */}
        <div className="lg:col-span-2">
          <div
            className="sticky overflow-hidden rounded-xl"
            style={{
              top: "72px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="px-5 py-4"
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <OutputHeader
                onCopy={output ? handleCopy : undefined}
                onDownload={output ? downloadJSON : undefined}
                onSave={output ? saveToAssets : undefined}
                onFeedback={output ? sendFeedback : undefined}
                feedback={feedback}
              />
            </div>

            <div className="px-5 pb-5 pt-4">
              {/* Failed run: a real inline error with retry — not just a toast
                  that disappears while the panel sits empty. */}
              {!output && !generating && runError && (
                <ErrorState
                  variant={
                    /timed out|stopped responding|connection/i.test(runError)
                      ? "network"
                      : "generic"
                  }
                  title="This run didn't finish"
                  description={runError}
                  onRetry={handleGenerate}
                  retryLabel="Run again"
                  compact
                />
              )}

              {!output && !generating && !runError && (
                <EmptyState
                  variant="inline"
                  icon={FileText}
                  title="No output yet"
                  description={
                    isToolLocked
                      ? `Upgrade to ${requiredPlan ?? "a higher plan"} to run this tool.`
                      : effectiveWired
                        ? "Fill in the fields on the left, then generate to see your structured output here."
                        : "This tool is launching soon. Your inputs are auto-saved as a draft."
                  }
                  className="py-10"
                />
              )}

              {generating && (
                <ByldaThinking streamText={streamText} toolName={tool.name} toolKey={tool.key} />
              )}

              {output && !generating && (
                <div className="max-h-[68vh] overflow-y-auto pr-1">
                  {hasStructuredOutput(coreOutput) ? (
                    /* Research-enriched tools return the structured contract
                       (verdict/chips/drawers/guidance) — premium renderer.
                       Everything else stays on the legacy per-tool renderer. */
                    <ToolOutput
                      toolName={tool.name}
                      output={coreOutput}
                      runId={runId}
                      runTitle={title}
                      contextValue={primaryFieldValue}
                    />
                  ) : (
                    <OutputBody toolKey={effectiveToolKey || tool.key} output={coreOutput} />
                  )}
                  {contextUsed.length > 0 && (
                    <div
                      className="mt-4 rounded-xl border p-3"
                      style={{
                        borderColor: "color-mix(in oklab, var(--primary) 22%, var(--border))",
                        background: "color-mix(in oklab, var(--primary) 3%, transparent)",
                      }}
                    >
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--primary)" }}
                      >
                        Based on your business
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {contextUsed.slice(0, 6).map((c, i) => (
                          <span
                            key={i}
                            className="rounded-full px-2 py-0.5 text-[10.5px]"
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <PostRunMomentum momentum={momentum} facts={learnedFacts} />
                  {nextActions.length > 0 && (
                    <div className="mt-4">
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Bylda recommends next
                      </div>
                      <div className="mt-2 space-y-2">
                        {nextActions.slice(0, 3).map((a, i) => {
                          const slug = a.target ? (slugByToolKey.get(a.target) ?? a.target) : null;
                          const isTool =
                            a.type === "tool" &&
                            !!slug &&
                            launchpadCatalog.some((t) => t.key === slug);
                          const inner = (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12.5px] font-semibold">{a.label}</span>
                                {isTool && (
                                  <ArrowRight
                                    className="h-3.5 w-3.5 shrink-0"
                                    style={{ color: "var(--primary)" }}
                                  />
                                )}
                              </div>
                              <p
                                className="mt-0.5 text-[11.5px] leading-relaxed"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                {a.reason}
                              </p>
                            </>
                          );
                          return isTool ? (
                            <Link
                              key={i}
                              to="/app/launchpad/$tool"
                              params={{ tool: slug! }}
                              search={{ fromRun: runId ?? undefined, title } as never}
                              className="block rounded-xl border p-3 transition hover:-translate-y-0.5"
                              style={{
                                borderColor:
                                  "color-mix(in oklab, var(--primary) 30%, var(--border))",
                                background: "var(--surface)",
                              }}
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div
                              key={i}
                              className="rounded-xl border p-3"
                              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                            >
                              {inner}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {output && !nextPromptDismissed && (
              <NextToolPrompt
                toolKey={tool.key}
                runId={runId}
                runTitle={title}
                contextValue={primaryFieldValue}
                nextActions={allNextActions}
                slugByToolKey={slugByToolKey}
                onDismiss={() => setNextPromptDismissed(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-[12.5px] font-semibold" style={{ color: "var(--foreground)" }}>
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
