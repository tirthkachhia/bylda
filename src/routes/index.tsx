import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      // /app resolves the mode-aware product home (Launchpad vs Bylda).
      if (!cancelled && session) navigate({ to: "/app" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  return <CinematicLanding />;
}

// ─── Dashboard mock ──────────────────────────────────────────────────────────

function DashboardMock() {
  return (
    <div
      style={{
        width: 860,
        maxWidth: "88vw",
        borderRadius: 13,
        background: "#09091e",
        overflow: "hidden",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 38,
          background: "#05051a",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 7,
        }}
      >
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div
            key={c}
            style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }}
          />
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255,255,255,0.18)",
            fontFamily: "monospace",
          }}
        >
          bylda-os — dashboard
        </div>
      </div>
      <div style={{ display: "flex", height: 488 }}>
        <div
          style={{
            width: 186,
            background: "#060618",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            padding: "14px 10px",
          }}
        >
          {[
            { name: "Dashboard", active: false },
            { name: "Idea Validator", active: true },
            { name: "Pitch Generator", active: false },
            { name: "GTM Strategy", active: false },
            { name: "Funding Score", active: false },
            { name: "Investor Emails", active: false },
            { name: "First 10 Customers", active: false },
          ].map(({ name, active }) => (
            <div
              key={name}
              style={{
                padding: "7px 10px",
                borderRadius: 7,
                marginBottom: 3,
                fontSize: 11.5,
                background: active ? "rgba(59,130,246,0.14)" : "transparent",
                color: active ? "#3b82f6" : "rgba(255,255,255,0.38)",
                border: active ? "1px solid rgba(59,130,246,0.22)" : "1px solid transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {name}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: "22px 24px", overflow: "hidden" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f4ff", marginBottom: 3 }}>
            Idea Validator
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>
            Stress-test your concept before you build
          </div>
          <div
            style={{
              background: "#0d0d26",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "13px 15px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: "rgba(255,255,255,0.28)",
                marginBottom: 7,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Your idea
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              AI that writes investor updates in 30 seconds so founders focus on building…
            </div>
          </div>
          {[
            { label: "Market Viability", pct: 87, color: "#3b82f6" },
            { label: "Competition Level", pct: 64, color: "#8b5cf6" },
            { label: "Execution Risk", pct: 38, color: "#06b6d4" },
            { label: "Investor Appeal", pct: 91, color: "#10b981" },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ marginBottom: 11 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 5,
                }}
              >
                <span>{label}</span>
                <span style={{ color, fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ height: 3.5, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div
                  style={{
                    height: 3.5,
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 2,
                    boxShadow: `0 0 8px ${color}55`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Crack paths ─────────────────────────────────────────────────────────────

const CRACKS = [
  "M50,50 L8,12 L2,0",
  "M50,50 L82,8 L96,0",
  "M50,50 L96,42 L100,28",
  "M50,50 L88,78 L100,92",
  "M50,50 L62,96 L55,100",
  "M50,50 L24,92 L12,100",
  "M50,50 L4,68 L0,82",
  "M50,50 L6,32 L0,18",
];

const FEATURE_LINES = [
  "AI tools that think for you.",
  "Automations that run your ops.",
  "A CRM that closes deals.",
];

// ─── Main component ───────────────────────────────────────────────────────────

function CinematicLanding() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const dashSecRef = useRef<HTMLElement>(null);
  const featSecRef = useRef<HTMLElement>(null);
  const flashSecRef = useRef<HTMLElement>(null);
  const finalSecRef = useRef<HTMLElement>(null);
  const dashRevealRef = useRef<HTMLDivElement>(null);
  const dashMockRef = useRef<HTMLDivElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);
  const floodRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLSpanElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let gsapCtx: { revert: () => void } | undefined;

    const boot = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { TextPlugin } = await import("gsap/TextPlugin");
      gsap.registerPlugin(ScrollTrigger, TextPlugin);

      gsapCtx = gsap.context(() => {
        // ── Scroll spotlight follows page ───────────────────────────────────
        gsap.to(spotlightRef.current, {
          y: () => document.body.scrollHeight - window.innerHeight,
          ease: "none",
          scrollTrigger: {
            trigger: wrapRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
          },
        });

        // ── Hero letters: gradient drop-in ──────────────────────────────────
        const letters = gsap.utils.toArray<HTMLElement>(".gsap-letter");
        gsap.set(letters, { y: -160, opacity: 0, rotationX: -90, transformOrigin: "50% 0%" });
        gsap.to(letters, {
          y: 0,
          opacity: 1,
          rotationX: 0,
          stagger: 0.052,
          duration: 0.88,
          ease: "back.out(1.7)",
          delay: 0.2,
        });

        gsap.set(".gsap-subtitle", { y: 52, opacity: 0 });
        gsap.to(".gsap-subtitle", {
          y: 0,
          opacity: 1,
          duration: 1.1,
          ease: "power2.out",
          delay: 1.65,
        });

        // ── Orb pulse ───────────────────────────────────────────────────────
        gsap.to(".gsap-orb", {
          scale: 1.5,
          opacity: 0.4,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // ── Pin 1: crack + dashboard reveal ────────────────────────────────
        gsap.set(".gsap-crack-svg", { opacity: 0 });
        gsap.set(".gsap-crack-path", (_i: number, el: SVGPathElement) => {
          const len = el.getTotalLength?.() ?? 300;
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.set(dashRevealRef.current, { scale: 0.04, opacity: 0 });

        const crackTl = gsap.timeline({ defaults: { ease: "none" } });
        crackTl
          .to(".gsap-hero-text", { opacity: 0, duration: 0.18 })
          .to(".gsap-crack-svg", { opacity: 1, duration: 0.05 }, "<")
          .to(".gsap-crack-path", { strokeDashoffset: 0, stagger: 0.07, duration: 0.32 }, "<0.06")
          .to(
            dashRevealRef.current,
            { scale: 1, opacity: 1, duration: 0.55, ease: "power2.out" },
            "-=0.12",
          )
          .to(".gsap-crack-svg", { opacity: 0, duration: 0.16 }, "-=0.06");

        ScrollTrigger.create({
          trigger: heroRef.current,
          start: "top top",
          end: "+=290%",
          pin: true,
          scrub: 2,
          animation: crackTl,
        });

        // ── Pin 2: zoom into Idea Validator ────────────────────────────────
        gsap.set(".gsap-tool-overlay", { opacity: 0 });

        const zoomTl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        zoomTl
          .to(dashMockRef.current, { scale: 2.55, x: -155, y: -85, duration: 0.4 })
          .to(".gsap-tool-overlay", { opacity: 1, duration: 0.22 }, "-=0.05")
          .to(".gsap-tool-overlay", { opacity: 0, duration: 0.2 }, "+=0.38")
          .to(dashMockRef.current, { scale: 1, x: 0, y: 0, duration: 0.4 });

        ScrollTrigger.create({
          trigger: dashSecRef.current,
          start: "top top",
          end: "+=230%",
          pin: true,
          scrub: 2,
          animation: zoomTl,
        });

        // ── Features: slide in from left, one by one ────────────────────────
        const featLines = gsap.utils.toArray<HTMLElement>(".gsap-feat-line");
        gsap.set(featLines, { x: -90, opacity: 0 });
        featLines.forEach((line, i) => {
          gsap.to(line, {
            x: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power2.out",
            delay: i * 0.18,
            scrollTrigger: {
              trigger: line,
              start: "top 78%",
              toggleActions: "play none none none",
            },
          });
        });

        // ── Flash + typewriter ──────────────────────────────────────────────
        gsap.set(".gsap-flash", { opacity: 0 });
        gsap.set(".gsap-flash-bg", { opacity: 0 });
        if (typeRef.current) typeRef.current.textContent = "";

        const flashTl = gsap.timeline({
          scrollTrigger: {
            trigger: flashSecRef.current,
            start: "top 65%",
            toggleActions: "play none none none",
          },
        });
        flashTl
          .to(".gsap-flash", { opacity: 1, duration: 0.08 })
          .to(".gsap-flash-bg", { opacity: 1, duration: 0.28 }, "+=0.06")
          .to(".gsap-flash", { opacity: 0, duration: 0.3 })
          .to(
            typeRef.current,
            {
              text: { value: "Your competitors launched last Tuesday.", delimiter: "" },
              duration: 2.8,
              ease: "none",
            },
            "-=0.1",
          )
          .to(".gsap-cursor", { opacity: 0, duration: 0.2 }, "+=1.6")
          .to(typeRef.current, { opacity: 0, y: -22, duration: 0.5, delay: 0.2 });

        // ── CTA: pulsing rings ──────────────────────────────────────────────
        const ringTrigger = { trigger: finalSecRef.current, start: "top 80%" };
        gsap.to(".gsap-ring-1", {
          scale: 1.55,
          opacity: 0,
          duration: 2.1,
          ease: "power2.out",
          repeat: -1,
          repeatDelay: 0.3,
          scrollTrigger: ringTrigger,
        });
        gsap.to(".gsap-ring-2", {
          scale: 1.7,
          opacity: 0,
          duration: 2.6,
          ease: "power2.out",
          repeat: -1,
          repeatDelay: 0.3,
          delay: 0.85,
          scrollTrigger: ringTrigger,
        });

        // ── CTA: glow pulse on button ───────────────────────────────────────
        gsap.to(ctaBtnRef.current, {
          boxShadow:
            "0 0 70px rgba(59,130,246,0.95), 0 0 140px rgba(59,130,246,0.4), 0 0 220px rgba(99,102,241,0.2)",
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          scrollTrigger: ringTrigger,
        });

        // ── CTA: hover flood ────────────────────────────────────────────────
        const btn = ctaBtnRef.current;
        const flood = floodRef.current;
        if (btn && flood) {
          gsap.set(flood, { clipPath: "inset(50% 50% 50% 50% round 50%)" });
          const enter = () =>
            gsap.to(flood, {
              clipPath: "inset(0% 0% 0% 0% round 0%)",
              duration: 0.65,
              ease: "power2.out",
            });
          const leave = () =>
            gsap.to(flood, {
              clipPath: "inset(50% 50% 50% 50% round 50%)",
              duration: 0.45,
              ease: "power2.in",
            });
          btn.addEventListener("mouseenter", enter);
          btn.addEventListener("mouseleave", leave);
          return () => {
            btn.removeEventListener("mouseenter", enter);
            btn.removeEventListener("mouseleave", leave);
          };
        }
      }, wrapRef);
    };

    boot();
    return () => {
      gsapCtx?.revert();
    };
  }, []);

  const S: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div ref={wrapRef} style={{ background: "#000", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .gsap-letter { display: inline-block; }
      `}</style>

      {/* ── Scroll spotlight (fixed, moves down at 40% scroll speed) ──────── */}
      <div
        ref={spotlightRef}
        style={{
          position: "fixed",
          left: "50%",
          top: "10vh",
          transform: "translateX(-50%)",
          width: 900,
          height: 560,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, rgba(99,102,241,0.03) 40%, transparent 68%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Crack SVG overlay ─────────────────────────────────────────────── */}
      <svg
        className="gsap-crack-svg"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 30,
          pointerEvents: "none",
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="crack-glow">
            <feGaussianBlur stdDeviation="0.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {CRACKS.map((d, i) => (
          <path
            key={i}
            className="gsap-crack-path"
            d={d}
            stroke="rgba(59,130,246,0.95)"
            strokeWidth="0.45"
            fill="none"
            strokeLinecap="round"
            filter="url(#crack-glow)"
          />
        ))}
      </svg>

      {/* ══ S1 — HERO (pinned) ═══════════════════════════════════════════════ */}
      <section ref={heroRef} style={{ ...S, background: "#000" }}>
        {/* Blue orb */}
        <div
          className="gsap-orb"
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 48%, transparent 70%)",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />

        {/* Hero text */}
        <div
          className="gsap-hero-text"
          style={{ textAlign: "center", zIndex: 5, padding: "0 24px", position: "relative" }}
        >
          {/* Gradient headline with glow */}
          <div style={{ position: "relative", display: "inline-block" }}>
            {/* Glow bloom behind text */}
            <div
              style={{
                position: "absolute",
                top: "55%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "130%",
                height: "90%",
                background:
                  "radial-gradient(ellipse, rgba(59,130,246,0.28) 0%, rgba(99,102,241,0.1) 45%, transparent 70%)",
                filter: "blur(28px)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* Gradient text container */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: "clamp(3.6rem, 12vw, 10rem)",
                fontWeight: 900,
                letterSpacing: "-0.055em",
                lineHeight: 0.92,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                background:
                  "linear-gradient(90deg, #ffffff 0%, #bfdbfe 28%, #3b82f6 62%, #6366f1 85%, #8b5cf6 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {"STOP JUGGLING.".split("").map((ch, i) => (
                <span
                  key={i}
                  className="gsap-letter"
                  style={{ marginRight: ch === " " ? "0.22em" : 0 }}
                >
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </div>
          </div>

          {/* Tagline — brand statement */}
          <div
            className="gsap-subtitle"
            style={{ marginTop: 28, maxWidth: 640, margin: "28px auto 0" }}
          >
            <div
              style={{
                fontSize: "clamp(0.85rem, 1.6vw, 1.05rem)",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#3b82f6",
                marginBottom: 12,
              }}
            >
              Bylda OS
            </div>
            <div
              style={{
                fontSize: "clamp(1rem, 2.2vw, 1.42rem)",
                fontWeight: 400,
                color: "rgba(255,255,255,0.52)",
                lineHeight: 1.55,
                letterSpacing: "-0.01em",
              }}
            >
              The AI operating system founders use to go from&nbsp;
              <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                idea to revenue.
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard that scales up through the cracks */}
        <div
          ref={dashRevealRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            pointerEvents: "none",
          }}
        >
          <DashboardMock />
        </div>
      </section>

      {/* ══ S2 — DASHBOARD ZOOM (pinned) ════════════════════════════════════ */}
      <section ref={dashSecRef} style={{ ...S, background: "#03030e" }}>
        {/* Blue spotlight behind mockup */}
        <div
          style={{
            position: "absolute",
            width: 1100,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.05) 45%, transparent 68%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 5 }}>
          {/* Label */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 18,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#3b82f6",
                boxShadow: "0 0 10px #3b82f6",
                animation: "blink 2s ease-in-out infinite",
              }}
            />
            Bylda OS — Live Preview
          </div>

          {/* Glowing border wrapper → inner content is what GSAP zooms */}
          <div
            style={{
              borderRadius: 16,
              padding: "2px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.65) 0%, rgba(139,92,246,0.35) 50%, rgba(59,130,246,0.5) 100%)",
              boxShadow:
                "0 0 60px rgba(59,130,246,0.3), 0 0 120px rgba(59,130,246,0.1), 0 48px 96px rgba(0,0,0,0.85)",
            }}
          >
            <div
              ref={dashMockRef}
              style={{
                transformOrigin: "30% 35%",
                position: "relative",
                borderRadius: 13,
                overflow: "hidden",
              }}
            >
              <DashboardMock />
              {/* Zoom overlay */}
              <div
                className="gsap-tool-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(1.4rem, 4vw, 3rem)",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "#fff",
                    textAlign: "center",
                    textShadow: "0 0 60px rgba(59,130,246,0.4)",
                  }}
                >
                  Validate your idea in{" "}
                  <span style={{ color: "#3b82f6", textShadow: "0 0 40px rgba(59,130,246,0.9)" }}>
                    60 seconds.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ S3 — WHAT BYLDA IS (feature lines) ══════════════════════════════ */}
      <section
        ref={featSecRef}
        style={{ ...S, background: "#02020d", flexDirection: "column", padding: "100px 0" }}
      >
        <div style={{ marginBottom: 56, textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#3b82f6",
              marginBottom: 12,
            }}
          >
            Built for founders who move fast
          </div>
        </div>

        <div style={{ maxWidth: 820, width: "100%", padding: "0 32px" }}>
          {FEATURE_LINES.map((text, i) => (
            <div
              key={text}
              className="gsap-feat-line"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                marginBottom: i < FEATURE_LINES.length - 1 ? 44 : 0,
              }}
            >
              {/* Neon blue accent bar */}
              <div
                style={{
                  width: 4,
                  flexShrink: 0,
                  borderRadius: 3,
                  height: "clamp(52px, 7vw, 80px)",
                  background: "linear-gradient(180deg, #3b82f6 0%, #6366f1 100%)",
                  boxShadow: "0 0 18px rgba(59,130,246,0.9), 0 0 40px rgba(59,130,246,0.4)",
                }}
              />
              <div
                style={{
                  fontSize: "clamp(1.7rem, 4.5vw, 3.2rem)",
                  fontWeight: 800,
                  color: "#f0f4ff",
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ S4 — FLASH + TYPEWRITER ══════════════════════════════════════════ */}
      <section ref={flashSecRef} style={{ ...S, background: "#000" }}>
        <div
          className="gsap-flash"
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            opacity: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        />
        <div
          className="gsap-flash-bg"
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            opacity: 0,
            zIndex: 10,
          }}
        />
        <div style={{ position: "relative", zIndex: 30, textAlign: "center", padding: "0 24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span
              ref={typeRef}
              style={{
                fontSize: "clamp(1.1rem, 3.2vw, 2.4rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#f0f4ff",
                lineHeight: 1.3,
                fontFamily: "inherit",
              }}
            />
            <span
              className="gsap-cursor"
              style={{
                display: "inline-block",
                width: 3,
                height: "1.15em",
                background: "#3b82f6",
                marginLeft: 2,
                verticalAlign: "middle",
                animation: "blink 1s step-end infinite",
              }}
            />
          </div>
        </div>
      </section>

      {/* ══ S5 — FINAL CTA ═══════════════════════════════════════════════════ */}
      <section
        ref={finalSecRef}
        style={{
          ...S,
          flexDirection: "column",
          background:
            "radial-gradient(ellipse 100% 60% at 50% 100%, #0a1a3e 0%, #030314 50%, #000 100%)",
        }}
      >
        {/* Flood overlay */}
        <div
          ref={floodRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            pointerEvents: "none",
            background:
              "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 40%, #6366f1 75%, #8b5cf6 100%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 10, textAlign: "center" }}>
          <div
            style={{
              marginBottom: 16,
              fontSize: "clamp(0.8rem, 1.8vw, 1rem)",
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            The OS for founders who ship
          </div>

          <div
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              marginBottom: 40,
              lineHeight: 1.1,
            }}
          >
            Ready to build?
          </div>

          {/* Button + pulsing rings */}
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Ring 1 */}
            <div
              className="gsap-ring-1"
              style={{
                position: "absolute",
                inset: "-18px -28px",
                borderRadius: 22,
                border: "1.5px solid rgba(59,130,246,0.45)",
                pointerEvents: "none",
              }}
            />
            {/* Ring 2 */}
            <div
              className="gsap-ring-2"
              style={{
                position: "absolute",
                inset: "-32px -44px",
                borderRadius: 28,
                border: "1px solid rgba(59,130,246,0.22)",
                pointerEvents: "none",
              }}
            />

            <button
              ref={ctaBtnRef}
              onClick={() => {
                window.location.href = "/auth/sign-up";
              }}
              style={{
                padding: "26px 80px",
                fontSize: "clamp(1.1rem, 2.8vw, 1.6rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #6366f1 100%)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16,
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 0 30px rgba(59,130,246,0.4), 0 8px 40px rgba(0,0,0,0.5)",
                position: "relative",
                zIndex: 20,
                fontFamily: "inherit",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              Build now →
            </button>
          </div>

          <div style={{ marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>
            No credit card required · Free to start
          </div>
        </div>
      </section>
    </div>
  );
}
