export const PAGE30_SPRING = "linear(0, 0.21 11%, 0.48 23%, 0.71 37%, 0.87 52%, 0.96 69%, 1)";
export const PAGE30_RESPONSE = 340;

export function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function animatePage30Panel(element: HTMLElement, origin?: HTMLElement | null) {
  if (!element.animate) return;
  if (reducedMotion()) {
    return element.animate([{ opacity: 0.75 }, { opacity: 1 }], {
      duration: 120,
      easing: "ease-out",
    });
  }
  const from = origin?.getBoundingClientRect();
  const to = element.getBoundingClientRect();
  const distance = from ? Math.min(26, Math.max(-26, from.top - to.bottom)) : 8;
  return element.animate(
    [
      { translate: `0 ${distance}px`, scale: from ? 0.985 : 1 },
      { translate: "0 0", scale: 1 },
    ],
    {
      duration: PAGE30_RESPONSE,
      easing: CSS.supports("animation-timing-function", PAGE30_SPRING)
        ? PAGE30_SPRING
        : "cubic-bezier(0.16, 1, 0.3, 1)",
    },
  );
}

export function canTransitionPage30() {
  return (
    typeof document !== "undefined" && Boolean(document.startViewTransition) && !reducedMotion()
  );
}
