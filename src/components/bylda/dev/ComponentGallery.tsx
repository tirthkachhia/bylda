import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  AppBadge,
  Avatar,
  Button,
  CallBlock,
  CoachingBlock,
  ConfidenceMeter,
  DirectionTag,
  EvidenceBlock,
  ICON_NAMES,
  Icon,
  InsightCard,
  ReportBlock,
  Reactions,
  STATE_CODES,
  SidebarItem,
  StateEmpty,
  StateError,
  StateLoading,
  StructuredInsightBlock,
  SystemStatePreset,
  Tag,
  Wordmark,
  ByldaGlyph,
  CallMoreMenu,
} from "@/components/bylda";
import { NewMenu, ProfileMenu, WorkspaceSwitcher } from "@/components/bylda/menus/ShellMenus";

/** /dev/components — every kit component in every state. Dev + mock mode only. */
function Section({
  title,
  node,
  children,
  dark,
}: {
  title: string;
  node?: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-by-border-engraved pt-6">
      <h2 className="type-ui-label text-by-text-secondary">
        {title}{" "}
        {node ? <span className="type-mono-micro text-by-text-tertiary">· {node}</span> : null}
      </h2>
      <div
        className={
          dark
            ? "flex flex-col gap-1 rounded-by-card bg-by-surface-sidebar p-3"
            : "flex flex-wrap items-start gap-4"
        }
      >
        {children}
      </div>
    </section>
  );
}

const SWATCHES = [
  "bg-by-surface-canvas",
  "bg-by-surface-raised",
  "bg-by-surface-inset",
  "bg-by-surface-muted",
  "bg-by-surface-rail",
  "bg-by-surface-sidebar",
  "bg-by-surface-control-dark",
  "bg-by-signal-improve",
  "bg-by-signal-improve-bg",
  "bg-by-signal-regress",
  "bg-by-signal-regress-bg",
  "bg-by-signal-attention",
  "bg-by-signal-attention-bg",
  "bg-by-signal-info",
  "bg-by-signal-info-bg",
];

const TYPE = [
  "type-brand-logo",
  "type-display-xl",
  "type-display-l",
  "type-display-label",
  "type-editorial-h1",
  "type-editorial-h2",
  "type-editorial-insight",
  "type-editorial-quote",
  "type-ui-title",
  "type-ui-body",
  "type-ui-body-strong",
  "type-ui-small",
  "type-ui-label",
  "type-mono-data",
  "type-mono-micro",
  "type-mono-metric",
];

const EV = {
  timestamp: "18:42",
  speaker: "Prospect",
  quote: "We already budgeted for another tool this year, and I’d need to see—",
};

export function ComponentGallery() {
  return (
    <main className="bylda min-h-screen">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-10 py-12">
        <header className="flex items-end gap-4">
          <h1 className="type-editorial-h1">Bylda V1 — component kit</h1>
          <span className="flex-1" />
          <Link to={"/dev/screens" as never} className="type-ui-small underline">
            All 126 screens →
          </Link>
          <Link to={"/app/home" as never} className="type-ui-small underline">
            Open the shell →
          </Link>
        </header>

        <Section title="Semantic colour tokens" node="1:2">
          {SWATCHES.map((c) => (
            <div key={c} className="flex w-[150px] flex-col gap-1">
              <span className={`h-12 rounded-by-control border border-by-border-engraved ${c}`} />
              <span className="type-mono-micro text-by-text-secondary">{c.replace("bg-", "")}</span>
            </div>
          ))}
        </Section>

        <Section title="Type — 16 styles" node="3:95">
          <div className="flex w-full flex-col gap-2">
            {TYPE.map((t) => (
              <div key={t} className="flex items-baseline gap-6">
                <span className="type-mono-micro w-44 shrink-0 text-by-text-tertiary">{t}</span>
                <span className={t}>
                  {t === "type-brand-logo"
                    ? "BYLDA"
                    : "Jordan is losing control during price objections."}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button" node="4:23">
          {(["primary", "secondary", "ghost", "dark", "destructive"] as const).map((v) => (
            <div key={v} className="flex flex-col gap-2">
              <Button variant={v}>{v === "destructive" ? "Remove" : "Assign coaching"}</Button>
              <Button variant={v} disabled>
                {v === "destructive" ? "Remove" : "Assign coaching"}
              </Button>
            </div>
          ))}
          <Button icon="plus">New</Button>
          <Button size="sm" variant="secondary">
            Small
          </Button>
        </Section>

        <Section title="Tag" node="4:34">
          <Tag tone="improve">↑ Improving</Tag>
          <Tag tone="regress">↓ Regressing</Tag>
          <Tag tone="attention">Needs review</Tag>
          <Tag tone="info">Pattern</Tag>
          <Tag tone="neutral">Discovery</Tag>
          <DirectionTag direction="steady" />
        </Section>

        <Section title="Avatar · AppBadge · glyph · wordmark" node="4:35 · 39:965">
          {[16, 22, 28, 34, 36].map((s) => (
            <Avatar key={s} name="Jordan Reyes" size={s} />
          ))}
          <AppBadge />
          <ByldaGlyph size={18} />
          <Wordmark />
        </Section>

        <Section title="Sidebar item — default · active · unread" node="4:47" dark>
          <SidebarItem icon="hash" label="daily-brief" />
          <SidebarItem icon="hash" label="daily-brief" state="active" />
          <SidebarItem icon="hash" label="daily-brief" state="unread" />
          <SidebarItem icon="hash" label="objection-watch" meta={9} />
          <SidebarItem
            leading={<Avatar name="Jordan Reyes" size={16} />}
            label="Jordan Reyes"
            meta="on a call"
          />
        </Section>

        <Section title="Confidence — low · medium · high" node="4:66">
          <ConfidenceMeter level="low" sampleSize={4} />
          <ConfidenceMeter level="medium" sampleSize={18} />
          <ConfidenceMeter level="high" sampleSize={6} sampleLabel="n = 6 objections · 4 calls" />
        </Section>

        <Section title="Evidence block" node="4:67">
          <div className="w-[520px]">
            <EvidenceBlock evidence={EV} />
          </div>
        </Section>

        <Section
          title="Insight card — high (actions) · low (observation only) · causal-language guard"
          node="4:72"
        >
          <div className="flex w-[640px] flex-col gap-4">
            <InsightCard
              kind="pattern"
              time="8:04 AM"
              headline="Jordan lost control during 4 of 6 price objections this week."
              body="He responds within half a second, before the prospect finishes the concern. Top performers on this team pause ~1.8s and ask one clarifying question first."
              confidence="high"
              sampleSize={6}
              sampleLabel="n = 6 objections · 4 calls"
              tag={{ tone: "regress", label: "↓ Regressing" }}
              evidence={[EV]}
              actions={[
                { label: "Assign coaching" },
                { label: "View 4 calls" },
                { label: "Dismiss" },
              ]}
            />
            <InsightCard
              kind="improvement"
              headline="Alex is pausing after objections — 3 of the last 4."
              confidence="low"
              sampleSize={4}
              tag={{ tone: "improve", label: "↑ Improving" }}
              actions={[{ label: "Assign coaching" }]}
            />
            <InsightCard
              kind="pattern"
              headline="Discounting caused the lost deals."
              confidence="medium"
              sampleSize={12}
            />
          </div>
        </Section>

        <Section title="Room message blocks" node="39:904 · 39:918 · 39:935 · 39:946 · 39:956">
          <div className="flex w-[560px] flex-col gap-3">
            <ReportBlock title="Weekly Sales Behavior Report" meta="Report · Wk 39 · 5-min read" />
            <CallBlock
              title="Jordan × Acme Logistics"
              meta="38 min · Mon 2:00 PM · 4 key moments"
              moment={{ tone: "regress", label: "Lost control 18:42" }}
            />
            <CoachingBlock
              title="Focus: pause after objections"
              meta="Jordan · measured on next 5 objections · 2 clips attached"
            />
            <StructuredInsightBlock
              columns={[
                {
                  title: "Key moment",
                  body: "Acme CFO voiced rollout risk at 18:42; treated as price.",
                },
                {
                  title: "Behavioral insight",
                  body: "Reps answered before diagnosing in 7 of 9 price objections.",
                },
                {
                  title: "Today’s focus",
                  body: "Pause · ask “what’s behind that?” · then answer.",
                },
              ]}
            />
            <Reactions
              reactions={[
                { symbol: "◉", count: 3 },
                { symbol: "✓", count: 2, mine: true },
              ]}
            />
          </div>
        </Section>

        <Section title="Icons — Lucide @ 1.6" node="35:15">
          {ICON_NAMES.map((n) => (
            <span
              key={n}
              className="flex w-[88px] flex-col items-center gap-1 text-by-text-primary"
            >
              <Icon name={n} size={18} />
              <span className="type-mono-micro text-by-text-tertiary">{n}</span>
            </span>
          ))}
        </Section>

        <Section title="Menus & popovers" node="50:27312">
          <WorkspaceSwitcher>
            <Button variant="secondary">Workspace switcher</Button>
          </WorkspaceSwitcher>
          <NewMenu onAsk={() => undefined}>
            <Button icon="plus">New</Button>
          </NewMenu>
          <ProfileMenu>
            <Button variant="secondary">Profile menu</Button>
          </ProfileMenu>
          <CallMoreMenu callId="call_acme">
            <Button variant="secondary" icon="more">
              Call more-menu
            </Button>
          </CallMoreMenu>
        </Section>

        <Section title="Generic states" node="1:18">
          <StateEmpty title="No saved views yet." body="Save a filter on Calls to pin it here." />
          <StateError body="The calls service didn’t answer in 60s." onRetry={() => undefined} />
          <StateLoading />
          <StateLoading
            variant="progress"
            title="312 of 486 calls analyzed."
            body="Your first brief will be ready in ~14 min."
          />
        </Section>

        <Section title="Page 17 — all 13 states" node="19:2">
          {STATE_CODES.map((s) => (
            <SystemStatePreset key={s.code} id={s.id} />
          ))}
        </Section>
      </div>
    </main>
  );
}
