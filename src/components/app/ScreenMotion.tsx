import { useEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { reducedMotion } from "@/lib/coaching/page30-motion";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Shared by app, auth and setup routes. Never remounts or hides live content. */
export function ScreenMotion({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const screenKey = useRouterState({
    select: (s) =>
      s.location.pathname +
      JSON.stringify(
        ["view", "callId", "reportId", "tab", "repId", "step", "screen"].map(
          (key) => (s.location.search as Record<string, unknown>)[key] ?? null,
        ),
      ),
  });
  useEffect(() => {
    const root = host.current;
    if (!root || reducedMotion()) return;
    const animations = new Set<Animation>();
    const revealed = new WeakSet<Element>();
    let frame = 0;
    const play = (element: HTMLElement, delay = 0) => {
      if (revealed.has(element) || !element.animate || !element.getClientRects().length) return;
      revealed.add(element);
      const animation = element.animate(
        [
          { opacity: 0, transform: "translateY(14px)", clipPath: "inset(0 0 8% 0 round 8px)" },
          { opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0 0 round 0px)" },
        ],
        { duration: 440, delay, easing: EASE, fill: "backwards" },
      );
      animations.add(animation);
      void animation.finished.then(
        () => animations.delete(animation),
        () => undefined,
      );
    };
    const reveal = () => {
      if (reducedMotion()) return;
      const screen =
        root.querySelector<HTMLElement>("#workspace-content") ??
        (root.firstElementChild as HTMLElement | null);
      if (!screen) return;
      // Native view transitions animate the whole screen on navigation. This
      // also covers first mount and browsers without that API.
      const transitioning =
        typeof CSS !== "undefined" &&
        CSS.supports?.("selector(:active-view-transition)") &&
        document.documentElement.matches(":active-view-transition");
      if (!transitioning) play(screen);
      const panels = [
        ...screen.querySelectorAll<HTMLElement>(
          "section, article, [data-motion-reveal], .page30-section-header, .page30-glass, .figma-panel",
        ),
      ].filter(
        (node) =>
          !node.parentElement?.closest(
            "article, [data-motion-reveal], .page30-glass, .figma-panel",
          ),
      );
      const top = screen.getBoundingClientRect().top;
      panels
        .filter((node) => node.getBoundingClientRect().top < window.innerHeight + top)
        .slice(0, 12)
        .forEach((panel, index) => play(panel, Math.min(index * 35, 175)));
    };
    frame = requestAnimationFrame(reveal);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    });
    observer.observe(root, { childList: true, subtree: true });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (preference.matches) animations.forEach((animation) => animation.cancel());
    };
    preference.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", stop);
    };
  }, [screenKey]);
  return (
    <div ref={host} className="screen-motion">
      {children}
    </div>
  );
}
