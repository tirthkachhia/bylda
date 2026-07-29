import { Check, Copy, Download, Save, ThumbsDown, ThumbsUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Json = unknown;
type Out = Record<string, Json> | null;

export function OutputHeader({
  label = "Output",
  onCopy,
  onSave,
  onDownload,
  onFeedback,
  feedback,
}: {
  label?: string;
  onCopy?: () => void;
  onSave?: () => void;
  onDownload?: () => void;
  onFeedback?: (v: "up" | "down") => void;
  feedback?: "up" | "down" | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
        {label}
      </div>
      <div className="flex items-center gap-1">
        {onFeedback && (
          <div
            className="mr-1 flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() => onFeedback("up")}
              className="flex h-6 w-6 items-center justify-center rounded-md transition"
              style={
                feedback === "up"
                  ? {
                      background: "color-mix(in oklab, var(--success) 15%, transparent)",
                      color: "var(--success)",
                    }
                  : { color: "var(--muted-foreground)" }
              }
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onFeedback("down")}
              className="flex h-6 w-6 items-center justify-center rounded-md transition"
              style={
                feedback === "down"
                  ? {
                      background: "color-mix(in oklab, var(--destructive) 15%, transparent)",
                      color: "var(--destructive)",
                    }
                  : { color: "var(--muted-foreground)" }
              }
              title="Needs work"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}
        {onCopy && <IconBtn onClick={onCopy} icon={Copy} label="Copy" />}
        {onDownload && <IconBtn onClick={onDownload} icon={Download} label="Export" />}
        {onSave && (
          <button
            onClick={onSave}
            className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition"
            style={{
              background: "color-mix(in oklab, var(--primary) 10%, transparent)",
              border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
              color: "var(--primary)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "color-mix(in oklab, var(--primary) 16%, transparent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "color-mix(in oklab, var(--primary) 10%, transparent)";
            }}
          >
            <Save className="h-3 w-3" /> Save
          </button>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition"
      style={{ color: "var(--muted-foreground)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
      }}
      title={label}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

export function copyText(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Copy failed"),
  );
}

/* ────────── Block primitives ────────── */

const ACCENT_STYLES: Record<string, { borderColor: string; bg: string; titleColor: string }> = {
  primary: {
    borderColor: "var(--primary)",
    bg: "color-mix(in oklab, var(--primary) 5%, var(--surface-2))",
    titleColor: "var(--primary)",
  },
  accent: {
    borderColor: "var(--accent)",
    bg: "color-mix(in oklab, var(--accent) 5%, var(--surface-2))",
    titleColor: "var(--accent)",
  },
  warning: {
    borderColor: "var(--warning)",
    bg: "color-mix(in oklab, var(--warning) 5%, var(--surface-2))",
    titleColor: "var(--warning)",
  },
  destructive: {
    borderColor: "var(--destructive)",
    bg: "color-mix(in oklab, var(--destructive) 5%, var(--surface-2))",
    titleColor: "var(--destructive)",
  },
  success: {
    borderColor: "var(--success)",
    bg: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
    titleColor: "var(--success)",
  },
};

export function Block({
  title,
  children,
  className,
  accent,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  accent?: "primary" | "accent" | "warning" | "destructive" | "success";
}) {
  const styles = accent ? ACCENT_STYLES[accent] : null;
  return (
    <section
      className={cn("overflow-hidden rounded-xl", className)}
      style={{
        background: styles ? styles.bg : "var(--surface-2)",
        border: `1px solid ${styles ? `color-mix(in oklab, ${styles.borderColor} 25%, transparent)` : "color-mix(in oklab, var(--border) 70%, transparent)"}`,
        borderLeft: styles ? `3px solid ${styles.borderColor}` : undefined,
      }}
    >
      <div className="p-4">
        {title && (
          <div
            className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: styles ? styles.titleColor : "var(--muted-foreground)" }}
          >
            {title}
          </div>
        )}
        <div
          className="text-[13.5px] leading-relaxed"
          style={{ color: "color-mix(in oklab, var(--foreground) 90%, transparent)" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// ─── Markdown renderer for full_report fields ────────────────────────────────
// Handles the patterns our AI prompts produce: ## headers, **bold**, tables,
// bullet lists, ordered lists, --- dividers, and paragraphs.
export function MarkdownReport({ content }: { content: string }) {
  if (!content) return null;

  // Inline: **bold**, *italic*, `code`
  function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2] !== undefined)
        parts.push(
          <strong key={m.index} style={{ color: "var(--foreground)", fontWeight: 600 }}>
            {m[2]}
          </strong>,
        );
      else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
      else if (m[4] !== undefined)
        parts.push(
          <code
            key={m.index}
            style={{
              background: "var(--surface-3, var(--surface-2))",
              borderRadius: 4,
              padding: "1px 5px",
              fontSize: "0.85em",
              color: "var(--primary)",
            }}
          >
            {m[4]}
          </code>,
        );
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
  }

  // Table row parser
  function parseTableRow(line: string): string[] {
    return line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, a) => i > 0 && i < a.length - 1);
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines between blocks
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(
        <hr
          key={i}
          style={{
            border: "none",
            borderTop: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
            margin: "4px 0",
          }}
        />,
      );
      i++;
      continue;
    }

    // H2 heading
    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3);
      elements.push(
        <h2
          key={i}
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--primary)",
            marginTop: elements.length ? "20px" : 0,
            marginBottom: "6px",
          }}
        >
          {renderInline(text)}
        </h2>,
      );
      i++;
      continue;
    }

    // H3 heading
    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4);
      elements.push(
        <h3
          key={i}
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--foreground)",
            marginTop: "14px",
            marginBottom: "4px",
          }}
        >
          {renderInline(text)}
        </h3>,
      );
      i++;
      continue;
    }

    // Table — collect header + separator + rows
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      /^\|[-| :]+\|$/.test(lines[i + 1].trim())
    ) {
      const headers = parseTableRow(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i].trim()));
        i++;
      }
      elements.push(
        <div
          key={`table-${i}`}
          style={{ overflowX: "auto", marginTop: "8px", marginBottom: "8px" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
            <thead>
              <tr
                style={{ background: "color-mix(in oklab, var(--primary) 8%, var(--surface-2))" }}
              >
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    style={{
                      padding: "7px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      borderBottom: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom: "1px solid color-mix(in oklab, var(--border) 35%, transparent)",
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "6px 12px",
                        color: "color-mix(in oklab, var(--foreground) 85%, transparent)",
                        verticalAlign: "top",
                      }}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list — collect consecutive bullet lines
    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: "16px", margin: "4px 0 8px" }}>
          {items.map((item, ii) => (
            <li
              key={ii}
              style={{
                fontSize: "13px",
                color: "color-mix(in oklab, var(--foreground) 90%, transparent)",
                marginBottom: "3px",
                lineHeight: 1.55,
              }}
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: "18px", margin: "4px 0 8px" }}>
          {items.map((item, ii) => (
            <li
              key={ii}
              style={{
                fontSize: "13px",
                color: "color-mix(in oklab, var(--foreground) 90%, transparent)",
                marginBottom: "3px",
                lineHeight: 1.55,
              }}
            >
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blockquote (email templates)
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={`bq-${i}`}
          style={{
            borderLeft: "3px solid var(--primary)",
            paddingLeft: "14px",
            margin: "8px 0",
            color: "color-mix(in oklab, var(--foreground) 80%, transparent)",
            fontStyle: "italic",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} style={{ margin: "3px 0" }}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p
        key={i}
        style={{
          fontSize: "13px",
          lineHeight: 1.6,
          color: "color-mix(in oklab, var(--foreground) 88%, transparent)",
          margin: "4px 0 6px",
        }}
      >
        {renderInline(trimmed)}
      </p>,
    );
    i++;
  }

  return <div style={{ lineHeight: 1.6 }}>{elements}</div>;
}

export function ScoreGauge({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct >= 75
      ? "var(--success)"
      : pct >= 50
        ? "var(--primary)"
        : pct >= 25
          ? "var(--warning)"
          : "var(--destructive)";
  return (
    <div
      className="flex items-center gap-4 overflow-hidden rounded-xl p-4"
      style={{
        background: `color-mix(in oklab, ${color} 6%, var(--surface-2))`,
        border: `1px solid color-mix(in oklab, ${color} 20%, transparent)`,
      }}
    >
      <div
        className="font-display text-[2.6rem] font-semibold leading-none tabular-nums"
        style={{ color }}
      >
        {Math.round(value)}
        <span className="ml-0.5 text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>
          /{max}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {label && (
          <div className="text-[12.5px] font-medium" style={{ color: "var(--foreground)" }}>
            {label}
          </div>
        )}
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--surface-offset)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
          />
        </div>
      </div>
    </div>
  );
}

export function BulletList({
  items,
  accent,
}: {
  items: unknown[];
  accent?: "success" | "destructive" | "warning" | "primary";
}) {
  const dotColor =
    accent === "success"
      ? "var(--success)"
      : accent === "destructive"
        ? "var(--destructive)"
        : accent === "warning"
          ? "var(--warning)"
          : accent === "primary"
            ? "var(--primary)"
            : "var(--muted-foreground)";

  return (
    <ul className="space-y-2 text-[13.5px] leading-relaxed">
      {items.filter(Boolean).map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: dotColor, flexShrink: 0, marginTop: "0.4rem" }}
          />
          <span style={{ color: "color-mix(in oklab, var(--foreground) 90%, transparent)" }}>
            {typeof it === "string" ? it : JSON.stringify(it)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ────────── Per-tool intelligent renderers ────────── */
export function OutputBody({ toolKey, output }: { toolKey: string; output: Out }) {
  if (!output) return null;
  const o = output as Record<string, unknown>;

  switch (toolKey) {
    case "validate-idea":
      return <ValidatorOut o={o} />;
    case "generate-pitch":
      return <PitchOut o={o} />;
    case "generate-gtm-strategy":
      return <GtmOut o={o} />;
    case "generate-offer":
      return <OfferOut o={o} />;
    case "generate-ops-plan":
      return <OpsOut o={o} />;
    case "generate-followup-sequence":
      return <FollowupOut o={o} />;
    case "analyze-website":
      return <WebsiteOut o={o} />;
    case "kill-my-idea":
      return <KillMyIdeaOut o={o} />;
    case "funding-score":
      return <FundingScoreOut o={o} />;
    case "first-10-customers":
      return <FirstTenOut o={o} />;
    case "business-plan":
    case "business-plan-generator":
      return <BusinessPlanOut o={o} />;
    case "investor-emails":
      return <InvestorEmailsOut o={o} />;
    case "idea-vs-idea":
      return <IdeaVsIdeaOut o={o} />;
    case "landing-page":
      return <LandingPageOut o={o} />;
    case "competitor-analysis":
      return <CompetitorOut o={o} />;
    case "pricing-strategy":
      return <PricingOut o={o} />;
    case "revenue-projector":
      return <RevenueOut o={o} />;
    case "blog":
      return <BlogOut o={o} />;
    case "social":
      return <SocialOut o={o} />;
    case "email_sequence":
      return <EmailSequenceOut o={o} />;
    case "sales_script":
      return <SalesScriptOut o={o} />;
    case "ad_creative":
      return <AdCreativeOut o={o} />;
    case "vsl":
      return <VslOut o={o} />;
    case "cold_email":
      return <ColdEmailOut o={o} />;
    case "niche_validator":
      return <NicheValidatorOut o={o} />;
    case "icp":
      return <IcpOut o={o} />;
    case "pitch_deck":
      return <PitchDeckOut o={o} />;
    case "lead_magnet":
      return <LeadMagnetOut o={o} />;
    case "automation":
      return <AutomationOut o={o} />;
    case "client_report":
      return <ClientReportOut o={o} />;
    case "niche-scorer":
      return <NicheScorerOut o={o} />;
    case "positioning-engine":
      return <PositioningEngineOut o={o} />;
    case "mvp-planner":
      return <MvpPlannerOut o={o} />;
    default:
      return <GenericOut o={o} />;
  }
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);

function ValidatorOut({ o }: { o: Record<string, unknown> }) {
  const rawScore = o.score ?? o.viability_score ?? o.overall_score ?? o.total_score;
  const score =
    typeof rawScore === "number" && rawScore > 0
      ? rawScore > 100
        ? Math.round((rawScore / 80) * 100)
        : rawScore
      : 0;
  const verdict = str(o.verdict ?? o.recommendation);
  const summary = str(o.summary);
  const strengths = arr(o.strengths);
  const weaknesses = arr(o.weaknesses);
  const risks = arr(o.risks);
  const next = arr(o.next_steps ?? o.recommendations ?? o.action_items);
  const dimensions = arr(o.dimensions ?? o.dimension_scores ?? o.criteria);
  const fullReport = str(o.full_report);

  const verdictLower = verdict.toLowerCase();
  const verdictColor =
    verdictLower.includes("go") || verdictLower.includes("strong") || verdictLower.includes("valid")
      ? "var(--success)"
      : verdictLower.includes("pause") || verdictLower.includes("caution")
        ? "var(--warning)"
        : verdictLower.includes("pivot") ||
            verdictLower.includes("stop") ||
            verdictLower.includes("kill")
          ? "var(--destructive)"
          : score >= 65
            ? "var(--success)"
            : score >= 40
              ? "var(--warning)"
              : "var(--destructive)";

  const verdictLabel =
    verdictLower.includes("go") || score >= 70
      ? "GO"
      : verdictLower.includes("pivot")
        ? "PIVOT"
        : score >= 45
          ? "PAUSE"
          : "STOP";

  return (
    <div className="space-y-3">
      {(score > 0 || verdict) && (
        <div
          className="flex items-center gap-5 overflow-hidden rounded-xl p-5"
          style={{
            background: `color-mix(in oklab, ${verdictColor} 6%, var(--surface-2))`,
            border: `1px solid color-mix(in oklab, ${verdictColor} 22%, transparent)`,
          }}
        >
          {score > 0 && (
            <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
              <svg
                viewBox="0 0 36 36"
                style={{ transform: "rotate(-90deg)", width: 80, height: 80 }}
              >
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="var(--surface-offset, rgba(0,0,0,0.08))"
                  strokeWidth="4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={verdictColor}
                  strokeWidth="4"
                  strokeDasharray={`${(score / 100) * 87.96} 87.96`}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${verdictColor})` }}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center font-mono text-[1.15rem] font-bold tabular-nums"
                style={{ color: verdictColor }}
              >
                {Math.round(score)}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider"
                style={{
                  background: `color-mix(in oklab, ${verdictColor} 18%, transparent)`,
                  color: verdictColor,
                  border: `1px solid color-mix(in oklab, ${verdictColor} 35%, transparent)`,
                }}
              >
                {verdictLabel}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Viability score
              </span>
            </div>
            {verdict && (
              <div
                className="text-[13.5px] font-medium leading-snug"
                style={{ color: "var(--foreground)" }}
              >
                {verdict}
              </div>
            )}
            {summary && (
              <div
                className="mt-1 text-[12.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {summary}
              </div>
            )}
          </div>
        </div>
      )}
      {dimensions.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Dimension breakdown
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {dimensions.map((d, i) => {
              const item =
                typeof d === "object" && d ? (d as Record<string, unknown>) : { name: String(d) };
              const label = str(item.name ?? item.dimension ?? item.criterion ?? item.category);
              const sc = num(item.score, 0);
              const maxSc = num(item.max, 10);
              const note = str(item.note ?? item.notes ?? item.rationale);
              const pct = Math.min(100, (sc / maxSc) * 100);
              const col =
                pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--primary)" : "var(--warning)";
              return (
                <div key={i} className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-[12.5px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {label}
                    </span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: col }}>
                      {sc}/{maxSc}
                    </span>
                  </div>
                  <div
                    className="mb-1 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-offset, rgba(0,0,0,0.06))" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: col, boxShadow: `0 0 6px ${col}` }}
                    />
                  </div>
                  {note && (
                    <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                      {note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {(strengths.length > 0 || weaknesses.length > 0 || risks.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {strengths.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--success) 22%, transparent)",
                borderTop: "3px solid var(--success)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--success)" }}
              >
                Strengths
              </div>
              {strengths.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>
                  {typeof s === "string" ? s : JSON.stringify(s)}
                </div>
              ))}
              {strengths.length > 3 && (
                <div className="text-[10.5px]" style={{ color: "var(--success)" }}>
                  +{strengths.length - 3} more
                </div>
              )}
            </div>
          )}
          {weaknesses.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--warning) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--warning) 22%, transparent)",
                borderTop: "3px solid var(--warning)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--warning)" }}
              >
                Weaknesses
              </div>
              {weaknesses.slice(0, 3).map((w, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--warning)", flexShrink: 0 }}>△</span>
                  {typeof w === "string" ? w : JSON.stringify(w)}
                </div>
              ))}
              {weaknesses.length > 3 && (
                <div className="text-[10.5px]" style={{ color: "var(--warning)" }}>
                  +{weaknesses.length - 3} more
                </div>
              )}
            </div>
          )}
          {risks.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--destructive) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--destructive) 22%, transparent)",
                borderTop: "3px solid var(--destructive)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--destructive)" }}
              >
                Key Risks
              </div>
              {risks.slice(0, 3).map((r, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--destructive)", flexShrink: 0 }}>✕</span>
                  {typeof r === "string" ? r : JSON.stringify(r)}
                </div>
              ))}
              {risks.length > 3 && (
                <div className="text-[10.5px]" style={{ color: "var(--destructive)" }}>
                  +{risks.length - 3} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {next.length > 0 && (
        <Block title="Next steps — what to do now" accent="primary">
          <div className="space-y-1.5">
            {next.map((n, i) => (
              <div
                key={i}
                className="flex gap-2.5 text-[13px]"
                style={{ color: "var(--foreground)" }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--primary)", flexShrink: 0 }}
                >
                  {i + 1}
                </span>
                {typeof n === "string" ? n : JSON.stringify(n)}
              </div>
            ))}
          </div>
        </Block>
      )}
      {fullReport &&
        strengths.length === 0 &&
        weaknesses.length === 0 &&
        dimensions.length === 0 && (
          <Block title="Full Report">
            <MarkdownReport content={fullReport} />
          </Block>
        )}
    </div>
  );
}

function PitchOut({ o }: { o: Record<string, unknown> }) {
  const headline = str(o.headline);
  const problem = str(o.problem);
  const solution = str(o.offer ?? o.solution);
  const outcome = str(o.outcome);
  const cta = str(o.cta);
  // Edge function returns verbal_pitch + slide_narrative
  const verbalPitch = str(o.verbal_pitch);
  const slideNarrative = arr(o.slide_narrative);
  const fullReport = str(o.full_report);

  // If no structured fields, render verbal_pitch + slides
  const hasStructured = headline || problem || solution || outcome || cta;

  if (!hasStructured) {
    return (
      <div className="space-y-3">
        {verbalPitch && (
          <div
            className="overflow-hidden rounded-xl p-5"
            style={{
              background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
              border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
              borderLeft: "3px solid var(--primary)",
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3"
              style={{ color: "var(--primary)" }}
            >
              60-Second Verbal Pitch
            </div>
            <div
              className="whitespace-pre-wrap text-[13.5px] leading-relaxed"
              style={{ color: "var(--foreground)" }}
            >
              {verbalPitch}
            </div>
          </div>
        )}
        {slideNarrative.length > 0 && (
          <div
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                color: "var(--muted-foreground)",
              }}
            >
              10-Slide Narrative
            </div>
            <ol
              className="divide-y"
              style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
            >
              {slideNarrative.map((s, i) => {
                const slide =
                  typeof s === "object" && s
                    ? (s as Record<string, unknown>)
                    : { content: String(s) };
                const title = str(slide.title ?? slide.slide ?? slide.name ?? `Slide ${i + 1}`);
                const content = str(
                  slide.content ??
                    slide.description ??
                    slide.body ??
                    slide.key_insight ??
                    slide.key_stat,
                );
                return (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--primary), var(--accent))",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-[13.5px]">
                      <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                        {title}
                      </div>
                      {content && (
                        <div
                          className="mt-0.5 text-[13px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {content}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {!verbalPitch && !slideNarrative.length && fullReport && (
          <Block title="Pitch Package">
            <MarkdownReport content={fullReport} />
          </Block>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {headline && (
        <div
          className="overflow-hidden rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            Headline
          </div>
          <div
            className="mt-2 font-display text-[1.35rem] font-semibold leading-tight tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {headline}
          </div>
        </div>
      )}
      {problem && <Block title="Problem">{problem}</Block>}
      {solution && (
        <Block title="Solution" accent="primary">
          {solution}
        </Block>
      )}
      {outcome && (
        <Block title="Outcome" accent="success">
          {outcome}
        </Block>
      )}
      {cta && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--accent) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--accent) 25%, transparent)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Call to action
          </div>
          <div className="mt-1.5 text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            {cta}
          </div>
        </div>
      )}
    </div>
  );
}

function GtmOut({ o }: { o: Record<string, unknown> }) {
  const icp = str(o.icp);
  const positioning = str(o.positioning ?? o.positioning_statement);
  const channels = arr(o.channels ?? o.top_channels);
  const phases = arr(o.phases ?? o.timeline);
  const priorities = arr(o.priorities ?? o.kpis);
  const actions = arr(o.top_actions ?? o.immediate_actions ?? o.quick_wins);
  const fullReport = str(o.full_report);
  const channelColors = [
    "var(--primary)",
    "var(--accent)",
    "var(--success)",
    "color-mix(in oklab, var(--primary) 60%, var(--accent))",
    "color-mix(in oklab, var(--accent) 70%, var(--success))",
  ];
  return (
    <div className="space-y-3">
      {icp && (
        <div
          className="overflow-hidden rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--primary) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
            borderTop: "3px solid var(--primary)",
          }}
        >
          <div
            className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            Ideal Customer Profile
          </div>
          <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            {icp}
          </div>
        </div>
      )}
      {positioning && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Positioning statement
          </div>
          <div
            className="text-[13.5px] leading-relaxed italic"
            style={{ color: "var(--foreground)" }}
          >
            "{positioning}"
          </div>
        </div>
      )}
      {channels.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Channel priority matrix
          </div>
          <div className="grid gap-2 p-3">
            {channels.map((c, i) => {
              const item =
                typeof c === "object" && c ? (c as Record<string, unknown>) : { name: String(c) };
              const name = str(item.name ?? item.channel ?? item.title ?? String(c));
              const why = str(item.why ?? item.rationale ?? item.description ?? item.reason);
              const col = channelColors[i % channelColors.length];
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: `color-mix(in oklab, ${col} 6%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${col} 18%, transparent)`,
                  }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: col }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {name}
                    </div>
                    {why && (
                      <div
                        className="mt-0.5 text-[11.5px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {why}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {phases.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            90-day launch timeline
          </div>
          <div className="relative p-4">
            <div
              className="absolute bottom-7 top-7"
              style={{
                left: "calc(1rem + 12px)",
                width: 2,
                background: "color-mix(in oklab, var(--border) 60%, transparent)",
              }}
            />
            <div className="space-y-4">
              {phases.map((p, i) => {
                const item =
                  typeof p === "object" && p ? (p as Record<string, unknown>) : { name: String(p) };
                const name = str(item.name ?? item.title ?? item.phase ?? `Phase ${i + 1}`);
                const description = str(item.description ?? item.focus ?? item.goal);
                const timeline = str(item.timeline ?? item.duration ?? item.period);
                const phaseColors = ["var(--primary)", "var(--accent)", "var(--success)"];
                const col = phaseColors[i % phaseColors.length];
                return (
                  <div key={i} className="flex gap-3">
                    <div
                      className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: col }}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {name}
                        </span>
                        {timeline && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              background: `color-mix(in oklab, ${col} 12%, transparent)`,
                              color: col,
                              border: `1px solid color-mix(in oklab, ${col} 28%, transparent)`,
                            }}
                          >
                            {timeline}
                          </span>
                        )}
                      </div>
                      {description && (
                        <div
                          className="mt-1 text-[12.5px] leading-relaxed"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {(actions.length > 0 || priorities.length > 0) && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--accent) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--accent) 20%, transparent)",
            borderTop: "3px solid var(--accent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Top actions — start here
          </div>
          <div className="space-y-2 px-4 pb-4">
            {(actions.length > 0 ? actions : priorities).slice(0, 5).map((a, i) => (
              <div
                key={i}
                className="flex gap-2.5 text-[13px]"
                style={{ color: "var(--foreground)" }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--accent)", flexShrink: 0 }}
                >
                  {i + 1}
                </span>
                {typeof a === "string" ? a : JSON.stringify(a)}
              </div>
            ))}
          </div>
        </div>
      )}
      {fullReport && !positioning && channels.length === 0 && phases.length === 0 && (
        <Block title="GTM Strategy">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function OfferOut({ o }: { o: Record<string, unknown> }) {
  const name = str(o.name);
  const promise = str(o.promise);
  const deliverables = arr(o.deliverables);
  // Edge function returns price_recommendation, not price_anchor
  const priceAnchor = str(o.price_anchor ?? o.price_recommendation ?? o.dream_outcome);
  const guarantee = str(o.guarantee);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {name && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            Offer
          </div>
          <div
            className="mt-2 font-display text-[1.35rem] font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {name}
          </div>
          {promise && (
            <div className="mt-1.5 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
              {promise}
            </div>
          )}
        </div>
      )}
      {deliverables.length > 0 && (
        <Block title="Deliverables" accent="primary">
          <BulletList items={deliverables} accent="primary" />
        </Block>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {priceAnchor && <Block title="Price anchor">{priceAnchor}</Block>}
        {guarantee && (
          <Block title="Guarantee" accent="success">
            {guarantee}
          </Block>
        )}
      </div>
    </div>
  );
}

function OpsOut({ o }: { o: Record<string, unknown> }) {
  const workflows = arr(o.workflows);
  const automations = arr(o.automations);
  const kpis = arr(o.kpis);
  return (
    <div className="space-y-3">
      {workflows.length > 0 && (
        <Block title="Workflows">
          <BulletList items={workflows} accent="primary" />
        </Block>
      )}
      {automations.length > 0 && (
        <Block title="Automations" accent="accent">
          <BulletList items={automations} accent="primary" />
        </Block>
      )}
      {kpis.length > 0 && (
        <Block title="Key metrics" accent="success">
          <BulletList items={kpis} accent="success" />
        </Block>
      )}
    </div>
  );
}

function FollowupOut({ o }: { o: Record<string, unknown> }) {
  const seq = arr(o.sequence ?? o.emails ?? o.steps);
  if (!seq.length) return <GenericOut o={o} />;
  return (
    <div className="space-y-3">
      {seq.map((s, i) => {
        const item =
          typeof s === "object" && s ? (s as Record<string, unknown>) : { body: String(s) };
        const day = str(item.day);
        const delay = str(item.delay);
        const channel = str(item.channel);
        const subject = str(item.subject);
        const body = str(item.body ?? item.message ?? item.content);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                background: "color-mix(in oklab, var(--surface-offset) 60%, transparent)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Step {i + 1}
                  {day ? ` · Day ${day}` : delay ? ` · ${delay}` : ""}
                </span>
              </div>
              {channel && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {channel}
                </span>
              )}
            </div>
            <div className="px-4 py-3">
              {subject && (
                <div
                  className="mb-2 text-[13.5px] font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {subject}
                </div>
              )}
              <div
                className="whitespace-pre-wrap text-[13px] leading-relaxed"
                style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
              >
                {body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WebsiteOut({ o }: { o: Record<string, unknown> }) {
  const issues = arr(o.issues);
  const opportunities = arr(o.opportunities);
  const suggested = arr(o.suggested_changes);
  const seo = str(o.seo_notes);
  const ux = str(o.ux_notes);
  return (
    <div className="space-y-3">
      {issues.length > 0 && (
        <Block title="Issues" accent="destructive">
          <BulletList items={issues} accent="destructive" />
        </Block>
      )}
      {opportunities.length > 0 && (
        <Block title="Opportunities" accent="primary">
          <BulletList items={opportunities} accent="primary" />
        </Block>
      )}
      {suggested.length > 0 && (
        <Block title="Suggested changes" accent="success">
          <BulletList items={suggested} accent="success" />
        </Block>
      )}
      {seo && <Block title="SEO notes">{seo}</Block>}
      {ux && <Block title="UX notes">{ux}</Block>}
    </div>
  );
}

function KillMyIdeaOut({ o }: { o: Record<string, unknown> }) {
  const score = num(o.survival_score, 0);
  const verdict = str(o.verdict);
  const killShot = str(o.the_kill_shot ?? o.fatal_flaw);
  const fatalFlaws = arr(o.fatal_flaws ?? o.reasons_to_fail);
  const marketRisks = arr(o.market_risks);
  const executionRisks = arr(o.execution_risks);
  const assumptions = arr(o.dangerous_assumptions);
  const ifYouProceed = arr(o.if_you_proceed ?? o.pivots);
  const fullReport = str(o.full_report);
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 65 ? "var(--warning)" : "var(--destructive)";

  const allFlaws: Array<{
    label: string;
    severity: "fatal" | "market" | "exec";
    mitigation?: string;
  }> = [
    ...fatalFlaws.map((f) => {
      if (typeof f === "object" && f) {
        const item = f as Record<string, unknown>;
        return {
          label: str(item.flaw ?? item.issue ?? item.description ?? item),
          severity: "fatal" as const,
          mitigation: str(item.mitigation ?? item.fix),
        };
      }
      return { label: String(f), severity: "fatal" as const };
    }),
    ...marketRisks.map((r) => ({
      label: typeof r === "string" ? r : JSON.stringify(r),
      severity: "market" as const,
    })),
    ...executionRisks.map((r) => ({
      label: typeof r === "string" ? r : JSON.stringify(r),
      severity: "exec" as const,
    })),
  ];
  const severityConfig = {
    fatal: {
      color: "var(--destructive)",
      label: "FATAL",
      bg: "color-mix(in oklab, var(--destructive) 8%, var(--surface-2))",
      border: "color-mix(in oklab, var(--destructive) 25%, transparent)",
    },
    market: {
      color: "var(--warning)",
      label: "MARKET RISK",
      bg: "color-mix(in oklab, var(--warning) 6%, var(--surface-2))",
      border: "color-mix(in oklab, var(--warning) 22%, transparent)",
    },
    exec: {
      color: "color-mix(in oklab, var(--warning) 80%, var(--foreground))",
      label: "EXECUTION",
      bg: "color-mix(in oklab, var(--warning) 5%, var(--surface-2))",
      border: "color-mix(in oklab, var(--warning) 18%, transparent)",
    },
  };
  return (
    <div className="space-y-3">
      {(score > 0 || verdict) && (
        <div
          className="overflow-hidden rounded-xl p-4"
          style={{
            background: `color-mix(in oklab, ${color} 7%, var(--surface-2))`,
            border: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div
                className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color }}
              >
                Survivability score
              </div>
              {verdict && (
                <div
                  className="text-[13.5px] font-semibold leading-snug"
                  style={{ color: "var(--foreground)" }}
                >
                  {verdict}
                </div>
              )}
            </div>
            <div
              className="flex shrink-0 items-baseline gap-0.5 font-mono font-bold tabular-nums"
              style={{ color, fontSize: "2.2rem", lineHeight: 1 }}
            >
              {Math.round(score)}
              <span
                className="text-[14px] font-normal"
                style={{ color: "var(--muted-foreground)" }}
              >
                /100
              </span>
            </div>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--surface-offset, rgba(0,0,0,0.08))" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
            />
          </div>
          <div className="mt-1.5 text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
            Lower = higher failure risk · 0 means certain death
          </div>
        </div>
      )}
      {killShot && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--destructive) 8%, var(--surface-2))",
            border: "2px solid color-mix(in oklab, var(--destructive) 30%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--destructive) 20%, transparent)",
            }}
          >
            <span
              className="text-[9.5px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--destructive)" }}
            >
              ☠ The kill shot
            </span>
          </div>
          <div
            className="p-4 text-[14px] font-medium leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            {killShot}
          </div>
        </div>
      )}
      {allFlaws.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Failure points — ranked by severity
          </div>
          <div className="space-y-2 p-3">
            {allFlaws.map((flaw, i) => {
              const cfg = severityConfig[flaw.severity];
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <div className="flex items-start gap-3 p-3">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: cfg.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em]"
                          style={{
                            background: `color-mix(in oklab, ${cfg.color} 15%, transparent)`,
                            color: cfg.color,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div
                        className="text-[12.5px] leading-relaxed"
                        style={{ color: "var(--foreground)" }}
                      >
                        {flaw.label}
                      </div>
                      {flaw.mitigation && (
                        <div
                          className="mt-1.5 flex gap-1.5 text-[11.5px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <span style={{ color: "var(--success)", flexShrink: 0 }}>→</span>
                          <span>{flaw.mitigation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {assumptions.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Dangerous assumptions
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {assumptions.map((a, i) => {
              const item = typeof a === "object" && a ? (a as Record<string, unknown>) : {};
              return (
                <div key={i} className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                  <div>
                    <div
                      className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.1em]"
                      style={{ color: "var(--warning)" }}
                    >
                      You assume
                    </div>
                    <div className="text-[12.5px]" style={{ color: "var(--foreground)" }}>
                      {str(item.assumption ?? a)}
                    </div>
                  </div>
                  {str(item.reality) && (
                    <div>
                      <div
                        className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.1em]"
                        style={{ color: "var(--destructive)" }}
                      >
                        Reality check
                      </div>
                      <div className="text-[12.5px]" style={{ color: "var(--foreground)" }}>
                        {str(item.reality)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {ifYouProceed.length > 0 && (
        <Block title="If you proceed — fix these first" accent="primary">
          <div className="space-y-1.5">
            {ifYouProceed.map((n, i) => (
              <div
                key={i}
                className="flex gap-2.5 text-[13px]"
                style={{ color: "var(--foreground)" }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--primary)", flexShrink: 0 }}
                >
                  {i + 1}
                </span>
                {typeof n === "string" ? n : JSON.stringify(n)}
              </div>
            ))}
          </div>
        </Block>
      )}
      {fullReport && !killShot && allFlaws.length === 0 && (
        <Block title="Devil's Advocate Report">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function FundingScoreOut({ o }: { o: Record<string, unknown> }) {
  const score = num(o.score ?? o.funding_score ?? o.overall_score, 0);
  const verdict = str(o.verdict ?? o.summary ?? o.grade);
  const breakdown = arr(o.breakdown ?? o.criteria ?? o.dimension_scores);
  const strengths = arr(o.investor_strengths ?? o.strengths);
  const weaknesses = arr(o.investor_concerns ?? o.weaknesses);
  const recommendations = arr(o.recommendations ?? o.next_steps);
  const investorType = str(o.investor_type);
  const fullReport = str(o.full_report);
  const pct = Math.max(0, Math.min(100, score));
  const scoreColor =
    pct >= 70
      ? "var(--success)"
      : pct >= 45
        ? "var(--primary)"
        : pct >= 25
          ? "var(--warning)"
          : "var(--destructive)";
  const readinessLabel =
    pct >= 75
      ? "Investor-Ready"
      : pct >= 55
        ? "Getting There"
        : pct >= 35
          ? "Pre-Ready"
          : "Not Ready";
  return (
    <div className="space-y-3">
      {(score > 0 || verdict) && (
        <div
          className="overflow-hidden rounded-xl p-5"
          style={{
            background: `color-mix(in oklab, ${scoreColor} 6%, var(--surface-2))`,
            border: `1px solid color-mix(in oklab, ${scoreColor} 22%, transparent)`,
          }}
        >
          <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 90, height: 55 }}>
              <svg viewBox="0 0 100 60" style={{ width: 90, height: 55 }}>
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="var(--surface-offset, rgba(0,0,0,0.08))"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 125.66} 125.66`}
                  style={{ filter: `drop-shadow(0 0 4px ${scoreColor})` }}
                />
              </svg>
              <div
                className="absolute inset-x-0 bottom-0 text-center font-mono font-bold tabular-nums"
                style={{ fontSize: "1.3rem", color: scoreColor, lineHeight: 1 }}
              >
                {Math.round(score)}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider"
                  style={{
                    background: `color-mix(in oklab, ${scoreColor} 15%, transparent)`,
                    color: scoreColor,
                    border: `1px solid color-mix(in oklab, ${scoreColor} 30%, transparent)`,
                  }}
                >
                  {readinessLabel}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Fundability score
                </span>
              </div>
              {verdict && (
                <div
                  className="text-[13.5px] font-medium leading-snug"
                  style={{ color: "var(--foreground)" }}
                >
                  {verdict}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {breakdown.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Investor criteria checklist
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {breakdown.map((b, i) => {
              const item =
                typeof b === "object" && b
                  ? (b as Record<string, unknown>)
                  : { criterion: String(b) };
              const criterion = str(item.criterion ?? item.name ?? item.category);
              const sc = num(item.score, 0);
              const note = str(item.notes ?? item.rationale ?? item.note);
              const maxSc = num(item.max, 10);
              const pctItem = Math.min(100, (sc / maxSc) * 100);
              const passes = pctItem >= 60;
              const itemColor =
                pctItem >= 70
                  ? "var(--success)"
                  : pctItem >= 40
                    ? "var(--warning)"
                    : "var(--destructive)";
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: itemColor, flexShrink: 0 }}
                  >
                    {passes ? "✓" : "✕"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className="text-[12.5px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {criterion}
                      </span>
                      <span
                        className="font-mono text-[11px] font-semibold"
                        style={{ color: itemColor }}
                      >
                        {sc}/{maxSc}
                      </span>
                    </div>
                    <div
                      className="mb-1 h-1 overflow-hidden rounded-full"
                      style={{ background: "var(--surface-offset, rgba(0,0,0,0.06))" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pctItem}%`,
                          background: itemColor,
                          boxShadow: `0 0 5px ${itemColor}`,
                        }}
                      />
                    </div>
                    {note && (
                      <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                        {note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--success) 20%, transparent)",
                borderTop: "3px solid var(--success)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--success)" }}
              >
                Investor strengths
              </div>
              {strengths.slice(0, 4).map((s, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>
                  {typeof s === "string" ? s : JSON.stringify(s)}
                </div>
              ))}
            </div>
          )}
          {weaknesses.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--warning) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--warning) 20%, transparent)",
                borderTop: "3px solid var(--warning)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--warning)" }}
              >
                Investor concerns
              </div>
              {weaknesses.slice(0, 4).map((w, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--warning)", flexShrink: 0 }}>△</span>
                  {typeof w === "string" ? w : JSON.stringify(w)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {recommendations.length > 0 && (
        <Block title="To improve your score" accent="primary">
          <div className="space-y-1.5">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className="flex gap-2.5 text-[13px]"
                style={{ color: "var(--foreground)" }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--primary)", flexShrink: 0 }}
                >
                  {i + 1}
                </span>
                {typeof r === "string" ? r : JSON.stringify(r)}
              </div>
            ))}
          </div>
        </Block>
      )}
      {investorType && (
        <Block title="Best investor match" accent="accent">
          {investorType}
        </Block>
      )}
      {fullReport && score === 0 && breakdown.length === 0 && (
        <Block title="Funding Readiness Report">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function FirstTenOut({ o }: { o: Record<string, unknown> }) {
  const strategy = str(o.strategy ?? o.overview);
  // Edge function returns steps array and template strings
  const channels = arr(o.channels ?? o.acquisition_channels);
  // Edge function returns steps array and cold_dm_template / cold_email_template strings
  const scripts = arr(o.outreach_scripts ?? o.scripts ?? o.steps);
  const weekByWeek = arr(o.week_by_week ?? o.plan ?? o.timeline);
  const templates = arr(o.templates ?? o.outreach_templates);
  const coldDm = str(o.cold_dm_template);
  const coldEmail = str(o.cold_email_template);
  const linkedin = str(o.linkedin_template);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {strategy && (
        <Block title="Strategy" accent="primary">
          {strategy}
        </Block>
      )}
      {channels.length > 0 && (
        <Block title="Acquisition channels">
          <BulletList items={channels} accent="primary" />
        </Block>
      )}
      {weekByWeek.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Week-by-week plan
          </div>
          <ol
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {weekByWeek.map((w, i) => {
              const item =
                typeof w === "object" && w
                  ? (w as Record<string, unknown>)
                  : { actions: String(w) };
              const week = str(item.week ?? `Week ${i + 1}`);
              const focus = str(item.focus ?? item.goal ?? item.theme);
              const actions = arr(item.actions ?? item.tasks);
              return (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="flex h-5 w-10 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--primary), var(--accent))",
                      }}
                    >
                      {week}
                    </span>
                    {focus && (
                      <span
                        className="text-[12.5px] font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {focus}
                      </span>
                    )}
                  </div>
                  {actions.length > 0 && <BulletList items={actions} accent="primary" />}
                  {actions.length === 0 && !focus && (
                    <div className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                      {str(w)}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {scripts.length > 0 && (
        <div className="space-y-2">
          {scripts.map((s, i) => {
            const item =
              typeof s === "object" && s ? (s as Record<string, unknown>) : { script: String(s) };
            const channel = str(item.channel ?? item.type);
            const script = str(item.script ?? item.message ?? item.body);
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
                }}
              >
                {channel && (
                  <div
                    className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {channel} script
                  </div>
                )}
                <div
                  className="px-4 py-3 whitespace-pre-wrap text-[12.5px] leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
                >
                  {script}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {templates.length > 0 && (
        <Block title="Outreach templates">
          <BulletList items={templates} accent="success" />
        </Block>
      )}
      {coldDm && (
        <Block title="Cold DM Template" accent="primary">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{coldDm}</div>
        </Block>
      )}
      {coldEmail && (
        <Block title="Cold Email Template">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{coldEmail}</div>
        </Block>
      )}
      {linkedin && (
        <Block title="LinkedIn Outreach">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{linkedin}</div>
        </Block>
      )}
      {fullReport && !strategy && scripts.length === 0 && !coldDm && (
        <Block title="First 10 Customers Playbook">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function BusinessPlanOut({ o }: { o: Record<string, unknown> }) {
  const exec = str(o.executive_summary ?? o.summary);
  const fullReport = str(o.full_report);
  const risks = arr(o.risks ?? o.key_risks);

  // market_opportunity: object like {TAM: "...", SAM: "...", SOM: "..."}
  const marketObj =
    o.market_opportunity &&
    typeof o.market_opportunity === "object" &&
    !Array.isArray(o.market_opportunity)
      ? (o.market_opportunity as Record<string, unknown>)
      : null;

  // revenue_projections: object like {"Year 1": "...", "Year 2": "...", ...}
  const revenueObj =
    o.revenue_projections &&
    typeof o.revenue_projections === "object" &&
    !Array.isArray(o.revenue_projections)
      ? (o.revenue_projections as Record<string, unknown>)
      : null;

  // Fallback: parse TAM/SAM/SOM from full_report markdown if structured object missing
  function parseMarketFromMarkdown(md: string): Array<{ key: string; val: string }> {
    const result: Array<{ key: string; val: string }> = [];
    const lines = md.split("\n");
    for (const line of lines) {
      const m = line.match(/^\*{0,2}(TAM|SAM|SOM)\*{0,2}[:\s]+(.+)/i);
      if (m) result.push({ key: m[1].toUpperCase(), val: m[2].replace(/\*\*/g, "").trim() });
    }
    return result;
  }

  // Fallback: parse Year N projections from full_report markdown if structured object missing
  function parseRevenueFromMarkdown(md: string): Array<{ year: string; val: string }> {
    const result: Array<{ year: string; val: string }> = [];
    const lines = md.split("\n");
    for (const line of lines) {
      // Matches "Year 1: $360K ARR..." or "| Year 1 | $360K |..."
      const m = line.match(/(Year\s+\d+)[:\s|]+(.+?)(?:\|.*)?$/i);
      if (m && m[2].trim().match(/\$[\d.,]+/)) {
        result.push({ year: m[1].trim(), val: m[2].trim().replace(/\|/g, "").trim() });
      }
    }
    return result.slice(0, 4); // max 4 years
  }

  const marketCards = marketObj
    ? Object.entries(marketObj).map(([key, val]) => ({ key, val: String(val) }))
    : parseMarketFromMarkdown(fullReport);

  const revenueRows = revenueObj
    ? Object.entries(revenueObj).map(([year, val]) => ({ year, val: String(val) }))
    : parseRevenueFromMarkdown(fullReport);

  // Extract the dollar figure and description from a market string like "$500B – description"
  function splitMarketStat(s: string): { figure: string; desc: string } {
    const match = s.match(/^(\$[\d.,]+[BMKT%]*)/i);
    if (match) return { figure: match[1], desc: s.slice(match[0].length).replace(/^[\s–—-]+/, "") };
    return { figure: s, desc: "" };
  }

  const marketColors: string[] = [
    "var(--primary)",
    "color-mix(in oklab, var(--primary) 70%, var(--accent))",
    "var(--accent)",
  ];

  return (
    <div className="space-y-3">
      {/* Executive summary */}
      {exec && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
            style={{ color: "var(--primary)" }}
          >
            Executive Summary
          </div>
          <div
            className="text-[13.5px] leading-relaxed"
            style={{ color: "color-mix(in oklab, var(--foreground) 90%, transparent)" }}
          >
            {exec}
          </div>
        </div>
      )}

      {/* Market Opportunity — TAM / SAM / SOM cards */}
      {marketCards.length > 0 && (
        <div>
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Market Opportunity
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${marketCards.length}, minmax(0, 1fr))` }}
          >
            {marketCards.map(({ key, val }, i) => {
              const color = marketColors[i] ?? "var(--primary)";
              const { figure, desc } = splitMarketStat(val);
              return (
                <div
                  key={key}
                  className="rounded-xl p-4 flex flex-col gap-1"
                  style={{
                    background: `color-mix(in oklab, ${color} 8%, var(--surface-2))`,
                    border: `1px solid color-mix(in oklab, ${color} 22%, transparent)`,
                  }}
                >
                  <div
                    className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                    style={{ color }}
                  >
                    {key}
                  </div>
                  <div
                    className="font-display text-[1.4rem] font-bold leading-none tabular-nums"
                    style={{ color }}
                  >
                    {figure}
                  </div>
                  {desc && (
                    <div
                      className="text-[11px] leading-snug"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue Projections — year-by-year visual timeline */}
      {revenueRows.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Revenue Projections
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {revenueRows.map(({ year, val }, i) => {
              const arrMatch = val.match(/\$([\d.,]+[BMKT]*)\s*ARR/i);
              const arrFigure = arrMatch ? `$${arrMatch[1]} ARR` : "";
              const detail = arrFigure
                ? val.replace(arrMatch![0], "").replace(/^[\s–—-]+/, "")
                : val;
              const pct = Math.min(100, 20 + i * 35);
              return (
                <div key={year} className="px-4 py-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span
                      className="text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {year}
                    </span>
                    {arrFigure && (
                      <span
                        className="font-mono text-[13px] font-bold"
                        style={{ color: "var(--success)" }}
                      >
                        {arrFigure}
                      </span>
                    )}
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden mb-1.5"
                    style={{ background: "var(--surface-offset)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, var(--primary), var(--success))",
                        boxShadow: "0 0 6px var(--success)",
                      }}
                    />
                  </div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                    {detail || val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key risks */}
      {risks.length > 0 && (
        <Block title="Key risks" accent="destructive">
          <BulletList items={risks} accent="destructive" />
        </Block>
      )}

      {/* Full business plan — rendered markdown */}
      {fullReport && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Full Business Plan
          </div>
          <div className="px-4 py-4">
            <MarkdownReport content={fullReport} />
          </div>
        </div>
      )}
    </div>
  );
}

function InvestorEmailsOut({ o }: { o: Record<string, unknown> }) {
  const emails = arr(o.emails ?? o.sequence ?? o.outreach_emails);
  const strategy = str(o.strategy ?? o.approach);
  if (!emails.length) return <GenericOut o={o} />;
  return (
    <div className="space-y-3">
      {strategy && (
        <Block title="Outreach strategy" accent="primary">
          {strategy}
        </Block>
      )}
      {emails.map((e, i) => {
        const item =
          typeof e === "object" && e ? (e as Record<string, unknown>) : { body: String(e) };
        const subject = str(item.subject ?? item.title);
        const body = str(item.body ?? item.content ?? item.message);
        const timing = str(item.timing ?? item.send_at ?? item.when);
        const investor_type = str(item.investor_type ?? item.type);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                background: "color-mix(in oklab, var(--accent) 5%, transparent)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--primary))" }}
                >
                  {i + 1}
                </span>
                {subject && (
                  <span
                    className="text-[12.5px] font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {subject}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {investor_type && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {investor_type}
                  </span>
                )}
                {timing && (
                  <span className="text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
                    {timing}
                  </span>
                )}
              </div>
            </div>
            <div
              className="px-4 py-3 whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
            >
              {body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IdeaVsIdeaOut({ o }: { o: Record<string, unknown> }) {
  const winner = str(o.winner ?? o.recommended_idea);
  // Edge fn returns rationale as array — join if needed
  const rationaleRaw = o.winner_rationale ?? o.rationale ?? o.recommendation;
  const rationale = Array.isArray(rationaleRaw)
    ? (rationaleRaw as string[]).join("\n")
    : str(rationaleRaw);
  const comparison = arr(o.comparison ?? o.criteria);
  const ideaA = str(o.idea_a_summary ?? o.idea_a);
  const ideaB = str(o.idea_b_summary ?? o.idea_b);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {winner && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--success) 30%, transparent)",
            borderLeft: "3px solid var(--success)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
            style={{ color: "var(--success)" }}
          >
            Winner
          </div>
          <div
            className="font-display text-[1.2rem] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {winner}
          </div>
          {rationale && (
            <div
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {rationale}
            </div>
          )}
        </div>
      )}
      {comparison.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="grid grid-cols-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            <span>Criterion</span>
            <span className="text-center" style={{ color: "var(--primary)" }}>
              {ideaA ? "Idea A" : "Option A"}
            </span>
            <span className="text-center" style={{ color: "var(--accent)" }}>
              {ideaB ? "Idea B" : "Option B"}
            </span>
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {comparison.map((c, i) => {
              const item = typeof c === "object" && c ? (c as Record<string, unknown>) : {};
              const criterion = str(item.criterion ?? item.name ?? item.category);
              const a = str(item.idea_a ?? item.option_a ?? item.a);
              const b = str(item.idea_b ?? item.option_b ?? item.b);
              return (
                <div key={i} className="grid grid-cols-3 gap-2 px-4 py-3 text-[12.5px]">
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>
                    {criterion}
                  </div>
                  <div style={{ color: "var(--muted-foreground)" }}>{a}</div>
                  <div style={{ color: "var(--muted-foreground)" }}>{b}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {fullReport && !winner && (
        <Block title="Idea Comparison">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function LandingPageOut({ o }: { o: Record<string, unknown> }) {
  // Edge function returns hero as an object — extract fields from it
  const heroObj = (typeof o.hero === "object" && o.hero ? o.hero : {}) as Record<string, unknown>;
  const headline = str(o.headline ?? heroObj.headline);
  const subheadline = str(o.subheadline ?? o.sub_headline ?? heroObj.subheadline);
  const heroCopy = str(o.hero_copy ?? heroObj.copy ?? heroObj.body);
  const features = arr(o.features ?? o.value_props ?? o.sections);
  const socialProof = str(o.social_proof ?? o.testimonial_hooks);
  const cta = str(o.cta ?? o.call_to_action ?? heroObj.cta);
  const seoKeywords = arr(o.seo_keywords ?? o.keywords);
  const abVariants = arr(o.ab_variants ?? o.headline_variants);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {headline && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
            style={{ color: "var(--primary)" }}
          >
            Hero headline
          </div>
          <div
            className="font-display text-[1.4rem] font-bold leading-tight tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {headline}
          </div>
          {subheadline && (
            <div className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              {subheadline}
            </div>
          )}
        </div>
      )}
      {heroCopy && <Block title="Hero copy">{heroCopy}</Block>}
      {features.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Feature / value props
          </div>
          <div
            className="divide-y p-0"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {features.map((f, i) => {
              const item =
                typeof f === "object" && f ? (f as Record<string, unknown>) : { title: String(f) };
              const title = str(item.title ?? item.name);
              const desc = str(item.description ?? item.benefit);
              return (
                <div key={i} className="flex gap-3 px-4 py-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {title}
                    </div>
                    {desc && (
                      <div
                        className="mt-0.5 text-[12.5px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {desc}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {socialProof && (
          <Block title="Social proof hooks" accent="success">
            {socialProof}
          </Block>
        )}
        {cta && (
          <Block title="CTA" accent="accent">
            {cta}
          </Block>
        )}
      </div>
      {abVariants.length > 0 && (
        <Block title="A/B headline variants">
          <BulletList items={abVariants} accent="primary" />
        </Block>
      )}
      {seoKeywords.length > 0 && (
        <Block title="SEO keywords">
          <BulletList items={seoKeywords} />
        </Block>
      )}
      {fullReport && !headline && !heroCopy && (
        <Block title="Landing Page Copy">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function CompetitorOut({ o }: { o: Record<string, unknown> }) {
  const overview = str(o.market_overview ?? o.overview);
  const tier1 = arr(o.tier1);
  const tier2 = arr(o.tier2);
  const allCompetitors = arr(o.competitors).length > 0 ? arr(o.competitors) : [...tier1, ...tier2];
  const gaps = arr(o.gaps ?? o.market_gaps);
  const opportunity = str(o.positioning_opportunity ?? o.opportunity ?? o.winning_angle);
  const moat = str(o.your_moat ?? o.competitive_advantage ?? o.differentiation);
  const gtm = str(o.go_to_market ?? o.recommendation);
  const fullReport = str(o.full_report);
  const competitors = allCompetitors.map((c, idx) => {
    const item = typeof c === "object" && c ? (c as Record<string, unknown>) : { name: String(c) };
    return {
      name: str(item.name ?? item.company),
      positioning: str(item.positioning ?? item.description ?? item.tagline),
      strengths: arr(item.strengths),
      weaknesses: arr(item.weaknesses),
      price: str(item.price ?? item.pricing),
      icp: str(item.target ?? item.icp ?? item.ideal_customer),
      isTier1: idx < tier1.length && tier1.length > 0,
    };
  });
  return (
    <div className="space-y-3">
      {overview && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--primary) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
            borderTop: "3px solid var(--primary)",
          }}
        >
          <div
            className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            Market overview
          </div>
          <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            {overview}
          </div>
        </div>
      )}
      {competitors.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Competitor breakdown
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {competitors.map((comp, i) => {
              const tierColor = comp.isTier1 ? "var(--destructive)" : "var(--warning)";
              const tierLabel = comp.isTier1 ? "Tier 1" : "Tier 2";
              return (
                <div key={i} className="p-4">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
                      {comp.name}
                    </span>
                    {(tier1.length > 0 || tier2.length > 0) && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                        style={{
                          background: `color-mix(in oklab, ${tierColor} 12%, transparent)`,
                          color: tierColor,
                          border: `1px solid color-mix(in oklab, ${tierColor} 25%, transparent)`,
                        }}
                      >
                        {tierLabel}
                      </span>
                    )}
                    {comp.price && (
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {comp.price}
                      </span>
                    )}
                  </div>
                  {comp.positioning && (
                    <div
                      className="mb-2 text-[12px] italic"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      "{comp.positioning}"
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {comp.strengths.length > 0 && (
                      <div>
                        <div
                          className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: "var(--success)" }}
                        >
                          Strengths
                        </div>
                        <div className="space-y-1">
                          {comp.strengths.slice(0, 3).map((s, j) => (
                            <div
                              key={j}
                              className="flex gap-1.5 text-[11.5px]"
                              style={{ color: "var(--foreground)" }}
                            >
                              <span style={{ color: "var(--success)", flexShrink: 0 }}>+</span>
                              {typeof s === "string" ? s : JSON.stringify(s)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {comp.weaknesses.length > 0 && (
                      <div>
                        <div
                          className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: "var(--warning)" }}
                        >
                          Weaknesses
                        </div>
                        <div className="space-y-1">
                          {comp.weaknesses.slice(0, 3).map((w, j) => (
                            <div
                              key={j}
                              className="flex gap-1.5 text-[11.5px]"
                              style={{ color: "var(--foreground)" }}
                            >
                              <span style={{ color: "var(--warning)", flexShrink: 0 }}>−</span>
                              {typeof w === "string" ? w : JSON.stringify(w)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {comp.icp && (
                    <div className="mt-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      <span className="font-semibold">Targets:</span> {comp.icp}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {moat && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--success) 22%, transparent)",
            borderLeft: "3px solid var(--success)",
          }}
        >
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--success)" }}
          >
            Your competitive moat
          </div>
          <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            {moat}
          </div>
        </div>
      )}
      {gaps.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--accent) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--accent) 20%, transparent)",
            borderTop: "3px solid var(--accent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Market gaps you can own
          </div>
          <div className="space-y-1.5 px-4 pb-4">
            {gaps.map((g, i) => (
              <div
                key={i}
                className="flex gap-2 text-[12.5px]"
                style={{ color: "var(--foreground)" }}
              >
                <span style={{ color: "var(--accent)", flexShrink: 0 }}>◆</span>
                {typeof g === "string" ? g : JSON.stringify(g)}
              </div>
            ))}
          </div>
        </div>
      )}
      {opportunity && (
        <Block title="Positioning opportunity" accent="success">
          {opportunity}
        </Block>
      )}
      {gtm && (
        <Block title="GTM recommendation" accent="primary">
          {gtm}
        </Block>
      )}
      {fullReport && competitors.length === 0 && !opportunity && (
        <Block title="Competitive Analysis">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function PricingOut({ o }: { o: Record<string, unknown> }) {
  const model = str(o.recommended_model ?? o.pricing_model ?? o.model ?? o.recommended_strategy);
  const rationale = str(o.rationale ?? o.positioning_rationale);
  const recommendedPrice = o.recommended_price != null ? `$${String(o.recommended_price)}` : "";
  const tiers = arr(o.pricing_tiers ?? o.tiers ?? o.plans);
  const comparison = str(o.competitor_comparison ?? o.market_context);
  const justification = arr(o.price_justification ?? o.justification ?? o.value_bullets);
  const revenueObj = o.revenue_projections;
  const revenue = Array.isArray(revenueObj)
    ? (revenueObj as unknown[])
    : revenueObj && typeof revenueObj === "object"
      ? Object.entries(revenueObj as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`)
      : [];
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {model && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--accent) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--accent) 25%, transparent)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Recommended model
          </div>
          <div
            className="font-display text-[1.2rem] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {model}
          </div>
          {rationale && (
            <div
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {rationale}
            </div>
          )}
        </div>
      )}
      {tiers.length > 0 && (
        <div className={`grid gap-3 ${tiers.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {tiers.map((t, i) => {
            const item =
              typeof t === "object" && t ? (t as Record<string, unknown>) : { name: String(t) };
            const name = str(item.name ?? item.tier ?? item.plan);
            const price = str(item.price ?? item.pricing);
            const features = arr(item.features ?? item.includes);
            const highlight = !!(
              item.recommended ??
              item.highlighted ??
              (tiers.length === 3 && i === 1)
            );
            const tierColor = highlight
              ? "var(--primary)"
              : i === 0
                ? "var(--muted-foreground)"
                : "var(--accent)";
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl"
                style={{
                  background: highlight
                    ? "color-mix(in oklab, var(--primary) 8%, var(--surface-2))"
                    : "var(--surface-2)",
                  border: highlight
                    ? "2px solid color-mix(in oklab, var(--primary) 40%, transparent)"
                    : "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
                  boxShadow: highlight
                    ? "0 0 24px color-mix(in oklab, var(--primary) 12%, transparent)"
                    : "none",
                }}
              >
                {highlight && (
                  <div
                    className="py-1.5 text-center text-[9.5px] font-bold uppercase tracking-[0.14em] text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    Most Popular
                  </div>
                )}
                <div className="p-5">
                  <div
                    className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: tierColor }}
                  >
                    {name}
                  </div>
                  {price && (
                    <div
                      className="mb-4 font-display font-bold tabular-nums"
                      style={{
                        color: highlight ? "var(--primary)" : "var(--foreground)",
                        fontSize: "1.75rem",
                        lineHeight: 1.1,
                      }}
                    >
                      {price}
                    </div>
                  )}
                  {features.length > 0 && (
                    <div className="space-y-1.5">
                      {features.map((f, j) => (
                        <div
                          key={j}
                          className="flex gap-2 text-[12px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          <span
                            style={{
                              color: highlight ? "var(--primary)" : "var(--success)",
                              flexShrink: 0,
                            }}
                          >
                            ✓
                          </span>
                          {typeof f === "string" ? f : JSON.stringify(f)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {recommendedPrice && !model && tiers.length === 0 && (
        <div
          className="rounded-xl p-5 text-center"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface-2))",
            border: "2px solid color-mix(in oklab, var(--success) 30%, transparent)",
          }}
        >
          <div
            className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--success)" }}
          >
            Recommended Price
          </div>
          <div
            className="font-display text-[2.5rem] font-bold tabular-nums"
            style={{ color: "var(--success)" }}
          >
            {recommendedPrice}
          </div>
        </div>
      )}
      {justification.length > 0 && (
        <Block title="Why this price is justified" accent="success">
          <BulletList items={justification} accent="success" />
        </Block>
      )}
      {comparison && <Block title="Market context">{comparison}</Block>}
      {revenue.length > 0 && (
        <Block title="Revenue projections" accent="success">
          <BulletList items={revenue} accent="success" />
        </Block>
      )}
      {fullReport && !model && tiers.length === 0 && (
        <Block title="Pricing Strategy">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function RevenueOut({ o }: { o: Record<string, unknown> }) {
  const assumptions = arr(o.assumptions);
  const projections = arr(o.projections ?? o.monthly_projections ?? o.yearly_projections);
  const baseScenario = o.base_scenario as Record<string, unknown> | undefined;
  const conservativeScenario = o.conservative_scenario as Record<string, unknown> | undefined;
  const optimisticScenario = o.optimistic_scenario as Record<string, unknown> | undefined;
  const growthLevers = arr(o.growth_levers);
  const breakeven = str(o.breakeven_analysis);
  const verdict = str(o.unit_economics_verdict);
  const totalArr = str(o.total_arr ?? o.projected_arr ?? o.arr);
  const milestones = arr(o.milestones);
  const risks = arr(o.risks ?? o.key_risks);
  const fullReport = str(o.full_report);

  function scenarioRows(
    sc: Record<string, unknown> | undefined,
  ): Array<{ label: string; val: string }> {
    if (!sc) return [];
    return Object.entries(sc).map(([k, v]) => ({ label: k.replace(/_/g, " "), val: String(v) }));
  }
  const scenarios = [
    { label: "Conservative", data: conservativeScenario, color: "var(--warning)" },
    { label: "Base", data: baseScenario, color: "var(--primary)" },
    { label: "Optimistic", data: optimisticScenario, color: "var(--success)" },
  ].filter((s) => s.data);

  function extractRevNum(v: string): number {
    const m = v.match(/([\d,]+(?:\.\d+)?)\s*([KMBkm]?)/);
    if (!m) return 0;
    const n = parseFloat(m[1].replace(/,/g, ""));
    const mult =
      ({ k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9 } as Record<string, number>)[m[2]] ?? 1;
    return n * mult;
  }
  const projNums = projections.map((p) => {
    const item =
      typeof p === "object" && p ? (p as Record<string, unknown>) : { period: String(p) };
    return extractRevNum(str(item.revenue ?? item.mrr ?? item.arr));
  });
  const maxRevNum = Math.max(...projNums, 1);

  return (
    <div className="space-y-3">
      {totalArr && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--success) 30%, transparent)",
            borderLeft: "3px solid var(--success)",
          }}
        >
          <div
            className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--success)" }}
          >
            Projected ARR
          </div>
          <div
            className="font-display text-[2rem] font-bold tabular-nums"
            style={{ color: "var(--success)" }}
          >
            {totalArr}
          </div>
        </div>
      )}
      {scenarios.length > 0 && (
        <div
          className={`grid gap-3 ${scenarios.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {scenarios.map((s) => {
            const rows = scenarioRows(s.data);
            const keyRow = rows.find(
              (r) =>
                r.label.toLowerCase().includes("mrr") ||
                r.label.toLowerCase().includes("arr") ||
                r.label.toLowerCase().includes("revenue"),
            );
            return (
              <div
                key={s.label}
                className="overflow-hidden rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${s.color} 6%, var(--surface-2))`,
                  border: `1px solid color-mix(in oklab, ${s.color} 22%, transparent)`,
                  borderTop: `3px solid ${s.color}`,
                }}
              >
                <div className="p-4">
                  <div
                    className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: s.color }}
                  >
                    {s.label}
                  </div>
                  {keyRow && (
                    <div
                      className="mb-2 font-mono text-[1.2rem] font-bold tabular-nums"
                      style={{ color: s.color }}
                    >
                      {keyRow.val}
                    </div>
                  )}
                  <div className="space-y-1">
                    {rows
                      .filter((r) => r !== keyRow)
                      .slice(0, 3)
                      .map((r, i) => (
                        <div key={i} className="flex justify-between gap-2 text-[11px]">
                          <span className="capitalize" style={{ color: "var(--muted-foreground)" }}>
                            {r.label}
                          </span>
                          <span
                            className="font-medium tabular-nums"
                            style={{ color: "var(--foreground)" }}
                          >
                            {r.val}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {projections.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Revenue projections
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {projections.map((p, i) => {
              const item =
                typeof p === "object" && p ? (p as Record<string, unknown>) : { period: String(p) };
              const period = str(
                item.period ?? item.month ?? item.year ?? item.quarter ?? `Month ${i + 1}`,
              );
              const revenue = str(item.revenue ?? item.mrr ?? item.arr);
              const users = str(item.users ?? item.customers);
              const note = str(item.note ?? item.notes);
              const barPct =
                maxRevNum > 0
                  ? Math.round((projNums[i] / maxRevNum) * 100)
                  : Math.min(100, 15 + i * 12);
              return (
                <div key={i} className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {period}
                    </span>
                    <div className="flex items-center gap-3">
                      {users && (
                        <span
                          className="text-[10.5px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {users} users
                        </span>
                      )}
                      {revenue && (
                        <span
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: "var(--success)" }}
                        >
                          {revenue}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-offset, rgba(0,0,0,0.06))" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${barPct}%`,
                        background: "linear-gradient(90deg, var(--primary), var(--success))",
                        boxShadow: "0 0 5px var(--success)",
                      }}
                    />
                  </div>
                  {note && (
                    <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {assumptions.length > 0 && (
        <Block title="Key assumptions">
          <BulletList items={assumptions} />
        </Block>
      )}
      {verdict && (
        <Block title="Unit economics verdict" accent="accent">
          {verdict}
        </Block>
      )}
      {breakeven && <Block title="Breakeven analysis">{breakeven}</Block>}
      {milestones.length > 0 && (
        <Block title="Key milestones" accent="primary">
          <BulletList items={milestones} accent="primary" />
        </Block>
      )}
      {risks.length > 0 && (
        <Block title="Revenue risks" accent="warning">
          <BulletList items={risks} accent="warning" />
        </Block>
      )}
      {growthLevers.length > 0 && (
        <Block title="Growth levers" accent="primary">
          <BulletList items={growthLevers} accent="primary" />
        </Block>
      )}
      {fullReport && !totalArr && projections.length === 0 && !baseScenario && (
        <Block title="Revenue Projection">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function BlogOut({ o }: { o: Record<string, unknown> }) {
  const title = str(o.title);
  const metaDesc = str(o.meta_description);
  const body = str(o.body_markdown ?? o.body);
  const tags = arr(o.suggested_tags ?? o.tags);
  const readability = num(o.readability_score, 0);
  return (
    <div className="space-y-3">
      {title && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
            style={{ color: "var(--primary)" }}
          >
            Title
          </div>
          <div
            className="font-display text-[1.25rem] font-semibold leading-tight tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </div>
          {metaDesc && (
            <div
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {metaDesc}
            </div>
          )}
        </div>
      )}
      {readability > 0 && <ScoreGauge value={readability} label="Readability score" />}
      {body && (
        <Block title="Article">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{body}</div>
        </Block>
      )}
      {tags.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Suggested tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span
                key={i}
                className="rounded-full px-2.5 py-0.5 text-[11.5px]"
                style={{
                  background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {typeof t === "string" ? t : JSON.stringify(t)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialOut({ o }: { o: Record<string, unknown> }) {
  const platform = str(o.platform);
  const posts = arr(o.posts);
  return (
    <div className="space-y-3">
      {platform && (
        <div
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{
            background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            color: "var(--primary)",
          }}
        >
          {platform}
        </div>
      )}
      {posts.map((p, i) => {
        const post = typeof p === "object" && p ? (p as Record<string, unknown>) : {};
        const hook = str(post.hook);
        const body = str(post.body ?? post.copy ?? post.content);
        const cta = str(post.cta);
        const hashtags = arr(post.hashtags ?? post.tags);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                color: "var(--muted-foreground)",
              }}
            >
              Post {i + 1}
            </div>
            <div className="space-y-2 p-4">
              {hook && (
                <div
                  className="text-[13.5px] font-semibold leading-relaxed"
                  style={{ color: "var(--foreground)" }}
                >
                  {hook}
                </div>
              )}
              {body && (
                <div
                  className="whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
                >
                  {body}
                </div>
              )}
              {cta && (
                <div className="text-[12.5px] font-medium" style={{ color: "var(--primary)" }}>
                  {cta}
                </div>
              )}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {hashtags.map((h, j) => (
                    <span
                      key={j}
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: "color-mix(in oklab, var(--primary) 8%, transparent)",
                        color: "var(--primary)",
                      }}
                    >
                      {typeof h === "string" ? h : String(h)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmailSequenceOut({ o }: { o: Record<string, unknown> }) {
  const name = str(o.sequence_name ?? o.name);
  const emails = arr(o.emails);
  return (
    <div className="space-y-3">
      {name && (
        <Block title="Sequence name" accent="primary">
          {name}
        </Block>
      )}
      {emails.map((e, i) => {
        const email = typeof e === "object" && e ? (e as Record<string, unknown>) : {};
        const subject = str(email.subject);
        const preview = str(email.preview_text);
        const body = str(email.body ?? email.content);
        const cta = str(email.cta);
        const day = email.send_day != null ? str(email.send_day) : String(i + 1);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Email {i + 1}
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                  color: "var(--primary)",
                }}
              >
                Day {day}
              </span>
            </div>
            <div className="space-y-2 p-4">
              {subject && (
                <div className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {subject}
                </div>
              )}
              {preview && (
                <div className="text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>
                  {preview}
                </div>
              )}
              {body && (
                <div
                  className="whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
                >
                  {body}
                </div>
              )}
              {cta && (
                <div className="text-[12.5px] font-medium" style={{ color: "var(--primary)" }}>
                  CTA: {cta}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SalesScriptOut({ o }: { o: Record<string, unknown> }) {
  const scriptType = str(o.script_type);
  const opener = str(o.opener);
  const questions = arr(o.discovery_questions);
  const pitch = str(o.pitch_section);
  const objections = arr(o.objection_handlers);
  const close = str(o.close);
  const followUp = str(o.follow_up);
  return (
    <div className="space-y-3">
      {scriptType && (
        <div
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{
            background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            color: "var(--primary)",
          }}
        >
          {scriptType}
        </div>
      )}
      {opener && (
        <Block title="Opener" accent="primary">
          {opener}
        </Block>
      )}
      {questions.length > 0 && (
        <Block title="Discovery questions">
          <BulletList items={questions} accent="primary" />
        </Block>
      )}
      {pitch && <Block title="Pitch section">{pitch}</Block>}
      {objections.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Objection handlers
          </div>
          <div
            className="divide-y p-1"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {objections.map((obj, i) => {
              const item = typeof obj === "object" && obj ? (obj as Record<string, unknown>) : {};
              return (
                <div key={i} className="px-3 py-2.5">
                  <div className="text-[12px] font-semibold" style={{ color: "var(--warning)" }}>
                    {str(item.objection)}
                  </div>
                  <div
                    className="mt-1 text-[13px] leading-relaxed"
                    style={{ color: "var(--foreground)" }}
                  >
                    {str(item.response)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {close && (
        <Block title="Close" accent="success">
          {close}
        </Block>
      )}
      {followUp && <Block title="Follow-up">{followUp}</Block>}
    </div>
  );
}

function AdCreativeOut({ o }: { o: Record<string, unknown> }) {
  const platform = str(o.platform);
  const variants = arr(o.variants);
  const targeting = str(o.targeting_notes);
  return (
    <div className="space-y-3">
      {platform && (
        <div
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{
            background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            color: "var(--primary)",
          }}
        >
          {platform}
        </div>
      )}
      {variants.map((v, i) => {
        const variant = typeof v === "object" && v ? (v as Record<string, unknown>) : {};
        const headline = str(variant.headline);
        const primaryText = str(variant.primary_text ?? variant.body);
        const description = str(variant.description);
        const cta = str(variant.cta);
        const angle = str(variant.angle);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Variant {i + 1}
              </div>
              {angle && (
                <span className="text-[11px] italic" style={{ color: "var(--muted-foreground)" }}>
                  {angle}
                </span>
              )}
            </div>
            <div className="space-y-2 p-4">
              {headline && (
                <div
                  className="text-[14px] font-bold leading-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {headline}
                </div>
              )}
              {primaryText && (
                <div
                  className="whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}
                >
                  {primaryText}
                </div>
              )}
              {description && (
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {description}
                </div>
              )}
              {cta && (
                <div
                  className="inline-flex items-center rounded-lg px-3 py-1 text-[12px] font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {cta}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {targeting && <Block title="Targeting notes">{targeting}</Block>}
    </div>
  );
}

function VslOut({ o }: { o: Record<string, unknown> }) {
  const hook = str(o.hook);
  const problem = str(o.problem_agitation);
  const solution = str(o.solution_reveal);
  const proof = str(o.proof_section);
  const offerStack = str(o.offer_stack);
  const guarantee = str(o.guarantee);
  const close = str(o.close_and_cta);
  const fullScript = str(o.full_script);
  const minutes = o.estimated_minutes ? num(o.estimated_minutes, 0) : 0;
  type VslSection = {
    title: string;
    content: string;
    accent?: "primary" | "warning" | "success" | "destructive" | "accent";
  };
  const sections: VslSection[] = (
    [
      { title: "Hook", content: hook, accent: "primary" },
      { title: "Problem agitation", content: problem, accent: "warning" },
      { title: "Solution reveal", content: solution, accent: "success" },
      { title: "Proof section", content: proof },
      { title: "Offer stack", content: offerStack, accent: "accent" },
      { title: "Guarantee", content: guarantee },
      { title: "Close & CTA", content: close, accent: "primary" },
    ] as VslSection[]
  ).filter((s) => s.content);
  return (
    <div className="space-y-3">
      {minutes > 0 && (
        <div
          className="rounded-xl p-3 text-center text-[13px] font-medium"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
            color: "var(--muted-foreground)",
          }}
        >
          Estimated length:{" "}
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{minutes} minutes</span>
        </div>
      )}
      {sections.map((s) => (
        <Block key={s.title} title={s.title} accent={s.accent}>
          <div className="whitespace-pre-wrap">{s.content}</div>
        </Block>
      ))}
      {fullScript && (
        <Block title="Full script">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{fullScript}</div>
        </Block>
      )}
    </div>
  );
}

function ColdEmailOut({ o }: { o: Record<string, unknown> }) {
  const subjects = arr(o.subject_lines);
  const emails = arr(o.emails);
  const followUp = str(o.follow_up_template);
  return (
    <div className="space-y-3">
      {subjects.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Subject line variants — A/B test these
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {subjects.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                  {typeof s === "string" ? s : JSON.stringify(s)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {emails.map((e, i) => {
        const email = typeof e === "object" && e ? (e as Record<string, unknown>) : {};
        const angle = str(email.angle ?? email.variant_name);
        const subject = str(email.subject);
        const body = str(email.body ?? email.content);
        const ps = str(email.ps_line ?? email.ps);
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
              boxShadow: "0 2px 8px color-mix(in oklab, var(--border) 40%, transparent)",
            }}
          >
            <div
              className="px-4 py-2.5"
              style={{
                background: "color-mix(in oklab, var(--primary) 4%, var(--surface-2))",
                borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
                >
                  {i + 1}
                </div>
                {angle && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                      color: "var(--primary)",
                      border: "1px solid color-mix(in oklab, var(--primary) 22%, transparent)",
                    }}
                  >
                    {angle}
                  </span>
                )}
              </div>
              {subject && (
                <div className="mt-2 space-y-0.5">
                  <div className="flex items-baseline gap-2 text-[11.5px]">
                    <span
                      className="w-14 shrink-0 font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Subject:
                    </span>
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {subject}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span
                      className="w-14 shrink-0 font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      To:
                    </span>
                    <span style={{ color: "var(--muted-foreground)" }}>
                      [First Name] &lt;prospect@company.com&gt;
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-4">
              {body && (
                <div
                  className="whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--foreground) 88%, transparent)" }}
                >
                  {body}
                </div>
              )}
              {ps && (
                <div
                  className="mt-3 border-t pt-3 text-[12px] italic"
                  style={{
                    color: "var(--muted-foreground)",
                    borderColor: "color-mix(in oklab, var(--border) 40%, transparent)",
                  }}
                >
                  P.S. {ps}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {followUp && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Follow-up (send day 3–5 if no reply)
          </div>
          <div
            className="px-4 py-3 whitespace-pre-wrap text-[13px] leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            {followUp}
          </div>
        </div>
      )}
    </div>
  );
}

function NicheValidatorOut({ o }: { o: Record<string, unknown> }) {
  const verdict = str(o.verdict);
  const demandScore = num(o.demand_score ?? o.demand, 0);
  const competitionScore = num(o.competition_score ?? o.competition, 0);
  const monetisationScore = num(o.monetisation_score ?? o.monetisation, 0);
  const overallScore = num(o.overall_score ?? o.score, 0);
  const strengths = arr(o.strengths);
  const risks = arr(o.risks);
  const subNiches = arr(o.sub_niches);
  const entry = str(o.recommended_entry);
  const verdictColor =
    verdict === "strong"
      ? "var(--success)"
      : verdict === "viable"
        ? "var(--primary)"
        : verdict === "risky"
          ? "var(--warning)"
          : "var(--destructive)";
  return (
    <div className="space-y-3">
      {(overallScore > 0 || verdict) && (
        <ScoreGauge
          value={overallScore}
          label={verdict ? `Verdict: ${verdict.toUpperCase()}` : "Overall score"}
        />
      )}
      {(demandScore > 0 || competitionScore > 0 || monetisationScore > 0) && (
        <div
          className="grid grid-cols-3 gap-2 rounded-xl p-3"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          {[
            { label: "Demand", val: demandScore },
            { label: "Competition", val: competitionScore },
            { label: "Monetisation", val: monetisationScore },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="font-display text-[1.4rem] font-semibold tabular-nums"
                style={{ color: verdictColor }}
              >
                {s.val}
              </div>
              <div
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
      {strengths.length > 0 && (
        <Block title="Strengths" accent="success">
          <BulletList items={strengths} accent="success" />
        </Block>
      )}
      {risks.length > 0 && (
        <Block title="Risks" accent="warning">
          <BulletList items={risks} accent="warning" />
        </Block>
      )}
      {subNiches.length > 0 && (
        <Block title="Sub-niches to explore" accent="primary">
          <BulletList items={subNiches} accent="primary" />
        </Block>
      )}
      {entry && <Block title="Recommended entry">{entry}</Block>}
    </div>
  );
}

function IcpOut({ o }: { o: Record<string, unknown> }) {
  const primary = str(o.primary_icp);
  const demographics =
    typeof o.demographics === "object" && o.demographics
      ? (o.demographics as Record<string, unknown>)
      : null;
  const psychographics =
    typeof o.psychographics === "object" && o.psychographics
      ? (o.psychographics as Record<string, unknown>)
      : null;
  const painPoints = arr(o.pain_points);
  const goals = arr(o.goals);
  const triggers = arr(o.buying_triggers);
  const objections = arr(o.objections);
  const whereToFind = arr(o.where_to_find_them);
  const message = str(o.message_that_resonates);
  const initials =
    primary
      .split(" ")
      .filter((w) => /^[A-Z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "IC";
  return (
    <div className="space-y-3">
      {primary && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--primary) 5%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 22%, transparent)",
          }}
        >
          <div className="flex items-center gap-4 p-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[1.1rem] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
                boxShadow: "0 4px 12px color-mix(in oklab, var(--primary) 30%, transparent)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--primary)" }}
              >
                Ideal Customer Profile
              </div>
              <div
                className="text-[14px] font-semibold leading-snug"
                style={{ color: "var(--foreground)" }}
              >
                {primary}
              </div>
            </div>
          </div>
        </div>
      )}
      {(demographics || psychographics) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {demographics && (
            <div
              className="overflow-hidden rounded-xl"
              style={{
                background: "var(--surface-2)",
                border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
              }}
            >
              <div
                className="px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{
                  borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                  color: "var(--muted-foreground)",
                }}
              >
                Demographics
              </div>
              <div className="space-y-2 p-4">
                {Object.entries(demographics).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span
                      className="w-24 shrink-0 text-[10.5px] font-medium capitalize"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {k.replace(/_/g, " ")}
                    </span>
                    <span className="text-[12.5px]" style={{ color: "var(--foreground)" }}>
                      {str(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {psychographics && (
            <div
              className="overflow-hidden rounded-xl"
              style={{
                background: "var(--surface-2)",
                border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
              }}
            >
              <div
                className="px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{
                  borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                  color: "var(--muted-foreground)",
                }}
              >
                Psychographics
              </div>
              <div className="space-y-2 p-4">
                {Object.entries(psychographics).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span
                      className="w-24 shrink-0 text-[10.5px] font-medium capitalize"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {k.replace(/_/g, " ")}
                    </span>
                    <span className="text-[12.5px]" style={{ color: "var(--foreground)" }}>
                      {str(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {(painPoints.length > 0 || goals.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {painPoints.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--destructive) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--destructive) 20%, transparent)",
                borderTop: "3px solid var(--destructive)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--destructive)" }}
              >
                Pain points
              </div>
              {painPoints.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--destructive)", flexShrink: 0 }}>✕</span>
                  {typeof p === "string" ? p : JSON.stringify(p)}
                </div>
              ))}
            </div>
          )}
          {goals.length > 0 && (
            <div
              className="space-y-1.5 rounded-xl p-3"
              style={{
                background: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--success) 20%, transparent)",
                borderTop: "3px solid var(--success)",
              }}
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--success)" }}
              >
                Goals
              </div>
              {goals.map((g, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 text-[11.5px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>
                  {typeof g === "string" ? g : JSON.stringify(g)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {triggers.length > 0 && (
        <Block title="Buying triggers" accent="primary">
          <BulletList items={triggers} accent="primary" />
        </Block>
      )}
      {objections.length > 0 && (
        <Block title="Objections to handle" accent="warning">
          <BulletList items={objections} accent="warning" />
        </Block>
      )}
      {whereToFind.length > 0 && (
        <Block title="Where to find them">
          <BulletList items={whereToFind} accent="primary" />
        </Block>
      )}
      {message && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--accent) 6%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--accent) 22%, transparent)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Message that resonates
          </div>
          <div
            className="text-[13.5px] leading-relaxed italic"
            style={{ color: "var(--foreground)" }}
          >
            "{message}"
          </div>
        </div>
      )}
    </div>
  );
}

function PitchDeckOut({ o }: { o: Record<string, unknown> }) {
  const slides = arr(o.slides);
  const elevatorPitch = str(o.elevator_pitch);
  const oneLiner = str(o.one_line_summary ?? o.one_liner);
  const slideColors = [
    "var(--primary)",
    "var(--accent)",
    "var(--success)",
    "color-mix(in oklab, var(--primary) 60%, var(--accent))",
    "var(--primary)",
    "var(--accent)",
    "var(--success)",
    "color-mix(in oklab, var(--accent) 70%, var(--success))",
    "var(--primary)",
    "var(--accent)",
  ];
  return (
    <div className="space-y-3">
      {oneLiner && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            One-liner
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            {oneLiner}
          </div>
        </div>
      )}
      {elevatorPitch && <Block title="Elevator pitch">{elevatorPitch}</Block>}
      {slides.length > 0 && (
        <div className="space-y-2">
          {slides.map((s, i) => {
            const slide = typeof s === "object" && s ? (s as Record<string, unknown>) : {};
            const title = str(slide.title);
            const points = arr(slide.key_points);
            const content = str(slide.content ?? slide.description ?? slide.body);
            const notes = str(slide.speaker_notes);
            const slideNum =
              slide.slide_number != null ? String(slide.slide_number) : String(i + 1);
            const col = slideColors[i % slideColors.length];
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
                  borderLeft: `3px solid ${col}`,
                }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: col }}
                  >
                    {slideNum}
                  </span>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {title}
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  {content && !points.length && (
                    <div
                      className="text-[13px] leading-relaxed"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {content}
                    </div>
                  )}
                  {points.length > 0 && (
                    <div className="space-y-1.5">
                      {points.map((pt, j) => (
                        <div
                          key={j}
                          className="flex gap-2 text-[12.5px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          <span style={{ color: col, flexShrink: 0 }}>→</span>
                          {typeof pt === "string" ? pt : JSON.stringify(pt)}
                        </div>
                      ))}
                    </div>
                  )}
                  {notes && (
                    <div
                      className="rounded-lg px-3 py-2 text-[11px] italic"
                      style={{
                        background: "color-mix(in oklab, var(--border) 30%, transparent)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      📣 {notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadMagnetOut({ o }: { o: Record<string, unknown> }) {
  const title = str(o.title);
  const subtitle = str(o.subtitle);
  const format = str(o.format);
  const sections = arr(o.sections);
  const optInHeadline = str(o.opt_in_headline);
  const optInSubtext = str(o.opt_in_subtext);
  const deliverySequence = arr(o.delivery_sequence);
  return (
    <div className="space-y-3">
      {(title || subtitle) && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          {format && (
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: "var(--primary)" }}
            >
              {format}
            </div>
          )}
          {title && (
            <div
              className="text-[15px] font-bold leading-snug"
              style={{ color: "var(--foreground)" }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
      {sections.map((s, i) => {
        const sec = typeof s === "object" && s ? (s as Record<string, unknown>) : {};
        const heading = str(sec.heading);
        const content = str(sec.content);
        return (
          <Block key={i} title={heading || `Section ${i + 1}`}>
            <div className="whitespace-pre-wrap">{content}</div>
          </Block>
        );
      })}
      {(optInHeadline || optInSubtext) && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--success) 6%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--success) 22%, transparent)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
            style={{ color: "var(--success)" }}
          >
            Opt-in copy
          </div>
          {optInHeadline && (
            <div className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
              {optInHeadline}
            </div>
          )}
          {optInSubtext && (
            <div className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              {optInSubtext}
            </div>
          )}
        </div>
      )}
      {deliverySequence.length > 0 && (
        <Block title="Delivery sequence" accent="primary">
          <BulletList items={deliverySequence} accent="primary" />
        </Block>
      )}
    </div>
  );
}

function AutomationOut({ o }: { o: Record<string, unknown> }) {
  const name = str(o.workflow_name ?? o.name);
  const trigger = str(o.trigger);
  const steps = arr(o.steps);
  const integrations = arr(o.integrations_needed ?? o.integrations);
  const timeSaved = str(o.time_saved_per_week);
  const effort = str(o.implementation_effort);
  const effortColor =
    effort === "low"
      ? "var(--success)"
      : effort === "medium"
        ? "var(--warning)"
        : "var(--destructive)";
  return (
    <div className="space-y-3">
      {name && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1"
            style={{ color: "var(--primary)" }}
          >
            Workflow
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            {name}
          </div>
        </div>
      )}
      {(timeSaved || effort) && (
        <div className="grid grid-cols-2 gap-2">
          {timeSaved && (
            <div
              className="rounded-xl p-3 text-center"
              style={{
                background: "var(--surface-2)",
                border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
              }}
            >
              <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Time saved/week
              </div>
              <div className="text-[14px] font-bold" style={{ color: "var(--success)" }}>
                {timeSaved}
              </div>
            </div>
          )}
          {effort && (
            <div
              className="rounded-xl p-3 text-center"
              style={{
                background: "var(--surface-2)",
                border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
              }}
            >
              <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Effort
              </div>
              <div className="text-[14px] font-bold capitalize" style={{ color: effortColor }}>
                {effort}
              </div>
            </div>
          )}
        </div>
      )}
      {trigger && <Block title="Trigger">{trigger}</Block>}
      {steps.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Steps
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {steps.map((s, i) => {
              const step = typeof s === "object" && s ? (s as Record<string, unknown>) : {};
              const action = str(step.action ?? step.step ?? s);
              const tool2 = str(step.tool);
              const notes = str(step.notes);
              return (
                <div key={i} className="flex gap-3 px-4 py-2.5">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px]" style={{ color: "var(--foreground)" }}>
                      {action}
                    </div>
                    {tool2 && (
                      <div className="text-[11px] font-medium" style={{ color: "var(--primary)" }}>
                        {tool2}
                      </div>
                    )}
                    {notes && (
                      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {integrations.length > 0 && (
        <Block title="Integrations needed">
          <div className="flex flex-wrap gap-1.5">
            {integrations.map((int, i) => (
              <span
                key={i}
                className="rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                style={{
                  background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {typeof int === "string" ? int : str(int)}
              </span>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

function ClientReportOut({ o }: { o: Record<string, unknown> }) {
  const title = str(o.report_title ?? o.title);
  const period = str(o.period);
  const summary = str(o.executive_summary ?? o.summary);
  const metrics = arr(o.key_metrics ?? o.metrics);
  const wins = arr(o.wins);
  const improvements = arr(o.improvements);
  const nextSteps = arr(o.next_steps);
  return (
    <div className="space-y-3">
      {(title || period) && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          {period && (
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1"
              style={{ color: "var(--primary)" }}
            >
              {period}
            </div>
          )}
          {title && (
            <div className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
              {title}
            </div>
          )}
        </div>
      )}
      {summary && <Block title="Executive summary">{summary}</Block>}
      {metrics.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Key metrics
          </div>
          <div
            className="divide-y p-1"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {metrics.map((m, i) => {
              const metric = typeof m === "object" && m ? (m as Record<string, unknown>) : {};
              const name = str(metric.name ?? metric.metric ?? m);
              const value = str(metric.value ?? metric.result);
              const change = str(metric.change ?? metric.delta);
              return (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[13px]" style={{ color: "var(--foreground)" }}>
                    {name}
                  </span>
                  <div className="flex items-center gap-2">
                    {value && (
                      <span
                        className="font-mono text-[13px] font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {value}
                      </span>
                    )}
                    {change && (
                      <span
                        className="text-[11px]"
                        style={{
                          color: change.startsWith("-") ? "var(--destructive)" : "var(--success)",
                        }}
                      >
                        {change}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {wins.length > 0 && (
        <Block title="Wins this period" accent="success">
          <BulletList items={wins} accent="success" />
        </Block>
      )}
      {improvements.length > 0 && (
        <Block title="Areas for improvement" accent="warning">
          <BulletList items={improvements} accent="warning" />
        </Block>
      )}
      {nextSteps.length > 0 && (
        <Block title="Next steps" accent="primary">
          <BulletList items={nextSteps} accent="primary" />
        </Block>
      )}
    </div>
  );
}

function NicheScorerOut({ o }: { o: Record<string, unknown> }) {
  const score = num(o.score ?? o.overall_score, 0);
  const dimensions = arr(o.dimension_breakdown ?? o.dimensions ?? o.breakdown);
  const confidence = str(o.confidence);
  const recommendation = str(o.recommendation);
  const fullReport = str(o.full_report);
  const confidenceColor = confidence.toLowerCase().startsWith("high")
    ? "var(--success)"
    : confidence.toLowerCase().startsWith("med")
      ? "var(--primary)"
      : confidence.toLowerCase().startsWith("low")
        ? "var(--warning)"
        : "var(--muted-foreground)";
  return (
    <div className="space-y-3">
      <ScoreGauge value={score} label="Niche opportunity score" />
      {dimensions.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Dimension breakdown
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {dimensions.map((d, i) => {
              const item =
                typeof d === "object" && d
                  ? (d as Record<string, unknown>)
                  : { dimension: String(d) };
              const label = str(item.dimension ?? item.name ?? item.category ?? item.criterion);
              const sc = num(item.score, 0);
              const note = str(item.notes ?? item.rationale ?? item.note ?? item.detail);
              const pct = Math.min(100, (sc / 25) * 100);
              const color =
                pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--primary)" : "var(--warning)";
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[12.5px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {label}
                    </span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color }}>
                      {sc}/25
                    </span>
                  </div>
                  <div
                    className="h-1 overflow-hidden rounded-full mb-1.5"
                    style={{ background: "var(--surface-offset)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                  </div>
                  {note && (
                    <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                      {note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {confidence && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Confidence
          </span>
          <span className="text-[12.5px] font-semibold" style={{ color: confidenceColor }}>
            {confidence}
          </span>
        </div>
      )}
      {recommendation && (
        <Block title="Recommendation" accent="primary">
          {recommendation}
        </Block>
      )}
      {fullReport && score === 0 && dimensions.length === 0 && (
        <Block title="Niche Score Report">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function PositioningEngineOut({ o }: { o: Record<string, unknown> }) {
  const statement = str(o.positioning_statement ?? o.statement);
  const categoryFrame = str(o.category_frame ?? o.category);
  const alternatives = arr(o.against_alternatives ?? o.alternatives ?? o.against_the_alternatives);
  const proofPoints = arr(o.proof_points ?? o.proofs);
  const pillars = arr(o.messaging_pillars ?? o.pillars);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {statement && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--primary) 6%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <div
            className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            Positioning statement
          </div>
          <div
            className="px-4 pb-4 text-[14px] leading-relaxed italic"
            style={{ color: "var(--foreground)" }}
          >
            "{statement}"
          </div>
        </div>
      )}
      {categoryFrame && (
        <Block title="Category frame" accent="accent">
          {categoryFrame}
        </Block>
      )}
      {alternatives.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Against the alternatives
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {alternatives.map((alt, i) => {
              const item =
                typeof alt === "object" && alt
                  ? (alt as Record<string, unknown>)
                  : { name: String(alt) };
              const name = str(item.name ?? item.alternative ?? item.competitor);
              const youWin = str(item.where_you_win ?? item.you_win ?? item.win ?? item.advantage);
              const theyWin = str(
                item.where_they_win ?? item.they_win ?? item.concession ?? item.weakness,
              );
              return (
                <div key={i} className="px-4 py-3">
                  <div
                    className="text-[12.5px] font-semibold mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {name}
                  </div>
                  {youWin && (
                    <div className="text-[11.5px] mb-1">
                      <span className="font-medium" style={{ color: "var(--success)" }}>
                        Where you win:{" "}
                      </span>
                      <span style={{ color: "var(--foreground)" }}>{youWin}</span>
                    </div>
                  )}
                  {theyWin && (
                    <div className="text-[11.5px]">
                      <span className="font-medium" style={{ color: "var(--muted-foreground)" }}>
                        Where they win:{" "}
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>{theyWin}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {proofPoints.length > 0 && (
        <Block title="Proof points" accent="success">
          <BulletList items={proofPoints} accent="success" />
        </Block>
      )}
      {pillars.length > 0 && (
        <Block title="Messaging pillars" accent="primary">
          <BulletList items={pillars} accent="primary" />
        </Block>
      )}
      {fullReport && !statement && (
        <Block title="Positioning Report">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function MvpPlannerOut({ o }: { o: Record<string, unknown> }) {
  const scope = arr(o.mvp_scope ?? o.scope ?? o.must_haves);
  const cutList = arr(o.cut_list ?? o.cuts ?? o.not_yet);
  const sequence = arr(o.build_sequence ?? o.phases ?? o.sequence);
  const milestones = arr(o.validation_milestones ?? o.milestones ?? o.checkpoints);
  const techRec = str(o.tech_recommendation ?? o.tech_stack ?? o.stack);
  const fullReport = str(o.full_report);
  return (
    <div className="space-y-3">
      {scope.length > 0 && (
        <Block title="MVP scope — must have" accent="success">
          <BulletList items={scope} accent="success" />
        </Block>
      )}
      {cutList.length > 0 && (
        <Block title="Cut list — don't build yet" accent="warning">
          <BulletList items={cutList} accent="warning" />
        </Block>
      )}
      {sequence.length > 0 && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderBottom: "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
              color: "var(--muted-foreground)",
            }}
          >
            Build sequence
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}
          >
            {sequence.map((ph, i) => {
              const item =
                typeof ph === "object" && ph
                  ? (ph as Record<string, unknown>)
                  : { phase: String(ph) };
              const phaseName = str(item.phase ?? item.name ?? item.title);
              const what = str(
                item.what_to_build ?? item.description ?? item.deliverable ?? item.build,
              );
              const done = str(item.done_looks_like ?? item.done ?? item.success ?? item.goal);
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono"
                      style={{ background: "rgba(249,115,22,0.12)", color: "var(--primary)" }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-[12.5px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {phaseName}
                    </span>
                  </div>
                  {what && (
                    <div className="ml-7 text-[11.5px] mb-1" style={{ color: "var(--foreground)" }}>
                      {what}
                    </div>
                  )}
                  {done && (
                    <div className="ml-7 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      ✓ Done when: {done}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {milestones.length > 0 && (
        <Block title="Validation milestones" accent="primary">
          <BulletList items={milestones} accent="primary" />
        </Block>
      )}
      {techRec && (
        <Block title="Tech recommendation" accent="accent">
          {techRec}
        </Block>
      )}
      {fullReport && scope.length === 0 && sequence.length === 0 && (
        <Block title="MVP / Build Plan">
          <MarkdownReport content={fullReport} />
        </Block>
      )}
    </div>
  );
}

function GenericOut({ o }: { o: Record<string, unknown> }) {
  const entries = Object.entries(o);
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => {
        if (v == null) return null;
        if (Array.isArray(v)) {
          return (
            <Block key={k} title={k.replace(/_/g, " ")}>
              <BulletList items={v} accent="primary" />
            </Block>
          );
        }
        if (typeof v === "object") {
          return (
            <Block key={k} title={k.replace(/_/g, " ")}>
              <pre
                className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg p-2 font-mono text-[12px]"
                style={{ background: "var(--surface-offset)", color: "var(--foreground)" }}
              >
                {JSON.stringify(v, null, 2)}
              </pre>
            </Block>
          );
        }
        return (
          <Block key={k} title={k.replace(/_/g, " ")}>
            {String(v)}
          </Block>
        );
      })}
    </div>
  );
}

export function SavedTick({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px]"
      style={{ color: "var(--muted-foreground)" }}
    >
      <Check className="h-3 w-3" style={{ color: "var(--success)" }} /> {label}
    </span>
  );
}
