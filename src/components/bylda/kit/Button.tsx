import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

/**
 * Button (4:23). Primary = black solid · Secondary = white + hairline · Ghost = text ·
 * Dark = black solid (on dark surfaces) · Destructive = regress tint.
 * "One primary per view." Disabled = 40% opacity.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "destructive";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-by-surface-control-dark text-by-text-on-control hover:bg-by-surface-control-dark/85",
  dark: "bg-by-surface-control-dark text-by-text-on-control hover:bg-by-surface-control-dark/85",
  secondary:
    "bg-by-surface-raised text-by-text-primary border border-by-border-control hover:bg-by-surface-hover",
  ghost: "text-by-text-secondary hover:text-by-text-primary hover:bg-by-surface-hover",
  destructive: "bg-by-signal-regress-bg text-by-signal-regress hover:bg-by-signal-regress-bg/80",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, asChild, className, children, type, ...rest },
  ref,
) {
  const Cmp = asChild ? Slot : "button";
  return (
    <Cmp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "type-ui-body-strong inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-by-control transition-colors duration-200 ease-by-out",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "px-3.5 py-2" : "px-2.5 py-1 type-ui-small",
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon ? <Icon name={icon} size={14} /> : null}
          {children}
        </>
      )}
    </Cmp>
  );
});
