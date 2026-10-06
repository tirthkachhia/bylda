import type { ID, ISODate } from "./common";

/** X1 Data sources. Bylda never writes to your CRM in V1. */
export type DataSource = {
  key: string;
  name: string;
  category: "recorder" | "dialer" | "crm" | "meetings";
  status: "connected" | "disconnected" | "error" | "not_connected";
  lastSyncAt: ISODate | null;
  callsSynced: number;
  waiting: number;
  error: string | null;
};

/** X2 Delivery channels — separate from sources (V1 decision 5). */
export type DeliveryChannel = {
  key: "slack" | "teams" | "email" | "push";
  name: string;
  status: "connected" | "not_connected";
  destinations: string[];
};

/** X3 HubSpot mapping — read-only direction. */
export type FieldMapping = {
  byldaField: string;
  crmObject: string;
  crmField: string | null;
  direction: "read";
  required: boolean;
};
export type IntegrationDetail = { source: DataSource; mappings: FieldMapping[] };
