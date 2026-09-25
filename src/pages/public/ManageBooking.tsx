/* ══════════════════════════════════════════════════════════════
   SPRÁVA REZERVACE  (route: /rezervace/:token)

   What the patient gets after booking: the appointment they made, a calendar
   file for whatever they use, a button to move it to another free time, and
   a button to cancel it.

   ── Why this file exists ──

   The confirmation screen has offered a "Správa rezervace" button since
   18. 9. 2026 pointing at /book/manage/{token}. No such route existed, so the
   button fell through to the catch-all, hit the AuthGuard, and put a patient on
   the STAFF LOGIN SCREEN — a login they can never pass, on their way to their
   own appointment. Measured on 19. 9. 2026 by clicking it.

   ── Moving, since 25. 9. 2026 ──

   The patient may move or cancel only until the clinic's deadline before the
   appointment — a setting, and the server sends the moment it runs out, so the
   page says "do čtvrtka 9:00" from the server's number and never from one of
   its own. The times offered for a move are the public page's own free times,
   read through the same two requests.

   ── The token IS the identity ──

   The patient has no account, so holding this link is what proves the booking
   is theirs. That means the page shows only what somebody holding it is
   entitled to see — their činnost, their služba, their time — and nothing about
   the clinic's day, the worker, or anybody else.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  EventAvailableOutlined,
  EventBusyOutlined,
  DownloadOutlined,
  EditCalendarOutlined,
} from '@mui/icons-material';
import {
  ManageError,
  calendarFileUrl,
  canStillChange,
  cancelBooking,
  readBooking,
  rescheduleBooking,
} from '../../api/publicManage';
import type { ManagedBooking } from '../../api/publicManage';
import { freeDays, freeSlots } from '../../api/publicBooking';
import type { BookableSlot } from '../../api/publicBooking';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import { addDaysToDateOnly, pragueDateKey } from '../../utils/time';

/* ── Brand, the same one /objednat and /dotaznik wear ── */

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

/** How far ahead the move offers days. The public page offers the same fortnight. */
const MOVE_WINDOW_DAYS = 14;

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

/**
 * The appointment as the clinic reads it.
 *
 * The server answers in UTC and the browser may be anywhere. Somebody opening
 * this on a phone that thinks it is in London must still be told the Prague
 * time they are expected at, so the zone is named rather than left to the
 * device.
 */
const clinicMoment = (utc: string): string =>
  new Date(utc).toLocaleString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

const clinicTime = (utc: string): string =>
  new Date(utc).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

/** `st 30. 9.` for a day chip. The key is a Prague date, so noon keeps it on that day anywhere. */
const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });

export default function ManageBooking() {
  const { token = '' } = useParams();

  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /* ── Moving ── */
  const [moving, setMoving] = useState(false);
  const [days, setDays] = useState<string[] | null>(null);
  const [daysFailed, setDaysFailed] = useState(false);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookableSlot[] | null>(null);
  const [pendingSlot, setPendingSlot] = useState<BookableSlot | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  /** The clinic's own number, from settings. Empty when nobody has set one. */
  const [clinic, setClinic] = useState<PublicClinic | null>(null);

  useEffect(() => {
    let abandoned = false;

    void readPublicClinic().then((details) => { if (!abandoned) setClinic(details); });

    return () => { abandoned = true; };
  }, []);

  useEffect(() => {
    if (token === '') {
      setLoadFailed('Odkaz na rezervaci je neúplný.');
      return undefined;
    }

    let abandoned = false;

    readBooking(token)
      .then((found) => { if (!abandoned) setBooking(found); })
      .catch((error: unknown) => {
        if (abandoned) return;

        setLoadFailed(error instanceof ManageError
          ? error.message
          : 'Rezervaci se nepodařilo načíst.');
      });

    return () => { abandoned = true; };
  }, [token]);

  const phone = clinic?.phone.trim() ?? '';
  const callUs = phone !== '' ? ` Zavolejte nám prosím na ${phone}.` : ' Ozvěte se nám prosím.';

  /* The days with a free time, read once the patient asks to move. */
  const loadDays = useCallback(async (current: ManagedBooking) => {
    if (!current.calendarId || !current.activityId) {
      setDaysFailed(true);
      return;
    }
    const from = pragueDateKey(new Date());
    try {
      setDays(await freeDays(current.calendarId, current.activityId, from, addDaysToDateOnly(from, MOVE_WINDOW_DAYS)));
      setDaysFailed(false);
    } catch {
      setDays(null);
      setDaysFailed(true);
    }
  }, []);

  const pickDay = async (day: string): Promise<void> => {
    if (booking?.calendarId == null || booking.activityId == null) return;
    setChosenDay(day);
    setSlots(null);
    try {
      const found = await freeSlots(booking.calendarId, booking.activityId, day);
      /* The time it already has is not a move. */
      setSlots(found.filter((slot) => slot.startUtc !== booking.startUtc));
    } catch {
      setSlots([]);
    }
  };

  const startMoving = (): void => {
    if (booking === null) return;
    setComplaint(null);
    setDone(null);
    setMoving(true);
    setChosenDay(null);
    setSlots(null);
    setDays(null);
    void loadDays(booking);
  };

  const confirmMove = async (): Promise<void> => {
    if (pendingSlot === null || booking === null) return;
    setRescheduling(true);
    setComplaint(null);

    try {
      const was = booking.startUtc;
      const moved = await rescheduleBooking(token, pendingSlot.startUtc);
      setBooking(moved);
      setPendingSlot(null);
      setMoving(false);
      setDone(`Termín jsme přesunuli z ${clinicMoment(was)} na ${clinicMoment(moved.startUtc)}. Ordinace o tom ví.`);
    } catch (error) {
      setPendingSlot(null);
      setComplaint(error instanceof ManageError ? error.message : 'Termín se nepodařilo přesunout.');
      if (error instanceof ManageError && error.slotGone && chosenDay !== null) {
        /* Somebody was quicker, or the time stopped being offered: show the day again. */
        void pickDay(chosenDay);
      }
      if (error instanceof ManageError && error.tooLate) {
        setMoving(false);
      }
    } finally {
      setRescheduling(false);
    }
  };

  const confirmCancel = async (): Promise<void> => {
    setCancelling(true);
    setComplaint(null);

    try {
      setBooking(await cancelBooking(token));
      setAsking(false);
    } catch (error) {
      // The server's own sentence, not one repeated here. How late is too late
      // is the clinic's setting now, so a number written into this file would
      // be wrong for every clinic that changed it.
      setComplaint(error instanceof ManageError
        ? error.message
        : 'Termín se nepodařilo zrušit.');
      setAsking(false);
    } finally {
      setCancelling(false);
    }
  };

  const mayChange = booking !== null && canStillChange(booking);

  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page, pb: { xs: 6, md: 10 } }}>
        <Hero />

        <Container maxWidth="sm" sx={{ mt: { xs: -7, md: -9 } }}>
          {loadFailed !== null && (
            <Card sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 19, mb: 1 }}>
                Rezervaci jsme nenašli
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                {loadFailed} Odkaz mohl být neúplný, nebo už byl termín zrušen.
                {phone !== ''
                  ? ` Zavolejte nám prosím na ${phone} a rádi to s vámi projdeme.`
                  : ''}
              </Typography>
            </Card>
          )}

          {loadFailed === null && booking === null && (
            <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={18} sx={{ color: BRAND.accent }} />
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                Načítáme vaši rezervaci…
              </Typography>
            </Card>
          )}

          {booking !== null && (
            <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
              {booking.isCancelled ? (
                <>
                  <EventBusyOutlined sx={{ fontSize: 44, color: BRAND.muted, mb: 1 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 21, mb: 0.5 }}>
                    Termín je zrušený
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2 }}>
                    {booking.activityName} — {clinicMoment(booking.startUtc)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Čas jsme uvolnili pro ostatní. Nový termín si můžete vybrat
                    na stránce objednání.
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    href="/objednat"
                    sx={{ mt: 2.5, borderRadius: 999, py: 1.25, color: BRAND.ink }}
                  >
                    Vybrat nový termín
                  </Button>
                </>
              ) : (
                <>
                  <EventAvailableOutlined sx={{ fontSize: 44, color: BRAND.accent, mb: 1 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 21, mb: 0.25 }}>
                    {clinicMoment(booking.startUtc)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
                    {booking.activityName}
                    {booking.serviceName !== '' && ` — ${booking.serviceName}`}
                  </Typography>

                  {done !== null && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                      {done}
                    </Alert>
                  )}

                  {complaint !== null && (
                    <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                      {complaint}
                    </Alert>
                  )}

                  {/*
                    A plain link, not a fetch. The browser downloads the file and
                    hands it to whatever the patient keeps their calendar in,
                    which is the whole point of offering it.
                  */}
                  <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    href={calendarFileUrl(token)}
                    startIcon={<DownloadOutlined />}
                    sx={{ borderRadius: 999, py: 1.25, color: BRAND.ink }}
                  >
                    Přidat do kalendáře
                  </Button>

                  <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 1, mb: 2.5 }}>
                    Stáhne soubor, který si otevřete v Google, Apple i jinde.
                  </Typography>

                  <Box sx={{ borderTop: `1px solid ${BRAND.line}`, pt: 2.5 }}>
                    {/*
                      The deadline, from the server. Both the moment and the
                      number of hours are the clinic's setting; nothing here
                      knows what it is.
                    */}
                    {mayChange ? (
                      <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                        Termín si můžete sami přesunout nebo zrušit
                        {booking.canChangeUntilUtc
                          ? ` do ${clinicMoment(booking.canChangeUntilUtc)}`
                          : ''}
                        {booking.changeDeadlineHours
                          ? ` (${booking.changeDeadlineHours} hodin před začátkem)`
                          : ''}
                        . Potom už jen telefonicky.{callUs}
                      </Typography>
                    ) : (
                      <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
                        Na změnu nebo zrušení online je už pozdě
                        {booking.changeDeadlineHours
                          ? ` — lhůta je ${booking.changeDeadlineHours} hodin před začátkem`
                          : ''}
                        .{callUs}
                      </Alert>
                    )}

                    {mayChange && !moving && (
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={startMoving}
                        startIcon={<EditCalendarOutlined />}
                        sx={{ borderRadius: 999, py: 1.1, mb: 1, borderColor: BRAND.accentEdge, color: BRAND.ink }}
                      >
                        Změnit termín
                      </Button>
                    )}

                    {moving && (
                      <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: BRAND.accentWash, border: `1px solid ${BRAND.accentEdge}` }}>
                        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Vyberte nový čas</Typography>
                        <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                          Nabízíme jen volné časy pro {booking.activityName || 'tuto činnost'} v příštích
                          {' '}{MOVE_WINDOW_DAYS} dnech. Původní čas uvolníme, jakmile změnu potvrdíte.
                        </Typography>

                        {daysFailed && (
                          <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}>
                            Volné časy se nepodařilo načíst.{callUs}
                          </Alert>
                        )}

                        {days === null && !daysFailed && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                            <Typography variant="body2" sx={{ color: BRAND.muted }}>Hledáme volné dny…</Typography>
                          </Box>
                        )}

                        {days !== null && days.length === 0 && (
                          <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                            V příštích {MOVE_WINDOW_DAYS} dnech není žádný volný čas.{callUs}
                          </Typography>
                        )}

                        {days !== null && days.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                            {days.map((day) => (
                              <Chip
                                key={day}
                                label={dayLabel(day)}
                                clickable
                                color={chosenDay === day ? 'primary' : 'default'}
                                onClick={() => { void pickDay(day); }}
                                sx={{ fontWeight: 600 }}
                              />
                            ))}
                          </Box>
                        )}

                        {chosenDay !== null && slots === null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                            <Typography variant="body2" sx={{ color: BRAND.muted }}>Hledáme volné časy…</Typography>
                          </Box>
                        )}

                        {chosenDay !== null && slots !== null && slots.length === 0 && (
                          <Typography variant="body2" sx={{ color: BRAND.muted }}>
                            Tento den už nemá jiný volný čas. Zkuste jiný den.
                          </Typography>
                        )}

                        {slots !== null && slots.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {slots.map((slot) => (
                              <Button
                                key={slot.startUtc}
                                variant="contained"
                                disableElevation
                                size="small"
                                onClick={() => setPendingSlot(slot)}
                                sx={{ borderRadius: 999, color: BRAND.ink, minWidth: 72 }}
                              >
                                {clinicTime(slot.startUtc)}
                              </Button>
                            ))}
                          </Box>
                        )}

                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => setMoving(false)}
                          sx={{ mt: 1.5, borderRadius: 999 }}
                        >
                          Nechat původní termín
                        </Button>
                      </Box>
                    )}

                    {mayChange && (
                      <>
                        <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                          Nemůžete přijít vůbec? Zrušte termín prosím co nejdřív, ať ho
                          můžeme nabídnout někomu jinému.
                        </Typography>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="inherit"
                          onClick={() => setAsking(true)}
                          sx={{ borderRadius: 999, py: 1.1, borderColor: BRAND.line }}
                        >
                          Zrušit termín
                        </Button>
                      </>
                    )}
                  </Box>
                </>
              )}
            </Card>
          )}

          <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2, textAlign: 'center' }}>
            K vyšetření si prosím vezměte výpis ze zdravotní dokumentace od
            svého praktického lékaře.
          </Typography>
        </Container>

        {/*
          Moving gives the old time away to whoever books it next. A confirm
          step for a one-click change is the least this owes somebody who
          tapped the wrong time on a phone.
        */}
        <Dialog open={pendingSlot !== null} onClose={() => setPendingSlot(null)}>
          <DialogTitle sx={{ fontWeight: 800 }}>Přesunout termín?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {booking !== null && pendingSlot !== null && (
                <>
                  Nově: <strong>{clinicMoment(pendingSlot.startUtc)}</strong>.
                  {' '}Původní čas {clinicMoment(booking.startUtc)} hned uvolníme ostatním.
                </>
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setPendingSlot(null)} color="inherit" sx={{ borderRadius: 999 }}>
              Zpět
            </Button>
            <Button
              onClick={() => { void confirmMove(); }}
              disabled={rescheduling}
              variant="contained"
              disableElevation
              sx={{ borderRadius: 999, color: BRAND.ink }}
            >
              {rescheduling ? 'Přesouváme…' : 'Ano, přesunout'}
            </Button>
          </DialogActions>
        </Dialog>

        {/*
          Cancelling gives the time away to whoever books it next, and there is
          no undo. A confirm step for a one-click irreversible action is the
          least this owes somebody who meant to press the other button.
        */}
        <Dialog open={asking} onClose={() => setAsking(false)}>
          <DialogTitle sx={{ fontWeight: 800 }}>Opravdu zrušit termín?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {booking !== null && clinicMoment(booking.startUtc)} — tento čas
              hned nabídneme dalším zájemcům a vrátit ho zpět už nepůjde.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setAsking(false)} color="inherit" sx={{ borderRadius: 999 }}>
              Nechat termín
            </Button>
            <Button
              onClick={() => { void confirmCancel(); }}
              disabled={cancelling}
              variant="contained"
              disableElevation
              sx={{ borderRadius: 999, color: BRAND.ink }}
            >
              {cancelling ? 'Rušíme…' : 'Ano, zrušit'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function Hero() {
  return (
    <Box
      sx={{
        bgcolor: BRAND.ink,
        color: '#FFFFFF',
        pt: { xs: 5, md: 7 },
        pb: { xs: 10, md: 13 },
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Typography sx={{ fontWeight: 900, letterSpacing: '-0.02em', fontSize: { xs: 22, md: 26 } }}>
          SportMedical{' '}
          <Box component="span" sx={{ color: BRAND.accent, letterSpacing: 2, fontWeight: 800 }}>
            DIAGNOSTICS
          </Box>
        </Typography>
        <Typography variant="h4" sx={{ mt: 2, fontSize: { xs: 26, md: 34 } }}>
          Vaše rezervace
        </Typography>
      </Container>
    </Box>
  );
}
