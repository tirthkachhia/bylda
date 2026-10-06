import { useState } from "react";
import type { Reaction } from "@/components/bylda";

/**
 * Viewer-local reactions on a feed post. There is no feed-reactions hook yet
 * (logged in LANE_REQUESTS.md) — so this starts empty and never invents counts.
 */
const QUICK = "👍";

export function useLocalReactions() {
  const [list, setList] = useState<Reaction[]>([]);
  const toggle = (symbol: string) =>
    setList((prev) =>
      prev
        .map((r) =>
          r.symbol === symbol ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r,
        )
        .filter((r) => r.count > 0),
    );
  const add = () =>
    setList((prev) =>
      prev.some((r) => r.symbol === QUICK && r.mine)
        ? prev
        : prev.some((r) => r.symbol === QUICK)
          ? prev.map((r) => (r.symbol === QUICK ? { ...r, mine: true, count: r.count + 1 } : r))
          : [...prev, { symbol: QUICK, count: 1, mine: true }],
    );
  return { list, toggle, add };
}
