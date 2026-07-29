import React, { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  LayoutGrid,
  Zap,
  Megaphone,
  BarChart3,
  Settings,
  X,
  Star,
  ChevronRight,
  Video,
  ExternalLink,
  PlayCircle,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/app/tutorials")({ component: TutorialsPage });

/* ── Types ─────────────────────────────────────────────────────── */
type TutorialCategory =
  | "All"
  | "Getting Started"
  | "CRM & Pipeline"
  | "Automations"
  | "Marketing"
  | "Reports & Analytics"
  | "Settings & Admin";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: Exclude<TutorialCategory, "All">;
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  // Replace these YouTube IDs with your actual tutorial video IDs
  youtubeId: string;
  featured?: boolean;
  /** Direct MP4 URL of the generated walkthrough video (from public.tutorials). */
  videoUrl?: string;
  thumbnailUrl?: string;
}

// Video fields live in the public.tutorials table, written by the tutorial
// video generation pipeline. Static TUTORIALS below stays as the fallback
// catalog when the table is unreachable.
interface TutorialVideoRow {
  id: string;
  youtube_id: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  video_status: "pending" | "generating" | "completed" | "failed";
}

/* Public Supabase Storage base, used for the brand film hero. */
const SUPABASE_PUBLIC_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public`;

/* ── Tutorial data ─────────────────────────────────────────────── */
// IMPORTANT: Replace the youtubeId values with your actual YouTube/Loom video IDs.
// Set youtubeId to "" for videos not yet recorded — they will show as "Coming Soon".
const TUTORIALS: Tutorial[] = [
  // Getting Started
  {
    id: "welcome",
    title: "Welcome to Bylda — Platform Overview",
    description:
      "Get a complete tour of the Bylda AI Operating System and learn what each section does.",
    category: "Getting Started",
    duration: "5:00",
    difficulty: "Beginner",
    youtubeId: "", // TODO: Replace with your YouTube video ID
    featured: true,
  },
  {
    id: "account-setup",
    title: "Setting Up Your Account",
    description: "Complete your profile, organization settings, and first-time configuration.",
    category: "Getting Started",
    duration: "3:30",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "dashboard-tour",
    title: "Navigating the Dashboard",
    description: "Learn how to use the command center, sidebar navigation, and key metrics.",
    category: "Getting Started",
    duration: "4:45",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "onboarding-wizard",
    title: "Completing Your Onboarding",
    description: "Walk through the onboarding wizard to personalize your Bylda experience.",
    category: "Getting Started",
    duration: "6:00",
    difficulty: "Beginner",
    youtubeId: "",
  },

  // CRM & Pipeline
  {
    id: "crm-intro",
    title: "CRM Overview: Contacts, Deals & Pipeline",
    description:
      "Master the full CRM system — adding contacts, creating deals, and managing your pipeline.",
    category: "CRM & Pipeline",
    duration: "8:30",
    difficulty: "Beginner",
    youtubeId: "",
    featured: true,
  },
  {
    id: "kanban-dnd",
    title: "Drag & Drop Kanban Board",
    description:
      "Learn to move deals between pipeline stages using the drag-and-drop Kanban board.",
    category: "CRM & Pipeline",
    duration: "4:00",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "tags-scoring",
    title: "Tags, Lead Scoring & Priority",
    description:
      "Organize deals with tags, set lead scores, and use priority levels for better focus.",
    category: "CRM & Pipeline",
    duration: "5:15",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "pipeline-views",
    title: "Pipeline Views: Kanban, Table, List & Forecast",
    description:
      "Switch between different pipeline views to analyze your deals from multiple angles.",
    category: "CRM & Pipeline",
    duration: "5:45",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "bulk-actions",
    title: "Bulk Actions & Team Operations",
    description:
      "Select multiple deals and perform batch operations — stage updates, tagging, deletion.",
    category: "CRM & Pipeline",
    duration: "3:30",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "activity-timeline",
    title: "Activity Timeline & Deal History",
    description: "Log calls, emails, meetings, and tasks on each deal to build a complete history.",
    category: "CRM & Pipeline",
    duration: "4:45",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "forecast-view",
    title: "Revenue Forecasting & Pipeline Analytics",
    description: "Use the forecast view to calculate weighted pipeline value and predict revenue.",
    category: "CRM & Pipeline",
    duration: "6:00",
    difficulty: "Advanced",
    youtubeId: "",
  },
  {
    id: "crm-settings",
    title: "CRM Display Settings & Custom Views",
    description:
      "Customize which columns, metrics, and cards appear using the display settings panel.",
    category: "CRM & Pipeline",
    duration: "3:15",
    difficulty: "Beginner",
    youtubeId: "",
  },

  // Automations
  {
    id: "workflow-builder",
    title: "Building Your First Automation Workflow",
    description:
      "Create a trigger-based automation workflow from scratch using the visual builder.",
    category: "Automations",
    duration: "9:00",
    difficulty: "Intermediate",
    youtubeId: "",
    featured: true,
  },
  {
    id: "trigger-types",
    title: "Trigger Types: Forms, Stage Changes & More",
    description:
      "Learn all available automation triggers — form submission, stage change, time-based, etc.",
    category: "Automations",
    duration: "7:30",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "multi-step",
    title: "Multi-Step Automation Sequences",
    description: "Build complex multi-step automations with if/then branching and delays.",
    category: "Automations",
    duration: "10:00",
    difficulty: "Advanced",
    youtubeId: "",
  },
  {
    id: "integrations",
    title: "Connecting Third-Party Integrations",
    description:
      "Set up integrations with Gmail, Slack, and other tools in the Integrations panel.",
    category: "Automations",
    duration: "6:00",
    difficulty: "Intermediate",
    youtubeId: "",
  },

  // Marketing
  {
    id: "campaigns",
    title: "Creating Your First Campaign",
    description: "Set up a marketing campaign, define your audience, and schedule messaging.",
    category: "Marketing",
    duration: "7:00",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "leads-capture",
    title: "Lead Capture & Qualification",
    description: "Use the Leads module to capture, score, and qualify inbound leads automatically.",
    category: "Marketing",
    duration: "5:30",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "email-sequences",
    title: "Email Sequences & Drip Campaigns",
    description: "Build multi-email drip sequences that automatically nurture leads over time.",
    category: "Marketing",
    duration: "8:00",
    difficulty: "Intermediate",
    youtubeId: "",
  },

  // Reports & Analytics
  {
    id: "reports-overview",
    title: "Reports Overview",
    description:
      "Learn to read and interpret pipeline reports, activity summaries, and revenue data.",
    category: "Reports & Analytics",
    duration: "5:00",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "ai-dashboard",
    title: "AI Dashboard & Intelligence Metrics",
    description: "Use the AI Dashboard to track model usage, performance, and cost optimization.",
    category: "Reports & Analytics",
    duration: "6:30",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "admin-analytics",
    title: "Admin Hub: Platform-Wide Analytics",
    description: "Track every event, tool use, ROI metric, and user activity from the Admin Hub.",
    category: "Reports & Analytics",
    duration: "7:15",
    difficulty: "Advanced",
    youtubeId: "",
    featured: true,
  },

  // Settings & Admin
  {
    id: "billing",
    title: "Billing & Subscription Management",
    description: "Manage your plan, view invoices, and upgrade or downgrade your subscription.",
    category: "Settings & Admin",
    duration: "3:00",
    difficulty: "Beginner",
    youtubeId: "",
  },
  {
    id: "team-management",
    title: "Team Management & Permissions",
    description: "Invite team members, assign roles, and control access to platform features.",
    category: "Settings & Admin",
    duration: "4:30",
    difficulty: "Intermediate",
    youtubeId: "",
  },
  {
    id: "bylda-memory",
    title: "Bylda Memory & Personalization",
    description: "Configure Bylda AI's memory system so it learns your business context over time.",
    category: "Settings & Admin",
    duration: "5:00",
    difficulty: "Intermediate",
    youtubeId: "",
  },
];

/* ── Category config ─────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<
  Exclude<TutorialCategory, "All">,
  { icon: React.ElementType; color: string; bg: string }
> = {
  "Getting Started": { icon: BookOpen, color: "#059669", bg: "rgba(5,150,105,0.10)" },
  "CRM & Pipeline": { icon: LayoutGrid, color: "#3B82F6", bg: "rgba(59,130,246,0.10)" },
  Automations: { icon: Zap, color: "#7C3AED", bg: "rgba(2, 132, 199,0.10)" },
  Marketing: { icon: Megaphone, color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  "Reports & Analytics": { icon: BarChart3, color: "#EC4899", bg: "rgba(236,72,153,0.10)" },
  "Settings & Admin": { icon: Settings, color: "#6B7280", bg: "rgba(107,114,128,0.10)" },
};

const DIFFICULTY_CONFIG = {
  Beginner: { color: "#059669", bg: "rgba(5,150,105,0.10)" },
  Intermediate: { color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  Advanced: { color: "#7C3AED", bg: "rgba(2, 132, 199,0.10)" },
};

const CATEGORIES: TutorialCategory[] = [
  "All",
  "Getting Started",
  "CRM & Pipeline",
  "Automations",
  "Marketing",
  "Reports & Analytics",
  "Settings & Admin",
];

/* ═══════════════════════════════ PAGE ═══════════════════════════ */
function TutorialsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TutorialCategory>("All");
  const [playing, setPlaying] = useState<Tutorial | null>(null);

  const videosQ = useQuery({
    queryKey: ["tutorial-videos"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tutorials")
        .select("id, youtube_id, video_url, video_thumbnail_url, video_status");
      if (error) throw error;
      return (data ?? []) as TutorialVideoRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const tutorials = useMemo(() => {
    const rows = new Map((videosQ.data ?? []).map((r) => [r.id, r]));
    return TUTORIALS.map((t) => {
      const row = rows.get(t.id);
      if (!row) return t;
      return {
        ...t,
        youtubeId: row.youtube_id ?? t.youtubeId,
        videoUrl: row.video_status === "completed" && row.video_url ? row.video_url : undefined,
        thumbnailUrl: row.video_thumbnail_url ?? undefined,
      };
    });
  }, [videosQ.data]);
  const [watched, setWatched] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("bylda-tutorials-watched");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markWatched = (id: string) => {
    setWatched((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("bylda-tutorials-watched", JSON.stringify(Array.from(next)));
      } catch {
        /* */
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    let arr = tutorials;
    if (category !== "All") arr = arr.filter((t) => t.category === category);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s) ||
          t.category.toLowerCase().includes(s),
      );
    }
    return arr;
  }, [tutorials, category, search]);

  const featured = tutorials.filter((t) => t.featured);
  const completedCount = watched.size;
  const totalCount = tutorials.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="max-w-[1100px] mx-auto space-y-8">
      {/* ── Hero header ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-border)" }}
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display text-[26px] font-bold tracking-tight mb-2"
                style={{ color: "var(--primary)" }}
              >
                Platform Tutorials
              </h1>
              <p className="text-[14px] max-w-lg" style={{ color: "var(--primary)", opacity: 0.8 }}>
                Step-by-step video guides showing you exactly how to use every feature in Bylda.
                Master the platform at your own pace.
              </p>
            </div>
            <div className="shrink-0 hidden sm:block">
              <div className="text-center">
                <div
                  className="font-display text-[32px] font-bold"
                  style={{ color: "var(--primary)" }}
                >
                  {completedCount}/{totalCount}
                </div>
                <div className="text-[12px]" style={{ color: "var(--primary)", opacity: 0.7 }}>
                  tutorials completed
                </div>
                <div
                  className="mt-2 h-2 rounded-full w-32"
                  style={{ background: "color-mix(in oklab, var(--primary) 20%, transparent)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progressPct}%`, background: "var(--primary)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div
            className="flex gap-4 mt-4 text-[12.5px]"
            style={{ color: "var(--primary)", opacity: 0.8 }}
          >
            <span className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" />
              {totalCount} videos
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              ~4.5 hours total
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              {tutorials.filter((t) => t.difficulty === "Beginner").length} beginner-friendly
            </span>
          </div>
        </div>
      </div>

      {/* ── Brand film ── */}
      {category === "All" && !search && (
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ border: "1px solid var(--border)", background: "rgb(11,14,26)" }}
        >
          <video
            className="w-full block"
            style={{ aspectRatio: "16 / 9", objectFit: "cover" }}
            src={`${SUPABASE_PUBLIC_BASE}/tutorial-videos/promo/bylda-brand-film.mp4`}
            poster={`${SUPABASE_PUBLIC_BASE}/tutorial-videos/promo/bylda-brand-film.jpg`}
            controls
            playsInline
            preload="none"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            <span
              className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full"
              style={{ background: "rgba(240,101,58,0.92)", color: "white" }}
            >
              THE FILM
            </span>
            <span className="text-[12px] font-medium text-white/90">
              Launchpad Bylda — From idea → scale
            </span>
          </div>
        </div>
      )}

      {/* ── Featured tutorials ── */}
      {category === "All" && !search && (
        <div>
          <h2
            className="font-display text-[16px] font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Featured Tutorials
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {featured.map((t) => (
              <TutorialCard
                key={t.id}
                tutorial={t}
                watched={watched.has(t.id)}
                featured
                onClick={() => {
                  setPlaying(t);
                  markWatched(t.id);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Search + category filters ── */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tutorials…"
            className="w-full h-10 rounded-xl pl-10 pr-3 text-[13px] outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const cfg = cat !== "All" ? CATEGORY_CONFIG[cat] : null;
            const isA = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all"
                style={
                  isA
                    ? { background: cfg?.color ?? "var(--foreground)", color: "white" }
                    : {
                        background: "var(--surface-2)",
                        color: "var(--muted-foreground)",
                        border: "1px solid var(--border)",
                      }
                }
              >
                {cfg && <cfg.icon className="h-3.5 w-3.5" />}
                {cat}
                {cat !== "All" && (
                  <span
                    className="rounded-full px-1.5 text-[10px] font-bold"
                    style={{ background: isA ? "rgba(255,255,255,0.25)" : "var(--surface-2)" }}
                  >
                    {tutorials.filter((t) => t.category === cat).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tutorial grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Video
            className="h-10 w-10 mb-3"
            style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
          />
          <p className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
            No tutorials found
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted-foreground)" }}>
            Try adjusting your search or category filter
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-display text-[16px] font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {category === "All" ? "All Tutorials" : category}
                <span
                  className="ml-2 text-[14px] font-normal"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  ({filtered.length})
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <TutorialCard
                  key={t.id}
                  tutorial={t}
                  watched={watched.has(t.id)}
                  onClick={() => {
                    setPlaying(t);
                    markWatched(t.id);
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Video modal ── */}
      {playing && <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/* ── Tutorial card ───────────────────────────────────────────── */
function TutorialCard({
  tutorial,
  watched,
  featured = false,
  onClick,
}: {
  tutorial: Tutorial;
  watched: boolean;
  featured?: boolean;
  onClick: () => void;
}) {
  const catCfg = CATEGORY_CONFIG[tutorial.category];
  const diffCfg = DIFFICULTY_CONFIG[tutorial.difficulty];
  const hasVideo = !!(tutorial.videoUrl || tutorial.youtubeId);

  return (
    <div
      onClick={onClick}
      className="flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-border)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-xs)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative aspect-video flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${catCfg.color}30, ${catCfg.color}10)` }}
      >
        {tutorial.videoUrl ? (
          tutorial.thumbnailUrl ? (
            <img
              src={tutorial.thumbnailUrl}
              alt={tutorial.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={tutorial.videoUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          )
        ) : hasVideo ? (
          <img
            src={`https://img.youtube.com/vi/${tutorial.youtubeId}/mqdefault.jpg`}
            alt={tutorial.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <catCfg.icon className="h-10 w-10" style={{ color: catCfg.color, opacity: 0.6 }} />
            <span
              className="text-[11px] font-medium rounded-full px-2.5 py-1"
              style={{ background: catCfg.bg, color: catCfg.color }}
            >
              Coming Soon
            </span>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
          <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
            <Play className="h-5 w-5 ml-0.5" style={{ color: catCfg.color }} />
          </div>
        </div>

        {/* Watched badge */}
        {watched && (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center shadow">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          </div>
        )}

        {/* Duration */}
        <div
          className="absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
        >
          <Clock className="h-2.5 w-2.5 inline mr-0.5" />
          {tutorial.duration}
        </div>

        {/* Featured star */}
        {featured && (
          <div
            className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1"
            style={{ background: "rgba(0,0,0,0.6)", color: "#FCD34D" }}
          >
            <Star className="h-2.5 w-2.5" />
            Featured
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: catCfg.bg, color: catCfg.color }}
          >
            <catCfg.icon className="h-2.5 w-2.5" />
            {tutorial.category}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: diffCfg.bg, color: diffCfg.color }}
          >
            {tutorial.difficulty}
          </span>
        </div>
        <h3
          className="font-semibold text-[13px] leading-snug mb-1.5"
          style={{ color: "var(--foreground)" }}
        >
          {tutorial.title}
        </h3>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {tutorial.description}
        </p>
      </div>
    </div>
  );
}

/* ── Video modal ─────────────────────────────────────────────── */
function VideoModal({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const catCfg = CATEGORY_CONFIG[tutorial.category];
  const hasVideo = !!(tutorial.videoUrl || tutorial.youtubeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Video area */}
        <div className="aspect-video bg-black">
          {tutorial.videoUrl ? (
            <video
              src={tutorial.videoUrl}
              poster={tutorial.thumbnailUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full"
            />
          ) : hasVideo ? (
            <iframe
              src={`https://www.youtube.com/embed/${tutorial.youtubeId}?autoplay=1&rel=0`}
              title={tutorial.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${catCfg.color}20, ${catCfg.color}05)`,
              }}
            >
              <div
                className="h-20 w-20 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: catCfg.bg }}
              >
                <PlayCircle className="h-10 w-10" style={{ color: catCfg.color }} />
              </div>
              <h3 className="text-white text-[18px] font-bold mb-2">Video Coming Soon</h3>
              <p className="text-[14px] text-white/70 text-center max-w-sm px-4">
                This tutorial video is being recorded. Check back soon for step-by-step guidance on{" "}
                {tutorial.title.toLowerCase()}.
              </p>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="p-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: catCfg.bg, color: catCfg.color }}
              >
                <catCfg.icon className="h-2.5 w-2.5" />
                {tutorial.category}
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                <Clock className="h-2.5 w-2.5 inline mr-1" />
                {tutorial.duration}
              </span>
            </div>
            <h2
              className="font-display text-[17px] font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {tutorial.title}
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
              {tutorial.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
