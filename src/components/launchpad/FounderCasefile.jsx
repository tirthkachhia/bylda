import { useEffect, useState } from "react";
import { Seal } from "./Seal";

// ─── SCORE PILL ────────────────────────────────────────────────────────────
// Width animation: start at w-0 then transition to the value-derived class.
// We use data-* + CSS var approach to allow arbitrary % without inline style.
function ScorePill({ label, value, color }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  const twColor =
    color === "#16a34a" || color === "green"
      ? "bg-blueprint-seal"
      : color === "#d97706" || color === "amber"
        ? "bg-blueprint-warn"
        : color === "#dc2626" || color === "red"
          ? "bg-red-500"
          : "bg-blueprint-signal";

  // Map value to nearest Tailwind width class (steps of ~10)
  const widthClass = animated
    ? value >= 90
      ? "w-full"
      : value >= 80
        ? "w-4/5"
        : value >= 70
          ? "w-3/4"
          : value >= 60
            ? "w-3/5"
            : value >= 50
              ? "w-1/2"
              : value >= 40
                ? "w-2/5"
                : value >= 30
                  ? "w-[30%]"
                  : value >= 20
                    ? "w-1/5"
                    : "w-[10%]"
    : "w-0";

  return (
    <div className="flex flex-col items-center gap-1 hover:ring-2 hover:ring-blueprint-signal/25 rounded-none px-3 py-2 transition-all duration-200 cursor-default">
      <div className="text-[18px] font-extrabold text-ink leading-none">{value}</div>
      <div className="h-[3px] w-12 bg-line/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${twColor} ${widthClass}`}
        />
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.8px] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

// ─── DRAWER ────────────────────────────────────────────────────────────────
function Drawer({ icon, title, tag, tagColor, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `drawer-${title.replace(/\s+/g, "-").toLowerCase()}`;

  // Map legacy hex/string tag colors to Tailwind semantic classes
  const tagClasses =
    tagColor?.includes("16a34a") || tagColor === "green"
      ? "bg-blueprint-seal/10 text-blueprint-seal border-blueprint-seal/30"
      : tagColor?.includes("d97706") || tagColor === "amber"
        ? "bg-blueprint-brass-soft text-blueprint-warn border-blueprint-warn/30"
        : tagColor?.includes("dc2626") || tagColor === "red"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-blueprint-signal-soft text-blueprint-signal border-blueprint-signal/30";

  return (
    <div className="border border-line rounded-none overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={`w-full flex items-center gap-2.5 px-4 py-3.5 border-none cursor-pointer text-left transition-colors duration-150 ${open ? "bg-blueprint-signal-soft" : "bg-paper hover:bg-blueprint-signal-soft"}`}
      >
        <span className="text-[13px]" aria-hidden="true">
          {icon}
        </span>
        <span
          className={`text-[12px] font-semibold flex-1 transition-colors ${open ? "text-ink" : "text-ink-dim"}`}
        >
          {title}
        </span>
        {tag && (
          <span
            className={`text-[9px] font-bold uppercase tracking-[0.8px] px-2 py-0.5 rounded-full border ${tagClasses}`}
          >
            {tag}
          </span>
        )}
        <span
          aria-hidden="true"
          className={`text-sm text-ink-faint ml-1.5 inline-block transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}
        >
          ›
        </span>
      </button>
      {/* max-h slide: 0 → large fixed value so content slides in/out */}
      <div
        id={id}
        className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? "max-h-[600px]" : "max-h-0"}`}
      >
        <div className="px-4 pt-1 pb-4 bg-paper">{children}</div>
      </div>
    </div>
  );
}

// ─── PROOF ITEM ────────────────────────────────────────────────────────────
function ProofItem({ num, title, desc, action }) {
  return (
    <div className="flex gap-2.5 mb-3.5">
      <div className="text-[9px] font-bold text-ink-faint w-5 h-5 rounded-none bg-line/60 border border-line flex items-center justify-center shrink-0 mt-0.5 font-bp-mono">
        {num}
      </div>
      <div>
        <div className="text-[12px] font-semibold text-ink mb-0.5">{title}</div>
        <div className="text-[11px] text-ink-dim leading-relaxed mb-1.5">{desc}</div>
        <button className="text-[10px] font-bold text-blueprint-signal hover:text-blueprint-blue transition-colors cursor-pointer bg-none border-none p-0">
          → {action}
        </button>
      </div>
    </div>
  );
}

// ─── RISK ROW ──────────────────────────────────────────────────────────────
function RiskRow({ level, title, pct }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  // High keeps Tailwind red — the blueprint palette has no danger hue and
  // risk severity must stay visually distinct from the warn amber.
  const cfg = {
    High: {
      badge: "text-red-600 bg-red-50 border-red-200",
      bar: "bg-gradient-to-r from-red-500 to-red-400",
    },
    Medium: {
      badge: "text-blueprint-warn bg-blueprint-brass-soft border-blueprint-warn/30",
      bar: "bg-blueprint-warn",
    },
    Low: {
      badge: "text-blueprint-seal bg-blueprint-seal/10 border-blueprint-seal/30",
      bar: "bg-blueprint-seal",
    },
  }[level] ?? {
    badge: "text-ink-dim bg-paper border-line",
    bar: "bg-ink-faint",
  };

  const widthClass = animated
    ? pct >= 90
      ? "w-full"
      : pct >= 80
        ? "w-4/5"
        : pct >= 70
          ? "w-[70%]"
          : pct >= 60
            ? "w-3/5"
            : pct >= 50
              ? "w-1/2"
              : pct >= 40
                ? "w-2/5"
                : pct >= 30
                  ? "w-[30%]"
                  : pct >= 20
                    ? "w-1/5"
                    : "w-[10%]"
    : "w-0";

  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span
        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.badge}`}
      >
        {level}
      </span>
      <div className="text-[11px] text-ink-dim flex-1">{title}</div>
      <div className="w-20 h-[3px] bg-line/60 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${cfg.bar} ${widthClass}`}
        />
      </div>
    </div>
  );
}

// ─── STRENGTH ROW ──────────────────────────────────────────────────────────
function StrengthRow({ title, desc }) {
  const [open, setOpen] = useState(false);
  const id = `strength-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="border-b border-line/50 pb-2.5 mb-2.5 last:border-0 last:mb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-left p-0"
      >
        <span className="text-[10px] text-blueprint-seal" aria-hidden="true">
          ✦
        </span>
        <span className="text-[12px] font-semibold text-ink flex-1">{title}</span>
        <span
          aria-hidden="true"
          className={`text-[11px] text-ink-faint inline-block transition-transform duration-150 ${open ? "rotate-90" : "rotate-0"}`}
        >
          ›
        </span>
      </button>
      <div
        id={id}
        className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? "max-h-[200px]" : "max-h-0"}`}
      >
        <div className="text-[11px] text-ink-dim leading-relaxed mt-2 pl-[18px]">{desc}</div>
      </div>
    </div>
  );
}

// ─── MISSION CARD ──────────────────────────────────────────────────────────
function MissionCard({ emoji, label, title, desc, locked }) {
  return (
    <div
      className={`bg-panel rounded-none p-3 mb-2 flex items-center gap-3 transition-all duration-150 ${
        locked
          ? "border border-line/50 opacity-40 cursor-default"
          : "border-l-4 border-l-blueprint-signal border border-line cursor-pointer shadow-sm hover:shadow-md hover:border-blueprint-signal/40"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-none flex items-center justify-center text-sm shrink-0 border ${
          locked
            ? "bg-paper border-line"
            : "bg-gradient-to-br from-blueprint-signal-soft to-blueprint-brass-soft border-line"
        }`}
        aria-hidden="true"
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-faint mb-0.5">
          {label}
        </div>
        <div
          className={`text-[12px] font-semibold truncate ${locked ? "text-ink-faint" : "text-ink"}`}
        >
          {title}
        </div>
        {!locked && <div className="text-[10px] text-ink-faint mt-0.5">{desc}</div>}
      </div>
      <span
        aria-hidden="true"
        className={`text-base ${locked ? "text-ink-faint" : "text-ink-faint"}`}
      >
        ›
      </span>
    </div>
  );
}

// ─── PLAYBOOK STEP ─────────────────────────────────────────────────────────
function PbStep({ status, label }) {
  const cfg = {
    done: { dot: "bg-blueprint-seal", text: "text-ink-faint", extra: "line-through" },
    active: {
      dot: "bg-blueprint-signal animate-pulse",
      text: "text-blueprint-signal font-semibold",
      extra: "",
    },
    idle: { dot: "bg-line", text: "text-ink-faint", extra: "" },
  }[status] ?? { dot: "bg-line", text: "text-ink-faint", extra: "" };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-line/50 last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
      <span className={`text-[10px] ${cfg.text} ${cfg.extra}`}>{label}</span>
    </div>
  );
}

// ─── SIDEBAR LABEL ─────────────────────────────────────────────────────────
function SideLabel({ children }) {
  return (
    <div className="font-bp-mono text-[9px] font-bold uppercase tracking-[1.2px] text-ink-faint mb-2.5 pb-2 border-b border-line/50">
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function FounderCasefile() {
  const [accepted, setAccepted] = useState(false);
  const [acceptPulse, setAcceptPulse] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeDay, setActiveDay] = useState(0);

  // Hero entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleAccept = () => {
    if (accepted) return;
    setAccepted(true);
    setAcceptPulse(true);
    setTimeout(() => setAcceptPulse(false), 400);
  };

  const days = [
    {
      label: "Days 1–7",
      tasks: ["Talk to 5 target customers", "Test willingness to pay", "Document objections"],
    },
    {
      label: "Days 8–14",
      tasks: ["Build landing page", "Run 3 paid traffic tests", "Capture 10 email leads"],
    },
    {
      label: "Days 15–30",
      tasks: ["Close first pre-sale", "Refine offer based on feedback", "Ship MVP to paying user"],
    },
  ];

  const scores = [
    { label: "Market", value: 78, color: "#16a34a" },
    { label: "Timing", value: 65, color: "#d97706" },
    { label: "Moat", value: 52, color: "#d97706" },
    { label: "Team Fit", value: 84, color: "#16a34a" },
    { label: "Revenue", value: 71, color: "#16a34a" },
  ];

  return (
    <div
      className={`min-h-screen bg-blueprint-grid px-4 py-6 transition-opacity duration-500 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
        {/* ── MAIN COLUMN ── */}
        <div className="space-y-4">
          {/* Hero card */}
          <div className="bg-panel rounded-none border border-line shadow-md p-5">
            {/* Case header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="font-bp-mono text-[10px] font-bold uppercase tracking-[1.2px] text-ink-faint mb-1">
                  Founder Casefile · Idea Validation
                </div>
                <h1 className="font-tech text-[20px] font-extrabold text-ink leading-tight tracking-tight">
                  AI-Powered Meal Planning for Busy Parents
                </h1>
                <p className="text-[12px] text-ink-faint mt-1">
                  Submitted 2 minutes ago &nbsp;·&nbsp; Bylda Score{" "}
                  <span className="font-bold text-blueprint-signal">74 / 100</span>
                </p>
              </div>
              {/* Verdict — engineer's seal, stamps in on render */}
              <Seal verdict="GO" arcTop="Idea Validation" arcBottom="Score 74/100" size={88} />
            </div>

            {/* Score pills */}
            <div className="flex flex-wrap gap-4 mb-4 pt-3 border-t border-line/50">
              {scores.map((s) => (
                <ScorePill key={s.label} {...s} />
              ))}
            </div>

            {/* Verdict block — brass drafting annotation */}
            <div className="bg-blueprint-brass-soft border-l-4 border-blueprint-brass p-4">
              <div className="font-bp-mono text-[10px] font-bold uppercase tracking-[0.8px] text-blueprint-brass mb-1.5">
                Bylda's Verdict
              </div>
              <p className="text-[13px] text-ink leading-relaxed font-medium">
                This idea has strong market timing and high founder-fit. The biggest risk is
                customer acquisition cost in a crowded wellness market. Validate willingness to pay
                before building — a landing page test will tell you within 2 weeks.
              </p>
            </div>
          </div>

          {/* Bylda's Take */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-5 relative overflow-hidden">
            {/* Violet left-edge accent */}
            <div
              className="absolute left-0 top-0 w-1 h-full bg-blueprint-signal rounded-l-xl"
              aria-hidden="true"
            />
            <div className="pl-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-blueprint-signal">
                  Bylda's Take
                </span>
                <span className="text-[10px] text-ink-faint">· AI Analysis</span>
              </div>
              <p className="text-[13px] text-ink-dim leading-relaxed">
                You're entering a real market with a real problem. Parents already spend money on
                meal delivery — your challenge is proving they'll pay for planning instead of
                execution. The fastest path to validation is a 48-hour paid test, not a full build.
              </p>
            </div>

            <hr className="border-t border-line my-4" />

            {/* Recommended Move */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-ink-faint mb-2">
                Recommended Move
              </div>
              <div className="flex items-start gap-3 bg-blueprint-signal-soft rounded-none p-3">
                <div
                  className="w-6 h-6 rounded-none bg-blueprint-signal flex items-center justify-center shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <span className="text-white text-[10px] font-bold">1</span>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-ink mb-0.5">
                    Run a 48-hour landing page test
                  </div>
                  <div className="text-[11px] text-ink-dim leading-relaxed">
                    Build a simple page, drive 100 visitors with $50 in ads, and measure email
                    sign-up rate. Above 15% = strong signal.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Case Details — collapsible drawers */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="font-bp-mono text-[11px] font-bold uppercase tracking-[1px] text-ink-faint">
                Case Details
              </div>
              <span
                className="text-[12px] text-ink-faint cursor-help"
                title="Expand each section to see full analysis"
              >
                ⓘ
              </span>
            </div>

            <Drawer icon="✦" title="Strengths" tag="3 found" tagColor="#16a34a" defaultOpen>
              <div className="pt-3">
                <StrengthRow
                  title="Clear pain point with existing spend"
                  desc="Busy parents already pay $200+/month for meal delivery — they have demonstrated willingness to pay for food-related convenience."
                />
                <StrengthRow
                  title="High repeat purchase potential"
                  desc="Meal planning is a weekly habit, meaning strong LTV if you nail the first-week experience."
                />
                <StrengthRow
                  title="AI creates real defensibility"
                  desc="Personalized AI planning that learns dietary preferences is genuinely hard to replicate with a simple spreadsheet or static service."
                />
              </div>
            </Drawer>

            <Drawer icon="🔬" title="What Needs Proof" tag="3 assumptions" tagColor="#d97706">
              <div className="pt-3">
                <ProofItem
                  num="1"
                  title="Willingness to pay for planning vs. delivery"
                  desc="Parents may prefer paying for done-for-you meals rather than a planning tool. You need to confirm price-point acceptance."
                  action="Run GTM Strategy tool"
                />
                <ProofItem
                  num="2"
                  title="AI quality threshold for trust"
                  desc="The meal recommendations must be good enough on day one. Users won't return after one bad plan."
                  action="Build MVP validation mission"
                />
                <ProofItem
                  num="3"
                  title="CAC in a crowded market"
                  desc="Wellness and parenting apps are expensive to acquire. What's your unfair distribution advantage?"
                  action="Start First 10 Customers tool"
                />
              </div>
            </Drawer>

            <Drawer icon="⚠️" title="Risks" tag="2 high" tagColor="#dc2626">
              <div className="pt-3">
                <RiskRow
                  level="High"
                  title="Customer acquisition cost exceeds LTV in early months"
                  pct={80}
                />
                <RiskRow
                  level="High"
                  title="Big tech (Google, Apple) could add this to health apps"
                  pct={70}
                />
                <RiskRow
                  level="Medium"
                  title="Content moderation for dietary restrictions"
                  pct={50}
                />
                <RiskRow
                  level="Low"
                  title="Technical complexity of meal database integration"
                  pct={25}
                />
              </div>
            </Drawer>
          </div>

          {/* 30-Day Proof Plan — timeline */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-5">
            <div className="font-bp-mono text-[11px] font-bold uppercase tracking-[1px] text-ink-faint mb-3">
              30-Day Proof Plan
            </div>
            {/* Day chips — scrollable on mobile */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-2 flex-nowrap mb-4">
                {days.map((d, i) => (
                  <button
                    key={d.label}
                    onClick={() => setActiveDay(i)}
                    className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer ${
                      activeDay === i
                        ? "bg-blueprint-signal text-white border-blueprint-signal ring-1 ring-blueprint-signal ring-offset-1"
                        : "bg-panel text-ink-dim border-line hover:border-line"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Tasks for active day */}
            <ul className="space-y-2">
              {days[activeDay].tasks.map((task) => (
                <li key={task} className="flex items-start gap-2.5 text-[12px] text-ink-dim">
                  <span className="mt-0.5 text-blueprint-signal shrink-0" aria-hidden="true">
                    ▸
                  </span>
                  {task}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-5">
            <div className="text-[13px] font-semibold text-ink mb-1">Ready to move forward?</div>
            <p className="text-[12px] text-ink-faint mb-4">
              Accepting this move starts your first validation mission. Bylda will guide you step by
              step.
            </p>
            <button
              onClick={handleAccept}
              aria-live="polite"
              className={`group flex items-center gap-2 px-5 py-2.5 rounded-none text-[13px] font-bold tracking-wide transition-all duration-300 ${
                acceptPulse ? "scale-105" : "scale-100"
              } ${
                accepted
                  ? "bg-blueprint-seal text-white border border-blueprint-seal"
                  : "bg-blueprint-signal hover:bg-blueprint-blue text-white border border-blueprint-signal"
              }`}
            >
              {accepted ? (
                <>
                  <span aria-hidden="true">✓</span>
                  Move Accepted
                </>
              ) : (
                <>
                  Accept This Move
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-150 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="lg:sticky lg:top-[49px] self-start space-y-4">
          {/* Next Missions */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-4">
            <SideLabel>Next Missions</SideLabel>
            <MissionCard
              emoji="🎯"
              label="Mission 1"
              title="Build Your Offer"
              desc="30 min · Start here"
              locked={false}
            />
            <MissionCard
              emoji="🚀"
              label="Mission 2"
              title="Land First Customers"
              desc="2–4 weeks"
              locked={false}
            />
            <MissionCard
              emoji="🔁"
              label="Mission 3"
              title="Build Repeatable System"
              desc="Unlocks after Mission 2"
              locked
            />
          </div>

          {/* Proof Playbook */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-4">
            <SideLabel>Proof Playbook</SideLabel>
            <PbStep status="done" label="Submit idea to Bylda" />
            <PbStep status="done" label="Review casefile analysis" />
            <PbStep status="active" label="Accept validation move" />
            <PbStep status="idle" label="Run landing page test" />
            <PbStep status="idle" label="Talk to 5 customers" />
            <PbStep status="idle" label="Close first pre-sale" />
          </div>

          {/* Quick Stats */}
          <div className="bg-panel rounded-none border border-line shadow-sm p-4">
            <SideLabel>At a Glance</SideLabel>
            <div className="space-y-2.5">
              {[
                { label: "Overall Score", value: "74 / 100" },
                { label: "Validation Cost", value: "~$50–$100" },
                { label: "Time to Signal", value: "48 hours" },
                { label: "Risk Level", value: "Medium" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-ink-faint">{label}</span>
                  <span className="text-[11px] font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
