/* ══════════════════════════════════════════════════════════════
   PATIENT PORTAL  (route: /portal/:token)

   The patient's own home. They open their personal link and see their upcoming
   appointments — no account, no password; the token in the URL is the identity,
   the same model as the completion and manage links. Branded like the rest of
   the patient-facing pages (near-black, one orange accent, Inter), not the staff
   teal.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container, Divider, Stack, Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  EventAvailableOutlined, DescriptionOutlined, PersonOutlined, CalendarMonthOutlined,
  HistoryOutlined, ReceiptLongOutlined,
} from '@mui/icons-material';
import { openPortal, portalDocumentUrl } from '../../api/patientPortal';
import type { PortalAppointment, PortalDashboard } from '../../api/patientPortal';

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

const portalTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: BRAND.muted },
    divider: BRAND.line,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: INTER,
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h6: { fontWeight: 800 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Naplánováno',
  Confirmed: 'Potvrzeno',
  CheckedIn: 'Přišli jste',
  Completed: 'Hotovo',
};

function clinicMoment(utc: string): string {
  return new Date(utc).toLocaleString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Prague',
  });
}

/** UTC instant as an iCalendar stamp: 20260929T083000Z. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Builds a one-event .ics from the appointment and hands it to the browser to
 * download — the patient adds it to Google or Apple Calendar. Client-side, so it
 * needs nothing from the server.
 */
function addToCalendar(appointment: PortalAppointment): void {
  const summary = `SportMedical — ${appointment.activityName || 'Termín'}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SportMedical//Portal//CS',
    'BEGIN:VEVENT',
    `UID:${icsStamp(appointment.startUtc)}-sportmedical@portal`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(appointment.startUtc)}`,
    `DTEND:${icsStamp(appointment.endUtc)}`,
    `SUMMARY:${summary}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'termin.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    /* download blocked — nothing to do; the time is on screen. */
  }
}

function AppointmentRow({ appointment, past = false }: { appointment: PortalAppointment; past?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
      <Box
        sx={{
          width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
          bgcolor: BRAND.accentWash, border: `1px solid ${BRAND.accentEdge}`,
          display: 'grid', placeItems: 'center', color: BRAND.accentDark,
        }}
      >
        <EventAvailableOutlined />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>{appointment.activityName || 'Termín'}</Typography>
        <Typography variant="body2" sx={{ color: BRAND.muted }}>
          {clinicMoment(appointment.startUtc)}
        </Typography>
      </Box>
      <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
        <Chip
          size="small"
          label={STATUS_LABELS[appointment.status] ?? appointment.status}
          sx={{ fontWeight: 700, bgcolor: BRAND.accentWash, color: BRAND.accentDark }}
        />
        {!past && (
          <Button
            size="small"
            startIcon={<CalendarMonthOutlined sx={{ fontSize: 16 }} />}
            onClick={() => addToCalendar(appointment)}
            sx={{ color: BRAND.accentDark, minWidth: 0, px: 0.5, fontSize: 12 }}
          >
            Do kalendáře
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default function PatientPortal() {
  const { token } = useParams<{ token: string }>();
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'no-token'>(
    token ? 'loading' : 'no-token',
  );

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return;
    }
    let alive = true;
    void openPortal(token).then((data) => {
      if (!alive) return;
      if (data === null) {
        setState('error');
      } else {
        setDashboard(data);
        setState('ok');
      }
    });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <ThemeProvider theme={portalTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page }}>
        {/* Header */}
        <Box sx={{ bgcolor: BRAND.ink, color: '#fff', px: 2, pt: { xs: 4, md: 6 }, pb: { xs: 7, md: 9 } }}>
          <Container maxWidth="sm">
            <Typography variant="body2" sx={{ color: BRAND.accent, fontWeight: 700, letterSpacing: 1 }}>
              SPORTMEDICAL · MŮJ PORTÁL
            </Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {state === 'ok' && dashboard
                ? `Dobrý den, ${dashboard.givenName}`
                : 'Váš portál'}
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="sm" sx={{ mt: { xs: -5, md: -6 }, pb: 8 }}>
          {state === 'loading' && (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={26} sx={{ color: BRAND.accent }} />
              <Typography sx={{ mt: 1.5, color: BRAND.muted }}>Načítáme váš portál…</Typography>
            </Card>
          )}

          {state === 'error' && (
            <Card sx={{ p: 3 }}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Tento odkaz už neplatí nebo je neúplný. Požádejte prosím ordinaci o nový.
              </Alert>
            </Card>
          )}

          {state === 'no-token' && (
            <Card sx={{ p: 3 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Otevřete prosím svůj osobní odkaz do portálu — dostanete ho od ordinace
                e-mailem nebo při registraci. Bez něj se do portálu nedá přihlásit.
              </Alert>
            </Card>
          )}

          {state === 'ok' && dashboard && (
            <Stack spacing={2.5}>
              <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                  <EventAvailableOutlined sx={{ color: BRAND.accentDark }} />
                  <Typography variant="h6">Vaše nadcházející termíny</Typography>
                </Box>
                {dashboard.appointments.length === 0 ? (
                  <Typography variant="body2" sx={{ color: BRAND.muted, py: 1 }}>
                    Nemáte žádný nadcházející termín.
                  </Typography>
                ) : (
                  dashboard.appointments.map((a, i) => (
                    <Box key={`${a.startUtc}-${i}`}>
                      {i > 0 && <Divider />}
                      <AppointmentRow appointment={a} />
                    </Box>
                  ))
                )}
              </Card>

              {dashboard.pastAppointments.length > 0 && (
                <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <HistoryOutlined sx={{ color: BRAND.accentDark }} />
                    <Typography variant="h6">Vaše návštěvy</Typography>
                  </Box>
                  {dashboard.pastAppointments.map((a, i) => (
                    <Box key={`past-${a.startUtc}-${i}`}>
                      {i > 0 && <Divider />}
                      <AppointmentRow appointment={a} past />
                    </Box>
                  ))}
                </Card>
              )}

              <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                  <DescriptionOutlined sx={{ color: BRAND.accentDark }} />
                  <Typography variant="h6">Dokumenty</Typography>
                </Box>
                {dashboard.documents.length === 0 ? (
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Zatím tu nemáte žádné dokumenty. Jakmile vám je ordinace uvolní, objeví se zde.
                  </Typography>
                ) : (
                  dashboard.documents.map((d, i) => (
                    <Box key={d.id}>
                      {i > 0 && <Divider />}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                        <DescriptionOutlined sx={{ color: BRAND.muted }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{d.title}</Typography>
                          <Typography variant="caption" sx={{ color: BRAND.muted }}>
                            Zpřístupněno {new Date(d.issuedAtUtc).toLocaleDateString('cs-CZ')}
                          </Typography>
                        </Box>
                        <Button
                          component="a"
                          href={portalDocumentUrl(token ?? '', d.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="outlined"
                          size="small"
                          aria-label={`Otevřít dokument ${d.title}`}
                        >
                          Otevřít
                        </Button>
                      </Box>
                    </Box>
                  ))
                )}
              </Card>

              {(dashboard.invoices?.length ?? 0) > 0 && (
                <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <ReceiptLongOutlined sx={{ color: BRAND.accentDark }} />
                    <Typography variant="h6">Faktury</Typography>
                  </Box>
                  {dashboard.invoices!.map((inv, i) => (
                    <Box key={inv.number || `inv-${i}`}>
                      {i > 0 && <Divider />}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                        <ReceiptLongOutlined sx={{ color: BRAND.muted }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }}>{inv.number}</Typography>
                          <Typography variant="caption" sx={{ color: BRAND.muted }}>
                            Vystaveno {new Date(inv.issuedAtUtc).toLocaleDateString('cs-CZ')}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 700 }}>
                            {inv.totalCzk.toLocaleString('cs-CZ')} Kč
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: inv.remainingCzk > 0 ? BRAND.accentDark : BRAND.muted }}
                          >
                            {inv.remainingCzk > 0
                              ? `Zbývá ${inv.remainingCzk.toLocaleString('cs-CZ')} Kč`
                              : 'Zaplaceno'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Card>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: BRAND.muted, px: 1 }}>
                <PersonOutlined sx={{ fontSize: 18 }} />
                <Typography variant="caption">
                  {dashboard.givenName} {dashboard.familyName} — tento odkaz je jen pro vás, nesdílejte ho.
                </Typography>
              </Box>
            </Stack>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}
