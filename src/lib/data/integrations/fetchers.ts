import { integrationsQuery, startIntegrationOAuth } from "@/lib/queries";
import { NotBuiltError } from "../core/errors";
import type { DeliveryChannelRow, FieldMappingRow } from "./map";

/** REAL — existing wrapper over user_integrations_masked (src/lib/queries.ts). */
export async function fetchIntegrations(userId: string) {
  const q = integrationsQuery(userId);
  return q.queryFn!({
    queryKey: q.queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  } as never);
}

/** REAL — existing OAuth start wrapper. Returns the provider redirect. */
export const connect = (key: string) => startIntegrationOAuth(key);

/** C-23 · delivery_channels */
export async function fetchDeliveryChannels(): Promise<DeliveryChannelRow[]> {
  throw new NotBuiltError("delivery_channels");
}
/** C-27 · integration_field_mappings */
export async function fetchFieldMappings(_key: string): Promise<FieldMappingRow[]> {
  throw new NotBuiltError("integration_field_mappings");
}
