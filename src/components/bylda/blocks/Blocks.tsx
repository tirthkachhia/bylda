import type { ReactNode } from "react";
import { cn } from "../kit/cn";
import { Button } from "../kit/Button";
import { Icon } from "../kit/Icon";
import { Tag, type TagTone } from "../kit/Tag";

/** Room message blocks (39:904 · 39:918 · 39:935 · 39:946). White, hairline, radius 10. */
const SHELL =
  "flex w-full items-center gap-3.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-3.5 py-3";

function MoreButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-by-text-tertiary hover:text-by-text-primary"
      aria-label="More"
    >
      <Icon name="more" size={16} />
    </button>
  );
}

function Titles({ title, meta, children }: { title: string; meta: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="type-ui-body-strong truncate text-by-text-primary">{title}</p>
      <p className="type-ui-small truncate text-by-text-tertiary">{meta}</p>
      {children}
    </div>
  );
}

/** Block / Report (39:904) */
export function ReportBlock({
  title,
  meta,
  onOpen,
  onMore,
  className,
}: {
  title: string;
  /** "Report · Wk 39 · 5-min read" */
  meta: string;
  onOpen?: () => void;
  onMore?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(SHELL, className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-by-tile bg-by-signal-info-bg text-by-signal-info">
        <Icon name="file" size={18} />
      </span>
      <Titles title={title} meta={meta} />
      <Button variant="secondary" onClick={onOpen}>
        Open
      </Button>
      <MoreButton onClick={onMore} />
    </div>
  );
}

/** Block / Call (39:918) */
export function CallBlock({
  title,
  meta,
  moment,
  onReview,
  onMore,
  className,
}: {
  /** "Jordan × Acme Logistics" */
  title: string;
  /** "38 min · Mon 2:00 PM · 4 key moments" */
  meta: string;
  /** e.g. { tone: "regress", label: "Lost control 18:42" } */
  moment?: { tone: TagTone; label: string };
  onReview?: () => void;
  onMore?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(SHELL, className)}>
      <span className="flex h-[68px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-by-control bg-by-surface-sidebar">
        <span className="flex size-7 items-center justify-center rounded-by-pill bg-by-surface-raised/90 text-by-text-primary">
          <Icon name="play" size={12} />
        </span>
      </span>
      <Titles title={title} meta={meta}>
        {moment ? (
          <span className="pt-0.5">
            <Tag tone={moment.tone}>{moment.label}</Tag>
          </span>
        ) : null}
      </Titles>
      <Button variant="secondary" onClick={onReview}>
        Review call
      </Button>
      <MoreButton onClick={onMore} />
    </div>
  );
}

/** Block / Coaching (39:935) */
export function CoachingBlock({
  title,
  meta,
  actionLabel = "Acknowledge",
  onAction,
  className,
}: {
  /** "Focus: pause after objections" */
  title: string;
  /** "Jordan · measured on next 5 objections · 2 clips attached" */
  meta: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(SHELL, className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-by-tile bg-by-surface-control-dark text-by-text-on-control">
        <Icon name="coaching" size={18} />
      </span>
      <Titles title={title} meta={meta} />
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

/** Block / Structured insight (39:946) — three columns on Inset. */
export function StructuredInsightBlock({
  columns,
  className,
}: {
  /** Figma: Key moment · Behavioral insight · Today's focus */
  columns: [StructuredColumn, StructuredColumn, StructuredColumn];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-stretch rounded-by-card border border-by-border-engraved bg-by-surface-inset",
        className,
      )}
    >
      {columns.map((c, i) => (
        <div
          key={c.title}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3",
            i < 2 && "border-r border-by-border-engraved",
          )}
        >
          <p className="type-ui-body-strong text-by-text-primary">{c.title}</p>
          <p className="type-ui-small text-by-text-secondary">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
export type StructuredColumn = { title: string; body: string };
