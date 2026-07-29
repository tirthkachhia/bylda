// Context-driven tool recommendations for the Workbench.
// Rules engine v1: lane + stage + mode + completed runs → up to 3 tools,
// each with a human-readable REASON (the anti-"wall of tools" mechanic:
// the default surface is the recommendation, not the catalog).

export interface ToolRecommendation {
  slug: string;
  reason: string;
}

interface RecommendInput {
  lane?: string | null;
  stage?: string | null;
  mode?: string | null;
  /** Industry/business type collected during onboarding, if known. */
  industry?: string | null;
  /** slugs of tools the org has already run at least once */
  completedSlugs: Set<string>;
}

// Ordered playlists per lane — first uncompleted wins.
const LANE_PLAYLISTS: Record<string, Array<{ slug: string; reason: string }>> = {
  Idea: [
    { slug: "idea-validator", reason: "You're in the Idea lane — score it before you build it." },
    {
      slug: "kill-my-idea",
      reason: "Your idea is scored — now stress-test it before the market does.",
    },
    {
      slug: "competitor-scanner",
      reason: "Validated and pressure-tested — map who you're up against.",
    },
    { slug: "gtm-strategy-builder", reason: "Research done — turn it into a go-to-market plan." },
  ],
  Offer: [
    { slug: "positioning-engine", reason: "Offer lane: lock your market position first." },
    { slug: "pricing-calculator", reason: "Position set — now price it with real numbers." },
    { slug: "gtm-strategy-builder", reason: "Offer and price ready — build the plan to sell it." },
    { slug: "landing-page-creator", reason: "Turn your offer into a page that converts." },
  ],
  Customer: [
    {
      slug: "first-10-customers-finder",
      reason: "Customer lane: a word-for-word playbook to land your first 10.",
    },
    { slug: "pitch-generator", reason: "Outreach started — sharpen the pitch they hear." },
    { slug: "email-sequence", reason: "Prospects need 5+ touches — automate the follow-up." },
    { slug: "landing-page-creator", reason: "Give your outreach somewhere to convert." },
  ],
  Systems: [
    {
      slug: "kpi-dashboard",
      reason: "Systems lane: define the numbers you'll run the business by.",
    },
    { slug: "gtm-strategy-builder", reason: "Build a GTM your team can run without you." },
    { slug: "email-sequence", reason: "Turn manual follow-up into a system." },
    { slug: "seo-audit", reason: "Compound channel: find what your site is leaving on the table." },
  ],
};

// Stage fallbacks when lane is unknown.
const STAGE_FALLBACKS: Record<string, Array<{ slug: string; reason: string }>> = {
  Idea: LANE_PLAYLISTS.Idea,
  Validate: LANE_PLAYLISTS.Idea,
  Launch: LANE_PLAYLISTS.Customer,
  Operate: LANE_PLAYLISTS.Systems,
  Scale: LANE_PLAYLISTS.Systems,
};

export function recommendTools({
  lane,
  stage,
  mode,
  industry,
  completedSlugs,
}: RecommendInput): ToolRecommendation[] {
  const playlist =
    (mode === "operate" ? LANE_PLAYLISTS.Systems : undefined) ??
    (lane ? LANE_PLAYLISTS[lane] : undefined) ??
    (stage ? STAGE_FALLBACKS[stage] : undefined) ??
    LANE_PLAYLISTS.Idea;

  const next = playlist.filter((t) => !completedSlugs.has(t.slug)).slice(0, 3);

  // Everything in the playlist is done — celebrate forward motion instead.
  if (next.length === 0) {
    return playlist
      .slice(0, 3)
      .map((t) => ({ slug: t.slug, reason: "Run it again with what you've learned since." }));
  }

  // Tie the top pick back to the founder's stated business type, so the
  // "start here" recommendation visibly reflects onboarding, not just stage.
  if (industry) {
    next[0] = { ...next[0], reason: `${next[0].reason} Tailored for your ${industry} business.` };
  }
  return next;
}
