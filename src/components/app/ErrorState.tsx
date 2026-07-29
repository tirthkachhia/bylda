import React from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, RefreshCw, Lock, WifiOff, Frown, ArrowRight } from "lucide-react";

export type ErrorVariant =
  | "generic"
  | "network"
  | "permission"
  | "empty"
  | "rate_limit"
  | "not_found";

interface Props {
  variant?: ErrorVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  cta?: { label: string; to: string };
  compact?: boolean;
}

const VARIANT_CONFIG: Record<
  ErrorVariant,
  {
    icon: React.ComponentType<{ style?: React.CSSProperties }>;
    defaultTitle: string;
    defaultDesc: string;
  }
> = {
  generic: {
    icon: AlertCircle,
    defaultTitle: "Something went wrong",
    defaultDesc: "An unexpected error occurred. Try again or contact support.",
  },
  network: {
    icon: WifiOff,
    defaultTitle: "Connection issue",
    defaultDesc: "Check your internet connection and try again.",
  },
  permission: {
    icon: Lock,
    defaultTitle: "Access restricted",
    defaultDesc: "You don't have permission to view this. Upgrade your plan to unlock it.",
  },
  empty: {
    icon: Frown,
    defaultTitle: "Nothing here yet",
    defaultDesc: "Get started by running a tool or adding data.",
  },
  rate_limit: {
    icon: AlertCircle,
    defaultTitle: "Limit reached",
    defaultDesc: "You've hit your monthly limit. Upgrade to continue.",
  },
  not_found: {
    icon: AlertCircle,
    defaultTitle: "Not found",
    defaultDesc: "This resource doesn't exist or was removed.",
  },
};

const neutralBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--foreground)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "opacity 0.15s",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "#fff",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

export function ErrorState({
  variant = "generic",
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  cta,
  compact = false,
}: Props) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;
  const displayTitle = title ?? cfg.defaultTitle;
  const displayDesc = description ?? cfg.defaultDesc;

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <Icon
          style={
            {
              width: 14,
              height: 14,
              color: "var(--muted-foreground)",
              flexShrink: 0,
            } as React.CSSProperties
          }
        />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--foreground)" }}>
            {displayTitle}
          </span>
          {description && (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 6 }}>
              {displayDesc}
            </span>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} style={{ ...neutralBtn, padding: "4px 10px", fontSize: 11 }}>
            <RefreshCw style={{ width: 10, height: 10 } as React.CSSProperties} />
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
        minHeight: 200,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Icon
          style={{ width: 20, height: 20, color: "var(--muted-foreground)" } as React.CSSProperties}
        />
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--foreground)",
          marginBottom: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {displayTitle}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--muted-foreground)",
          lineHeight: 1.55,
          maxWidth: 320,
          marginBottom: 20,
        }}
      >
        {displayDesc}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={neutralBtn}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 } as React.CSSProperties} />
            {retryLabel}
          </button>
        )}
        {cta && (
          <Link to={cta.to} style={{ textDecoration: "none" }}>
            <button style={primaryBtn}>
              {cta.label} <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </Link>
        )}
        {(variant === "permission" || variant === "rate_limit") && !cta && (
          <Link to="/app/billing" style={{ textDecoration: "none" }}>
            <button style={primaryBtn}>
              Upgrade plan <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}
