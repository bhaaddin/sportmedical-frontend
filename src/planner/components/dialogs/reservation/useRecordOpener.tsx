/*
 * Opening the record a row of the reservation drawer stands for - the same destinations the calendar uses:
 *
 *   booking (appointment)  -> `AppointmentDetail`, the dialog the grid opens on a click on a card;
 *   club window with order -> the club order ("Otevřít objednávku" of `ClubBlockPopover`), /clubs/objednavky;
 *   club window, legacy    -> the club block on /clubs (router state `{ clubBlockId, clubId }`).
 *
 * The appointment detail with its API clients is loaded when the first row is opened, so the planner bundle
 * stays light. The calendar the booking belongs to (name, colour) comes from the source when it can list them.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useCallback, useState, type ReactNode } from 'react';
import { useInRouterContext, useNavigate, type NavigateFunction } from 'react-router-dom';
import { clubBlocksApi } from '../../../../api/clubBlocks';
import { usePlannerData } from '../../../data/PlannerDataProvider';
import { plannerKeys } from '../../../data/PlannerDataSource';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import type { DayRecord, DayRecordRef } from './dayRecords';

const AppointmentDetail = lazy(() =>
  import('../../../../components/booking/AppointmentDetail').then((m) => ({ default: m.AppointmentDetail })),
);

/** `useNavigate` when the planner sits in a router (always in the app); null in an isolated test. */
function useOptionalNavigate(): NavigateFunction | null {
  const inRouter = useInRouterContext();
  // `inRouter` never changes for a mounted component, so the hook order is stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return inRouter ? useNavigate() : null;
}

export interface RecordOpener {
  open: (record: DayRecord) => void;
  /** Render this once, next to the rows: the appointment detail while one is open. */
  detail: ReactNode;
}

export function useRecordOpener(options: { onBeforeNavigate?: () => void } = {}): RecordOpener {
  const act = usePlannerActions();
  const { source } = usePlannerData();
  const client = useQueryClient();
  const navigate = useOptionalNavigate();
  const [appointment, setAppointment] = useState<Extract<DayRecordRef, { type: 'appointment' }> | null>(null);
  const { onBeforeNavigate } = options;

  const calendars = useQuery({
    queryKey: [...plannerKeys.all(source.id), 'calendars'],
    queryFn: () => (source.getCalendars as NonNullable<typeof source.getCalendars>)(),
    enabled: typeof source.getCalendars === 'function' && appointment !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const openClub = useCallback(
    async (ref: Extract<DayRecordRef, { type: 'clubWindow' }>) => {
      if (!navigate) {
        act.toast('Klubové okno lze otevřít jen v aplikaci.');
        return;
      }
      let orderId = ref.clubOrderId;
      if (!orderId && ref.clubBlockId) {
        try {
          orderId = (await clubBlocksApi.get(ref.clubBlockId)).clubOrderId ?? null;
        } catch {
          orderId = null;
        }
      }
      onBeforeNavigate?.();
      if (orderId) navigate('/clubs/objednavky', { state: { openOrderId: orderId } });
      else if (ref.clubBlockId) {
        navigate('/clubs', { state: { clubBlockId: ref.clubBlockId, ...(ref.clubId ? { clubId: ref.clubId } : {}) } });
      }
    },
    [act, navigate, onBeforeNavigate],
  );

  const open = useCallback(
    (record: DayRecord) => {
      const ref = record.ref;
      if (ref.type === 'appointment') setAppointment(ref);
      else void openClub(ref);
    },
    [openClub],
  );

  const calendar = appointment ? calendars.data?.find((c) => c.id === appointment.calendarId) : undefined;
  const detail: ReactNode = appointment ? (
    <Suspense fallback={null}>
      <AppointmentDetail
        appointmentId={appointment.appointmentId}
        calendarId={appointment.calendarId}
        calendar={calendar ? { id: calendar.id, name: calendar.name, color: calendar.color } : undefined}
        open
        onClose={() => setAppointment(null)}
        onChanged={() => void client.invalidateQueries({ queryKey: plannerKeys.all(source.id) })}
      />
    </Suspense>
  ) : null;

  return { open, detail };
}
