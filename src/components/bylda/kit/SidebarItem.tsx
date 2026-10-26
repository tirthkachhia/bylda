import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

/**
 * Sidebar Item (4:47) / Nav Item (36:51) — on the dark sidebar.
 * States: default · active (white 10%) · unread (bright text + dot).
 * Leading: an icon, "#" for rooms, or any node (an Avatar for people).
 * Meta: a count or status on the right ("9", "on a call").
 */
export type SidebarItemState = "default" | "active" | "unread";

export function SidebarItem({
  to,
  label,
  icon,
  leading,
  meta,
  state = "default",
  onClick,
  className,
}: {
  to?: string;
  label: string;
  icon?: IconName | "hash";
  leading?: ReactNode;
  meta?: ReactNode;
  state?: SidebarItemState;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {leading ??
        (icon === "hash" ? (
          <span className="type-mono-data w-4 text-center opacity-80" aria-hidden>
            #
          </span>
        ) : icon ? (
          <Icon name={icon} size={16} />
        ) : null)}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          state === "default" ? "type-ui-body" : "type-ui-body-strong",
        )}
      >
        {label}
      </span>
      {state === "unread" ? (
        <span className="h-1.5 w-1.5 rounded-by-pill bg-by-text-on-dark" aria-label="unread" />
      ) : meta !== undefined && meta !== null && meta !== "" ? (
        <span className="type-mono-micro text-by-text-on-dark-muted">{meta}</span>
      ) : null}
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-by-control px-2.5 py-[5px] text-left transition-colors duration-200",
    state === "active"
      ? "bg-by-surface-sidebar-active text-by-text-on-dark"
      : state === "unread"
        ? "text-by-text-on-dark hover:bg-by-surface-sidebar-hover"
        : "text-by-text-sidebar hover:bg-by-surface-sidebar-hover hover:text-by-text-on-dark",
    className,
  );
  if (to) {
    return (
      <Link
        to={to as never}
        className={cls}
        aria-current={state === "active" ? "page" : undefined}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}
