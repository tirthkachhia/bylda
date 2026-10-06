import { ForbiddenForRoleError } from "../core/errors";
import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray, never } from "../core/query";
import { resolveSource } from "../core/source";
import { INVOICES, PLAN, USAGE } from "../mocks/admin";
import type { Invoice, Plan, UsageMeter } from "../types";
import { fetchInvoices, fetchSubscription, fetchUsage } from "./fetchers";
import { mapInvoice, mapPlan, mapUsage } from "./map";
import { billingKeys } from "./queryKeys";
import { SOURCE } from "./source";

const ownerOnly = (ctx: DataCtx) => {
  if (ctx.role !== "owner" && ctx.role !== "admin")
    throw new ForbiddenForRoleError("billing", ctx.role);
};

export async function loadPlan(ctx: DataCtx): Promise<Plan> {
  ownerOnly(ctx);
  if (resolveSource(SOURCE) !== "mock" && !ctx.orgId)
    throw new Error("Select a workspace to view billing.");
  return resolveSource(SOURCE) === "mock" ? PLAN : mapPlan(await fetchSubscription(ctx.orgId!));
}
export async function loadInvoices(ctx: DataCtx): Promise<Invoice[]> {
  ownerOnly(ctx);
  if (resolveSource(SOURCE) !== "mock" && !ctx.orgId)
    throw new Error("Select a workspace to view billing.");
  return resolveSource(SOURCE) === "mock"
    ? INVOICES
    : ((await fetchInvoices(ctx.orgId!)).invoices ?? []).map(mapInvoice);
}
export async function loadUsage(ctx: DataCtx): Promise<UsageMeter[]> {
  ownerOnly(ctx);
  if (resolveSource(SOURCE) !== "mock" && !ctx.orgId)
    throw new Error("Select a workspace to view billing.");
  return resolveSource(SOURCE) === "mock" ? USAGE : mapUsage(await fetchUsage(ctx.orgId!));
}

export const usePlan = () => useCtxQuery(billingKeys.plan(), loadPlan, never);
export const useInvoices = () => useCtxQuery(billingKeys.invoices(), loadInvoices, isEmptyArray);
export const useUsage = () => useCtxQuery(billingKeys.usage(), loadUsage, isEmptyArray);
