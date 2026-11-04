import Papa from "papaparse";
export const OUTCOME_TYPES = [
  "application_completed",
  "approved",
  "placed",
  "declined",
  "cancelled",
  "unknown",
] as const;
export type ImportedOutcome = {
  call_id: string;
  outcome: (typeof OUTCOME_TYPES)[number];
  occurred_at: string;
  source_reference: string;
};
export function parseOutcomeCsv(text: string): ImportedOutcome[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
  });
  if (result.errors.length) throw new Error(`CSV could not be parsed: ${result.errors[0].message}`);
  if (!["call_id", "outcome", "occurred_at"].every((h) => result.meta.fields?.includes(h)))
    throw new Error("CSV requires call_id, outcome and occurred_at columns.");
  if (!result.data.length || result.data.length > 500)
    throw new Error("Import 1-500 rows per file.");
  return result.data.map((row, i) => {
    if (!/^[0-9a-f-]{36}$/i.test(row.call_id?.trim()))
      throw new Error(`Row ${i + 2}: invalid call_id.`);
    if (!OUTCOME_TYPES.includes(row.outcome?.trim() as ImportedOutcome["outcome"]))
      throw new Error(`Row ${i + 2}: unsupported outcome.`);
    const raw = row.occurred_at?.trim(),
      date = new Date(raw);
    if (
      !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw) ||
      !Number.isFinite(date.getTime()) ||
      new Date(`${raw.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== raw.slice(0, 10)
    )
      throw new Error(`Row ${i + 2}: use an ISO date or timestamp.`);
    const reference = row.source_reference?.trim() ?? "";
    if (reference.length > 500) throw new Error(`Row ${i + 2}: source reference is too long.`);
    return {
      call_id: row.call_id.trim(),
      outcome: row.outcome.trim() as ImportedOutcome["outcome"],
      occurred_at: date.toISOString(),
      source_reference: reference,
    };
  });
}
