import type { DataSource, DeliveryChannel, FieldMapping } from "../types";

const CATALOG: Record<string, { name: string; category: DataSource["category"] }> = {
  zoom: { name: "Zoom", category: "meetings" },
  gong: { name: "Gong", category: "recorder" },
  aircall: { name: "Aircall", category: "dialer" },
  readymode: { name: "ReadyMode", category: "dialer" },
  hubspot: { name: "HubSpot", category: "crm" },
  salesforce: { name: "Salesforce", category: "crm" },
  gohighlevel: { name: "GoHighLevel", category: "crm" },
  google: { name: "Google Meet", category: "meetings" },
  microsoft: { name: "Microsoft Teams", category: "meetings" },
};

/** Today's user_integrations_masked row → DataSource. */
export function mapIntegration(r: {
  integration_key: string;
  is_connected: boolean;
  status: string;
  updated_at: string;
}): DataSource {
  const c = CATALOG[r.integration_key] ?? { name: r.integration_key, category: "crm" as const };
  return {
    key: r.integration_key,
    name: c.name,
    category: c.category,
    status: r.is_connected ? "connected" : r.status === "error" ? "error" : "disconnected",
    lastSyncAt: r.updated_at,
    // GAP: calls synced / waiting backlog — C-23b (integration_sync_stats)
    callsSynced: 0,
    waiting: 0,
    error: r.status === "error" ? "Reconnect required." : null,
  };
}

/** C-23 · proposed delivery_channels row */
export type DeliveryChannelRow = {
  organization_id: string;
  key: DeliveryChannel["key"];
  name: string;
  status: DeliveryChannel["status"];
  destinations: string[];
};
export const mapDeliveryChannel = (r: DeliveryChannelRow): DeliveryChannel => ({
  key: r.key,
  name: r.name,
  status: r.status,
  destinations: r.destinations ?? [],
});

/** C-27 · proposed integration_field_mappings row (read-only direction in V1). */
export type FieldMappingRow = {
  organization_id: string;
  integration_key: string;
  bylda_field: string;
  crm_object: string;
  crm_field: string | null;
  required: boolean;
};
export const mapFieldMapping = (r: FieldMappingRow): FieldMapping => ({
  byldaField: r.bylda_field,
  crmObject: r.crm_object,
  crmField: r.crm_field,
  direction: "read",
  required: r.required,
});

/** C-20 · proposed v_integration_sources row (today's masked row + sync stats). */
export type IntegrationSourceRow = {
  integration_key: string;
  name: string;
  category: DataSource["category"];
  status: DataSource["status"];
  last_sync_at: string | null;
  calls_synced: number;
  waiting: number;
  last_error: string | null;
};
export const mapIntegrationSource = (r: IntegrationSourceRow): DataSource => ({
  key: r.integration_key,
  name: r.name,
  category: r.category,
  status: r.status,
  lastSyncAt: r.last_sync_at,
  callsSynced: r.calls_synced,
  waiting: r.waiting,
  error: r.last_error,
});
