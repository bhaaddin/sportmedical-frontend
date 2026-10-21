/*
 * "Vyžaduje pozornost" - the shelf at the top of the plocha. It reads the lists the application already loads (invoices,
 * today's bookings, club orders, the registration queue, the outgoing-queue health, the paperwork of today's patients),
 * hands them to the pure rules in `attention.ts` and draws one card per rule that has something in it. Every case on a card
 * is a link to the place that fixes it.
 *
 * A source the person may not see is not asked (no `billing.manage`, no invoices); a source that fails contributes nothing
 * and is SAID: an all-clear is never claimed for something that could not be looked at.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { billingApi } from '../../api/billing';
import type { DayAppointment } from '../../api/bookingContracts';
import client from '../../api/client';
import { clubOrdersApi } from '../../api/clubOrders';
import { documentsApi } from '../../api/documents';
import { fetchIntakeQueue } from '../../api/intakeReview';
import { usePermission } from '../../auth/usePermission';
import { readHealth } from '../../pages/systemHealthModel';
import { expiringSoon } from '../../pages/patients/paperworkStanding';
import { pragueDateKey } from '../../utils/time';
import { attentionGroups, attentionTotal, EXPIRING_PATIENT_LIMIT, type AttentionGroup, type ExpiringLike } from './attention';
import { PEEK_KEYS } from './peekKeys';
import { AttentionCard } from './ShelfCard';
import { Shelf } from './Shelf';

export interface AttentionState {
  groups: AttentionGroup[];
  total: number;
  /** A source is still on its way and nothing has been found yet. */
  loading: boolean;
  /** How many sources were asked and did not answer. */
  failed: number;
  retry: () => void;
}

export function useAttention(todayAppointments: readonly DayAppointment[] | null, patientNames: Readonly<Record<string, string>>): AttentionState {
  const mayBill = usePermission('billing.manage');
  const mayRegister = usePermission('patients.register');
  const mayAdmin = usePermission('settings.clinic.manage');
  const maySeePatients = usePermission('patients.view');

  /* The patients of today's bookings, soonest first, at most as many as the rule is allowed to ask about. */
  const todayPatients = useMemo(() => {
    const seen: string[] = [];
    for (const a of [...(todayAppointments ?? [])].sort((x, y) => x.startUtc.localeCompare(y.startUtc))) {
      if (a.patientId !== '' && !seen.includes(a.patientId)) seen.push(a.patientId);
      if (seen.length >= EXPIRING_PATIENT_LIMIT) break;
    }
    return seen;
  }, [todayAppointments]);

  const [invoices, orders, intake, health] = useQueries({
    queries: [
      { queryKey: PEEK_KEYS.invoices, queryFn: () => billingApi.getInvoices(), enabled: mayBill, staleTime: 60_000, retry: false },
      { queryKey: ['shelf', 'club-orders', 'Requested'], queryFn: () => clubOrdersApi.list({ status: 'Requested' }), staleTime: 60_000, retry: false },
      { queryKey: ['shelf', 'intake-queue'], queryFn: fetchIntakeQueue, enabled: mayRegister, staleTime: 60_000, retry: false },
      {
        queryKey: ['shelf', 'health'],
        queryFn: async () => readHealth((await client.get<unknown>('/api/system/health')).data),
        enabled: mayAdmin,
        staleTime: 60_000,
        retry: false,
      },
    ],
  });
  const checks = useQueries({
    queries: (maySeePatients ? todayPatients : []).map((id) => ({
      queryKey: ['documents', 'check', id],
      queryFn: () => documentsApi.checkRequired(id),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });

  const enabled = [mayBill, true, mayRegister, mayAdmin];
  const asked = [invoices, orders, intake, health].filter((_, i) => enabled[i]);
  const failed = asked.filter((r) => r.isError).length + checks.filter((r) => r.isError).length;
  const pending = asked.some((r) => r.isPending) || (todayAppointments === null);

  const expiring: ExpiringLike[] | null = useMemo(() => {
    if (!maySeePatients) return null;
    const rows: ExpiringLike[] = [];
    checks.forEach((r, i) => {
      const data = r.data;
      if (data === undefined) return;
      const patientId = todayPatients[i];
      for (const req of expiringSoon(data.requirements)) {
        if (typeof req.validUntil === 'string' && req.validUntil !== '') {
          rows.push({ patientId, patientName: patientNames[patientId] ?? '', documentName: req.templateName, validUntil: req.validUntil.slice(0, 10) });
        }
      }
    });
    /* A row without a name is not drawn: a card that says "Výpis platí do ..." about nobody tells the desk nothing. */
    return rows.filter((r) => r.patientName !== '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maySeePatients, todayPatients, patientNames, checks.map((r) => r.dataUpdatedAt).join(',')]);

  const today = pragueDateKey(new Date());
  const groups = useMemo(
    () => attentionGroups({
      now: new Date(),
      invoices: mayBill ? invoices.data ?? null : null,
      todayAppointments,
      patientNames,
      expiring,
      clubOrders: orders.data ?? null,
      intake: mayRegister ? intake.data ?? null : null,
      failedMessages: mayAdmin ? health.data?.outboxFailed ?? null : null,
    }),
    // `today` re-evaluates the rules when the Prague day turns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, mayBill, mayRegister, mayAdmin, invoices.data, orders.data, intake.data, health.data, todayAppointments, patientNames, expiring],
  );

  return {
    groups,
    total: attentionTotal(groups),
    loading: pending && groups.length === 0,
    failed,
    retry: () => [invoices, orders, intake, health, ...checks].forEach((r) => { if (r.isError) void r.refetch(); }),
  };
}

export function AttentionShelf({ state }: { state: AttentionState }) {
  const { groups, total, loading, failed, retry } = state;
  const clear = groups.length === 0 && !loading;
  return (
    <Shelf
      id="attention"
      title="Vyžaduje pozornost"
      hint={failed > 0 && groups.length > 0 ? `Část údajů se nenačetla (${failed})` : total > 0 ? 'Každý případ vede tam, kde se vyřeší' : undefined}
      count={total}
      countTone="red"
      layout="row"
      minCardWidth={320}
      cardHeight={188}
      skeletons={3}
      loading={loading}
      error={clear && failed > 0 ? 'Některé údaje se nepodařilo načíst, takže nevíme, jestli něco nečeká.' : false}
      onRetry={retry}
      empty={clear}
      emptyState={{ text: 'Vše vyřízeno. Nic nečeká na vaši pozornost.', action: { label: 'Dnešní přehled', to: '/dnes' } }}
    >
      {groups.map((g) => <AttentionCard key={g.id} group={g} />)}
    </Shelf>
  );
}
