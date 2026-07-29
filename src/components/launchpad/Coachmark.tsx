// Coachmark — literal "look here" guidance for the Founder Course. A course
// step points at a real in-product element (target_ui_ref). When the founder
// starts the step we navigate to that route and requestCoachmark(id): this
// listener finds the element tagged [data-coach="id"], scrolls it into view,
// and drops a spotlight ring + tooltip on it. Point at it, don't just describe.
//
// The pending target is handed across the route change via sessionStorage (not
// a URL search param) so per-route search validation can never strip it. The
// spotlight uses the box-shadow-spread trick (one element dims everything
// outside the ring) and is pointer-events:none so the founder can immediately
// click the real control it's pointing at.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";

const KEY = "bylda-coach-target";

/** Ask the coachmark to spotlight [data-coach="id"] on the next rendered route. */
export function requestCoachmark(id: string) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* sessionStorage unavailable — coachmark simply won't fire */
  }
  window.dispatchEvent(new Event("bylda-coach"));
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
}

const HOLD_MS = 6000;

export function CoachmarkListener() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [box, setBox] = useState<Box | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({
      top: r.top - 6,
      left: r.left - 6,
      width: r.width + 12,
      height: r.height + 12,
      label: el.getAttribute("data-coach-label") ?? "Bylda brought you here — do this",
    });
  }, []);

  const dismiss = useCallback(() => {
    targetRef.current = null;
    setBox(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const locate = useCallback(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(KEY);
    } catch {
      id = null;
    }
    if (!id) return;

    let tries = 0;
    const attempt = () => {
      const el = document.querySelector<HTMLElement>(`[data-coach="${id}"]`);
      if (el) {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* noop */
        }
        targetRef.current = el;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Let the smooth-scroll settle before measuring the final position.
        window.setTimeout(measure, 380);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(dismiss, HOLD_MS + 400);
      } else if (tries++ < 14) {
        window.setTimeout(attempt, 140); // wait for the target route to render
      } else {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* noop */
        }
      }
    };
    attempt();
  }, [measure, dismiss]);

  // Fire on same-tab request and whenever the route (path) changes.
  useEffect(() => {
    locate();
    const onReq = () => locate();
    window.addEventListener("bylda-coach", onReq);
    return () => window.removeEventListener("bylda-coach", onReq);
  }, [locate, path]);

  // A route change always clears an in-flight spotlight.
  useEffect(() => {
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Keep the ring glued to the target while it's visible.
  useEffect(() => {
    if (!box) return;
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [box, measure]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (!box || typeof document === "undefined") return null;

  const tooltipBelow = box.top + box.height + 12;
  const showAbove = tooltipBelow > window.innerHeight - 90;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 120, pointerEvents: "none" }}>
      <style>{`@keyframes coachPulse {
        0%,100% { box-shadow: 0 0 0 9999px rgba(8,6,4,0.62), 0 0 0 2px var(--primary,#f97316), 0 0 22px 4px color-mix(in oklab, var(--primary,#f97316) 55%, transparent); }
        50%     { box-shadow: 0 0 0 9999px rgba(8,6,4,0.62), 0 0 0 3px var(--primary,#f97316), 0 0 34px 8px color-mix(in oklab, var(--primary,#f97316) 75%, transparent); }
      }`}</style>

      {/* Spotlight ring — the box-shadow spread dims everything outside it. */}
      <div
        style={{
          position: "absolute",
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          borderRadius: 14,
          animation: "coachPulse 1.6s ease-in-out infinite",
          transition: "top 0.2s, left 0.2s, width 0.2s, height 0.2s",
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: "absolute",
          left: Math.max(12, Math.min(box.left, window.innerWidth - 320)),
          top: showAbove ? undefined : tooltipBelow,
          bottom: showAbove ? window.innerHeight - box.top + 12 : undefined,
          maxWidth: 300,
          padding: "10px 14px",
          borderRadius: 12,
          background: "var(--primary, #f97316)",
          color: "var(--primary-foreground, #fff)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {box.label}
      </div>
    </div>,
    document.body,
  );
}
