// Sprint 4 Low · Support contact widget
// Inline support form that submits a support request.

import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, CheckCircle2, Loader2 } from "lucide-react";

import { toast } from "sonner";

type Category = "bug" | "feature" | "billing" | "question" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "billing", label: "Billing issue" },
  { value: "question", label: "General question" },
  { value: "other", label: "Other" },
];

export function SupportWidget() {
  const [category, setCategory] = React.useState<Category>("question");
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const userEmail = session?.user?.email ?? null;

      if (userId) {
        await supabase.from("support_tickets").insert({
          user_id: userId,
          issue_summary: `[${category}] ${message.slice(0, 2000)}`,
          status: "open",
        });
      }

      setSubmitted(true);
      setMessage("");
    } catch {
      toast.error("Failed to send. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 14,
          border: "1px solid rgba(16,185,129,0.25)",
          background: "rgba(16,185,129,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 10,
        }}
      >
        <CheckCircle2 style={{ width: 28, height: 28, color: "#10b981" }} />
        <div>
          <div
            style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}
          >
            Message received
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
            We'll get back to you within 24 hours.
          </div>
        </div>
        <button
          onClick={() => setSubmitted(false)}
          style={{
            fontSize: 12,
            color: "var(--primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(59,130,246,0.15)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(59,130,246,0.08)",
        }}
      >
        <MessageSquare style={{ width: 14, height: 14, color: "var(--primary)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
          Contact support
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${category === c.value ? "var(--primary)" : "var(--border)"}`,
                background: category === c.value ? "rgba(59,130,246,0.12)" : "var(--surface-2)",
                color: category === c.value ? "var(--primary)" : "var(--muted-foreground)",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue or request..."
          rows={4}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(59,130,246,0.15)",
            background: "var(--surface-2)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.55,
          }}
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: message.trim()
              ? "linear-gradient(135deg, #0284c7, #38bdf8)"
              : "var(--surface-2)",
            color: message.trim() ? "#fff" : "var(--muted-foreground)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: loading || !message.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          {loading ? (
            <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
          ) : (
            <Send style={{ width: 13, height: 13 }} />
          )}
          Send message
        </button>
      </form>
    </div>
  );
}
