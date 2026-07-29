// Sprint 4 Medium · Usage bar component
// Shows current usage vs plan limit with a progress bar and upgrade CTA.

import React from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, Zap } from "lucide-react";
import { useUsageLimit } from "@/hooks/use-usage-limit";

interface Props {
  compact?: boolean;
  showUpgrade?: boolean;
}

export function UsageBar({ compact = false, showUpgrade = true }: Props) {
  const { used, limit, remaining, percentUsed, isAtLimit, isNearLimit, isLoading } =
    useUsageLimit();

  if (isLoading) return null;
  if (!limit) return null;

  const barColor = isAtLimit ? "#ef4444" : isNearLimit ? "#f59e0b" : "#3b82f6";
  const statusLabel = isAtLimit ? "Limit reached" : isNearLimit ? "Near limit" : "Usage";

  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{statusLabel}</span>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: barColor }}>
            {used} / {limit}
          </span>
        </div>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percentUsed}%`,
              borderRadius: 2,
              background: barColor,
              boxShadow: `0 0 6px ${barColor}80`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${barColor}25`,
        background: `${barColor}06`,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap style={{ width: 14, height: 14, color: barColor }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)" }}>
            AI Generations
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(isAtLimit || isNearLimit) && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: barColor,
                background: `${barColor}14`,
                border: `1px solid ${barColor}25`,
                padding: "2px 7px",
                borderRadius: 4,
              }}
            >
              {isAtLimit ? "Limit reached" : "Near limit"}
            </span>
          )}
          <span
            style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: barColor }}
          >
            {used} / {limit}
          </span>
        </div>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--border)",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentUsed}%`,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
            boxShadow: `0 0 8px ${barColor}60`,
            transition: "width 0.7s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {remaining !== null ? `${remaining} remaining this month` : "Unlimited"}
        </span>
        {showUpgrade && isNearLimit && (
          <Link to="/app/billing" style={{ textDecoration: "none" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: barColor,
                cursor: "pointer",
              }}
            >
              <TrendingUp style={{ width: 10, height: 10 }} />
              Upgrade for more
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
