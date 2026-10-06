import type { ReactNode } from "react";
import { cn } from "../kit/cn";
import { ByldaGlyph } from "../kit/ByldaGlyph";
import { Button, type ButtonVariant } from "../kit/Button";
import { Tag, type TagTone } from "../kit/Tag";
import { SkeletonBar, SkeletonBlock } from "../kit/Skeleton";

/**
 * Empty & System States (page 17, board 19:2).
 * Rule: "when Bylda lacks evidence, it says so — with the number it needs.
 * It never fills space with fake intelligence."
 */
export type StateAction = {
  label: string;
  variant?: ButtonVariant;
  onClick?: () => void;
  href?: string;
};

export type SystemStateProps = {
  /** Mono eyebrow, e.g. "HOME · NO CALLS YET". */
  eyebrow?: string;
  tag?: { tone: TagTone; label: string };
  title: string;
  body?: ReactNode;
  actions?: StateAction[];
  /** error states tint the glyph regress */
  tone?: "neutral" | "error";
  /** "card" = raised card (default); "bare" = no container, for inline use in a panel. */
  surface?: "card" | "bare";
  className?: string;
};

export function SystemState({
  eyebrow,
  tag,
  title,
  body,
  actions = [],
  tone = "neutral",
  surface = "card",
  className,
}: SystemStateProps) {
  return (
    <section
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex w-full max-w-[470px] flex-col items-start gap-2.5",
        surface === "card" &&
          "border border-by-border-engraved bg-by-surface-raised px-6 py-[22px]",
        className,
      )}
    >
      {eyebrow || tag ? (
        <div className="flex w-full items-center gap-2">
          <span className="type-mono-micro min-w-0 flex-1 text-by-text-tertiary">{eyebrow}</span>
          {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
        </div>
      ) : null}
      <ByldaGlyph size={18} className={tone === "error" ? "text-by-signal-regress" : undefined} />
      <h3 className="type-editorial-insight text-by-text-primary">{title}</h3>
      {body ? <div className="type-ui-small text-by-text-secondary">{body}</div> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2 pt-0.5">
          {actions.map((a) =>
            a.href ? (
              <Button key={a.label} asChild variant={a.variant ?? "ghost"}>
                <a href={a.href}>{a.label}</a>
              </Button>
            ) : (
              <Button key={a.label} variant={a.variant ?? "ghost"} onClick={a.onClick}>
                {a.label}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Generic empty state — neutral "Empty" tag. */
export function StateEmpty(props: Omit<SystemStateProps, "tone"> & { tagLabel?: string }) {
  const { tagLabel = "Empty", ...rest } = props;
  return <SystemState tag={{ tone: "neutral", label: tagLabel }} {...rest} />;
}

/** Generic error state — regress "Error" tag, regress glyph, Retry. */
export function StateError({
  title = "Something went wrong.",
  body,
  onRetry,
  eyebrow,
  className,
}: {
  title?: string;
  body?: ReactNode;
  onRetry?: () => void;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <SystemState
      tone="error"
      eyebrow={eyebrow}
      tag={{ tone: "regress", label: "Error" }}
      title={title}
      body={body}
      actions={onRetry ? [{ label: "Retry", variant: "secondary", onClick: onRetry }] : []}
      className={className}
    />
  );
}

/**
 * Loading. `skeleton` (default) = Y13 static bars — NO SHIMMER THEATRICS.
 * `progress` = Y2 style: a real count, never a fake bar.
 */
export function StateLoading(
  props:
    | { variant?: "skeleton"; label?: string; className?: string }
    | {
        variant: "progress";
        title: string;
        body?: ReactNode;
        eyebrow?: string;
        className?: string;
      },
) {
  if (props.variant === "progress") {
    return (
      <SystemState
        eyebrow={props.eyebrow}
        tag={{ tone: "info", label: "Loading" }}
        title={props.title}
        body={props.body}
        className={props.className}
      />
    );
  }
  return (
    <section
      role="status"
      aria-label="Loading"
      className={cn(
        "flex w-full max-w-[470px] flex-col gap-3 border border-by-border-engraved bg-by-surface-raised px-6 py-[22px]",
        props.className,
      )}
    >
      {props.label ? <p className="type-mono-micro text-by-text-tertiary">{props.label}</p> : null}
      <SkeletonBar width={120} height={8} />
      <SkeletonBar width="95%" />
      <SkeletonBar width="80%" />
      <SkeletonBar width="62%" />
      <SkeletonBlock />
    </section>
  );
}
