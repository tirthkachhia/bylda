import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../kit/cn";
import { Icon, type IconName } from "../kit/Icon";

/**
 * Menu primitives styled from Menus & popovers (50:27312): white, hairline,
 * radius 12, the one soft shadow, 280 wide, items radius 7 with Pearl-50 hover.
 */
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({
  children,
  align = "start",
  side,
  className,
}: {
  children: ReactNode;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        side={side}
        sideOffset={6}
        className={cn(
          "bylda z-50 flex w-by-menu flex-col gap-px rounded-by-menu border border-by-border-engraved bg-by-surface-raised p-1.5 shadow-by-float",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DM.Label className="type-ui-label px-2.5 py-1.5 text-by-text-tertiary">{children}</DM.Label>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-0.5 h-px bg-by-border-engraved" />;
}

export function MenuItem({
  icon,
  leading,
  children,
  meta,
  selected,
  onSelect,
}: {
  icon?: IconName;
  leading?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "type-ui-body flex cursor-default items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-by-text-primary outline-none data-[highlighted]:bg-by-surface-hover",
        selected && "bg-by-surface-hover",
      )}
    >
      {leading ?? (icon ? <Icon name={icon} size={16} /> : null)}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected ? (
        <Icon name="check" size={16} />
      ) : meta ? (
        <span className="type-mono-micro text-by-text-tertiary">{meta}</span>
      ) : null}
    </DM.Item>
  );
}
