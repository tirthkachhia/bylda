export const CRM_NAMES: Record<string, string> = {
  gohighlevel: "GoHighLevel",
  close_io: "Close",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  pipedrive: "Pipedrive",
};
export function connectedCrmKeys(rows: Array<{ integration_key: string; status: string }>) {
  return [
    ...new Set(
      rows
        .filter(
          (row) => row.status === "connected" && Object.hasOwn(CRM_NAMES, row.integration_key),
        )
        .map((row) => row.integration_key),
    ),
  ];
}
export function sourceName(provider: string | null) {
  return provider
    ? (CRM_NAMES[provider] ??
        (provider === "manual_upload" ? "Audio upload" : provider.replaceAll("_", " ")))
    : "Unknown source";
}
