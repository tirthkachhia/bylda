type CallMemoryInput = {
  callId: string;
  provider?: string | null;
  startedAt?: string | null;
  disposition?: string | null;
  subject?: string | null;
  salesProfile: string;
  profileLabel: string;
  summary?: string | null;
  objections: string[];
  competitors: string[];
  nextSteps: string[];
  dealInsights: unknown;
  fields: unknown;
  complianceFlags: unknown;
  transcript: string;
};

function displayProvider(provider?: string | null) {
  if (!provider) return "Dialer";
  if (provider.toLowerCase() === "readymode") return "ReadyMode";
  return provider
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function section(label: string, value: unknown) {
  const emptyArray = Array.isArray(value) && value.length === 0;
  if (value == null || value === "" || emptyArray) return null;
  const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return `## ${label}\n${rendered}`;
}

export function buildCallMemoryArtifact(input: CallMemoryInput) {
  const provider = displayProvider(input.provider);
  const occurredAt = input.startedAt ? new Date(input.startedAt) : null;
  const validDate = occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : null;
  const dateLabel = validDate ? validDate.toISOString().slice(0, 10) : "recent call";
  const subject = input.subject?.trim() || "Unknown prospect";
  const title = `${provider} call — ${subject} — ${dateLabel}`;

  const content = [
    `# ${title}`,
    `Call ID: ${input.callId}`,
    `Sales profile: ${input.profileLabel} (${input.salesProfile})`,
    input.disposition ? `Disposition: ${input.disposition}` : null,
    section("Summary", input.summary),
    section("Objections", input.objections),
    section("Competitors", input.competitors),
    section("Next steps", input.nextSteps),
    section("Deal insights", input.dealInsights),
    section("Evidence-backed CRM fields", input.fields),
    section("Compliance flags", input.complianceFlags),
    section("Transcript", input.transcript.trim().slice(0, 24000)),
  ]
    .filter(Boolean)
    .join("\n\n");

  const previewParts = [
    input.summary,
    input.objections.length ? `Objections: ${input.objections.join("; ")}` : null,
    input.nextSteps.length ? `Next steps: ${input.nextSteps.join("; ")}` : null,
  ].filter(Boolean);

  return {
    title,
    sourceLabel: `${provider} calls`,
    content,
    contentPreview: previewParts.join(" | ").slice(0, 500) || input.transcript.trim().slice(0, 500),
    metadata: {
      call_id: input.callId,
      provider: input.provider ?? "unknown",
      started_at: input.startedAt ?? null,
      disposition: input.disposition ?? null,
      sales_profile: input.salesProfile,
      transcript_backed: true,
    },
  };
}
