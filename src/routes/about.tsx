import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Rocket,
  Sparkles,
  Zap,
  Target,
  FileText,
  PenLine,
  BarChart2,
  Users,
  ArrowRight,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #06060f 0%, #0a0a1e 50%, #06060f 100%)",
        color: "var(--foreground, #f0f4ff)",
      }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-50 flex h-14 items-center justify-between px-6 md:px-10"
        style={{
          background: "rgba(6,6,15,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(59,130,246,0.08)",
        }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              boxShadow: "0 0 16px rgba(59,130,246,0.4)",
            }}
          >
            LN
          </div>
          <span
            className="font-display text-[13.5px] font-bold tracking-tight"
            style={{ color: "#f0f4ff" }}
          >
            LaunchpadBYLDA
          </span>
        </Link>
        <nav
          className="hidden items-center gap-6 text-[13px] md:flex"
          style={{ color: "rgba(240,244,255,0.5)" }}
        >
          <Link to="/" className="transition-colors hover:text-white">
            Home
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-white">
            Pricing
          </Link>
          <Link to="/about" style={{ color: "#3b82f6" }}>
            About
          </Link>
        </nav>
        <Link
          to="/auth/sign-in"
          className="rounded-xl px-4 py-1.5 text-[12.5px] font-semibold text-white transition"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            boxShadow: "0 0 16px rgba(59,130,246,0.25)",
          }}
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium"
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            color: "#3b82f6",
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Business Operating System
        </div>
        <h1
          className="font-display text-[2.8rem] font-bold leading-tight tracking-tight md:text-[3.6rem]"
          style={{ color: "#f0f4ff" }}
        >
          We help founders
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            build faster with AI
          </span>
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed"
          style={{ color: "rgba(240,244,255,0.55)" }}
        >
          LaunchpadBYLDA is an AI-powered business OS that combines strategic intelligence, content
          generation, and operational automation — all in one place. From validating your first idea
          to scaling your operations, Bylda is the co-founder you never had.
        </p>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div
          className="overflow-hidden rounded-3xl p-8 md:p-12"
          style={{
            background: "rgba(59,130,246,0.04)",
            border: "1px solid rgba(59,130,246,0.12)",
          }}
        >
          <div
            className="h-px mb-8"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(59,130,246,0.6), rgba(139,92,246,0.4), transparent)",
            }}
          />
          <div className="grid gap-10 md:grid-cols-2 md:gap-16 items-center">
            <div>
              <div
                className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#3b82f6" }}
              >
                Our mission
              </div>
              <h2
                className="font-display text-[1.75rem] font-bold leading-tight tracking-tight"
                style={{ color: "#f0f4ff" }}
              >
                Level the playing field for independent builders
              </h2>
              <p
                className="mt-4 text-[14px] leading-relaxed"
                style={{ color: "rgba(240,244,255,0.55)" }}
              >
                Big companies have entire departments for strategy, marketing, and operations. Solo
                founders and small teams don't. Bylda changes that — giving every founder
                enterprise-grade AI intelligence at a fraction of the cost, without the complexity.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: Rocket,
                  label: "Launch faster",
                  desc: "Go from idea to execution in hours, not months",
                },
                {
                  icon: Target,
                  label: "Sharper strategy",
                  desc: "AI-validated decisions backed by real market signal",
                },
                {
                  icon: Zap,
                  label: "Automate ops",
                  desc: "Workflows that run while you focus on growth",
                },
                {
                  icon: BarChart2,
                  label: "Scale smarter",
                  desc: "Data-driven projections and revenue modeling",
                },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(59,130,246,0.1)",
                  }}
                >
                  <Icon className="mb-3 h-5 w-5" style={{ color: "#3b82f6" }} />
                  <div className="text-[13px] font-semibold" style={{ color: "#f0f4ff" }}>
                    {label}
                  </div>
                  <div
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "rgba(240,244,255,0.4)" }}
                  >
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What we build */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-10 text-center">
          <div
            className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#8b5cf6" }}
          >
            The platform
          </div>
          <h2
            className="font-display text-[1.9rem] font-bold tracking-tight"
            style={{ color: "#f0f4ff" }}
          >
            Everything a founder needs
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* Blog section */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div
          className="overflow-hidden rounded-3xl"
          style={{
            background: "rgba(139,92,246,0.04)",
            border: "1px solid rgba(139,92,246,0.14)",
          }}
        >
          <div className="grid gap-8 p-8 md:grid-cols-2 md:gap-12 md:p-12 items-center">
            <div>
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  color: "#8b5cf6",
                }}
              >
                <PenLine className="h-3 w-3" /> Blog Post Generator
              </div>
              <h2
                className="font-display text-[1.6rem] font-bold leading-tight tracking-tight"
                style={{ color: "#f0f4ff" }}
              >
                SEO-optimized content, generated in seconds
              </h2>
              <p
                className="mt-4 text-[14px] leading-relaxed"
                style={{ color: "rgba(240,244,255,0.5)" }}
              >
                Enter a topic or keyword and Bylda crafts a full-length, SEO-structured blog post —
                complete with meta description, suggested tags, and a readability score. No writer's
                block. No agency fees.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Full article with headers and structured content",
                  "Auto-generated meta description for SEO",
                  "Suggested tags and primary keyword targeting",
                  "Readability score so every post lands well",
                  "Export as Markdown with one click",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[13px]"
                    style={{ color: "rgba(240,244,255,0.6)" }}
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#8b5cf6" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/sign-up"
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                  boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
                }}
              >
                Try the blog generator <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Sample card */}
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: "#09091e",
                border: "1px solid rgba(139,92,246,0.2)",
                boxShadow: "0 4px 24px rgba(139,92,246,0.1)",
              }}
            >
              <div
                className="h-0.5"
                style={{
                  background: "linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, transparent)",
                }}
              />
              <div className="p-5">
                <div
                  className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "#8b5cf6" }}
                >
                  Sample output
                </div>
                <div
                  className="font-display text-[16px] font-bold leading-snug"
                  style={{ color: "#f0f4ff" }}
                >
                  10 Proven Strategies to Get Your First 100 SaaS Customers
                </div>
                <div
                  className="mt-2 text-[12px] leading-relaxed"
                  style={{ color: "rgba(240,244,255,0.4)" }}
                >
                  From founder-led sales to content flywheels — a tactical breakdown of how
                  early-stage SaaS companies turn zero into traction.
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["SaaS Growth", "Customer Acquisition", "Startup Marketing"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-2 py-0.5 text-[10.5px]"
                      style={{
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        color: "#8b5cf6",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  className="mt-4 flex items-center justify-between text-[11px]"
                  style={{ color: "rgba(240,244,255,0.3)" }}
                >
                  <span>Readability: 82/100</span>
                  <span>8 min read</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team / values strip */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Built for founders",
              desc: "Every feature is designed for the realities of building a company with a small team and a big vision.",
            },
            {
              icon: Sparkles,
              title: "AI-first, always",
              desc: "We don't bolt AI on top — intelligence is baked into every workflow, output, and decision Bylda helps you make.",
            },
            {
              icon: Mail,
              title: "Reach us anytime",
              desc: "Questions, feedback, or partnership ideas — we'd love to hear from you. We're builders too.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(59,130,246,0.1)",
              }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.15)",
                }}
              >
                <Icon className="h-5 w-5" style={{ color: "#3b82f6" }} />
              </div>
              <div className="text-[14px] font-semibold" style={{ color: "#f0f4ff" }}>
                {title}
              </div>
              <div
                className="mt-2 text-[13px] leading-relaxed"
                style={{ color: "rgba(240,244,255,0.45)" }}
              >
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2
          className="font-display text-[2rem] font-bold tracking-tight"
          style={{ color: "#f0f4ff" }}
        >
          Ready to build smarter?
        </h2>
        <p
          className="mt-4 text-[14.5px] leading-relaxed"
          style={{ color: "rgba(240,244,255,0.5)" }}
        >
          Join founders using Bylda to validate ideas, create content, and grow their businesses —
          all with the power of AI working in their corner.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth/sign-up"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold text-white transition"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              boxShadow: "0 4px 24px rgba(59,130,246,0.3)",
            }}
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-[14px] font-semibold transition"
            style={{
              border: "1px solid rgba(59,130,246,0.25)",
              color: "rgba(240,244,255,0.7)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.5)";
              (e.currentTarget as HTMLElement).style.color = "#f0f4ff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.25)";
              (e.currentTarget as HTMLElement).style.color = "rgba(240,244,255,0.7)";
            }}
          >
            View pricing
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 text-center text-[12px]"
        style={{
          borderTop: "1px solid rgba(59,130,246,0.08)",
          color: "rgba(240,244,255,0.25)",
        }}
      >
        © {new Date().getFullYear()} LaunchpadBYLDA. All rights reserved.
        <span className="mx-2">·</span>
        <Link to="/pricing" className="transition-colors hover:text-white/60">
          Pricing
        </Link>
        <span className="mx-2">·</span>
        <Link to="/about" className="transition-colors hover:text-white/60">
          About
        </Link>
      </footer>
    </div>
  );
}

/* ── Feature card ── */
const FEATURES = [
  {
    icon: Rocket,
    color: "#3b82f6",
    title: "Bylda Studio",
    desc: "17 AI tools covering every stage — from idea validation and pitch generation to competitor analysis and revenue projections.",
  },
  {
    icon: PenLine,
    color: "#8b5cf6",
    title: "Blog Generator",
    desc: "Create SEO-structured blog posts from a topic or keyword. Full articles with meta, tags, and readability scoring.",
  },
  {
    icon: FileText,
    color: "#f97316",
    title: "Bylda OS",
    desc: "CRM pipeline, lead capture, client onboarding, automation workflows, and reporting — a complete ops layer.",
  },
];

function FeatureCard({
  icon: Icon,
  color,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(59,130,246,0.1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}40`;
        (e.currentTarget as HTMLElement).style.background = `${color}08`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.1)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
      }}
    >
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          background: `${color}12`,
          border: `1px solid ${color}25`,
          boxShadow: `0 0 16px ${color}20`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="text-[15px] font-semibold" style={{ color: "#f0f4ff" }}>
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(240,244,255,0.45)" }}>
        {desc}
      </div>
    </div>
  );
}
