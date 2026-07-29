// TASK-118 · Client-side analytics event tracking
// Tracks user events against Supabase usage_events via the log-activation-event edge function.
// All tracking is non-blocking (fire and forget).

import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEvent =
  | "page_view"
  | "tool_opened"
  | "tool_completed"
  | "operator_message_sent"
  | "mission_step_viewed"
  | "offer_copied"
  | "asset_viewed"
  | "billing_page_viewed"
  | "upgrade_clicked"
  | "resume_banner_clicked"
  | "rescue_action_used"
  | "onboarding_step_completed"
  | "dashboard_loaded";

interface TrackOptions {
  workspaceId?: string | null;
  properties?: Record<string, unknown>;
}

let _userId: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _userId = session?.user?.id ?? null;
});

supabase.auth.getSession().then(({ data }) => {
  _userId = data.session?.user?.id ?? null;
});

export function track(event: AnalyticsEvent, opts: TrackOptions = {}): void {
  if (!_userId) return;

  const supabaseUrl = (import.meta as { env: { VITE_SUPABASE_URL?: string } }).env
    .VITE_SUPABASE_URL;
  if (!supabaseUrl) return;

  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (!token) return;

    fetch(`${supabaseUrl}/functions/v1/log-activation-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        event_name: event,
        workspace_id: opts.workspaceId ?? null,
        properties: { ...opts.properties, _client: "web", _ts: Date.now() },
      }),
    }).catch(() => {});
  });
}

export function trackPageView(path: string, workspaceId?: string | null): void {
  track("page_view", { workspaceId, properties: { path } });
}

export function trackToolOpened(toolKey: string, workspaceId?: string | null): void {
  track("tool_opened", { workspaceId, properties: { tool_key: toolKey } });
}

export function trackToolCompleted(toolKey: string, workspaceId?: string | null): void {
  track("tool_completed", { workspaceId, properties: { tool_key: toolKey } });
}
