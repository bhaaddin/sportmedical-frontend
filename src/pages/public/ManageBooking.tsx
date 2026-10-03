/* ══════════════════════════════════════════════════════════════
   SPRÁVA REZERVACE  (route: /rezervace/:token)

   What the patient gets after booking: the appointment they made, a calendar
   file for whatever they use, and a button to cancel it.

   ── Why this file exists ──

   The confirmation screen has offered a "Správa rezervace" button since
   18. 9. 2026 pointing at /book/manage/{token}. No such route existed, so the
   button fell through to the catch-all, hit the AuthGuard, and put a patient on
   the STAFF LOGIN SCREEN — a login they can never pass, on their way to their
   own appointment. Measured on 19. 9. 2026 by clicking it.

   The server side was already finished and waiting: GET manage/{token},
   GET manage/{token}/calendar.ics and POST manage/{token}/cancel. This is the
   page they were built for.

   ── The token IS the identity ──

   The patient has no account, so holding this link is what proves the booking
   is theirs. That means the page shows only what somebody holding it is
   entitled to see — their činnost, their služba, their time — and nothing about
   the clinic's day, the worker, or anybody else.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import {
  EventAvailableOutlined,
  EventBusyOutlined,
  DownloadOutlined,
} from '@mui/icons-material';
import {
  ManageError,
  calendarFileUrl,
  cancelBooking,
  readBooking,
  rescheduleBooking,
} from '../../api/publicManage';
import type { ManagedBooking } from '../../api/publicManage';
import { freeDays, freeSlots } from '../../api/publicBooking';
import type { BookableSlot } from '../../api/publicBooking';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import PublicLayout from './PublicLayout';
import { BRAND } from '../../components/public/brand';
import { PageTitle, Panel, PublicMain } from '../../components/public/kit';
import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

/* The artboards' white panel; the content keeps its own spacing. */
function Card({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return <Panel component="div" sx={{ display: 'block', ...sx }}>{children}</Panel>;
}

/* Brand: the website identity every public page wears — components/public/brand.ts. */

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

/** A local calendar date (YYYY-MM-DD) for the availability query, no UTC shift. */
const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A short day label for a YYYY-MM-DD, read at noon so DST can't nudge the date. */
const dayLabel = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ', {
    weekday: 'short', day: 'numeric', month: 'numeric',
  });

/** The Prague clock time of a UTC instant, for a slot button. */
const slotTime = (utc: string): string =>
  new Date(utc).toLocaleTimeString('cs-CZ', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague',
  });

export default function ManageBooking() {
  const { token = '' } = useParams();

  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);

  /** The clinic's own number, from settings. Empty when nobody has set one. */
  const [clinic, setClinic] = useState<PublicClinic | null>(null);

  /* Reschedule: a dialog that fetches free days, then times, then moves. */
  const [moving, setMoving] = useState(false);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookableSlot[] | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingNow, setMovingNow] = useState(false);

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

  const confirmCancel = async (): Promise<void> => {
    setCancelling(true);
    setComplaint(null);

    try {
      setBooking(await cancelBooking(token));
      setAsking(false);
    } catch (error) {
      // The server's own sentence, not one repeated here. How late is too late
      // is a per-calendar setting now, so a number written into this file would
      // be wrong for every clinic that changed it.
      setComplaint(error instanceof ManageError
        ? error.message
        : 'Termín se nepodařilo zrušit.');
      setAsking(false);
    } finally {
      setCancelling(false);
    }
  };

  const canReschedule = booking !== null && !booking.isCancelled
    && booking.calendarId !== null && booking.activityId !== null;

  const openReschedule = async (): Promise<void> => {
    if (booking?.calendarId == null || booking.activityId == null) return;
    setMoving(true);
    setMoveError(null);
    setDay(null);
    setSlots(null);
    setDays(null);
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 60);
    try {
      setDays(await freeDays(booking.calendarId, booking.activityId, isoDate(from), isoDate(to)));
    } catch {
      setMoveError('Volné termíny se nepodařilo načíst.');
      setDays([]);
    }
  };

  const pickDay = async (chosen: string): Promise<void> => {
    if (booking?.calendarId == null || booking.activityId == null) return;
    setDay(chosen);
    setSlots(null);
    setMoveError(null);
    try {
      setSlots(await freeSlots(booking.calendarId, booking.activityId, chosen));
    } catch {
      setMoveError('Časy se nepodařilo načíst.');
      setSlots([]);
    }
  };

  const confirmMove = async (startUtc: string): Promise<void> => {
    setMovingNow(true);
    setMoveError(null);
    try {
      setBooking(await rescheduleBooking(token, startUtc, booking?.activityId ?? null));
      setMoving(false);
    } catch (error) {
      // Re-checked server-side: a time free when shown but taken since is refused
      // here, not silently overwritten — the server's own sentence is shown.
      setMoveError(error instanceof ManageError ? error.message : 'Termín se nepodařilo přesunout.');
    } finally {
      setMovingNow(false);
    }
  };

  return (
    <PublicLayout clinic={clinic}>
      <PublicMain maxWidth={640} gap={2.5}>
        <PageTitle>Vaše rezervace</PageTitle>

        <Box>
          {loadFailed !== null && (
            <Card sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 19, mb: 1 }}>
                Rezervaci jsme nenašli
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                {loadFailed} Odkaz mohl být neúplný, nebo už byl termín zrušen.
                {clinic?.phone.trim()
                  ? ` Zavolejte nám prosím na ${clinic.phone.trim()} a rádi to s vámi projdeme.`
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

                  {canReschedule && (
                    <Button
                      fullWidth
                      variant="outlined"
                      color="inherit"
                      onClick={() => { void openReschedule(); }}
                      sx={{ borderRadius: 999, py: 1.1, borderColor: BRAND.line, mb: 2.5 }}
                    >
                      Přesunout na jiný čas
                    </Button>
                  )}

                  <Box sx={{ borderTop: `1px solid ${BRAND.line}`, pt: 2.5 }}>
                    <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                      Nemůžete přijít? Zrušte termín prosím co nejdřív, ať ho
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
                  </Box>
                </>
              )}
            </Card>
          )}

        </Box>

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

        {/* Move the booking: pick a free day, then a free time; the server
            re-checks and refuses a time taken since it was shown. */}
        <Dialog open={moving} onClose={() => setMoving(false)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 800 }}>Přesunout termín</DialogTitle>
          <DialogContent>
            {moveError !== null && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{moveError}</Alert>
            )}

            {days === null ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <CircularProgress size={18} sx={{ color: BRAND.accent }} />
                <Typography variant="body2" sx={{ color: BRAND.muted }}>Hledáme volné dny…</Typography>
              </Box>
            ) : days.length === 0 ? (
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                V nejbližších týdnech není volný termín.
                {clinic?.phone.trim() ? ` Zavolejte nám prosím na ${clinic.phone.trim()}.` : ''}
              </Typography>
            ) : day === null ? (
              <>
                <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1 }}>Vyberte den:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {days.map((d) => (
                    <Button
                      key={d}
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => { void pickDay(d); }}
                      sx={{ borderRadius: 2, borderColor: BRAND.line }}
                    >
                      {dayLabel(d)}
                    </Button>
                  ))}
                </Box>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => { setDay(null); setSlots(null); }}
                  sx={{ mb: 1 }}
                >
                  ← jiný den
                </Button>
                <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1 }}>
                  {dayLabel(day)} — vyberte čas:
                </Typography>
                {slots === null ? (
                  <CircularProgress size={18} sx={{ color: BRAND.accent }} />
                ) : slots.length === 0 ? (
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Na tento den už není volno. Zkuste jiný.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {slots.map((s) => (
                      <Button
                        key={s.startUtc}
                        size="small"
                        variant="contained"
                        disableElevation
                        disabled={movingNow}
                        onClick={() => { void confirmMove(s.startUtc); }}
                        sx={{ borderRadius: 2, color: BRAND.ink }}
                      >
                        {slotTime(s.startUtc)}
                      </Button>
                    ))}
                  </Box>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setMoving(false)} color="inherit" sx={{ borderRadius: 999 }}>
              Zavřít
            </Button>
          </DialogActions>
        </Dialog>
      </PublicMain>
    </PublicLayout>
  );
}
