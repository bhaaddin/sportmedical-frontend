/*
 * The open club inquiries as a day map for the board: club orders that block no time yet (Invited with offered days,
 * Requested with requested days). One read of the club orders, shared with the rest of the application through
 * react-query's cache; a failed read draws nothing (the calendar never waits for it, and an old backend without the
 * list simply has no marks).
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { clubOrdersApi } from '../../../api/clubOrders';
import { inquiriesByDay, type InquiryRef } from '../../model/inquiries';

const NONE: ReadonlyMap<string, InquiryRef[]> = new Map();

export function useInquiries(currentOrderId?: string | null, enabled = true): ReadonlyMap<string, InquiryRef[]> {
  const query = useQuery({
    queryKey: ['club-orders', 'inquiries'],
    queryFn: () => clubOrdersApi.list({}),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  return useMemo(() => (Array.isArray(data) ? inquiriesByDay(data, currentOrderId) : NONE), [data, currentOrderId]);
}
