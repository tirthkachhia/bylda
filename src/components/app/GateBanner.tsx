// Feature gate banner — shown when a feature is locked on the current plan.

import React from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import type { FeatureKey } from "@/lib/feature-gates";
import { useFeatureGate } from "@/hooks/use-feature-gate";

interface Props {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function GateBanner({ feature, children, fallback }: Props) {
  const { allowed, upsell, isLoading } = useFeatureGate(feature);

  if (isLoading) return null;
  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
        background: "color-mix(in oklab, var(--primary) 6%, transparent)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--primary) 12%, transparent)",
          border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock style={{ width: 18, height: 18, color: "var(--primary)" }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
          Feature locked
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--muted-foreground)",
            lineHeight: 1.55,
            maxWidth: 280,
          }}
        >
          {upsell}
        </div>
      </div>
      <Link to="/app/billing" style={{ textDecoration: "none" }}>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 9,
            border: "none",
            background: "linear-gradient(135deg, var(--primary), var(--mentor-accent))",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 14px color-mix(in oklab, var(--primary) 35%, transparent)",
          }}
        >
          <Sparkles style={{ width: 12, height: 12 }} />
          Upgrade plan <ArrowRight style={{ width: 11, height: 11 }} />
        </button>
      </Link>
    </div>
  );
}

// Inline variant — wraps content with a subtle overlay
interface InlineGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

export function InlineGate({ feature, children }: InlineGateProps) {
  const { allowed, isLoading } = useFeatureGate(feature);

  if (isLoading || allowed) return <>{children}</>;

  return (
    <div style={{ position: "relative", pointerEvents: "none" }}>
      <div style={{ opacity: 0.35, userSelect: "none", filter: "blur(1px)" }}>{children}</div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "all",
        }}
      >
        <Link to="/app/billing" style={{ textDecoration: "none" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 7,
              background: "color-mix(in oklab, var(--primary) 90%, transparent)",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 700,
              backdropFilter: "blur(4px)",
              cursor: "pointer",
            }}
          >
            <Lock style={{ width: 10, height: 10 }} /> Upgrade to unlock
          </span>
        </Link>
      </div>
    </div>
  );
}
