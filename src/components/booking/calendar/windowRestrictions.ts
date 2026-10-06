/*
 * Etapa 10: which of a club's windows allow only some činnosti of their order. The calendar's block rows know
 * nothing about orders, so the phone window cards and the popover read it from the orders list (the same cached
 * query as the "Poptávka" chips): block id -> "Spiroergometrie".
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { clubOrdersApi, type ClubOrderView } from "../../../api/clubOrders";
import { orderWindows, windowActivityNames } from "../../clubs/orders/orderWindows";

/** Block id -> the činnosti its window is restricted to; windows that allow everything are not in the map. */
export function restrictedWindows(orders: readonly ClubOrderView[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const order of orders) {
    if (order.status !== "Confirmed") continue;
    for (const block of orderWindows(order)) {
      const only = windowActivityNames(block, order);
      if (only !== null) map.set(block.id, only);
    }
  }
  return map;
}

export function useWindowRestrictions(enabled = true): Map<string, string> {
  const query = useQuery({
    queryKey: ["club-orders", "inquiries"],
    queryFn: () => clubOrdersApi.list({}),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  return useMemo(() => (Array.isArray(data) ? restrictedWindows(data) : new Map<string, string>()), [data]);
}
