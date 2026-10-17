/*
 * ReservationDrawer - `#reservation-drawer-layer` (prototype line 3000,
 * `openReservationDrawer`, `renderReservationDrawer`, `renderReservationContent`,
 * `bookingBreakdownMarkup`, `renderDayEventCard`): the right-hand drawer "Rezervační
 * centrum" for one day with the occupancy ring, the four-part breakdown
 * (club / individuals / held for the club / free), the 7-day release note and the
 * tabs Přehled dne / Rezervace / Klub.
 *
 * SHELL: the hidden layer; it mounts when `drawer` is set in the store. TO DO by the owner of
 * this file: render `reservationDrawerModel(ctx, drawer.date, catalogue.releaseDaysBefore)`
 * (`.rd-backdrop`, `aside.rd-panel` … see the prototype), the tabs (`act.setDrawerTab`), "Rozhraní klubu"
 * (-> `act.closeReservationDrawer()` + `act.openDialog({ kind: 'clubOccupancy', focusDate })`),
 * "Detail termínu" (-> `{ kind: 'eventDetail' | 'agendaDetail', id }`), and - only when
 * `catalogue.capabilities.simulateBookings` - the buttons "+ Klub" / "+ Jednotlivec" /
 * "Simulovat uvolnění" through `usePlannerCommands().addBooking / releaseDay`.
 * Esc closes it (store `escape`). Figures never come from the UI: `model/booking.ts`.
 */
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';

export function ReservationDrawer() {
  const drawer = usePlannerSelector((s) => s.drawer);
  const act = usePlannerActions();
  return (
    <div id="reservation-drawer-layer" className="reservation-drawer-layer" hidden={!drawer} data-testid="reservation-drawer">
      {drawer ? (
        <>
          <div className="rd-backdrop" data-drawer-close="true" onClick={() => act.closeReservationDrawer()} />
          <aside className="rd-panel" role="dialog" aria-modal="true" aria-label={`Rezervace a obsazenost dne ${drawer.date}`} data-testid="reservation-drawer-panel" />
        </>
      ) : null}
    </div>
  );
}
