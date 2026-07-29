// Client-side guest/demo mode. No Supabase calls. No persistence beyond sessionStorage.
import { useSyncExternalStore } from "react";

export const GUEST_USER = {
  id: "guest-commander",
  full_name: "Ansh Patel",
  email: "demo@apexgrowth.partners",
  plan: "scale" as const,
  stage: "Scale" as const,
};

export const GUEST_ORG_ID = "guest-org";

// The single account that sees the fully-populated front-end demo (no backend).
// When this email signs in, the client-side demo layer is switched on for them
// (and only them); every other account is unaffected.
export const DEMO_ACCOUNT_EMAIL = "ansh.patel102104@gmail.com";

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === DEMO_ACCOUNT_EMAIL;
}

const STORAGE_KEY = "bylda-guest-mode";

type GuestState = {
  isGuest: boolean;
  gateOpen: boolean;
  gateReason: string | null;
};

let state: GuestState = {
  isGuest: (() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  })(),
  gateOpen: false,
  gateReason: null,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function setState(patch: Partial<GuestState>) {
  state = { ...state, ...patch };
  emit();
}

export const guestStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  enable: () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setState({ isGuest: true });
  },
  disable: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState({ isGuest: false, gateOpen: false });
  },
  openGate: (reason?: string) => setState({ gateOpen: true, gateReason: reason ?? null }),
  closeGate: () => setState({ gateOpen: false }),
};

export function useGuest() {
  const snap = useSyncExternalStore(guestStore.subscribe, guestStore.get, guestStore.get);
  return {
    ...snap,
    enable: guestStore.enable,
    disable: guestStore.disable,
    openGate: guestStore.openGate,
    closeGate: guestStore.closeGate,
  };
}

/** Helper for action handlers: returns true if blocked (caller should bail). */
export function blockIfGuest(reason?: string): boolean {
  if (state.isGuest) {
    guestStore.openGate(reason);
    return true;
  }
  return false;
}

// ─────────── Mock data ───────────
const now = Date.now();
const day = 86400000;
const period = new Date().toISOString().slice(0, 7);

// Deal / pipeline rows (read by the CRM at /app/bylda/crm via leadsQuery).
type GuestLead = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  stage: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
  value: number;
  tags: string[];
  score: number;
  priority: "low" | "medium" | "high";
  owner_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const lead = (
  id: string,
  name: string,
  email: string,
  phone: string,
  company: string,
  stage: GuestLead["stage"],
  source: string,
  value: number,
  tags: string[],
  score: number,
  priority: GuestLead["priority"],
  notes: string,
  ageDays: number,
): GuestLead => ({
  id,
  organization_id: GUEST_ORG_ID,
  user_id: GUEST_USER.id,
  name,
  email,
  phone,
  company,
  stage,
  source,
  value,
  tags,
  score,
  priority,
  owner_name: "Ansh Patel",
  notes,
  created_at: new Date(now - ageDays * day).toISOString(),
  updated_at: new Date(now - Math.max(1, Math.floor(ageDays / 4)) * day).toISOString(),
});

// prettier-ignore
export const GUEST_LEADS: GuestLead[] = [
  lead("g-l1", "Northwind Labs — Enterprise rollout", "sarah.chen@northwindlabs.io", "+1 415 555 0114", "Northwind Labs", "Proposal", "LinkedIn", 48000, ["enterprise", "hot"], 88, "high", "Proposal sent; verbal yes pending legal.", 12),
  lead("g-l2", "Vortex Digital — Growth retainer", "marcus.webb@vortexdigital.co", "+44 20 7946 0091", "Vortex Digital", "Qualified", "Referral", 36000, ["referral", "hot"], 81, "high", "Demo done; scoping a 6-month retainer.", 9),
  lead("g-l3", "BrightPath Health — RevOps build", "aisha.rao@brightpathhealth.com", "+1 617 555 0177", "BrightPath Health", "Contacted", "Webinar", 54000, ["compliance", "mid-market"], 64, "medium", "Security review in progress.", 15),
  lead("g-l4", "Helio Studio — Creative ops pilot", "diego.romero@heliostudio.io", "+34 91 555 7820", "Helio Studio", "New", "Cold email", 12000, ["smb"], 47, "low", "Inbound reply; qualifying budget.", 21),
  lead("g-l5", "OrbitCraft — Annual contract", "yuki.tanaka@orbitcraft.jp", "+81 3 5555 0190", "OrbitCraft", "Won", "Twitter", 60000, ["customer", "flagship"], 95, "high", "Closed-won. 12-month retainer signed.", 40),
  lead("g-l6", "Lumen Retail — Automation package", "hannah.cole@lumenretail.com", "+1 312 555 0145", "Lumen Retail", "Qualified", "Inbound", 42000, ["seasonal", "hot"], 73, "high", "Wants live before Q4. Strong urgency.", 11),
  lead("g-l7", "Cedar and Co — Starter engagement", "tom.becker@cedarandco.com", "+1 720 555 0133", "Cedar and Co", "Contacted", "Cold email", 9000, ["smb", "price-sensitive"], 55, "medium", "Comparing vendors; price sensitive.", 14),
  lead("g-l8", "Quanta Foods — Growth sprint", "priya.menon@quantafoods.com", "+1 512 555 0166", "Quanta Foods", "Proposal", "Referral", 30000, ["dtc", "champion"], 69, "high", "ROI deck delivered; awaiting sign-off.", 7),
  lead("g-l9", "OrbitCraft — Reporting add-on", "daniel.reyes@orbitcraft.jp", "+81 3 5555 0205", "OrbitCraft", "Qualified", "Customer intro", 15000, ["expansion"], 60, "medium", "Expansion via Yuki referral.", 6),
  lead("g-l10", "BrightPath Health — Phase 2", "emma.larsson@brightpathhealth.com", "+1 617 555 0199", "BrightPath Health", "Qualified", "Webinar", 24000, ["mid-market", "hot"], 77, "high", "Budget confirmed; procurement next.", 18),
  lead("g-l11", "Lumen Retail — Pilot (lost)", "olivia.grant@lumenretail.com", "+1 312 555 0150", "Lumen Retail", "Lost", "Inbound", 8000, ["smb"], 38, "low", "Went with an in-house hire. Revisit in 6 mo.", 28),
  lead("g-l12", "Vortex Digital — Net-new pod", "noah.kim@vortexdigital.co", "+44 20 7946 0123", "Vortex Digital", "New", "LinkedIn", 18000, ["mid-market"], 42, "medium", "Fresh inbound from the Vortex team.", 2),
  lead("g-l13", "Northwind Labs — Add-on seats", "liam.osullivan@northwindlabs.io", "+1 415 555 0188", "Northwind Labs", "Contacted", "LinkedIn", 13000, ["enterprise"], 58, "medium", "Technical buyer looped into the eval.", 10),
  lead("g-l14", "Quanta Foods — Lapsed (cold)", "sofia.marino@quantafoods.com", "+1 512 555 0170", "Quanta Foods", "Lost", "Cold email", 6000, ["dtc"], 34, "low", "No response after 4 touches.", 30),
];

// Contact rows (read by /app/contacts in guest mode).
type GuestContact = {
  id: string;
  user_id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  lead_score: number;
  status: "new" | "contacted" | "qualified" | "engaged" | "nurture" | "cold" | "archived";
  source: string;
  tags: string[];
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
};

const contact = (
  id: string,
  first: string,
  last: string,
  email: string,
  phone: string,
  company: string,
  score: number,
  status: GuestContact["status"],
  source: string,
  tags: string[],
  notes: string,
  touchedDays: number,
  ageDays: number,
): GuestContact => ({
  id,
  user_id: GUEST_USER.id,
  org_id: GUEST_ORG_ID,
  first_name: first,
  last_name: last,
  email,
  phone,
  company,
  lead_score: score,
  status,
  source,
  tags,
  notes,
  last_contacted_at: new Date(now - touchedDays * day).toISOString(),
  created_at: new Date(now - ageDays * day).toISOString(),
});

// prettier-ignore
export const GUEST_CONTACTS: GuestContact[] = [
  contact("g-c1", "Sarah", "Chen", "sarah.chen@northwindlabs.io", "+1 415 555 0114", "Northwind Labs", 88, "qualified", "LinkedIn", ["hot", "enterprise", "decision-maker"], "VP Eng. Wants a Q3 rollout. Sent proposal.", 1, 12),
  contact("g-c2", "Marcus", "Webb", "marcus.webb@vortexdigital.co", "+44 20 7946 0091", "Vortex Digital", 81, "engaged", "Referral", ["hot", "referral"], "Referred by OrbitCraft. Demo booked.", 2, 9),
  contact("g-c3", "Aisha", "Rao", "aisha.rao@brightpathhealth.com", "+1 617 555 0177", "BrightPath Health", 64, "contacted", "Webinar", ["mid-market", "compliance"], "Attended the RevOps webinar. Security review pending.", 4, 15),
  contact("g-c4", "Diego", "Romero", "diego.romero@heliostudio.io", "+34 91 555 7820", "Helio Studio", 47, "nurture", "Cold email", ["smb"], "Interested but no budget until next quarter.", 8, 21),
  contact("g-c5", "Yuki", "Tanaka", "yuki.tanaka@orbitcraft.jp", "+81 3 5555 0190", "OrbitCraft", 95, "qualified", "Twitter", ["hot", "customer", "upsell"], "Closed-won. Reporting add-on upsell in motion.", 1, 40),
  contact("g-c6", "Hannah", "Cole", "hannah.cole@lumenretail.com", "+1 312 555 0145", "Lumen Retail", 73, "engaged", "Inbound", ["mid-market", "seasonal"], "Wants automation live before Q4 peak.", 3, 11),
  contact("g-c7", "Tom", "Becker", "tom.becker@cedarandco.com", "+1 720 555 0133", "Cedar and Co", 55, "contacted", "Cold email", ["smb", "price-sensitive"], "Comparing two vendors. Follow up Friday.", 5, 14),
  contact("g-c8", "Priya", "Menon", "priya.menon@quantafoods.com", "+1 512 555 0166", "Quanta Foods", 69, "engaged", "Referral", ["dtc", "champion"], "VP Growth is championing internally. Needs ROI deck.", 2, 7),
  contact("g-c9", "Liam", "OSullivan", "liam.osullivan@northwindlabs.io", "+1 415 555 0188", "Northwind Labs", 58, "contacted", "LinkedIn", ["enterprise", "technical"], "Technical buyer at Northwind. Looped into eval.", 6, 10),
  contact("g-c10", "Noah", "Kim", "noah.kim@vortexdigital.co", "+44 20 7946 0123", "Vortex Digital", 42, "new", "LinkedIn", ["mid-market"], "New inbound from the Vortex team.", 1, 2),
  contact("g-c11", "Emma", "Larsson", "emma.larsson@brightpathhealth.com", "+1 617 555 0199", "BrightPath Health", 77, "qualified", "Webinar", ["mid-market", "hot"], "Budget confirmed. Procurement next.", 2, 18),
  contact("g-c12", "Olivia", "Grant", "olivia.grant@lumenretail.com", "+1 312 555 0150", "Lumen Retail", 38, "nurture", "Inbound", ["smb"], "Early stage. Drip nurture for now.", 12, 20),
  contact("g-c13", "Daniel", "Reyes", "daniel.reyes@orbitcraft.jp", "+81 3 5555 0205", "OrbitCraft", 60, "contacted", "Customer intro", ["expansion"], "Intro from Yuki for a sister team.", 4, 6),
  contact("g-c14", "Sofia", "Marino", "sofia.marino@quantafoods.com", "+1 512 555 0170", "Quanta Foods", 34, "cold", "Cold email", ["dtc"], "No response after 4 touches. Pausing.", 25, 30),
];

// Mentor / intelligence signals (read by mentorInsightsQuery in guest mode).
// prettier-ignore
export const GUEST_INSIGHTS = [
  { id: "g-i1", org_id: GUEST_ORG_ID, agent_id: "sales", type: "opportunity" as const, title: "3 deals are stuck in Proposal", detail: "Northwind, Quanta, and BrightPath have been in Proposal 5+ days. A nudge sequence could recover ~$102k.", priority: "high" as const, read: false, n8n_run_id: null, created_at: new Date(now - 6 * 3600 * 1000).toISOString() },
  { id: "g-i2", org_id: GUEST_ORG_ID, agent_id: "growth", type: "signal" as const, title: "Referrals are your best channel", detail: "Referral leads convert 2.4x higher than cold. Ask your 3 happiest clients for intros this week.", priority: "medium" as const, read: false, n8n_run_id: null, created_at: new Date(now - 1 * day).toISOString() },
  { id: "g-i3", org_id: GUEST_ORG_ID, agent_id: "automation", type: "recommendation" as const, title: "Turn on invoice reminders", detail: "It is the only automation still off. Clients pay ~6 days faster with reminders on.", priority: "medium" as const, read: false, n8n_run_id: null, created_at: new Date(now - 2 * day).toISOString() },
  { id: "g-i4", org_id: GUEST_ORG_ID, agent_id: "finance", type: "signal" as const, title: "Pipeline up 18% week-over-week", detail: "Open pipeline grew to ~$272k. Won this month: OrbitCraft ($60k).", priority: "low" as const, read: true, n8n_run_id: null, created_at: new Date(now - 3 * day).toISOString() },
  { id: "g-i5", org_id: GUEST_ORG_ID, agent_id: "content", type: "opportunity" as const, title: "Repurpose the OrbitCraft win", detail: "A case study from the OrbitCraft rollout would arm outbound to similar PLG SaaS.", priority: "medium" as const, read: false, n8n_run_id: null, created_at: new Date(now - 4 * day).toISOString() },
  { id: "g-i6", org_id: GUEST_ORG_ID, agent_id: "sales", type: "warning" as const, title: "Quanta Foods is going cold", detail: "No reply after 4 touches on the lapsed deal. Last chance before close-lost.", priority: "high" as const, read: false, n8n_run_id: null, created_at: new Date(now - 5 * day).toISOString() },
];

// Derived KPI snapshot for the mode-aware Home (mirrors mentorKPIsQuery output).
export const GUEST_KPIS = (() => {
  const wonLeads = GUEST_LEADS.filter((l) => l.stage === "Won").length;
  const totalLeads = GUEST_LEADS.length;
  const pipelineValue = GUEST_LEADS.reduce((s, l) => s + (l.value ?? 0), 0);
  return {
    mrr: wonLeads * 420,
    pipelineValue,
    execIndex: 78,
    cacRatio: 3.2,
    wonLeads,
    totalLeads,
    completedRuns: 16,
    activeAutomations: 5,
  };
})();

export const GUEST_ASSETS = [
  {
    id: "g-a1",
    organization_id: GUEST_ORG_ID,
    user_id: GUEST_USER.id,
    kind: "gtm-strategy-builder",
    title: "GTM Plan — Apex Growth Partners",
    metadata: { sections: [] },
    mime_type: null,
    size_bytes: null,
    storage_bucket: null,
    storage_path: null,
    tool_run_id: null,
    created_at: new Date(now - 2 * day).toISOString(),
  },
  {
    id: "g-a2",
    organization_id: GUEST_ORG_ID,
    user_id: GUEST_USER.id,
    kind: "generate-offer",
    title: "Offer — Done-for-you growth engine ($6k–$12k/mo)",
    metadata: { hook: "" },
    mime_type: null,
    size_bytes: null,
    storage_bucket: null,
    storage_path: null,
    tool_run_id: null,
    created_at: new Date(now - 4 * day).toISOString(),
  },
  {
    id: "g-a3",
    organization_id: GUEST_ORG_ID,
    user_id: GUEST_USER.id,
    kind: "generate-followup-sequence",
    title: "5-Touch Reactivation Sequence",
    metadata: { emails: [] },
    mime_type: null,
    size_bytes: null,
    storage_bucket: null,
    storage_path: null,
    tool_run_id: null,
    created_at: new Date(now - 7 * day).toISOString(),
  },
  {
    id: "g-a4",
    organization_id: GUEST_ORG_ID,
    user_id: GUEST_USER.id,
    kind: "competitor-scanner",
    title: "Competitor Scan — RevOps & growth agencies",
    metadata: {
      tier1: [{ name: "RevPilot" }, { name: "GrowthForge" }, { name: "PipelineIQ" }],
      tier2: [{ name: "Generic marketing freelancers" }],
      gaps: ["No system handoff after the engagement ends", "Reporting is manual and slow"],
      winning_angle:
        "Position as the only agency that leaves behind a running system — competitors sell hours, we install an engine the client keeps.",
      full_report: "",
    },
    mime_type: null,
    size_bytes: null,
    storage_bucket: null,
    storage_path: null,
    tool_run_id: null,
    created_at: new Date(now - 5 * day).toISOString(),
  },
];

const run = (id: string, toolKey: string, ageDays: number) => ({
  id,
  organization_id: GUEST_ORG_ID,
  user_id: GUEST_USER.id,
  tool_key: toolKey,
  status: "succeeded" as const,
  input: {},
  output: {},
  error: null,
  metadata: {},
  created_at: new Date(now - ageDays * day).toISOString(),
  updated_at: new Date(now - ageDays * day).toISOString(),
});

export const GUEST_TOOL_RUNS = [
  run("g-r1", "validate-idea", 34),
  run("g-r2", "competitor-scanner", 30),
  run("g-r3", "persona-builder", 29),
  run("g-r4", "positioning-engine", 27),
  run("g-r5", "generate-offer", 25),
  run("g-r6", "pricing-calculator", 24),
  run("g-r7", "gtm-strategy-builder", 21),
  run("g-r8", "landing-page-creator", 19),
  run("g-r9", "first-10-customers-finder", 17),
  run("g-r10", "generate-followup-sequence", 14),
  run("g-r11", "cold_email", 12),
  run("g-r12", "kpi-dashboard", 9),
  run("g-r13", "seo-audit", 7),
  run("g-r14", "client_report", 4),
  run("g-r15", "social", 2),
  run("g-r16", "ad-copy", 1),
];

export const GUEST_ORG = {
  id: GUEST_ORG_ID,
  name: "Apex Growth Partners",
  business_type: "Agency",
  niche: "B2B growth & RevOps",
  stage: "Scale" as const,
  goal: "Reach $120k MRR and 25 retained clients",
  location: "Austin, TX",
  offer: "Done-for-you growth engine: CRM, outbound, and reporting on autopilot",
  owner_id: GUEST_USER.id,
  target_customer: "Seed–Series B SaaS founders",
  website_url: "https://apexgrowth.partners",
  created_at: new Date(now - 120 * day).toISOString(),
  updated_at: new Date().toISOString(),
};

export const GUEST_SUBSCRIPTION = {
  id: "guest-sub",
  organization_id: GUEST_ORG_ID,
  plan: GUEST_USER.plan,
  status: "active",
  current_period_end: new Date(now + 365 * day).toISOString(),
  cancel_at_period_end: false,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  created_at: new Date(now - 120 * day).toISOString(),
  updated_at: new Date().toISOString(),
};

// prettier-ignore
export const GUEST_USAGE = [
  { id: "gu1", organization_id: GUEST_ORG_ID, tool_key: "generate-followup-sequence", count: 6, period, last_used_at: new Date().toISOString() },
  { id: "gu2", organization_id: GUEST_ORG_ID, tool_key: "client_report", count: 4, period, last_used_at: new Date().toISOString() },
  { id: "gu3", organization_id: GUEST_ORG_ID, tool_key: "gtm-strategy-builder", count: 3, period, last_used_at: new Date().toISOString() },
  { id: "gu4", organization_id: GUEST_ORG_ID, tool_key: "cold_email", count: 5, period, last_used_at: new Date().toISOString() },
];

export const GUEST_INTEGRATIONS: {
  id: string;
  user_id: string;
  integration_key: string;
  value_last4: string | null;
  is_connected: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}[] = [];
