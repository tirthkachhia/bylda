import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-by-control border border-by-border-engraved px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-by-border-focus focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-by-surface-control-dark text-by-text-on-control shadow-none hover:bg-by-surface-control-dark/80",
        secondary:
          "border-transparent bg-by-surface-raised text-by-text-primary hover:bg-by-surface-raised/80",
        destructive:
          "border-transparent bg-by-signal-regress-bg text-by-signal-regress shadow-none hover:bg-by-signal-regress-bg/80",
        outline: "text-by-text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants alongside the component
export { Badge, badgeVariants };
