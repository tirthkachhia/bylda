export function checkedDeliveryUrl(
  kind: string,
  value: string,
  allowedHosts: string[] = [],
): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new Error("Use an HTTPS endpoint without credentials or a fragment.");
  const host = url.hostname.toLowerCase();
  const allowed =
    kind === "slack"
      ? host === "hooks.slack.com" || host === "hooks.slack-gov.com"
      : kind === "teams"
        ? host.endsWith(".api.powerplatform.com") ||
          host.endsWith(".logic.azure.com") ||
          host.endsWith(".webhook.office.com")
        : allowedHosts.includes(host);
  if (!allowed)
    throw new Error(
      kind === "webhook"
        ? "This webhook host must be configured in COACHING_WEBHOOK_ALLOWED_HOSTS on the server."
        : "Use an official incoming webhook endpoint for this provider.",
    );
  return url.toString();
}
