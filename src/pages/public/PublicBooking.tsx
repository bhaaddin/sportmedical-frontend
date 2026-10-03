/* ══════════════════════════════════════════════════════════════
   OBJEDNÁNÍ ONLINE  (route: /objednat — artboard V-Rezervace)

   Booking and nothing else: the clinic's pages (who we are, prices, documents,
   the club offer, contacts) live on the prerendered site under /web. Three
   steps — Služba, Termín, Vaše údaje — where the third is the registration
   (/dotaznik), reached through "Pokračovat".

   ── What comes from where ──

   Services, prices, durations and the clinic's own notes: /api/public/booking/offer
   (the admin's calendars). Nothing on this page lists a service the owner has
   not marked publicly bookable. The address in the summary is the clinic's, from
   /api/public/clinic. No text, price or deadline is written here.

   ── Hold, then register ──

   Picking a time only selects it; "Pokračovat" holds it and goes on to the
   registration with a minute's typing still ahead, rather than telling the
   patient at the end that somebody else got there first. A refusal comes now.

   ── Three layouts ──

   Desktop: the artboard — a column per day beside the summary. iPad: the same
   week as a day list beside the summary. Phone: one column, the summary under
   the times and "Pokračovat" pinned at the bottom of the screen.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import {
  SlotGoneError, bookableOffer, freeDays, freeSlots, holdSlot, rememberHeld,
} from '../../api/publicBooking';
import type { BookableActivity, BookableService, BookableSlot } from '../../api/publicBooking';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import { useDevice } from '../../layout/useDevice';
import PublicLayout from './PublicLayout';
import {
  ARCHIVO, BRAND, clinicDate, clinicTime, czk, telHref,
} from '../../components/public/brand';
import {
  LABEL_COLOR, LoadError, Panel, PanelTitle, PageTitle, PinnedBar, PublicMain, Steps, FieldLabel,
  ctaSx, ghostSx, shortDate,
} from '../../components/public/kit';
import ServiceGroup, { minuteWord, priceLine } from './booking/ServiceGroup';
import { useSlotTexts } from '../../site/useSlotTexts';
import { fillText } from '../../site/fillText';
import SlotPicker from './booking/SlotPicker';
import type { DaySlots } from './booking/SlotPicker';
import { addDays, isoOf, mondayOf, weekOf } from './booking/weekGrid';

/** How far ahead the day list asks. The calendar's own horizon still applies. */
const HORIZON_DAYS = 60;

/** ". Zavolejte nám prosím na 123" (the lead is an editable text) — or nothing at all when there is no number. */
function ringUs(clinic: PublicClinic | null, lead: string): string {
  const phone = clinic?.phone.trim() ?? '';
  return phone === '' ? '' : `. ${lead} ${phone}`;
}

/** The editable wording of this page (registry: src/site/slots/formulare.ts). */
const BOOKING_TEXT_KEYS = [
  'formulare.booking.call-us', 'formulare.booking.closed.title', 'formulare.booking.closed.with-phone',
  'formulare.booking.closed.no-phone', 'formulare.booking.pick-time', 'formulare.booking.no-slots',
] as const;

type Chosen = { service: BookableService; activity: BookableActivity };
type Picked = { slot: BookableSlot; day: string };

function Waiting({ text }: { text: string }) {
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: LABEL_COLOR }}>
      <CircularProgress size={18} sx={{ color: BRAND.accent }} />
      <Typography sx={{ fontSize: 14 }}>{text}</Typography>
    </Box>
  );
}

export default function PublicBooking() {
  const navigate = useNavigate();
  const device = useDevice();

  const [services, setServices] = useState<BookableService[] | null>(null);
  const [offerFailed, setOfferFailed] = useState(false);
  const [offerAttempt, setOfferAttempt] = useState(0);

  /* The clinic's telephone, e-mail and address, from the admin's own settings.
     Null while loading, empty when nobody has filled it in — both mean "say
     nothing" rather than invent one. */
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const txt = useSlotTexts(BOOKING_TEXT_KEYS);

  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [days, setDays] = useState<string[] | null>(null);
  const [monday, setMonday] = useState<string | null>(null);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, DaySlots | undefined>>({});
  const [picked, setPicked] = useState<Picked | null>(null);
  const [holding, setHolding] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);

  /* Answers for a činnost that has since been replaced must never land. */
  const generation = useRef(0);
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    setOfferFailed(false);

    bookableOffer()
      .then((offer) => { if (!cancelled) setServices(offer); })
      .catch(() => { if (!cancelled) setOfferFailed(true); });

    // Never throws; a missing telephone number must not cost the patient the page.
    void readPublicClinic().then((details) => { if (!cancelled) setClinic(details); });

    return () => { cancelled = true; };
  }, [offerAttempt]);

  /* Days for the chosen činnost. Cleared first, so a slow answer for the
     previous choice can never land under the new one. */
  useEffect(() => {
    generation.current += 1;
    requested.current = new Set();
    setDays(null);
    setMonday(null);
    setSlotsByDay({});
    setPicked(null);
    if (chosen === null) return undefined;

    const mine = generation.current;
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + HORIZON_DAYS);

    freeDays(chosen.activity.calendarId, chosen.activity.id, isoOf(from), isoOf(to))
      .then((free) => {
        if (generation.current !== mine) return;
        const sorted = [...free].sort();
        setDays(sorted);
        if (sorted.length > 0) setMonday(mondayOf(sorted[0]));
      })
      .catch(() => { if (generation.current === mine) setDays([]); });

    return () => { generation.current += 1; };
  }, [chosen]);

  const freeSet = useMemo(() => new Set(days ?? []), [days]);

  /* The free times of the week on screen: one request per free day, once. */
  const loadDay = useCallback((day: string, force = false): void => {
    if (chosen === null) return;
    const key = `${generation.current}:${day}`;
    if (!force && requested.current.has(key)) return;
    requested.current.add(key);

    const mine = generation.current;
    freeSlots(chosen.activity.calendarId, chosen.activity.id, day)
      .then((list) => { if (generation.current === mine) setSlotsByDay((prev) => ({ ...prev, [day]: list })); })
      .catch(() => { if (generation.current === mine) setSlotsByDay((prev) => ({ ...prev, [day]: 'error' })); });
  }, [chosen]);

  useEffect(() => {
    if (monday === null || days === null) return;
    weekOf(monday).filter((d) => freeSet.has(d)).forEach((d) => loadDay(d));
  }, [monday, days, freeSet, loadDay]);

  const choose = (service: BookableService, activity: BookableActivity): void => {
    setChosen({ service, activity });
    setComplaint(null);
    // The booking opens at the top of the page, not wherever the card was.
    document.documentElement.scrollTop = 0;
  };

  const firstFree = days !== null && days.length > 0 ? days[0] : null;
  const lastFree = days !== null && days.length > 0 ? days[days.length - 1] : null;
  const canPrev = monday !== null && firstFree !== null && monday > mondayOf(firstFree);
  const canNext = monday !== null && lastFree !== null && addDays(monday, 7) <= lastFree;
  const moveWeek = (delta: -1 | 1): void => {
    if (monday === null) return;
    setMonday(addDays(monday, delta * 7));
  };

  /**
   * Hold the slot, then go to the registration. The hold happens BEFORE the
   * form: the time is theirs while they type, and a refusal comes now, while
   * they have typed nothing.
   */
  const proceed = async (): Promise<void> => {
    if (chosen === null || picked === null || holding) return;

    setHolding(true);
    setComplaint(null);

    try {
      const held = await holdSlot(chosen.activity.calendarId, chosen.activity.id, picked.slot.startUtc);

      rememberHeld({
        token: held.token,
        startUtc: held.startUtc,
        endUtc: held.endUtc,
        expiresAtUtc: held.expiresAtUtc,
        serviceName: chosen.service.name,
        activityName: chosen.activity.name,
        activityId: chosen.activity.id,
        calendarId: chosen.activity.calendarId,
        requiresReportByEmail: chosen.activity.requiresReportByEmail,
        requiresClubSharing: chosen.activity.requiresClubSharing,
        questionnaireRequirement: chosen.activity.questionnaireRequirement,
      });

      navigate('/dotaznik');
    } catch (error) {
      setHolding(false);

      if (error instanceof SlotGoneError) {
        setComplaint(error.message);
        setPicked(null);
        // Ask again rather than leaving a dead time on screen.
        loadDay(picked.day, true);
        return;
      }

      setComplaint('Termín se nepodařilo rezervovat. Zkuste to prosím znovu.');
    }
  };

  const nothingOffered = services !== null && services.length === 0;
  const phone = clinic?.phone.trim() ?? '';
  const address = clinic?.address.trim() ?? '';
  const activity = chosen?.activity ?? null;
  const hold = activity === null ? null : minuteWord(activity.holdMinutes);

  const cta = (
    <Button
      variant="contained"
      disabled={picked === null || holding}
      onClick={() => { void proceed(); }}
      startIcon={holding ? <CircularProgress size={18} color="inherit" /> : undefined}
      sx={{ ...ctaSx(50), width: device === 'phone' ? '100%' : undefined }}
    >
      {holding ? 'Držím termín…' : 'Pokračovat'}
    </Button>
  );

  return (
    <PublicLayout clinic={clinic}>
      <PublicMain>
        <Steps steps={['Služba', 'Termín', 'Vaše údaje']} current={chosen === null ? 1 : 2} />
        <PageTitle>{chosen === null ? 'Vyberte si službu' : 'Vyberte si termín'}</PageTitle>

        {/* ── 1 · Služba ── */}
        {chosen === null && (
          <>
            {offerFailed && (
              <LoadError
                what={`Nabídku se nepodařilo načíst${ringUs(clinic, txt['formulare.booking.call-us'])}.`}
                onRetry={() => setOfferAttempt((n) => n + 1)}
              />
            )}

            {services === null && !offerFailed && <Waiting text="Načítáme nabídku…" />}

            {nothingOffered && (
              <Panel>
                <PanelTitle>{txt['formulare.booking.closed.title']}</PanelTitle>
                <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
                  {phone !== ''
                    ? fillText(txt['formulare.booking.closed.with-phone'], { phone })
                    : txt['formulare.booking.closed.no-phone']}
                </Typography>
                {phone !== '' && (
                  <Box>
                    <Button variant="contained" href={telHref(phone)} sx={ctaSx(46)}>Zavolat {phone}</Button>
                  </Box>
                )}
              </Panel>
            )}

            {services !== null && services.length > 0 && (
              <Box sx={{ display: 'grid', gap: { xs: 3.5, md: 4 } }}>
                {services.map((service) => (
                  <ServiceGroup key={service.id} service={service} onChoose={(a) => choose(service, a)} />
                ))}
              </Box>
            )}
          </>
        )}

        {/* ── 2 · Termín ── */}
        {chosen !== null && activity !== null && (
          <Box
            id="rezervace"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2.5,
              alignItems: 'flex-start',
              flexDirection: device === 'phone' ? 'column' : 'row',
              '& > *': device === 'phone' ? { width: '100%', boxSizing: 'border-box' } : undefined,
            }}
          >
            <Box sx={{ flex: device === 'phone' ? undefined : '999 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <Panel sx={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, minWidth: 0 }}>
                  <FieldLabel>Vybrané vyšetření</FieldLabel>
                  <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 20 }}>{activity.name}</Typography>
                  <Typography sx={{ fontSize: 14, color: '#5C6067' }}>
                    {chosen.service.name} · {priceLine(activity.priceCzk, activity.durationMinutes)}
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => setChosen(null)} sx={ghostSx(44)}>
                  Změnit službu
                </Button>
              </Panel>

              <Panel>
                {complaint !== null && <Alert severity="warning">{complaint}</Alert>}

                {days === null && <Waiting text="Hledám volné termíny…" />}

                {days !== null && days.length === 0 && (
                  <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
                    {fillText(txt['formulare.booking.no-slots'], { days: String(HORIZON_DAYS) })}{ringUs(clinic, txt['formulare.booking.call-us'])}.
                  </Typography>
                )}

                {days !== null && days.length > 0 && monday !== null && (
                  <>
                    <SlotPicker
                      monday={monday}
                      free={freeSet}
                      slotsByDay={slotsByDay}
                      selectedUtc={picked?.slot.startUtc ?? null}
                      disabled={holding}
                      layout={device === 'desktop' ? 'columns' : 'list'}
                      canPrev={canPrev}
                      canNext={canNext}
                      onWeek={moveWeek}
                      onPick={(slot, day) => { setPicked({ slot, day }); setComplaint(null); }}
                    />
                    <Typography sx={{ fontSize: 14, color: '#5C6067' }}>
                      Zobrazeny jsou jen časy, kde je volno pro tuto službu.
                      {/* The clinic's own hold length, never a number written here. */}
                      {hold !== null && ` Po stisknutí „Pokračovat“ vám termín podržíme ${hold}, než vyplníte registraci.`}
                    </Typography>
                  </>
                )}
              </Panel>
            </Box>

            <Panel
              component="aside"
              labelledBy="booking-summary"
              sx={{
                flex: device === 'phone' ? undefined : '1 1 280px',
                position: device === 'desktop' ? 'sticky' : 'static',
                top: 96,
                gap: 2,
              }}
            >
              <PanelTitle id="booking-summary">Shrnutí</PanelTitle>
              <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <SummaryRow term="Služba" value={activity.name} />
                <SummaryRow
                  term="Termín"
                  value={picked === null
                    ? <Box component="span" sx={{ color: LABEL_COLOR, fontWeight: 400 }}>Vyberte čas</Box>
                    : `${shortDate(picked.slot.startUtc)} · ${clinicTime(picked.slot.startUtc)}`}
                  label={picked === null ? undefined : `${clinicDate(picked.day)}, ${clinicTime(picked.slot.startUtc)}`}
                />
                {activity.durationMinutes > 0 && <SummaryRow term="Délka" value={`${activity.durationMinutes} minut`} />}
                {address !== '' && <SummaryRow term="Místo" value={address} />}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, pt: 1.75, borderTop: '1px solid #F0ECE6', alignItems: 'baseline' }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Cena</Typography>
                <Typography sx={{ fontFamily: ARCHIVO, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {czk(activity.priceCzk) ?? 'Cena na dotaz'}
                </Typography>
              </Box>
              {device !== 'phone' && cta}
              {picked === null && (
                <Typography sx={{ fontSize: 13, color: LABEL_COLOR, lineHeight: 1.6 }}>
                  {txt['formulare.booking.pick-time']}
                </Typography>
              )}
            </Panel>
          </Box>
        )}

        {/* The phone's main action, pinned at the bottom of the screen. */}
        {chosen !== null && device === 'phone' && (
          <PinnedBar label="Pokračovat k registraci">
            {picked !== null && (
              <Typography sx={{ fontSize: 14, color: BRAND.text, fontWeight: 600, textAlign: 'center' }}>
                {shortDate(picked.slot.startUtc)} · {clinicTime(picked.slot.startUtc)} · {activity?.name}
              </Typography>
            )}
            {cta}
          </PinnedBar>
        )}
      </PublicMain>
    </PublicLayout>
  );
}

function SummaryRow({ term, value, label }: { term: string; value: ReactNode; label?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
      <Box component="dt" sx={{ fontSize: 14, color: LABEL_COLOR }}>{term}</Box>
      <Box component="dd" aria-label={label} sx={{ m: 0, fontSize: 14, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
        {value}
      </Box>
    </Box>
  );
}

