import { useMutation } from "@tanstack/react-query";
import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { DATA_SOURCES, DELIVERY_CHANNELS, HUBSPOT_MAPPINGS } from "../mocks/collab";
import type { DataSource, DeliveryChannel, IntegrationDetail } from "../types";
import { connect, fetchDeliveryChannels, fetchFieldMappings, fetchIntegrations } from "./fetchers";
import { mapDeliveryChannel, mapFieldMapping, mapIntegration } from "./map";
import { integrationKeys } from "./queryKeys";
import { CHANNELS_SOURCE, SOURCE } from "./source";

/** X1, A8, H7. Bylda never writes to your CRM in V1 — read-only. */
export async function loadDataSources(ctx: DataCtx): Promise<DataSource[]> {
  if (resolveSource(SOURCE) === "mock") return DATA_SOURCES;
  return ((await fetchIntegrations(ctx.userId)) as Parameters<typeof mapIntegration>[0][]).map(
    mapIntegration,
  );
}
export async function loadDeliveryChannels(ctx: DataCtx): Promise<DeliveryChannel[]> {
  void ctx;
  return resolveSource(CHANNELS_SOURCE) === "mock"
    ? DELIVERY_CHANNELS
    : (await fetchDeliveryChannels()).map(mapDeliveryChannel);
}
export async function loadIntegrationDetail(
  ctx: DataCtx,
  key: string,
): Promise<IntegrationDetail | null> {
  const source = (await loadDataSources(ctx)).find((s) => s.key === key);
  if (!source) return null;
  // GAP: field mapping state — C-27
  const mappings =
    resolveSource(CHANNELS_SOURCE) === "mock"
      ? HUBSPOT_MAPPINGS
      : (await fetchFieldMappings(key)).map(mapFieldMapping);
  return { source, mappings };
}

export const useDataSources = () =>
  useCtxQuery(integrationKeys.sources(), loadDataSources, isEmptyArray);
export const useDeliveryChannels = () =>
  useCtxQuery(integrationKeys.channels(), loadDeliveryChannels, isEmptyArray);
export const useIntegrationDetail = (key: string) =>
  useCtxQuery(
    integrationKeys.detail(key),
    (ctx) => loadIntegrationDetail(ctx, key),
    (d) => d === null,
  );

/** X1/A8 "Connect" — starts OAuth via the existing wrapper; mock resolves to no redirect. */
export function useConnectSource() {
  return useMutation<unknown, Error, string>({
    mutationFn: async (key) => (resolveSource(SOURCE) === "mock" ? { url: null } : connect(key)),
  });
}
