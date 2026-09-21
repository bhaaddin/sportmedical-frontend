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
  Card,
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
} from '@mui/icons-material';
import {
  ManageError,
  calendarFileUrl,
  cancelBooking,
  readBooking,
} from '../../api/publicManage';
import type { ManagedBooking } from '../../api/publicManage';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';

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

export default function ManageBooking() {
  const { token = '' } = useParams();

  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);

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

          <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2, textAlign: 'center' }}>
            K vyšetření si prosím vezměte výpis ze zdravotní dokumentace od
            svého praktického lékaře.
          </Typography>
        </Container>

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
