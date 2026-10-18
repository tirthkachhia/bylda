/**
 * CallScores — what the Jev scoring means for this rep, in manager language:
 * a verdict, three plain gauges, the learning moments with the actual words and
 * (after analysis) Claude's one-line explanation and a better line to say.
 * The curve itself sits behind a toggle; it is evidence, not the message.
 */
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { callVerdict } from "../../../../supabase/functions/_shared/coaching/moments";
import {
  TEMPERATURE_LABELS,
  TEMPERATURE_MAX,
} from "../../../../supabase/functions/_shared/coaching/jev-questions";
import { callScoresQuery } from "@/lib/queries";
import type { ExchangeScoreRow, LearningMomentRow, ScoreSummary } from "@/lib/coaching/types";

// Validated two-series palette (dataviz skill): CVD ΔE 28, contrast ≥ 3:1 on the page surface.
const TEMP_COLOR = "#3275d8";
const MOVE_COLOR = "#c2410c";
const MOMENT_COLOR = "#9b1c1c";

const TEMP_LEVELS: readonly string[] = TEMPERATURE_LABELS;
const MOVE_LEVELS = ["pushed past", "missed the opening", "advanced", "advanced and asked"];

const n = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);
const mmss = (s: number | string | null | undefined) => {
  const v = Math.round(n(s) ?? 0);
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

type Point = {
  index: number;
  label: string;
  temperature: number;
  move: number | null;
  risk: number | null;
  confidence: number;
};

const toPoints = (rows: ExchangeScoreRow[]): Point[] =>
  rows.map((r) => ({
    index: r.exchange_index,
    label: mmss(r.start_s),
    temperature: n(r.temperature_score) ?? 0,
    move: n(r.rep_move_score),
    risk: n(r.risk_probability),
    confidence: n(r.temperature_confidence) ?? 0,
  }));

export function CallScores({ callId }: { callId: string }) {
  const q = useQuery(callScoresQuery(callId));
  if (q.isLoading) return <p className="p-5 text-sm text-neutral-500">Loading…</p>;
  if (q.error)
    return <p className="p-5 text-sm text-red-700">Could not load scores: {String(q.error)}</p>;
  const { rows, summary, moments } = q.data ?? { rows: [], summary: null, moments: [] };
  if (!rows.length || !summary)
    return (
      <p className="p-5 text-sm text-neutral-500">
        Not scored yet. Scoring runs right after transcription; use Re-analyze for older calls.
      </p>
    );

  const points = toPoints(rows);
  const byIndex = new Map(points.map((p) => [p.index, p]));
  const peakPoint = points.reduce((a, b) => (b.temperature > a.temperature ? b : a), points[0]);
  const dropPoint =
    summary.biggest_drop_exchange_index === null
      ? undefined
      : byIndex.get(summary.biggest_drop_exchange_index);
  const verdict = callVerdict(
    {
      coaching_value_label: summary.coaching_value_label,
      peak_temperature: n(summary.peak_temperature) ?? 0,
      final_temperature: n(summary.final_temperature) ?? 0,
      risk_count: summary.risk_count,
      biggest_drop_exchange_index: summary.biggest_drop_exchange_index,
    },
    { peakAt: peakPoint?.label, dropAt: dropPoint?.label },
  );
  const explained = moments.some((m) => m.why_it_matters);

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <p className="text-[15px] font-medium leading-7 text-[#333943]">{verdict}</p>

      <Gauges summary={summary} />

      {moments.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            Moments to coach on
          </h3>
          {!explained && (
            <p className="mt-1 text-xs text-neutral-500">
              Explanations appear once the call has been analyzed; use Re-analyze if this call was
              scored before its last analysis.
            </p>
          )}
          <ol className="mt-2 divide-y divide-black/5">
            {moments.map((m, i) => (
              <Moment key={m.id} rank={i + 1} moment={m} point={byIndex.get(m.exchange_index)} />
            ))}
          </ol>
        </section>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 hover:text-neutral-800">
          Show the curve
        </summary>
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px]">
            <Swatch color={TEMP_COLOR} label="Customer temperature" />
            <Swatch color={MOVE_COLOR} label="Rep move" />
            <span className="flex items-center gap-1.5 text-neutral-500">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white"
                style={{ background: MOMENT_COLOR, boxShadow: `0 0 0 1px ${MOMENT_COLOR}` }}
              />
              Moment
            </span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#8a9098" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, TEMPERATURE_MAX]}
                  ticks={Array.from({ length: TEMPERATURE_MAX + 1 }, (_, i) => i)}
                  tickFormatter={(v: number) => TEMP_LEVELS[v] ?? String(v)}
                  tick={{ fontSize: 10, fill: "#8a9098" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(0,0,0,0.2)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as Point;
                    return (
                      <div className="rounded-by-card border border-black/10 bg-white px-3 py-2 text-[11px] shadow-by-float">
                        <div className="font-semibold">{p.label}</div>
                        <div>Customer: {TEMP_LEVELS[Math.round(p.temperature)]}</div>
                        {p.move !== null && <div>Rep: {MOVE_LEVELS[Math.round(p.move)]}</div>}
                        {p.risk !== null && p.risk >= 0.6 && (
                          <div className="text-red-700">Risky statement</div>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke={TEMP_COLOR}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="move"
                  stroke={MOVE_COLOR}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                {moments.map((m) => {
                  const p = byIndex.get(m.exchange_index);
                  return p ? (
                    <ReferenceDot
                      key={m.id}
                      x={p.label}
                      y={p.temperature}
                      r={5}
                      fill={MOMENT_COLOR}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ) : null;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </details>

      <p className="text-[10px] text-neutral-400">
        Scores are AI estimates from the words of each exchange, judged without seeing what came
        later. Explanations are grounded in the rep’s playbook. Short back-and-forth exchanges are
        not scored.
      </p>
    </div>
  );
}

function Gauges({ summary }: { summary: ScoreSummary }) {
  const value = summary.coaching_value_label;
  const valueClass =
    value === "high"
      ? "bg-[#fde2e2] text-[#9b1c1c]"
      : value === "medium"
        ? "bg-[#fdf1d6] text-[#8a5b00]"
        : "bg-[#ececea] text-[#5f656d]";
  const quality = summary.quality_score;
  const execution =
    quality >= 70 ? "Solid execution" : quality >= 45 ? "Uneven execution" : "Weak execution";
  const move = n(summary.rep_move_average);
  const moveNote =
    move === null
      ? ""
      : move >= 2.5
        ? "usually answered and advanced with a question"
        : move >= 1.75
          ? "usually answered, often missed the opening"
          : "often pushed past or missed what the customer said";
  const risk = summary.risk_count;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Gauge
        title="Worth reviewing"
        value={
          <span
            className={`rounded-by-pill px-2.5 py-0.5 text-[11px] font-bold uppercase ${valueClass}`}
          >
            {value}
          </span>
        }
        note={
          value === "high"
            ? "A warm customer was lost or risk is high"
            : value === "medium"
              ? "Some signal; review if time allows"
              : "Little to learn from this call"
        }
      />
      <Gauge
        title="Execution"
        value={<span className="text-[18px] font-bold">{execution}</span>}
        note={moveNote}
      />
      <Gauge
        title="Compliance risk"
        value={
          <span
            className={`text-[18px] font-bold ${risk >= 5 ? "text-[#9b1c1c]" : risk > 0 ? "text-[#8a5b00]" : "text-[#28764d]"}`}
          >
            {risk === 0 ? "None flagged" : `${risk} flagged`}
          </span>
        }
        note={
          risk === 0
            ? "No claims, pressure, or sensitive data by voice"
            : "Statements a reviewer would question"
        }
      />
    </div>
  );
}

function Gauge({ title, value, note }: { title: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-by-card border border-black/[0.08] bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </div>
      <div className="mt-1.5">{value}</div>
      {note && <p className="mt-1 text-[11px] leading-5 text-neutral-500">{note}</p>}
    </div>
  );
}

function Moment({
  rank,
  moment: m,
  point,
}: {
  rank: number;
  moment: LearningMomentRow;
  point?: Point;
}) {
  const headline = m.headline ?? "Moment worth reviewing";
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[11px] font-semibold text-neutral-400">{rank}.</span>
        <span className="font-mono text-[11px] text-neutral-500">{point?.label ?? "—"}</span>
        <span className="text-sm font-semibold">{headline}</span>
        {m.low_confidence && <span className="text-[10px] text-neutral-400">low confidence</span>}
      </div>
      {m.why_it_matters && <p className="mt-1 text-sm text-neutral-700">{m.why_it_matters}</p>}
      {m.playbook_guideline && (
        <p className="mt-0.5 text-[11px] text-[#4774b5]">
          {m.guideline_source === "playbook" ? "Playbook" : "General rule"}
          {m.guideline_code ? ` ${m.guideline_code}` : ""}: {m.playbook_guideline}
        </p>
      )}
      <div className="mt-2 rounded-by-card bg-black/[0.03] px-3 py-2 text-[12px] leading-5">
        {m.rep_text && (
          <p>
            <span className="font-semibold text-[#474d55]">Rep:</span> {m.rep_text}
          </p>
        )}
        {m.customer_text && (
          <p className="text-neutral-600">
            <span className="font-semibold text-[#474d55]">Customer:</span> {m.customer_text}
          </p>
        )}
      </div>
      {m.what_to_say_instead && (
        <p className="mt-2 text-[12px] leading-5 text-[#28764d]">
          <span className="font-semibold">Say instead:</span> “{m.what_to_say_instead}”
        </p>
      )}
    </li>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-neutral-600">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
