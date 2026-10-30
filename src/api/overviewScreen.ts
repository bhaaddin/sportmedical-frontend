/* The overview screen (NET-11): own module so the Přehled bundle does not carry the patient screen. See screens.ts for the rules. */
import type { QueryClient } from '@tanstack/react-query';
import client from './client';
import { dayAppointmentListSchema } from './bookingContracts';
import { toOrder } from './clubOrders';
import { withContacts, type Patient } from './patients';
import { attempt, dataOf, makeMemo, sectionsOf } from './screenCore';

export const overviewMemo = makeMemo('overview');

export const OVERVIEW_PERMISSION = 'patients.view';

export function overviewScreenBlocked(): boolean {
  return overviewMemo.blocked();
}

/**
 * Seeds the owner's Přehled keys (the week, the club orders asked for, the names of today's registered patients) from one
 * request. Resolves with whether anything was seeded; never rejects. The account and the notifications keep their own readers.
 */
export async function seedOverviewScreen(
  queryClient: QueryClient,
  range: { from: string; to: string; today: string },
  options: { weekKey: readonly unknown[]; mayViewPatients: boolean },
): Promise<boolean> {
  if (overviewMemo.blocked()) return false;
  try {
    const res = await client.get('/api/v1/screens/overview', { params: { from: range.from, to: range.to, today: range.today } });
    const sections = sectionsOf(res.data);
    if (sections === null) return false;
    let seeded = false;
    const week = attempt(() => {
      const raw = dataOf(sections.week);
      return raw === undefined ? undefined : dayAppointmentListSchema.parse(raw);
    });
    if (week !== undefined) {
      queryClient.setQueryData(options.weekKey, week);
      seeded = true;
    }
    if (options.mayViewPatients) {
      const orders = attempt(() => {
        const raw = dataOf(sections.clubOrders);
        return Array.isArray(raw) ? raw.map(toOrder) : undefined;
      });
      if (orders !== undefined) {
        queryClient.setQueryData(['shelf', 'club-orders', 'Requested'], orders);
        seeded = true;
      }
      const patients = attempt(() => {
        const raw = dataOf(sections.patients);
        return raw !== undefined && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
      });
      if (patients !== undefined) {
        for (const [id, dto] of Object.entries(patients)) {
          if (dto !== null && typeof dto === 'object' && (dto as { id?: unknown }).id === id) {
            queryClient.setQueryData(['patient', id], withContacts(dto as Patient));
          }
        }
      }
    }
    return seeded;
  } catch (error) {
    overviewMemo.learn(error);
    return false;
  }
}
