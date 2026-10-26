import { cn } from "./cn";

/** The Bylda glyph — the outlined triangle on insight headers and system states (4:74, 19:11). */
export function ByldaGlyph({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.9)}
      viewBox="0 0 20 18"
      fill="none"
      aria-hidden
      className={cn("shrink-0 text-by-text-tertiary", className)}
    >
      <path
        d="M10 1.5 18.5 16.5H1.5L10 1.5Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The BYLDA wordmark — Cinzel (`Brand/Logo`), the only place Cinzel is used. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("type-brand-logo select-none", className)}>BYLDA</span>;
}
