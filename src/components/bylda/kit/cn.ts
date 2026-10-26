import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge that knows the Bylda token utilities, so `cn(base, override)` resolves conflicts. */
const twMergeBylda = extendTailwindMerge<"bylda-type">({
  extend: {
    classGroups: {
      rounded: [
        {
          rounded: ["by-bar", "by-badge", "by-control", "by-tile", "by-card", "by-menu", "by-pill"],
        },
      ],
      shadow: [{ shadow: ["by-float"] }],
      "bylda-type": [
        {
          type: [
            "brand-logo",
            "display-xl",
            "display-l",
            "display-label",
            "editorial-h1",
            "editorial-h2",
            "editorial-insight",
            "editorial-quote",
            "ui-title",
            "ui-body",
            "ui-body-strong",
            "ui-small",
            "ui-label",
            "mono-data",
            "mono-micro",
            "mono-metric",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeBylda(clsx(inputs));
}
