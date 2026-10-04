/* ══════════════════════════════════════════════════════════════
   KLUBOVÁ REGISTRACE  (route: /klub/:token — artboard V-KlubReg)

   An athlete follows their club's link, picks a time inside the block the club
   reserved and gives their details. No account, no login.

   Everything shown comes from the server's offer for this one token: the club's
   name and colour, the block's period, how many places are left (and of how
   many), the činnosti the club ordered, the days held for it and — when the
   server lists them — the free times to choose from. When it does not, it
   assigns the time inside the held day itself and the page says so. Nothing is
   decided here that the clinic has not already decided: whether a date of birth
   is asked for is the server's flag.

   ── Three layouts ──

   Phone: one column, one field per row, "Potvrdit registraci" pinned at the
   bottom. iPad and desktop: the same panels in the artboard's 880 px column.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, TextField, Typography,
} from '@mui/material';
import { ClubClaimError, ClubLinkDeadError, claimClubSlot, getClubOffer, getClubSlots } from '../../api/publicClub';
import type { ClubFreeSlot, ClubOffer, ClubSlot } from '../../api/publicClub';
import { useDevice } from '../../layout/useDevice';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import PublicLayout from './PublicLayout';
import { ActivityCards, activityRemaining } from './club/ActivityCards';
import { Booked } from './club/Booked';
import type { BookedInfo } from './club/Booked';
import { INFO_SLOT_KEYS, InfoPanel } from './club/InfoPanel';
import { SLOT_PICKER_KEYS } from './club/SlotPicker';
import { TermCalendar } from './club/TermCalendar';
import { CAL_KEYS, withCalDefaults } from './club/texts';
import { downloadIcs } from './club/ics';
import type { SlotsStatus } from './club/SlotPicker';
import { ARCHIVO, BRAND, clinicDate, clinicTime, telHref } from '../../components/public/brand';
import {
  FieldLabel, LABEL_COLOR, LoadError, ON_ORANGE, Panel, PanelTitle, PinnedBar, PublicMain, ctaSx, ghostSx, longWhen,
} from '../../components/public/kit';
import { PhoneField } from '../../components/ui/PhoneField';
import { LANDING_PATH } from '../../components/public/PublicHeader';
import { useSlotTexts } from '../../site/useSlotTexts';

const SLOT_KEYS = [
  'formulare.club.closed',
  'formulare.club.full',
  ...INFO_SLOT_KEYS,
  ...SLOT_PICKER_KEYS,
  ...CAL_KEYS,
  'formulare.club-reg.register.title',
  'formulare.club-reg.minor.label',
  'formulare.club-reg.parent.hint',
  'formulare.club-reg.email.hint',
  'formulare.club-reg.slots.title',
  'formulare.club-reg.error.taken',
  'formulare.club-reg.error.noslot',
  'formulare.club-reg.error.already',
  'formulare.club-reg.done.title',
  'formulare.club-reg.done.next',
  'formulare.club-reg.done.bring',
  'formulare.club-reg.done.add',
] as const;

const hhmm = (time: string): string => time.slice(0, 5);

const pragueDay = (utc: string): string =>
  new Date(utc).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "26. října" for a date; the month in the genitive, which Czech needs after a day. */
const dayMonthName = (y: number, m: number, d: number): string =>
  new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });

/** "26.–27. října 2026" / "26. 10. – 2. 11. 2026" / "26. října 2026" for two yyyy-MM-dd dates. */
function periodText(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return '';
  if (from === to) return `${dayMonthName(fy, fm, fd)} ${fy}`;
  if (fy === ty && fm === tm) return `${fd}.–${dayMonthName(ty, tm, td)} ${ty}`;
  return `${fd}. ${fm}. ${fy === ty ? '' : `${fy} `}– ${td}. ${tm}. ${ty}`;
}

/** The block's period: the server's, else the first and last day it holds. */
function blockPeriod(offer: ClubOffer): string {
  const dates = offer.windows.map((w) => w.date).sort();
  const from = offer.fromDate ?? dates[0];
  const to = offer.toDate ?? dates[dates.length - 1];
  return from !== undefined && to !== undefined && from !== null && to !== null ? periodText(from, to) : '';
}

/** The club's colour, only when it is a real #RRGGBB. */
const safeColor = (hex: string | null | undefined): string =>
  typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : BRAND.accent;

function Hero({ offer }: { offer: ClubOffer }) {
  const colour = safeColor(offer.colorHex);
  const seats = typeof offer.seats === 'number' && offer.seats > 0 ? offer.seats : null;
  const taken = seats === null ? null : Math.max(0, seats - Math.max(0, offer.remaining));
  const period = blockPeriod(offer);
  const activities = offer.activities.map((a) => a.activityName).join(' · ');

  return (
    <Box sx={{ bgcolor: BRAND.ink, color: '#FFFFFF', px: { xs: 2, md: 4, lg: '44px' }, py: { xs: 4, md: 5 } }}>
      <Box sx={{ maxWidth: 880, mx: 'auto', display: 'flex', flexWrap: 'wrap', gap: 3.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0, flex: '1 1 320px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box aria-hidden="true" data-testid="club-colour" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: colour, flex: '0 0 12px' }} />
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: BRAND.accent }}>
              {offer.partnerName}
            </Typography>
          </Box>
          <Typography
            component="h1"
            sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 'clamp(28px, 3.6vw, 40px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}
          >
            Vyberte si čas na prohlídku
          </Typography>
          <Typography sx={{ fontSize: 16, color: BRAND.onInk, maxWidth: '54ch' }}>
            Váš klub pro vás rezervoval místa{activities !== '' ? ` na ${activities}` : ''}.
            {period !== '' && ` Blok: ${period}.`} Vyberte si čas, který vám sedí, a vyplňte své údaje.
          </Typography>
        </Box>

        <Box
          role="group"
          aria-label="Zbývající místa"
          sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1, p: '20px 24px', border: '1px solid #3A3F47', borderRadius: '14px', bgcolor: BRAND.inkSoft, minWidth: 200 }}
        >
          <FieldLabel sx={{ color: '#8C939C' }}>Zbývá míst</FieldLabel>
          <Box sx={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 38, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {Math.max(0, offer.remaining)}
            {seats !== null && <Box component="span" sx={{ fontSize: 20, color: '#8C939C' }}> / {seats}</Box>}
          </Box>
          {seats !== null && taken !== null && (
            <Box
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={seats}
              aria-valuenow={taken}
              aria-label="Obsazená místa"
              sx={{ height: 8, borderRadius: '4px', bgcolor: '#2A3037', overflow: 'hidden' }}
            >
              <Box sx={{ height: '100%', width: `${Math.min(100, Math.round((taken / seats) * 100))}%`, bgcolor: colour }} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/** One of the block's free times, struck through once a team-mate has it. */
function TimePill({ slot, selected, onPick }: { slot: ClubSlot; selected: boolean; onPick: () => void }) {
  const time = clinicTime(slot.startUtc);
  if (!slot.free) {
    return (
      <Box
        component="span"
        aria-label={`${time} — obsazeno`}
        sx={{ height: 46, px: 2.25, border: `1px solid ${BRAND.line}`, borderRadius: '23px', bgcolor: '#F4F2EE', color: '#9A958D', fontSize: 15, display: 'flex', alignItems: 'center', textDecoration: 'line-through' }}
      >
        {time}
      </Box>
    );
  }
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={`${clinicDate(pragueDay(slot.startUtc))}, ${time}`}
      onClick={onPick}
      sx={{
        height: 46, minWidth: 44, px: 2.25, borderRadius: '23px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
        fontWeight: selected ? 700 : 600, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: selected ? BRAND.accent : BRAND.paper, color: selected ? ON_ORANGE : BRAND.text,
        border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accent : '#D8D2C9'}`,
        '&:hover': { borderColor: BRAND.accent, bgcolor: selected ? BRAND.accent : '#FFF6EB' },
      }}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {time}
    </Box>
  );
}

export default function ClubRegistration() {
  const txt = useSlotTexts(SLOT_KEYS);
  const cal = withCalDefaults(txt);
  const device = useDevice();
  const { token = '' } = useParams();

  const [offer, setOffer] = useState<ClubOffer | null>(null);
  const [dead, setDead] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [clinic, setClinic] = useState<PublicClinic | null>(null);

  const [activityId, setActivityId] = useState('');
  /** Činnosti the server just answered 409 for: shown as full until the page is reloaded. */
  const [fullIds, setFullIds] = useState<ReadonlySet<string>>(new Set());
  const [slotUtc, setSlotUtc] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedInfo | null>(null);
  const [minor, setMinor] = useState(false);
  const [parentName, setParentName] = useState('');
  const [note, setNote] = useState('');
  const [freeSlots, setFreeSlots] = useState<ClubFreeSlot[]>([]);
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>('idle');
  /** The day tapped in the calendar; kept when the slots are refreshed. */
  const [day, setDay] = useState<string | null>(null);
  const info = offer?.info ?? null;

  useEffect(() => {
    let alive = true;
    setOffer(null);
    setDead(false);
    setLoadFailed(false);

    getClubOffer(token)
      .then((result) => {
        if (!alive) return;
        setOffer(result);
        setFullIds(new Set());
        if (result.activities.length === 1) setActivityId(result.activities[0].activityId);
      })
      .catch((error) => {
        if (!alive) return;
        if (error instanceof ClubLinkDeadError) setDead(true);
        else setLoadFailed(true);
      });
    void readPublicClinic().then((details) => { if (alive) setClinic(details); });

    return () => { alive = false; };
  }, [token, attempt]);

  /** Free slots of the chosen činnost (order links only); the earliest one is preselected. */
  const loadSlots = useCallback(async (forActivity: string, preselect = true): Promise<void> => {
    if (forActivity === '') { setFreeSlots([]); setSlotsStatus('idle'); return; }
    setSlotsStatus('loading');
    try {
      const list = await getClubSlots(token, forActivity);
      setFreeSlots(list);
      // The nearest slot is offered only while the person has not chosen; a chosen one that is still free stays.
      setSlotUtc((current) => (current !== null && list.some((x) => x.startUtc === current) ? current : preselect ? list[0]?.startUtc ?? null : null));
      setDay((current) => (current !== null && list.some((x) => x.date === current) ? current : preselect ? list[0]?.date ?? null : null));
      setSlotsStatus('ready');
    } catch {
      setFreeSlots([]);
      setSlotUtc(null);
      setDay(null);
      setSlotsStatus('failed');
    }
  }, [token]);

  const infoMode = info !== null;
  useEffect(() => {
    if (infoMode) void loadSlots(activityId);
  }, [infoMode, activityId, loadSlots]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, ClubSlot[]>();
    for (const slot of offer?.slots ?? []) {
      const day = pragueDay(slot.startUtc);
      groups.set(day, [...(groups.get(day) ?? []), slot]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [offer]);

  const choosesTime = infoMode || slotsByDay.length > 0;
  const dobRequired = offer?.requireDateOfBirth === true;
  const emailLooksOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const emailOk = email.trim() === '' ? !infoMode : emailLooksOk;
  const parentOk = !infoMode || !minor || parentName.trim() !== '';
  const canSubmit =
    name.trim() !== '' && activityId !== '' && (!choosesTime || slotUtc !== null)
    && (!dobRequired || dateOfBirth !== '') && emailOk && parentOk && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setComplaint(null);
    try {
      const claim = await claimClubSlot(token, {
        activityId,
        name: name.trim(),
        phone: phone.trim() === '' ? undefined : phone.trim(),
        email: email.trim() === '' ? undefined : email.trim(),
        dateOfBirth: dobRequired && dateOfBirth !== '' ? dateOfBirth : undefined,
        note: infoMode && note.trim() !== '' ? note.trim() : undefined,
        parentName: infoMode && minor && parentName.trim() !== '' ? parentName.trim() : undefined,
        startUtc: choosesTime && slotUtc !== null ? slotUtc : undefined,
      });
      if (claim.startUtc) {
        const chosen = offer?.activities.find((a) => a.activityId === activityId);
        setBooked({
          startUtc: claim.startUtc,
          endUtc: claim.endUtc || null,
          date: claim.date ?? null,
          startLocal: claim.startLocal ?? null,
          endLocal: claim.endLocal ?? null,
          calendarName: claim.calendarName ?? null,
          activityName: claim.activityName ?? (infoMode ? chosen?.activityName ?? null : null),
          bring: chosen?.description ?? null,
        });
      } else setComplaint('Rezervaci se nepodařilo dokončit.');
    } catch (error) {
      if (error instanceof ClubClaimError && error.timeTaken) {
        setComplaint(txt['formulare.club-reg.error.taken']);
        setSlotUtc(null);
        void loadSlots(activityId, false);
      } else if (error instanceof ClubClaimError && error.code !== null && /no.?free.?slot/i.test(error.code)) {
        setComplaint(txt['formulare.club-reg.error.noslot']);
        void loadSlots(activityId);
      } else if (error instanceof ClubClaimError && error.code !== null && /already/i.test(error.code)) {
        setComplaint(txt['formulare.club-reg.error.already']);
      } else {
        setComplaint(error instanceof Error ? error.message : 'Rezervaci se nepodařilo dokončit.');
      }
      if (error instanceof ClubClaimError && error.activityFull) {
        setFullIds((prev) => new Set(prev).add(activityId));
        setActivityId('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const phoneOfClinic = clinic?.phone.trim() ?? '';

  /** The booking as an .ics download, built here from date, time, činnost and place. */
  const saveToCalendar = (b: BookedInfo) => {
    const minutes = offer?.activities.find((x) => x.activityId === activityId)?.durationMinutes ?? 0;
    const endUtc = b.endUtc ?? new Date(new Date(b.startUtc).getTime() + Math.max(minutes, 15) * 60_000).toISOString();
    const place = [b.calendarName, clinic?.address].map((x) => (x ?? '').trim()).filter((x) => x !== '').join(', ');
    downloadIcs({
      startUtc: b.startUtc,
      endUtc,
      title: [b.activityName ?? 'Prohlídka', clinic?.name].map((x) => (x ?? '').trim()).filter((x) => x !== '').join(' · '),
      location: place === '' ? null : place,
      description: b.bring,
    }, 'termin-prohlidky.ics');
  };

  const frame = (children: ReactNode, hero?: ReactNode) => (
    <PublicLayout clinic={clinic}>
      {hero}
      <PublicMain maxWidth={880}>{children}</PublicMain>
    </PublicLayout>
  );

  /* ── Dead / failed / loading ── */
  if (dead) {
    return frame(
      <Panel>
        <PanelTitle>Odkaz neplatí</PanelTitle>
        <Typography role="status" sx={{ fontSize: 16, color: '#5C6067', lineHeight: 1.6 }}>
          Tento odkaz už není platný nebo vypršel. Ozvěte se prosím svému klubu.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button variant="contained" href={LANDING_PATH} sx={ctaSx(50)}>Objednat se samostatně</Button>
          {phoneOfClinic !== '' && <Button variant="outlined" href={telHref(phoneOfClinic)} sx={ghostSx(50)}>Zavolat {phoneOfClinic}</Button>}
        </Box>
      </Panel>,
    );
  }

  if (loadFailed) {
    return frame(
      <LoadError what="Registraci se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu." onRetry={() => setAttempt((n) => n + 1)} />,
    );
  }

  if (offer === null) {
    return frame(
      <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: BRAND.accent }} aria-label="Načítáme registraci" />
      </Box>,
    );
  }

  /* ── Confirmed ── */
  if (booked) {
    const addAnother = () => {
      setBooked(null);
      setName('');
      setDateOfBirth('');
      setNote('');
      setSlotUtc(null);
      setDay(null);
      setComplaint(null);
      void getClubOffer(token).then((fresh) => setOffer(fresh)).catch(() => undefined);
      if (infoMode) void loadSlots(activityId);
    };
    return frame(
      <Booked
        booked={booked}
        title={txt['formulare.club-reg.done.title']}
        next={txt['formulare.club-reg.done.next']}
        bringTitle={txt['formulare.club-reg.done.bring']}
        addLabel={txt['formulare.club-reg.done.add']}
        onAdd={infoMode ? addAnother : null}
        calendarLine={cal['formulare.club-reg.done.calendar']}
        icsLabel={cal['formulare.club-reg.done.ics']}
        onIcs={() => saveToCalendar(booked)}
      />,
    );
  }

  /* ── Full / expired ── */
  const expired = typeof offer.expiresAtUtc === 'string' && new Date(offer.expiresAtUtc).getTime() < Date.now();
  const everyActivityFull =
    offer.activities.length > 0 && offer.activities.every((a) => activityRemaining(a, offer.remaining) <= 0);
  if (expired || offer.remaining <= 0 || everyActivityFull) {
    return frame(
      <Panel>
        <PanelTitle>{expired ? 'Odkaz vypršel' : 'Všechna místa jsou obsazená'}</PanelTitle>
        <Typography role="status" sx={{ fontSize: 16, color: '#5C6067', lineHeight: 1.6 }}>
          {expired ? txt['formulare.club.closed'] : txt['formulare.club.full']}
        </Typography>
      </Panel>,
      <Hero offer={offer} />,
    );
  }

  /* ── The offer + the form ── */
  const openWindows = offer.windows.filter((w) => w.places > 0);
  const chosenActivity = offer.activities.find((a) => a.activityId === activityId);
  const chooseActivity = offer.activities.length > 1;

  // Number sections by what is shown: info mode lists the details before the term.
  const firstNo = chooseActivity ? 2 : 1;
  const detailsNo = infoMode ? firstNo : firstNo + 1;
  const termNo = infoMode ? firstNo + 1 : firstNo;
  const termPanel = (
      <Panel labelledBy="club-step-1">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'baseline', justifyContent: 'space-between' }}>
          <PanelTitle id="club-step-1">{termNo} · {infoMode ? txt['formulare.club-reg.slots.title'] : 'Vyberte si termín'}</PanelTitle>
          {chosenActivity !== undefined && (
            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
              {chosenActivity.activityName} · {chosenActivity.durationMinutes}&nbsp;min na sportovce
            </Typography>
          )}
        </Box>

        {infoMode ? (
          <TermCalendar
            status={slotsStatus}
            slots={freeSlots}
            reservedDays={info?.windows.map((w) => w.date) ?? []}
            day={day}
            value={slotUtc}
            onDay={(date) => {
              setDay(date);
              setComplaint(null);
              setSlotUtc((current) => (current !== null && freeSlots.some((x) => x.startUtc === current && x.date === date) ? current : null));
            }}
            onPick={(utc) => { setSlotUtc(utc); setComplaint(null); }}
            onRefresh={() => { void loadSlots(activityId); }}
            device={device}
            t={txt}
            texts={cal}
          />
        ) : choosesTime ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {slotsByDay.map(([day, slots]) => (
              <Box key={day} sx={{ display: 'flex', flexDirection: 'column', gap: 1.125 }}>
                <Typography component="span" sx={{ fontSize: 14, fontWeight: 700 }}>{capitalise(clinicDate(day))}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
                  {slots.map((slot) => (
                    <TimePill key={slot.startUtc} slot={slot} selected={slotUtc === slot.startUtc} onPick={() => setSlotUtc(slot.startUtc)} />
                  ))}
                </Box>
              </Box>
            ))}
            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
              Přeškrtnuté časy si už vzal někdo z týmu. Jeden sportovec může obsadit jedno místo.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {openWindows.length === 0 ? (
              <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>Momentálně není volný žádný den.</Typography>
            ) : (
              <Box component="ul" aria-label="Rezervované dny" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {openWindows.map((w) => (
                  <Box
                    component="li"
                    key={`${w.date}-${w.startTime}`}
                    sx={{ minHeight: 44, px: 2, display: 'flex', alignItems: 'center', border: `1px solid ${BRAND.line}`, borderRadius: '22px', fontSize: 15, fontWeight: 600, bgcolor: BRAND.page }}
                  >
                    {capitalise(clinicDate(w.date))} · {hhmm(w.startTime)}–{hhmm(w.endTime)}
                  </Box>
                ))}
              </Box>
            )}
            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
              Přesný čas vám přidělíme v rezervovaném okně.
            </Typography>
          </Box>
        )}
      </Panel>
  );
  const detailsPanel = (
      <Panel labelledBy="club-step-2">
        <PanelTitle id="club-step-2">{detailsNo} · {infoMode ? txt['formulare.club-reg.register.title'] : 'Vaše údaje'}</PanelTitle>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          <TextField
            required
            label="Jméno a příjmení sportovce"
            placeholder="Jan Novák"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ flex: '1 1 100%' }}
            slotProps={{ htmlInput: { style: { minHeight: 20 } } }}
          />
          {infoMode && (
            <FormControlLabel
              sx={{ flex: '1 1 100%', m: 0 }}
              control={<Checkbox checked={minor} onChange={(e) => setMinor(e.target.checked)} />}
              label={txt['formulare.club-reg.minor.label']}
            />
          )}
          {infoMode && minor && (
            <TextField
              required
              label="Jméno rodiče / zákonného zástupce"
              autoComplete="name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              helperText={txt['formulare.club-reg.parent.hint']}
              sx={{ flex: '1 1 100%' }}
            />
          )}
          {dobRequired && (
            <TextField
              required
              type="date"
              label="Datum narození"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              sx={{ flex: '1 1 200px' }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
          <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
            <PhoneField
              value={phone}
              onChange={(value) => setPhone(value)}
              label="Telefon"
              placeholder="773 539 001"
              fullWidth
            />
          </Box>
          <TextField
            type="email"
            required={infoMode}
            label="E-mail"
            placeholder="jan@email.cz"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={email.trim() !== '' && !emailLooksOk}
            helperText={email.trim() !== '' && !emailLooksOk ? 'E-mail nevypadá správně.' : infoMode ? txt['formulare.club-reg.email.hint'] : undefined}
            sx={{ flex: '1 1 100%' }}
          />
          {infoMode && (
            <TextField
              label="Poznámka (nepovinné)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              sx={{ flex: '1 1 100%' }}
            />
          )}
        </Box>
      </Panel>
  );

  return frame(
    <>
      {info !== null && <InfoPanel info={info} activities={offer.activities} t={txt} device={device} cal={cal} />}
      {chooseActivity && (
        <Panel labelledBy="club-step-activity">
          <PanelTitle id="club-step-activity">1 · Vyberte činnost</PanelTitle>
          <ActivityCards
            activities={offer.activities}
            blockRemaining={offer.remaining}
            value={activityId}
            full={fullIds}
            onPick={(id) => { setActivityId(id); setComplaint(null); }}
          />
        </Panel>
      )}

{infoMode ? <>{detailsPanel}{activityId !== '' && termPanel}</> : <>{termPanel}{detailsPanel}</>}      {complaint !== null && (
        <Alert severity="warning" onClose={() => setComplaint(null)} sx={{ borderRadius: 2 }}>
          {complaint}
        </Alert>
      )}

      <PinnedBar label="Potvrdit registraci" card>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, minWidth: 0, mr: { sm: 'auto' }, textAlign: { xs: 'center', sm: 'left' } }}>
          <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>Vybraný termín</Typography>
          <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {slotUtc !== null
              ? capitalise(longWhen(slotUtc))
              : choosesTime ? 'Zatím nevybráno' : 'Přidělíme vám v rezervovaném čase'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={() => { void submit(); }}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={ctaSx(52)}
        >
          {submitting ? 'Rezervuji…' : 'Potvrdit registraci'}
        </Button>
      </PinnedBar>
    </>,
    <Hero offer={offer} />,
  );
}
