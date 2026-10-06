/*
 * "Poptávka": a club ORDER that does not block any time yet - Invited with offered days, Requested with the days
 * the club chose. The calendar draws those days as a light dashed chip so nothing is ever invisible; once the
 * desk confirms the order its blocks take over. Day-level only (the windows of a request are not drawn).
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { clubOrdersApi, type ClubOrderView } from "../../../api/clubOrders";
import { addDaysToDateOnly } from "../../../utils/time";
import { allowedNames } from "../../clubs/order/routing";
import { routedActivities } from "../../clubs/orders/orderWindows";

export interface InquiryRef {
  orderId: string;
  clubName: string;
  /** Invited: the days the desk offered; Requested: the days the club asked for. */
  kind: "offered" | "requested";
  /** The order the desk is processing right now: its days read "Klub žádá" instead of "Poptávka · club". */
  current: boolean;
  /** Etapa 10: the činnosti this day is asked for when the requested period is restricted ("Spiroergometrie"); null = all. */
  only?: string | null;
}

const MAX_RANGE_DAYS = 62;

/** The days one order asks for or offers (sorted, unique). Orders that already block time have none. */
export function inquiryDaysOf(order: Pick<ClubOrderView, "status" | "offeredDates" | "requestedDates" | "requestedRanges">): string[] {
  const days = new Set<string>();
  if (order.status === "Invited") {
    for (const d of order.offeredDates ?? []) days.add(d);
  } else if (order.status === "Requested") {
    for (const d of order.requestedDates ?? []) days.add(d);
    for (const r of order.requestedRanges ?? []) {
      if (!r.fromDate || r.toDate < r.fromDate) continue;
      let day = r.fromDate;
      for (let i = 0; i < MAX_RANGE_DAYS && day <= r.toDate; i += 1) {
        days.add(day);
        day = addDaysToDateOnly(day, 1);
      }
    }
  }
  return [...days].sort();
}

/** Per day of a Requested order: the činnosti its periods are restricted to, null when any period of the day allows all. */
function restrictionByDay(order: ClubOrderView): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (order.status !== "Requested") return out;
  const activities = routedActivities(order);
  for (const d of order.requestedDates ?? []) out.set(d, null);
  for (const r of order.requestedRanges ?? []) {
    if (!r.fromDate || r.toDate < r.fromDate) continue;
    const only = allowedNames(r.activityIds, activities);
    let day = r.fromDate;
    for (let i = 0; i < MAX_RANGE_DAYS && day <= r.toDate; i += 1) {
      const have = out.get(day);
      out.set(day, have === undefined ? only : have === null || only === null ? null : have.includes(only) ? have : `${have} + ${only}`);
      day = addDaysToDateOnly(day, 1);
    }
  }
  return out;
}

/** Every inquiry by day; `currentOrderId` marks the order being processed. */
export function inquiriesByDay(orders: readonly ClubOrderView[], currentOrderId?: string | null): Map<string, InquiryRef[]> {
  const map = new Map<string, InquiryRef[]>();
  for (const order of orders) {
    const kind = order.status === "Invited" ? "offered" : "requested";
    const restricted = restrictionByDay(order);
    for (const day of inquiryDaysOf(order)) {
      const list = map.get(day) ?? [];
      list.push({ orderId: order.id, clubName: order.clubName, kind, current: order.id === currentOrderId, only: restricted.get(day) ?? null });
      map.set(day, list);
    }
  }
  return map;
}

export const inquiryLabel = (inquiry: InquiryRef): string =>
  `${inquiry.current ? "Klub žádá" : `Poptávka · ${inquiry.clubName}`}${inquiry.only != null ? ` · ${inquiry.only}` : ""}`;
export const inquiryTitle = (inquiry: InquiryRef): string =>
  `${inquiry.clubName}: ${inquiry.kind === "offered" ? "nabídnuté dny, klub si ještě nevybral" : "klub žádá tyto dny, objednávka čeká na zpracování"}`;

/** The open inquiries (Invited with offered days, Requested with requested days) as a day map. A failed read draws nothing. */
export function useInquiries(currentOrderId?: string | null, enabled = true): Map<string, InquiryRef[]> {
  const query = useQuery({
    queryKey: ["club-orders", "inquiries"],
    queryFn: () => clubOrdersApi.list({}),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  return useMemo(() => (Array.isArray(data) ? inquiriesByDay(data, currentOrderId) : new Map<string, InquiryRef[]>()), [data, currentOrderId]);
}
