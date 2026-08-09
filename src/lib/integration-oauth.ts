export const OAUTH_PROVIDER_BY_INTEGRATION: Record<string, string> = {
  hubspot: "HubSpot",
  gohighlevel: "GoHighLevel",
  salesforce: "Salesforce",
  pipedrive: "Pipedrive",
  close_io: "Close",
  slack: "Slack",
  googlesheets: "Google",
  googledrive: "Google",
  google_calendar: "Google",
  youtube_api: "Google",
  onedrive: "Microsoft",
  outlook_cal: "Microsoft",
  notion: "Notion",
  zoom: "Zoom",
  calendly: "Calendly",
  xero: "Xero",
};

export function oauthProviderName(integrationKey: string) {
  return OAUTH_PROVIDER_BY_INTEGRATION[integrationKey] ?? null;
}
