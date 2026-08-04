"use client";

import { useMemo, useState } from "react";

type Deal = {
  company: string;
  contact: string;
  value: string;
  stage: string;
  age: number;
  next: string;
  health: "On track" | "At risk" | "Stalled";
  accent: string;
};

const deals: Deal[] = [
  { company: "Northstar Labs", contact: "Maya Chen", value: "$42,000", stage: "Proposal", age: 5, next: "Send security answers", health: "On track", accent: "NC" },
  { company: "Pioneer Freight", contact: "Liam Brooks", value: "$68,500", stage: "Discovery", age: 18, next: "Confirm ops workflow", health: "Stalled", accent: "PF" },
  { company: "Arbor & Co.", contact: "Sofia Patel", value: "$31,200", stage: "Negotiation", age: 9, next: "Review revised terms", health: "At risk", accent: "AC" },
  { company: "Orbit Financial", contact: "Noah Williams", value: "$55,000", stage: "Demo", age: 3, next: "Book technical demo", health: "On track", accent: "OF" },
];

const activity = [
  { time: "10:42 AM", title: "Call processed", detail: "Northstar Labs · 18m 24s", meta: "3 CRM updates ready", tone: "purple" },
  { time: "9:18 AM", title: "Commitment completed", detail: "Orbit Financial · Demo booked", meta: "Synced to CRM", tone: "green" },
  { time: "Yesterday", title: "Deal flagged as stalled", detail: "Pioneer Freight · 18 days in Discovery", meta: "Needs attention", tone: "orange" },
];

export default function Home() {
  const [view, setView] = useState<"overview" | "pipeline">("overview");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [approved, setApproved] = useState(false);
  const [selected, setSelected] = useState<Deal>(deals[0]);

  const filtered = useMemo(() => deals.filter((deal) => `${deal.company} ${deal.contact}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">b</span><span>bylda</span></div>
        <nav aria-label="Primary navigation">
          <button className={view === "overview" ? "nav-item active" : "nav-item"} onClick={() => setView("overview")}><span>⌂</span> Overview</button>
          <button className={view === "pipeline" ? "nav-item active" : "nav-item"} onClick={() => setView("pipeline")}><span>◫</span> Pipeline <b>4</b></button>
          <button className="nav-item"><span>◉</span> Calls <b>12</b></button>
          <button className="nav-item"><span>✓</span> Commitments <b>7</b></button>
          <button className="nav-item"><span>↗</span> Forecast</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="integration"><span className="sync-dot">↻</span><div><strong>HubSpot</strong><small>Synced 2m ago</small></div><i>•••</i></div>
          <button className="nav-item"><span>⚙</span> Settings</button>
          <div className="profile"><span>PS</span><div><strong>Parit Sharma</strong><small>Workspace admin</small></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div><p className="eyebrow">MONDAY, AUGUST 3</p><h1>{view === "overview" ? "Good morning, Parit" : "Your pipeline"}</h1><p>{view === "overview" ? "Here’s what needs your attention today." : "Every deal, enriched by what was actually said."}</p></div>
          <div className="header-actions"><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals, calls..." /></label><button className="icon-btn" aria-label="Notifications">♢<span /></button></div>
        </header>

        {view === "overview" ? (
          <>
            <section className="stats" aria-label="Pipeline summary">
              <article><div className="stat-icon violet">↗</div><p>Open pipeline</p><strong>$196.7k</strong><small className="up">↑ 12% <em>from last month</em></small></article>
              <article><div className="stat-icon amber">!</div><p>Needs attention</p><strong>3 deals</strong><small>2 stalled · 1 at risk</small></article>
              <article><div className="stat-icon blue">✓</div><p>Commitments due</p><strong>7</strong><small>Next 14 days</small></article>
              <article><div className="stat-icon green">◎</div><p>Calls this week</p><strong>24</strong><small className="up">↑ 8% <em>vs. last week</em></small></article>
            </section>

            <section className="grid-main">
              <article className="panel attention">
                <div className="panel-title"><div><h2>Needs your attention</h2><p>Deals where the next move matters most</p></div><button onClick={() => setView("pipeline")}>View all →</button></div>
                {filtered.slice(0, 3).map((deal) => <DealRow key={deal.company} deal={deal} onClick={() => { setSelected(deal); setAssistantOpen(true); }} />)}
              </article>
              <article className="panel assistant-preview">
                <div className="ai-heading"><span className="spark">✦</span><div><h2>Ask Bylda</h2><p>Your pipeline, explained.</p></div><button onClick={() => setAssistantOpen(!assistantOpen)}>↗</button></div>
                <div className="prompt-box"><p>What should I focus on today?</p><button onClick={() => setAssistantOpen(true)}>↑</button></div>
                <div className="quick-prompts"><button onClick={() => setAssistantOpen(true)}>Which deals are at risk?</button><button onClick={() => setAssistantOpen(true)}>Prep me for my next call</button><button onClick={() => setAssistantOpen(true)}>What did I promise this week?</button></div>
              </article>
            </section>

            <section className="grid-lower">
              <article className="panel commitments">
                <div className="panel-title"><div><h2>Upcoming commitments</h2><p>Your promises, kept visible</p></div><button>View calendar →</button></div>
                <div className="commitment-row"><time><b>4</b><span>AUG</span></time><div><strong>Send security questionnaire answers</strong><p>Northstar Labs · Maya Chen</p></div><span className="due today">Today</span></div>
                <div className="commitment-row"><time><b>6</b><span>AUG</span></time><div><strong>Share implementation timeline</strong><p>Arbor & Co. · Sofia Patel</p></div><span className="due">In 3 days</span></div>
              </article>
              <article className="panel recent">
                <div className="panel-title"><div><h2>Recent activity</h2><p>Across calls and your CRM</p></div><button>View all →</button></div>
                {activity.map((item) => <div className="activity-row" key={item.title}><span className={`activity-dot ${item.tone}`}>•</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><div className="activity-meta"><time>{item.time}</time><small>{item.meta}</small></div></div>)}
              </article>
            </section>
          </>
        ) : (
          <section className="panel pipeline-table">
            <div className="panel-title"><div><h2>Active deals</h2><p>{filtered.length} opportunities · $196,700 open value</p></div><button>＋ Add filter</button></div>
            <div className="table-head"><span>Deal</span><span>Stage</span><span>Value</span><span>Time in stage</span><span>Next move</span><span>Health</span></div>
            {filtered.map((deal) => <DealRow key={deal.company} deal={deal} expanded onClick={() => { setSelected(deal); setAssistantOpen(true); }} />)}
          </section>
        )}
      </section>

      {assistantOpen && <aside className="copilot" aria-label="Bylda assistant">
        <div className="copilot-head"><div className="spark">✦</div><div><strong>Bylda copilot</strong><small>Listening across your pipeline</small></div><button onClick={() => setAssistantOpen(false)}>×</button></div>
        <div className="copilot-context"><span>{selected.accent}</span><div><small>LOOKING AT</small><strong>{selected.company}</strong></div><i>Live context</i></div>
        <div className="chat">
          <div className="user-bubble">What should I do next?</div>
          <div className="ai-message"><span className="spark small">✦</span><div><p><strong>Send Maya the security answers today.</strong> She said legal can approve this week if security signs off first.</p><div className="evidence"><small>WHY THIS MATTERS</small><p>The deal is healthy, but this is the only open blocker before procurement.</p><button>View call evidence ↗</button></div></div></div>
          <div className="crm-card"><div className="crm-card-head"><span>↻</span><div><strong>CRM update ready</strong><small>3 fields from today’s call</small></div></div><dl><div><dt>Next step</dt><dd>Send security answers</dd></div><div><dt>Close date</dt><dd>August 21, 2026</dd></div><div><dt>Deal stage</dt><dd>Proposal</dd></div></dl><button className={approved ? "approved" : "approve"} onClick={() => setApproved(true)}>{approved ? "✓ Synced to HubSpot" : "Approve & sync"}</button></div>
        </div>
        <div className="chat-input"><textarea aria-label="Ask Bylda" placeholder="Ask about this deal..." /><button>↑</button><small>AI answers use calls + CRM data</small></div>
      </aside>}
      {!assistantOpen && <button className="floating-ai" onClick={() => setAssistantOpen(true)} aria-label="Open Bylda copilot">✦</button>}
    </main>
  );
}

function DealRow({ deal, onClick, expanded = false }: { deal: Deal; onClick: () => void; expanded?: boolean }) {
  return <button className={expanded ? "deal-row expanded" : "deal-row"} onClick={onClick}>
    <span className="avatar">{deal.accent}</span><span className="deal-name"><strong>{deal.company}</strong><small>{deal.contact}</small></span>
    {expanded && <span className="stage-pill">{deal.stage}</span>}
    {expanded && <strong className="deal-value">{deal.value}</strong>}
    <span className="deal-age"><strong>{deal.age} days</strong><small>in {deal.stage}</small></span>
    <span className="deal-next"><small>Next move</small><strong>{deal.next}</strong></span>
    <span className={`health ${deal.health.toLowerCase().replace(" ", "-")}`}>{deal.health}</span><span className="chevron">›</span>
  </button>;
}
