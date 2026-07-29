import { useEffect, useMemo, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { deriveOutputShape, type OutputShape } from "@/lib/casefile";

// SIMULATED reasoning sequence — NOT real intermediate state.
//
// The tool-run edge path (runTool) returns a single JSON response; it does
// not stream, so there is no genuine "Bylda is now doing X" signal to surface
// (streamText stays empty for these runs). Until the router exposes
// streaming, we advance a short, tool-shape-specific status sequence on a
// timer so the wait reads like reasoning rather than a blank spinner. It is
// paced by elapsed time (not a fixed cycle) and the last real step holds
// until the run finishes. Swap this for real states once streaming exists.
type Stage = { afterSeconds: number; label: string };

const TAIL: Stage = {
  afterSeconds: 20,
  label: "Still working — long runs can take up to a minute…",
};

const GENERIC_STAGES: Stage[] = [
  { afterSeconds: 0, label: "Reading your business context…" },
  { afterSeconds: 3, label: "Working through your inputs…" },
  { afterSeconds: 8, label: "Writing the result…" },
  TAIL,
];

// Three-beat sequences per output shape: read → analyze → draft.
const SHAPE_STEPS: Record<OutputShape, [string, string, string]> = {
  score_verdict: [
    "Reading your inputs…",
    "Scoring against benchmarks…",
    "Drafting Bylda's verdict…",
  ],
  comparison: [
    "Gathering the options…",
    "Comparing on price and fit…",
    "Picking the recommended move…",
  ],
  report: ["Reading your business context…", "Structuring the analysis…", "Writing the report…"],
  memo: ["Reading your business context…", "Working through the decision…", "Writing the memo…"],
  plan_with_steps: [
    "Reading your business context…",
    "Sequencing the steps…",
    "Writing your plan…",
  ],
  pipeline_snapshot: [
    "Reviewing your pipeline data…",
    "Comparing against stage benchmarks…",
    "Summarizing the snapshot…",
  ],
  session_summary: [
    "Reviewing the session…",
    "Pulling out the key takeaways…",
    "Writing your summary…",
  ],
};

function stagesForTool(toolKey?: string): Stage[] {
  const shape = toolKey ? deriveOutputShape(toolKey) : null;
  if (!shape) return GENERIC_STAGES;
  const [a, b, c] = SHAPE_STEPS[shape];
  return [
    { afterSeconds: 0, label: a },
    { afterSeconds: 3, label: b },
    { afterSeconds: 8, label: c },
    TAIL,
  ];
}

type Props = {
  streamText: string;
  toolName?: string;
  /** Tool key — selects a shape-specific (simulated) reasoning sequence. */
  toolKey?: string;
};

export function ByldaThinking({ streamText, toolName, toolKey }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);
  const stages = useMemo(() => stagesForTool(toolKey), [toolKey]);

  useEffect(() => {
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const stage = [...stages].reverse().find((s) => elapsed >= s.afterSeconds) ?? stages[0];

  useEffect(() => {
    setCharCount(streamText.length);
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [streamText]);

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--primary-soft)" }}
        >
          <Zap className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
            {toolName ? `Bylda — ${toolName}` : "Bylda AI"}
          </div>
          <div
            className="text-[11.5px] transition-all duration-500"
            style={{ color: "var(--muted-foreground)" }}
            key={stage.label}
          >
            {stage.label}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {charCount > 0 ? `${charCount} chars` : `${Math.floor(elapsed)}s`}
          </span>
          <ThinkingDots />
        </div>
      </div>

      {/* Stream display — only when the run actually streams text.
          Non-streaming runs (most tools) show the staged status line alone,
          never an empty panel with a blinking caret. */}
      {streamText.length > 0 && (
        <div
          ref={textRef}
          className="relative overflow-hidden rounded-xl"
          style={{
            maxHeight: "280px",
            overflowY: "auto",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="px-4 py-3">
            <div
              className="font-mono text-[10.5px] leading-relaxed break-all whitespace-pre-wrap"
              style={{ color: "var(--muted-foreground)" }}
            >
              {streamText}
              <span
                className="inline-block w-1.5 h-3 ml-0.5 align-middle"
                style={{
                  background: "var(--primary)",
                  animation: "caret-blink 0.7s steps(2) infinite",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes caret-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="caret-blink"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--primary)",
            animation: "dotBounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="dotBounce"] { animation: none !important; }
        }
      `}</style>
    </span>
  );
}
