import type { ID, ISODate } from "./common";

/** 13 Search — never answers from memory: the question becomes editable filter chips. */
export type SearchFilter = {
  field: "rep" | "behavior" | "objection" | "outcome" | "stage" | "account" | "date" | "text";
  value: string;
  label: string;
};

export type SearchResult = {
  callId: ID;
  title: string;
  repName: string;
  startedAt: ISODate;
  snippet: string;
  timestamp: string | null;
  matched: SearchFilter["field"][];
};

export type SearchResponse = {
  query: string;
  filters: SearchFilter[];
  results: SearchResult[];
  windowDays: number;
};

export type PaletteItem = {
  id: ID;
  kind: "call" | "person" | "behavior" | "pattern" | "coaching" | "report" | "room" | "action";
  label: string;
  hint: string | null;
  href: string;
};
