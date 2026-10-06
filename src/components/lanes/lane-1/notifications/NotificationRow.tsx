import { Link } from "@tanstack/react-router";
import { cn } from "@/components/bylda";
import type { Notification } from "@/lib/data";
import { toneOf } from "./model";

/**
 * One notification — shared by N1 (drawer, 31:1212) and N2 (center, 31:1377).
 * Severity is a dot and a word (the type label), never a badge or a pile-up count (31:1197).
 * Unread = coloured dot + body-strong title; read = pale dot + small title.
 */
const DOT = {
  improve: "bg-by-signal-improve",
  regress: "bg-by-signal-regress",
  attention: "bg-by-signal-attention",
  info: "bg-by-signal-info",
  neutral: "bg-by-text-tertiary",
} as const;

const WORD = {
  improve: "text-by-signal-improve",
  regress: "text-by-signal-regress",
  attention: "text-by-signal-attention",
  info: "text-by-signal-info",
  neutral: "text-by-text-tertiary",
} as const;

export function NotificationRow({
  notification: n,
  when,
  onOpen,
  className,
}: {
  notification: Notification;
  when: string;
  /** Fired on click, before navigation — marks it read, closes the drawer. */
  onOpen: (n: Notification) => void;
  className?: string;
}) {
  const tone = toneOf(n);
  return (
    <Link
      // Hrefs are data (`Notification.href`), not statically-known routes.
      to={n.href as never}
      onClick={() => onOpen(n)}
      className={cn(
        "flex items-start gap-3 transition-colors duration-200 ease-out hover:bg-by-surface-hover",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 size-2 shrink-0 rounded-by-pill",
          n.read ? "bg-by-border-engraved" : DOT[tone],
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={cn("type-mono-micro", WORD[tone])}>
          {n.typeLabel}
          {n.read ? null : <span className="sr-only"> (unread)</span>}
        </span>
        <span
          className={cn("text-by-text-primary", n.read ? "type-ui-small" : "type-ui-body-strong")}
        >
          {n.title}
        </span>
        {n.body ? <span className="type-ui-small text-by-text-secondary">{n.body}</span> : null}
      </span>
      <span className="type-mono-micro shrink-0 whitespace-nowrap text-by-text-tertiary">
        {when}
      </span>
    </Link>
  );
}
