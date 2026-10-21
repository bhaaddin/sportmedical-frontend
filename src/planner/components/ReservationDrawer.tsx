/*
 * ReservationDrawer - `#reservation-drawer-layer` (prototype `openReservationDrawer`,
 * `renderReservationDrawer`, `renderReservationContent`, `bookingBreakdownMarkup`, `renderDayEventCard`):
 * the right-hand drawer "Rezervační centrum" for one day with the occupancy ring, the four-part breakdown
 * (club / individuals / held for the club / free), the release note and the tabs Přehled dne / Rezervace / Klub.
 *
 * Figures come from `reservationDrawerModel` (`model/booking.ts`), the release rule from the catalogue
 * (`releaseDaysBefore`). On a source that can list the day's records (`dialogs/reservation/dayRecords.ts`) the
 * Rezervace tab also lists the real bookings and club windows by source, each row opening its record with its
 * price, and offers a new booking for that day. The demo-only controls of the prototype ("+ Klub",
 * "+ Jednotlivec", "Simulovat uvolnění") appear only when the source can simulate; a real source has no
 * "release the day" endpoint (the club's release rule is a setting), so there is none.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePlannerCommands } from '../data/usePlannerCommands';
import { plannerKeys } from '../data/PlannerDataSource';
import { usePlannerData } from '../data/PlannerDataProvider';
import { reservationDrawerModel, sourceFor, summariseDay, slotsText, countMark, type DrawerTab, type IsoDate, type PlannerSession } from '../model';
import { foldCards } from './dialogs/reservation/foldCards';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerCtx, usePlannerModelState } from './context';
import { BreakdownBlock, EventCard, RecordGroups } from './dialogs/reservation/DrawerParts';
import { groupDayRecords, useDayRecords } from './dialogs/reservation/dayRecords';
import { useRecordOpener } from './dialogs/reservation/useRecordOpener';
import './left/left.css';

const NewAppointmentDialog = lazy(() =>
  import('../../components/booking/NewAppointmentDialog').then((m) => ({ default: m.NewAppointmentDialog })),
);

const TABS: { value: DrawerTab; label: string }[] = [
  { value: 'overview', label: 'Přehled dne' },
  { value: 'bookings', label: 'Rezervace' },
  { value: 'club', label: 'Klub' },
];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ReservationDrawer() {
  const drawer = usePlannerSelector((s) => s.drawer);
  return (
    <div id="reservation-drawer-layer" className="reservation-drawer-layer" hidden={!drawer} data-testid="reservation-drawer">
      {drawer ? <DrawerBody date={drawer.date} tab={drawer.tab} /> : null}
    </div>
  );
}

function DrawerBody({ date, tab }: { date: IsoDate; tab: DrawerTab }) {
  const ctx = usePlannerCtx();
  const { catalogue, profile } = usePlannerModelState();
  const { source } = usePlannerData();
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const client = useQueryClient();
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [booking, setBooking] = useState(false);

  const releaseDays = catalogue?.releaseDaysBefore;
  const simulate = !!catalogue?.capabilities.simulateBookings;
  const model = reservationDrawerModel(ctx, date, releaseDays);
  const records = useDayRecords(date);
  const recordOpener = useRecordOpener({ onBeforeNavigate: () => act.closeReservationDrawer() });
  const clubMode = catalogue?.capabilities.mode ? catalogue.capabilities.mode === 'club' : ctx.demands.length > 0;
  const releaseNever = catalogue?.releaseNever === true;
  const mayBook = records.supported && catalogue?.capabilities.canBook !== false;
  const hasClubTerms = ctx.sessions.some((s) => sourceFor(s) === 'club');
  const clinic = (catalogue?.clinicName ?? '').trim();

  // Focus moves into the drawer and returns to what opened it.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const trapTab = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const openSessionDetail = (id: string) => {
    const session: PlannerSession | undefined = ctx.sessions.find((s) => s.id === id);
    act.closeReservationDrawer();
    act.openDialog({ kind: session && sourceFor(session) === 'public' ? 'eventDetail' : 'agendaDetail', id });
  };

  const simulateBooking = (id: string, kind: 'club' | 'public') => {
    commands.addBooking?.(id, kind)
      .then((result) => act.toast(result.message))
      .catch((error: unknown) => act.toast(error instanceof Error ? error.message : 'Rezervaci se nepodařilo přidat.'));
  };
  const simulateRelease = () => {
    commands.releaseDay?.(date)
      .then((result) => act.toast(result.message))
      .catch((error: unknown) => act.toast(error instanceof Error ? error.message : 'Uvolnění se nepodařilo provést.'));
  };

  const groups = records.records ? groupDayRecords(records.records) : [];
  const clubWindows = groups.filter((g) => g.id === 'clubWindows');
  /* A činnost's individual bookings are ONE card / one timing row (reviewer 2.2). */
  const cards = foldCards(ctx, model.cards);
  const daySummary = summariseDay(ctx, ctx.sessions, date);
  const confirmedPct = model.confirmedPercent;

  return (
    <>
      <div className="rd-backdrop" data-drawer-close="true" onClick={() => act.closeReservationDrawer()} />
      <aside
        ref={panelRef}
        className="rd-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Rezervace a obsazenost dne ${date}`}
        data-testid="reservation-drawer-panel"
        data-date={date}
        onKeyDown={trapTab}
      >
        <div className="rd-top-sheen" />
        <header className="rd-head">
          <div className="rd-eyebrow"><i className="rd-pulse" /> {clinic ? `${clinic.toLocaleUpperCase('cs-CZ')} · ` : ''}REZERVAČNÍ CENTRUM</div>
          <button ref={closeRef} className="rd-close" type="button" data-drawer-close="true" aria-label="Zavřít" onClick={() => act.closeReservationDrawer()}>
            <Icon name="close" />
          </button>
          <div className="rd-title-row">
            <div>
              <h2>{model.title}</h2>
              <p>Detail naplánovaného dne · klubové i veřejné termíny</p>
            </div>
          </div>
          {simulate ? <span className="rd-demo-tag">✦ INTERAKTIVNÍ UKÁZKA · SIMULOVANÉ REZERVACE</span> : null}
        </header>
        <div className="rd-body">
          <div className="rd-hero">
            <div className="rd-ring" style={{ '--rd-pct': `${confirmedPct}%` } as CSSProperties}>
              <span><strong>{confirmedPct}%</strong><small>potvrzeno</small></span>
            </div>
            <div className="rd-hero-copy">
              <div className="rd-head-stat">SKUTEČNÁ OBSAZENOST{simulate ? ' · DEMO' : ''}</div>
              <strong className="rd-big">{model.summary.confirmed} <span>/ {model.summary.slots} míst</span></strong>
              <p>{model.heroText}</p>
            </div>
          </div>
          <div className="rd-section-title">STAV JEDNOTLIVÝCH SLOTŮ <em>JEDEN SPOLEČNÝ REZERVAČNÍ SYSTÉM</em></div>
          <BreakdownBlock parts={model.breakdown} />
          <div className="rd-release">
            <Icon name="unlock" />
            <div>
              <b>Automatické uvolňování klubových míst</b>
              {releaseNever ? (
                <small>Neobsazená klubová místa se automaticky neuvolňují - klub je drží, dokud je nepustí ruční úpravou objednávky. Termíny a prstenec se nemění.</small>
              ) : (
                <small>
                  {model.release.before}
                  {model.release.pending ? <b>{model.release.cutoffLabel}</b> : null}
                  {model.release.after}
                </small>
              )}
            </div>
          </div>
          <div className="rd-tabs" role="tablist" aria-label="Obsah dne">
            {TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={tab === t.value} data-drawer-tab={t.value} className={tab === t.value ? 'active' : undefined} onClick={() => act.setDrawerTab(t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'club' ? (
            clubMode ? (
              <>
                <div className="rd-section-title">PROFIL KLUBU <em>PROPOJENÝ S PLÁNEM</em></div>
                <div className="rd-profile">
                  {[
                    ['Klub', profile?.clubName], ['IČO', profile?.ico], ['Adresa', profile?.address],
                    ['Vedení klubu', profile?.leaderName], ['Kontaktní osoba', profile?.contactName],
                    ['Telefon', profile?.contactPhone], ['E-mail', profile?.contactEmail], ['DIČ', profile?.dic],
                  ].map(([label, value]) => (
                    <div className="rd-profile-item" key={label}><span>{label}</span><b>{value ? value : '—'}</b></div>
                  ))}
                </div>
                <button className="rd-optional-action" data-drawer-profile onClick={() => { act.closeReservationDrawer(); act.openDialog({ kind: 'clubDetails' }); }}>
                  Upravit / doplnit údaje klubu →
                </button>
                {simulate ? <div className="rd-note">Tato karta je součástí interaktivního prototypu. Produkční přechod do klubového rozhraní se napojí na příslušné ID klubu a termínu.</div> : null}
              </>
            ) : clubWindows.length > 0 ? (
              <RecordGroups groups={clubWindows} onOpen={recordOpener.open} />
            ) : (
              <div className="rd-empty">V tento den nemá žádný klub rezervované okno.</div>
            )
          ) : cards.length === 0 ? (
            <div className="rd-empty">
              {records.supported
                ? 'V tento den zatím nejsou žádné rezervace ani klubová okna.'
                : 'Pro tento den zatím nejsou vytvořené žádné termíny. V mini kalendáři proto zůstává den bez barevného označení.'}
            </div>
          ) : tab === 'bookings' ? (
            <>
              <div className="rd-section-title">REZERVACE A KAPACITA TERMÍNŮ <em>{cards.length} TERMÍNŮ</em></div>
              <div className="rd-event-list">
                {cards.map((card) => (
                  <EventCard
                    key={card.id}
                    card={card}
                    actions={card.folded ? undefined : {
                      onDetail: () => openSessionDetail(card.id),
                      simulate: simulate ? { onClub: () => simulateBooking(card.id, 'club'), onPublic: () => simulateBooking(card.id, 'public') } : undefined,
                    }}
                  />
                ))}
              </div>
              {simulate ? <div className="rd-note">DEMO: tlačítka + Klub a + Jednotlivec upravují simulované rezervace. Ve skutečném systému by šlo o potvrzení rezervace až po serverové kontrole volného slotu.</div> : null}
              {groups.length > 0 ? <RecordGroups groups={groups} onOpen={recordOpener.open} /> : null}
              {records.supported && records.records?.length === 0 ? (
                <div className="rd-note">V tento den zatím nejsou žádné rezervace ani klubová okna.</div>
              ) : null}
            </>
          ) : (
            <>
              <div className="rd-section-title">NAČASOVÁNÍ DNE <em>{model.plannedLabel.toLocaleUpperCase('cs-CZ')} NAPLÁNOVÁNO</em></div>
              {model.timing.map((row) => {
                /* the činnost's slots by the summaries' one rule (people of the bookings, capacity of the windows) */
                const summed = daySummary.groups.find((g) => g.categoryId === row.categoryId);
                return (
                  <div className="rd-mini-grid" key={row.categoryId}>
                    <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8 }} />{row.name}{summed ? <b data-testid="rd-timing-count">{countMark(summed) ? ` ${countMark(summed)}` : ''}</b> : null}</span>
                      <strong>{row.duration} · {summed ? slotsText(summed.slots) : row.slotsLabel}</strong>
                    </div>
                  </div>
                );
              })}
              <div className="rd-section-title">TERMÍNY <em>PLÁN + REZERVACE</em></div>
              <div className="rd-event-list">
                {cards.map((card) => <EventCard key={card.id} card={card} />)}
              </div>
            </>
          )}

          {tab === 'bookings' && simulate && model.hasPendingHold && commands.releaseDay ? (
            <button className="rd-optional-action" data-demo-release={date} onClick={simulateRelease}>
              ⚡ Simulovat uvolnění blokací {releaseDays ?? 7} dní předem →
            </button>
          ) : null}
          {tab === 'overview' && cards.length > 0 ? (
            <button className="rd-optional-action" data-drawer-tab="bookings" onClick={() => act.setDrawerTab('bookings')}>
              {simulate ? 'Otevřít jednotlivé rezervace a simulaci →' : 'Otevřít jednotlivé rezervace →'}
            </button>
          ) : null}
          {tab === 'bookings' && mayBook ? (
            <div className="rd-day-actions">
              <button type="button" className="rd-optional-action" data-drawer-new-booking onClick={() => setBooking(true)}>
                + Nová rezervace na tento den
              </button>
            </div>
          ) : null}
        </div>
        <footer className="rd-footer">
          <button data-drawer-close="true" onClick={() => act.closeReservationDrawer()}>← Zpět do plánovače</button>
          {clubMode || hasClubTerms ? (
            <button className="primary" data-drawer-club-overview="true" onClick={() => { act.closeReservationDrawer(); act.openDialog({ kind: 'clubOccupancy', focusDate: date }); }}>
              Rozhraní klubu <Icon name="arrow-up-right" />
            </button>
          ) : null}
        </footer>
      </aside>
      {recordOpener.detail}
      {booking ? (
        <Suspense fallback={null}>
          <NewAppointmentDialog
            open
            initialDate={date}
            onClose={() => setBooking(false)}
            onBooked={() => void client.invalidateQueries({ queryKey: plannerKeys.all(source.id) })}
          />
        </Suspense>
      ) : null}
    </>
  );
}
