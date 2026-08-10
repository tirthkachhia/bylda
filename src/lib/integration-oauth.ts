export const OAUTH_PROVIDER_BY_INTEGRATION: Record<string, string> = {
  hubspot: "HubSpot",
  gohighlevel: "GoHighLevel",
  salesforce: "Salesforce",
  stripe: "Stripe",
  paypal: "PayPal",
  mailchimp: "Mailchimp",
  github: "GitHub",
  shopify: "Shopify",
  jira: "Jira",
  asana: "Asana",
  googleanalytics: "Google",
  airtable: "Airtable",
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

export const CREDENTIAL_PROVIDER_BY_INTEGRATION: Record<
  string,
  { name: string; placeholder: string; inputType?: "password" | "url" }
> = {
  openai: { name: "OpenAI", placeholder: "sk-..." },
  anthropic: { name: "Anthropic", placeholder: "sk-ant-..." },
  zapier: {
    name: "Zapier",
    placeholder: "https://hooks.zapier.com/hooks/catch/...",
    inputType: "url",
  },
  sendgrid: { name: "SendGrid", placeholder: "SG...." },
};

export function credentialProvider(integrationKey: string) {
  return CREDENTIAL_PROVIDER_BY_INTEGRATION[integrationKey] ?? null;
}
