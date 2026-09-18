/* ══════════════════════════════════════════════════════════════
   OBJEDNÁNÍ ONLINE  (route: /objednat)

   Pick a service, pick a činnost, pick a day, pick a time. The slot is held
   from that moment and the patient goes on to the registration to finish it.

   This file used to say the screen had not been built, and why: the old one was
   written against `/api/public/book` and a system of public event types that
   etapa 9 deleted, so it was pointing at nothing. The note asked for it to be
   rewritten against the calendars that actually exist. That is what this is.

   ── One page that grows, not a wizard ──

   Each choice reveals the next. Nothing is hidden behind a Pokračovat, and
   going back is scrolling up and clicking something else — the same reasoning
   that took the five steps out of /dotaznik. A booking IS sequential, unlike
   that form, but sequential does not have to mean one thing on screen at a
   time.

   ── Everything here comes from the admin's own calendar ──

   /api/public/booking/offer lists a činnost only if the owner created it,
   marked it publicly bookable, left it active, put it under a service, and that
   service has a live calendar. The days are the days he said he works. There is
   no second list of what the clinic does, and nothing on this page decides
   anything he has not already decided.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  EventAvailableOutlined,
  LockOutlined,
  ScheduleOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import {
  SlotGoneError,
  bookableOffer,
  freeDays,
  freeSlots,
  holdSlot,
  rememberHeld,
} from '../../api/publicBooking';
import type { BookableActivity, BookableService, BookableSlot } from '../../api/publicBooking';

/* ── Brand, the same one /dotaznik wears ── */

const BRAND = {
  ink: '#0B0B0C',
  accent: '#FF9D00',
  accentDark: '#E08A00',
  accentWash: 'rgba(255, 157, 0, 0.09)',
  accentEdge: 'rgba(255, 157, 0, 0.32)',
  page: '#F4F4F6',
  line: '#E5E5E9',
  muted: 'rgba(17, 17, 17, 0.58)',
};

const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: BRAND.muted },
    divider: BRAND.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: INTER,
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

/** How far ahead the day list asks. The calendar's own horizon still applies. */
const HORIZON_DAYS = 60;

const iso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * A time as the clinic reads it.
 *
 * The server answers in UTC and the browser may be anywhere. Somebody booking
 * from a phone that thinks it is in London must still be told the Prague time
 * they are expected at, so the zone is named rather than left to the device.
 */
const clinicTime = (utc: string): string =>
  new Date(utc).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

const clinicDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

export default function PublicBooking() {
  const navigate = useNavigate();

  const [services, setServices] = useState<BookableService[] | null>(null);
  const [offerFailed, setOfferFailed] = useState(false);

  const [chosen, setChosen] =
    useState<{ service: BookableService; activity: BookableActivity } | null>(null);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookableSlot[] | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [complaint, setComplaint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    bookableOffer()
      .then((offer) => { if (!cancelled) setServices(offer); })
      .catch(() => { if (!cancelled) setOfferFailed(true); });

    return () => { cancelled = true; };
  }, []);

  /* Days for the chosen činnost. Cleared first, so a slow answer for the
     previous choice can never land under the new one. */
  useEffect(() => {
    if (chosen === null) return undefined;

    let cancelled = false;
    setDays(null);
    setDay(null);
    setSlots(null);

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + HORIZON_DAYS);

    freeDays(chosen.activity.calendarId, chosen.activity.id, iso(from), iso(to))
      .then((free) => { if (!cancelled) setDays(free); })
      .catch(() => { if (!cancelled) setDays([]); });

    return () => { cancelled = true; };
  }, [chosen]);

  useEffect(() => {
    if (chosen === null || day === null) return undefined;

    let cancelled = false;
    setSlots(null);

    freeSlots(chosen.activity.calendarId, chosen.activity.id, day)
      .then((free) => { if (!cancelled) setSlots(free); })
      .catch(() => { if (!cancelled) setSlots([]); });

    return () => { cancelled = true; };
  }, [chosen, day]);

  /**
   * Hold the slot, then go to the registration.
   *
   * The hold happens BEFORE the form, which is the whole point: the patient
   * spends a minute typing and the time is already theirs. If somebody got
   * there first they are told here — while they have typed nothing — rather
   * than at the end, having given us their address and their insurance number.
   */
  const take = async (slot: BookableSlot): Promise<void> => {
    if (chosen === null) return;

    setHolding(slot.startUtc);
    setComplaint(null);

    try {
      const held = await holdSlot(chosen.activity.calendarId, chosen.activity.id, slot.startUtc);

      rememberHeld({
        token: held.token,
        startUtc: held.startUtc,
        endUtc: held.endUtc,
        expiresAtUtc: held.expiresAtUtc,
        serviceName: chosen.service.name,
        activityName: chosen.activity.name,
        activityId: chosen.activity.id,
        calendarId: chosen.activity.calendarId,
      });

      navigate('/dotaznik');
    } catch (error) {
      setHolding(null);

      if (error instanceof SlotGoneError) {
        setComplaint(error.message);

        // Ask again rather than leaving a time on screen that is no longer
        // there. Somebody who has just been refused must not be able to click
        // the same dead slot a second time.
        if (day !== null) {
          freeSlots(chosen.activity.calendarId, chosen.activity.id, day)
            .then(setSlots)
            .catch(() => setSlots([]));
        }
        return;
      }

      setComplaint('Termín se nepodařilo rezervovat. Zkuste to prosím znovu.');
    }
  };

  const nothingOffered = services !== null && services.length === 0;

  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page, pb: { xs: 6, md: 10 } }}>
        <Hero />

        <Container maxWidth="md" sx={{ mt: { xs: -7, md: -9 } }}>
          <Box sx={{ display: 'grid', gap: 3 }}>
            {offerFailed && (
              <Card>
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  Nabídku se nepodařilo načíst. Zkuste to prosím za chvíli znovu,
                  nebo nám zavolejte na +420 606 785 271.
                </Alert>
              </Card>
            )}

            {nothingOffered && (
              <Card>
                <Typography sx={{ fontWeight: 800, fontSize: 19, mb: 1 }}>
                  Online objednávání právě není otevřené
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.muted }}>
                  Termín vám rádi domluvíme telefonicky na +420 606 785 271.
                </Typography>
              </Card>
            )}

            {/* ── 1. Co potřebujete ── */}
            {services !== null && services.length > 0 && (
              <Card>
                <Step number={1} title="Co potřebujete" />

                {services.map((service) => (
                  <Box key={service.id} sx={{ mb: 3, '&:last-of-type': { mb: 0 } }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.25 }}>
                      {service.name}
                    </Typography>

                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.25,
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      }}
                    >
                      {service.activities.map((activity) => {
                        const picked = chosen?.activity.id === activity.id;
                        return (
                          <Box
                            key={activity.id}
                            component="button"
                            type="button"
                            onClick={() => setChosen({ service, activity })}
                            sx={{
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              p: 1.75,
                              borderRadius: 3,
                              bgcolor: picked ? BRAND.accentWash : '#FFFFFF',
                              border: `1px solid ${picked ? BRAND.accentEdge : BRAND.line}`,
                              transition: 'background-color 120ms ease, border-color 120ms ease',
                              '&:hover': {
                                borderColor: picked ? BRAND.accentEdge : 'rgba(17,17,17,0.24)',
                              },
                            }}
                          >
                            <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>
                              {activity.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: BRAND.muted }}>
                              {activity.durationMinutes} minut
                            </Typography>
                            {activity.publicNote !== '' && (
                              <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
                                {activity.publicNote}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Card>
            )}

            {/* ── 2. Kdy ── */}
            {chosen !== null && (
              <Card>
                <Step number={2} title="Kdy vám to vyhovuje" />

                {days === null && <Waiting />}

                {days !== null && days.length === 0 && (
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    V nejbližších {HORIZON_DAYS} dnech nemáme volno. Zavolejte nám
                    prosím na +420 606 785 271.
                  </Typography>
                )}

                {days !== null && days.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {days.map((free) => (
                      <Chip
                        key={free}
                        label={clinicDate(free)}
                        onClick={() => setDay(free)}
                        sx={{
                          fontWeight: 700,
                          py: 2.25,
                          cursor: 'pointer',
                          bgcolor: day === free ? BRAND.ink : '#FFFFFF',
                          color: day === free ? BRAND.accent : 'inherit',
                          border: `1px solid ${day === free ? BRAND.ink : BRAND.line}`,
                          '&:hover': { bgcolor: day === free ? BRAND.ink : BRAND.accentWash },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Card>
            )}

            {/* ── 3. V kolik ── */}
            {chosen !== null && day !== null && (
              <Card>
                <Step number={3} title="V kolik hodin" />

                {complaint !== null && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {complaint}
                  </Alert>
                )}

                {slots === null && <Waiting />}

                {slots !== null && slots.length === 0 && (
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Na tento den už volno nemáme. Zkuste prosím jiný.
                  </Typography>
                )}

                {slots !== null && slots.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {slots.map((slot) => (
                        <Box
                          key={slot.startUtc}
                          component="button"
                          type="button"
                          disabled={holding !== null}
                          onClick={() => { void take(slot); }}
                          sx={{
                            minWidth: 84,
                            py: 1.1,
                            px: 1.5,
                            borderRadius: 999,
                            cursor: holding === null ? 'pointer' : 'progress',
                            fontFamily: 'inherit',
                            fontSize: 15,
                            fontWeight: 700,
                            bgcolor: holding === slot.startUtc ? BRAND.ink : '#FFFFFF',
                            color: holding === slot.startUtc ? BRAND.accent : 'inherit',
                            border: `1px solid ${holding === slot.startUtc ? BRAND.ink : BRAND.line}`,
                            opacity: holding !== null && holding !== slot.startUtc ? 0.45 : 1,
                            transition: 'background-color 120ms ease, opacity 120ms ease',
                          }}
                        >
                          {clinicTime(slot.startUtc)}
                        </Box>
                      ))}
                    </Box>

                    <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2 }}>
                      Po výběru času vám termín podržíme 15 minut, než vyplníte
                      registraci.
                    </Typography>
                  </>
                )}
              </Card>
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

function Waiting() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: BRAND.muted }}>
      <CircularProgress size={18} sx={{ color: BRAND.accent }} />
      <Typography variant="body2">Hledám volné termíny…</Typography>
    </Box>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        borderRadius: 4,
        border: `1px solid ${BRAND.line}`,
        boxShadow: '0 18px 50px rgba(11, 11, 12, 0.10)',
        p: { xs: 2.5, sm: 3.5 },
      }}
    >
      {children}
    </Box>
  );
}

function Step({ number, title }: { number: number; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.75,
          bgcolor: BRAND.ink,
          color: BRAND.accent,
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BRAND.line }} />
    </Box>
  );
}

function Hero() {
  return (
    <Box
      sx={{
        bgcolor: BRAND.ink,
        backgroundImage:
          'radial-gradient(1200px 420px at 78% -20%, rgba(255,157,0,0.16), transparent 68%)',
        color: '#FFFFFF',
        pt: { xs: 3.5, md: 5 },
        pb: { xs: 11, md: 15 },
        px: 2,
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: '0 !important', md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 4 }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: { xs: 18, md: 22 } }}>
            SportMedical
          </Typography>
          <Typography
            component="span"
            sx={{
              fontWeight: 500,
              fontSize: { xs: 18, md: 22 },
              letterSpacing: 2.5,
              color: BRAND.accent,
            }}
          >
            DIAGNOSTICS
          </Typography>
        </Box>

        <Typography variant="h4" sx={{ fontSize: { xs: 32, sm: 44, md: 52 }, mb: 1.5, lineHeight: 1.08 }}>
          Objednat se online
        </Typography>
        <Typography
          sx={{ color: 'rgba(255,255,255,0.68)', mb: 3, maxWidth: 520, fontSize: { xs: 15, md: 17 } }}
        >
          Vyberte si vyšetření a čas. Termín je váš hned — potvrzení dostanete na
          obrazovce a přidáte si ho do svého kalendáře.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Trust icon={<EventAvailableOutlined sx={{ fontSize: 15 }} />} label="Termín ihned" />
          <Trust icon={<ScheduleOutlined sx={{ fontSize: 15 }} />} label="Registrace do minuty" />
          <Trust icon={<VerifiedUserOutlined sx={{ fontSize: 15 }} />} label="Zrušíte kdykoli" />
          <Trust icon={<LockOutlined sx={{ fontSize: 15 }} />} label="Šifrovaný přenos" />
        </Box>
      </Container>
    </Box>
  );
}

function Trust({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.65,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.16)',
        bgcolor: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {icon}
      {label}
    </Box>
  );
}
