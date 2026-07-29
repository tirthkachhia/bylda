/**
 * Seal — engineer's-seal verdict badge for casefiles.
 * Replaces the plain verdict circle: a stamped circular seal with curved
 * text on the top and bottom arcs. Stamps in with `animate-stamp` on every
 * new casefile render (key it by casefile/run id upstream to re-trigger).
 *
 * Verdict → finish mapping (matches the existing GO / CAUTION / PIVOT enum):
 *   GO                → brass
 *   CAUTION / PAUSE   → warn amber
 *   anything positive → seal green (e.g. VALIDATED)
 */

interface SealProps {
  /** Verdict word stamped in the centre, e.g. "GO" */
  verdict: string;
  /** Top arc text, e.g. "IDEA VALIDATION" (casefile type) */
  arcTop: string;
  /** Bottom arc text, e.g. "SCORE 74/100 · 2026-07-16" */
  arcBottom: string;
  /** Diameter in px (default 96) */
  size?: number;
}

function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v.includes("go") || v.includes("approved")) return "var(--color-blueprint-brass)";
  if (v.includes("caution") || v.includes("pause") || v.includes("pivot") || v.includes("stop"))
    return "var(--color-blueprint-warn)";
  return "var(--color-blueprint-seal)";
}

export function Seal({ verdict, arcTop, arcBottom, size = 96 }: SealProps) {
  const color = verdictColor(verdict);
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`Verdict seal: ${verdict}. ${arcTop}. ${arcBottom}`}
      className="animate-stamp shrink-0"
    >
      {/* Arc paths for curved text (top runs left→right, bottom reversed) */}
      <defs>
        <path id="seal-arc-top" d="M 18,60 A 42,42 0 0 1 102,60" fill="none" />
        <path id="seal-arc-bottom" d="M 14,60 A 46,46 0 0 0 106,60" fill="none" />
      </defs>

      {/* Outer + inner rings */}
      <circle cx="60" cy="60" r="56" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="0.75" />
      <circle
        cx="60"
        cy="60"
        r="32"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 2.5"
      />

      <text
        className="font-bp-mono"
        fontSize="8"
        fontWeight="600"
        fill={color}
        letterSpacing="0.16em"
      >
        <textPath href="#seal-arc-top" startOffset="50%" textAnchor="middle">
          {arcTop.toUpperCase()}
        </textPath>
      </text>
      <text
        className="font-bp-mono"
        fontSize="7"
        fontWeight="500"
        fill={color}
        letterSpacing="0.14em"
      >
        <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">
          {arcBottom.toUpperCase()}
        </textPath>
      </text>

      {/* Centre verdict */}
      <text
        x="60"
        y="66"
        textAnchor="middle"
        className="font-tech"
        fontSize={verdict.length > 4 ? 15 : 20}
        fontWeight="700"
        fill={color}
        letterSpacing="0.08em"
      >
        {verdict.toUpperCase()}
      </text>
    </svg>
  );
}
