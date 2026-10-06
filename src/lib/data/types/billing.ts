import type { ID, ISODate } from "./common";

export type Plan = {
  tier: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  periodEnd: ISODate | null;
  seats: number | null;
  seatsUsed: number;
  cancelAtPeriodEnd: boolean;
};
export type Invoice = {
  id: ID;
  number: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedAt: ISODate;
  url: string | null;
};
export type UsageMeter = {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  period: string;
};
