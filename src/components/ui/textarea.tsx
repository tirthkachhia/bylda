import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-by-control border border-by-border-strong aria-invalid:border-by-feedback-error focus-visible:border-by-focus-ring bg-transparent px-3 py-2 text-base shadow-none placeholder:text-by-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-by-focus-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
