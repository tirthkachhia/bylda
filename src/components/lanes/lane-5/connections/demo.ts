import { mocksForced, type DataSource, type DeliveryChannel, type FieldMapping } from "@/lib/data";

// GAP: temporary presentation fixtures for X1–X3; see LANE_REQUESTS #13.
// Never show Figma-only values against live integrations.
export const catalog = [
  {
    key: "zoom",
    name: "Zoom",
    category: "meetings",
    description: "Meeting recorder",
    detail: "486 calls · synced 4 min ago",
    status: "connected",
  },
  {
    key: "gong",
    name: "Gong",
    category: "recorder",
    description: "Recorder + transcripts",
    detail: "212 of 486 transcripts",
    status: "syncing",
  },
  {
    key: "aircall",
    name: "Aircall",
    category: "dialer",
    description: "Dialer",
    detail: "Token expired Sep 27 · 23 calls waiting",
    status: "error",
  },
  {
    key: "google_meet",
    name: "Google Meet",
    category: "meetings",
    description: "Meeting recorder",
    detail: "",
    status: "not_connected",
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "crm",
    description: "CRM",
    detail: "88 open opps · outcomes synced hourly",
    status: "connected",
  },
  {
    key: "salesforce",
    name: "Salesforce",
    category: "crm",
    description: "CRM",
    detail: "",
    status: "not_connected",
  },
  {
    key: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    description: "Upcoming calls for rep prep",
    detail: "9 reps",
    status: "connected",
  },
  {
    key: "manual_upload",
    name: "Manual upload",
    category: "files",
    description: "mp3, m4a, wav, mp4, vtt, txt",
    detail: "",
    status: "available",
  },
  {
    key: "csv_import",
    name: "CSV import",
    category: "files",
    description: "Deal outcomes for teams without CRM",
    detail: "",
    status: "available",
  },
];
export type SourceRow = (typeof catalog)[number];
export function sourceRows(sources: DataSource[]): SourceRow[] {
  if (mocksForced()) return catalog;
  return sources.map((s) => ({
    key: s.key,
    name: s.name,
    category: s.category,
    status: s.status,
    description: catalog.find((r) => r.key === s.key)?.description ?? s.category,
    detail:
      s.error ??
      (s.lastSyncAt
        ? `Last synced ${new Date(s.lastSyncAt).toLocaleString()}`
        : "No sync recorded"),
  }));
}
export const groups = [
  { label: "CALLS & MEETINGS", categories: ["meetings", "recorder", "dialer"] },
  { label: "CRM · OUTCOMES", categories: ["crm"] },
  { label: "CALENDAR", categories: ["calendar"] },
  { label: "FILES", categories: ["files"] },
];
export const health = [
  ["Calls in", "164 this week"],
  ["Analyzed", "158 · 96%"],
  ["Failed", "3 · mono audio"],
  ["Waiting", "23 · Aircall"],
  ["CRM match", "91% of calls linked to an opp"],
];
export const metrics = [
  { label: "OPPS SYNCED", value: "214", detail: "" },
  { label: "CALLS LINKED", value: "91%", detail: "442 of 486" },
  { label: "OUTCOMES", value: "19 won · 23 lost", detail: "" },
  { label: "UNMATCHED", value: "44 calls", detail: "no opp found" },
];
export const stages = [
  ["Discovery", "appointmentscheduled"],
  ["Demo", "qualifiedtobuy"],
  ["Pricing", "presentationscheduled"],
  ["Negotiation", "decisionmakerboughtin"],
  ["Closed", "closedwon · closedlost"],
];
const mappings = [
  { field: "Opportunity", property: "deal", example: "Acme Logistics — 3 sites", status: "Mapped" },
  { field: "Stage", property: "dealstage", example: "Negotiation", status: "Mapped" },
  { field: "Amount", property: "amount", example: "$48,000", status: "Mapped" },
  { field: "Outcome", property: "closed_won / closed_lost", example: "Open", status: "Mapped" },
  { field: "Loss reason", property: "closed_lost_reason", example: "—", status: "Pick field" },
  {
    field: "Account ↔ call",
    property: "contact email domain",
    example: "acmelogistics.com",
    status: "Auto",
  },
];
export function mappingRows(rows: FieldMapping[]) {
  return mocksForced()
    ? mappings
    : rows.map((r) => ({
        field: r.byldaField,
        property: r.crmField ?? "—",
        example: "—",
        status: r.crmField ? "Mapped" : "Pick field",
      }));
}
export function channelRows(rows: DeliveryChannel[]) {
  const order = ["email", "slack", "teams", "push"];
  const descriptions = {
    email: "Briefs and coaching notices",
    slack: "Post briefs & alerts to channels, DM reps their brief",
    teams: "Same as Slack",
    push: "iOS / Android app · P2",
  };
  const destinations = {
    email: "All users · default",
    slack: "acmerevenue.slack.com · 3 channels",
    teams: "",
    push: "",
  };
  return [...rows]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((r) => ({
      ...r,
      description: descriptions[r.key],
      destination: mocksForced() ? destinations[r.key] : r.destinations.join(" · "),
    }));
}
export const routing = [
  { name: "Daily Manager Brief", email: true, slack: "#sales-mgmt", inApp: true, push: false },
  { name: "Daily Rep Brief", email: true, slack: "DM to rep", inApp: true, push: false },
  { name: "Behavior regressions", email: false, slack: "#sales-mgmt", inApp: true, push: false },
  { name: "Coaching assigned", email: true, slack: "DM to rep", inApp: true, push: false },
  { name: "Weekly report", email: true, slack: "#daily-brief", inApp: true, push: false },
];
export const connection = "Connected Sep 12 by Kiran Patel · read-only · last sync 11 min ago";
export const unmatched =
  "44 calls have no opportunity. They still count for behavior analysis but are excluded from outcome associations.";
export const preview = {
  timestamp: "Bylda APP 7:30 AM",
  title: "Pricing is where your team is leaking. Coach Jordan first.",
  body: "Coach today: Jordan · Alex · Mia | 4 calls to review (26 min)",
};
