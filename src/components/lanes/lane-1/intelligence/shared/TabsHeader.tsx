import { IntelligenceTabs } from "./IntelligenceFrame";
import type { useIntelligenceContext } from "./useIntelligenceContext";

/** Figma 51:1657 + 51:1661: mono eyebrow, the Editorial/H2 line, then the tab strip. */
export function TabsHeader({
  eyebrow,
  counts,
}: Pick<ReturnType<typeof useIntelligenceContext>, "eyebrow" | "counts">) {
  return (
    <>
      <header className="flex flex-col gap-1.5">
        <p className="type-mono-micro text-by-text-tertiary">{eyebrow}</p>
        <h1 className="type-editorial-h2 text-by-text-primary">
          What Bylda has learned about how your team sells.
        </h1>
      </header>
      <IntelligenceTabs counts={counts} />
    </>
  );
}
