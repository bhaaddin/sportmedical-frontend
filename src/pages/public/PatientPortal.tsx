/* ══════════════════════════════════════════════════════════════
   PATIENT PORTAL  (route: /portal/:token; /portal shows the sign-in)

   The patient's own home: the next appointment, the rest of the upcoming
   ones, past visits, released documents, invoices, and the clinic's contacts.
   The token in the URL is the identity — the same model as the manage and
   completion links. A password is optional: set here, it lets the patient
   come back by e-mail instead of by link.

   Wears the website identity (ink, white, one orange accent), never the
   staff green.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container, Divider, Stack, TextField, Typography,
} from '@mui/material';
import {
  AddCircleOutlineOutlined, CalendarMonthOutlined, DescriptionOutlined, EmailOutlined, EventAvailableOutlined,
  HelpOutlineOutlined, HistoryOutlined, LockOutlined, LogoutOutlined, PhoneOutlined, PlaceOutlined,
  ReceiptLongOutlined, PersonOutlined, AssignmentOutlined, DirectionsOutlined,
} from '@mui/icons-material';
import {
  PortalAuthError, PortalCancelError, cancelPortalAppointment, changePortalPassword, forgetPortalToken,
  openPortal, portalDocumentUrl, rememberPortalToken, setPortalPassword, signOutEverywhere,
} from '../../api/patientPortal';
import type { PortalAppointment, PortalDashboard, PortalInvoice } from '../../api/patientPortal';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import PublicLayout from './PublicLayout';
import PatientSignIn from './PatientSignIn';
import { BRAND, clinicMoment, czk, mapsHref, telHref } from '../../components/public/brand';
import { LANDING_PATH, PORTAL_SIGN_IN_PATH } from '../../components/public/PublicHeader';

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Naplánováno',
  Confirmed: 'Potvrzeno',
  CheckedIn: 'Přišli jste',
  Completed: 'Hotovo',
};

/** How many characters a new password must have. The server has the last word. */
const MIN_PASSWORD = 8;

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

const canStillCancel = (appointment: PortalAppointment): boolean =>
  appointment.cancelUntilUtc != null && new Date(appointment.cancelUntilUtc).getTime() > Date.now();

/** "za 3 dny" / "zítra" / "dnes" — for the hero card; null when it is past. */
function daysAway(utc: string): string | null {
  const diff = Math.ceil((new Date(utc).getTime() - Date.now()) / (24 * 3600 * 1000));
  if (diff < 0) return null;
  if (diff === 0) return 'dnes';
  if (diff === 1) return 'zítra';
  if (diff <= 4) return `za ${diff} dny`;
  return `za ${diff} dní`;
}

function SectionTitle({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
      <Box sx={{ color: BRAND.accentDark, display: 'inline-flex' }}>{icon}</Box>
      <Typography variant="h6" sx={{ flex: 1 }}>{children}</Typography>
      {action}
    </Box>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] ?? status}
      sx={{ fontWeight: 700, bgcolor: BRAND.accentWash, color: BRAND.accentDark }}
    />
  );
}

/** The next visit, large: the one thing the patient opened the portal for. */
function NextAppointmentCard({
  appointment, onCancel,
}: {
  appointment: PortalAppointment;
  onCancel: (appointment: PortalAppointment) => void;
}) {
  const soon = daysAway(appointment.startUtc);
  return (
    <Card sx={{ p: { xs: 2.5, md: 3 }, borderColor: BRAND.accentEdge, boxShadow: BRAND.shadow }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: BRAND.accentDark }}>
          Váš příští termín
        </Typography>
        {soon !== null && (
          <Chip size="small" label={soon} sx={{ bgcolor: BRAND.ink, color: BRAND.accent, height: 20, fontSize: 11 }} />
        )}
        <Box sx={{ flex: 1 }} />
        <StatusPill status={appointment.status} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 26 }, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
        {clinicMoment(appointment.startUtc)}
      </Typography>
      <Typography sx={{ color: BRAND.muted, fontSize: 16, mt: 0.5 }}>
        {appointment.activityName || 'Termín'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
        <Button
          variant="contained"
          startIcon={<CalendarMonthOutlined />}
          onClick={() => addToCalendar(appointment)}
          sx={{ color: BRAND.ink }}
        >
          Do kalendáře
        </Button>
        {canStillCancel(appointment) && (
          <Button variant="outlined" onClick={() => onCancel(appointment)}>
            Zrušit termín
          </Button>
        )}
      </Box>
    </Card>
  );
}

function AppointmentRow({
  appointment, past = false, onCancel,
}: {
  appointment: PortalAppointment;
  past?: boolean;
  /** Offered only for an upcoming appointment the patient may still cancel. */
  onCancel?: (appointment: PortalAppointment) => void;
}) {
  const canCancel = !past && onCancel !== undefined && canStillCancel(appointment);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
      <Box
        sx={{
          width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
          bgcolor: past ? BRAND.page : BRAND.accentWash,
          border: `1px solid ${past ? BRAND.line : BRAND.accentEdge}`,
          display: 'grid', placeItems: 'center', color: past ? BRAND.muted : BRAND.accentDark,
        }}
      >
        {past ? <HistoryOutlined /> : <EventAvailableOutlined />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>{appointment.activityName || 'Termín'}</Typography>
        <Typography variant="body2" sx={{ color: BRAND.muted }}>
          {clinicMoment(appointment.startUtc)}
        </Typography>
      </Box>
      <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
        <StatusPill status={appointment.status} />
        {!past && (
          <Button
            size="small"
            startIcon={<CalendarMonthOutlined sx={{ fontSize: 16 }} />}
            onClick={() => addToCalendar(appointment)}
            sx={{ color: BRAND.accentDark, minWidth: 0, px: 0.5, fontSize: 12, minHeight: 28 }}
          >
            Do kalendáře
          </Button>
        )}
        {canCancel && (
          <Button
            size="small"
            onClick={() => onCancel?.(appointment)}
            sx={{ color: BRAND.muted, minWidth: 0, px: 0.5, fontSize: 12, minHeight: 28 }}
          >
            Zrušit termín
          </Button>
        )}
      </Stack>
    </Box>
  );
}

function InvoiceRow({ invoice }: { invoice: PortalInvoice }) {
  const unpaid = invoice.remainingCzk > 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25 }}>
      <ReceiptLongOutlined sx={{ color: BRAND.muted }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{invoice.number}</Typography>
        <Typography variant="caption" sx={{ color: BRAND.muted }}>
          Vystaveno {new Date(invoice.issuedAtUtc).toLocaleDateString('cs-CZ')}
          {unpaid && invoice.dueAtUtc && ` · splatnost ${new Date(invoice.dueAtUtc).toLocaleDateString('cs-CZ')}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontWeight: 800 }}>{czk(invoice.totalCzk) ?? ''}</Typography>
        {unpaid ? (
          <Chip
            size="small"
            label={invoice.remainingCzk < invoice.totalCzk ? `Nezaplaceno · zbývá ${czk(invoice.remainingCzk)}` : 'Nezaplaceno'}
            sx={{ bgcolor: BRAND.warnWash, color: BRAND.warn, height: 20, fontSize: 11, mt: 0.25 }}
          />
        ) : (
          <Chip size="small" label="Zaplaceno" sx={{ bgcolor: BRAND.successWash, color: BRAND.success, height: 20, fontSize: 11, mt: 0.25 }} />
        )}
      </Box>
    </Box>
  );
}

/**
 * Where to turn when self-service cannot do it: the clinic's own telephone,
 * e-mail and address, read from Nastavení — nothing is written into the page,
 * and only what the clinic has filled in is shown.
 */
function ClinicContactCard({ clinic }: { clinic: PublicClinic | null }) {
  if (clinic === null) return null;
  const phone = clinic.phone.trim();
  const email = clinic.email.trim();
  const address = clinic.address.trim();
  if (phone === '' && email === '' && address === '') return null;

  const line = { display: 'flex', alignItems: 'center', gap: 1.25 } as const;
  const link = { color: 'inherit', fontWeight: 600, textDecoration: 'none' } as const;

  return (
    <Card sx={{ p: { xs: 2.5, md: 3 } }}>
      <SectionTitle icon={<HelpOutlineOutlined />}>Potřebujete pomoc?</SectionTitle>
      <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
        Co tu nejde vyřídit — jiný termín, dotaz k vyšetření — domluvíte přímo s ordinací.
      </Typography>
      <Stack spacing={1}>
        {phone !== '' && (
          <Box sx={line}>
            <PhoneOutlined sx={{ color: BRAND.muted }} />
            <Typography component="a" href={telHref(phone)} sx={link}>{phone}</Typography>
          </Box>
        )}
        {email !== '' && (
          <Box sx={line}>
            <EmailOutlined sx={{ color: BRAND.muted }} />
            <Typography component="a" href={`mailto:${email}`} sx={{ ...link, overflowWrap: 'anywhere' }}>{email}</Typography>
          </Box>
        )}
        {address !== '' && (
          <Box sx={line}>
            <PlaceOutlined sx={{ color: BRAND.muted }} />
            <Typography sx={{ fontWeight: 600 }}>{address}</Typography>
          </Box>
        )}
        {clinic.openingHours && (
          <Typography variant="body2" sx={{ color: BRAND.muted, pl: 4.5 }}>{clinic.openingHours}</Typography>
        )}
      </Stack>
      {address !== '' && (
        <Button
          size="small"
          variant="outlined"
          href={mapsHref(address)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<DirectionsOutlined />}
          sx={{ mt: 2 }}
        >
          Navigovat
        </Button>
      )}
    </Card>
  );
}

/** Set the first password, or change it. */
function PasswordCard({
  token, hasPassword, email, onPasswordSet,
}: {
  token: string;
  hasPassword: boolean;
  email: string | null;
  onPasswordSet: () => void;
}) {
  const [open, setOpen] = useState(!hasPassword);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'warning'; text: string } | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setNotice({ severity: 'warning', text: `Heslo musí mít alespoň ${MIN_PASSWORD} znaků.` });
      return;
    }
    if (password !== confirm) {
      setNotice({ severity: 'warning', text: 'Hesla se neshodují.' });
      return;
    }
    if (hasPassword && current === '') {
      setNotice({ severity: 'warning', text: 'Zadejte prosím současné heslo.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      if (hasPassword) await changePortalPassword(token, current, password);
      else await setPortalPassword(token, password);
      setCurrent('');
      setPassword('');
      setConfirm('');
      setOpen(false);
      setNotice({
        severity: 'success',
        text: hasPassword
          ? 'Heslo je změněné.'
          : `Heslo je nastavené. Příště se přihlásíte e-mailem${email ? ` ${email}` : ''} a tímto heslem.`,
      });
      onPasswordSet();
    } catch (error) {
      setNotice({
        severity: 'warning',
        text: error instanceof PortalAuthError ? error.message : 'Heslo se nepodařilo uložit.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2.5, md: 3 }, ...(hasPassword ? {} : { borderColor: BRAND.accentEdge, bgcolor: BRAND.accentWash }) }}>
      <SectionTitle icon={<LockOutlined />}>
        {hasPassword ? 'Heslo' : 'Nastavte si heslo'}
      </SectionTitle>
      <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
        {hasPassword
          ? `Přihlašujete se e-mailem${email ? ` ${email}` : ''}. Heslo můžete kdykoli změnit.`
          : 'S heslem se do portálu dostanete kdykoli z adresy /portal — nebudete potřebovat tento odkaz.'}
      </Typography>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 1.5 }}>
          {notice.text}
        </Alert>
      )}

      {!open ? (
        <Button variant="outlined" size="small" onClick={() => setOpen(true)}>
          {hasPassword ? 'Změnit heslo' : 'Nastavit heslo'}
        </Button>
      ) : (
        <Box component="form" onSubmit={(event) => { void submit(event); }} noValidate sx={{ display: 'grid', gap: 1.5 }}>
          {hasPassword && (
            <TextField
              label="Současné heslo"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              fullWidth
              size="small"
            />
          )}
          <TextField
            label="Nové heslo"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText={`Alespoň ${MIN_PASSWORD} znaků.`}
            fullWidth
            size="small"
          />
          <TextField
            label="Nové heslo znovu"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            fullWidth
            size="small"
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button type="submit" variant="contained" disabled={busy} sx={{ color: BRAND.ink }}>
              {busy ? 'Ukládám…' : hasPassword ? 'Změnit heslo' : 'Uložit heslo'}
            </Button>
            {hasPassword && (
              <Button variant="outlined" onClick={() => { setOpen(false); setNotice(null); }}>Zrušit</Button>
            )}
          </Box>
        </Box>
      )}
    </Card>
  );
}

export default function PatientPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [notice, setNotice] = useState<{ severity: 'success' | 'warning'; text: string } | null>(null);
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'no-token'>(
    token ? 'loading' : 'no-token',
  );

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return undefined;
    }
    let alive = true;
    void openPortal(token).then((data) => {
      if (!alive) return;
      if (data === null) {
        setState('error');
      } else {
        setDashboard(data);
        setState('ok');
        // The link that worked becomes this tab's sign-in, so "Můj portál" in
        // the header and /portal lead back here until the tab closes.
        rememberPortalToken(token);
      }
    });
    readPublicClinic()
      .then((details) => { if (alive) setClinic(details); })
      .catch(() => { /* no contact card rather than a broken one */ });
    return () => {
      alive = false;
    };
  }, [token]);

  /* Cancel one of the patient's own upcoming appointments (15.05). The server
     applies the clinic's deadline; the dashboard is re-read so what is shown is
     what the server now holds, never a guess. */
  const cancel = async (appointment: PortalAppointment) => {
    if (!token) return;
    if (!window.confirm(`Opravdu zrušit termín ${clinicMoment(appointment.startUtc)}?`)) return;
    try {
      await cancelPortalAppointment(token, appointment.id);
      const fresh = await openPortal(token);
      if (fresh !== null) setDashboard(fresh);
      setNotice({ severity: 'success', text: 'Termín byl zrušen.' });
    } catch (error) {
      setNotice({
        severity: 'warning',
        text: error instanceof PortalCancelError ? error.message : 'Termín se nepodařilo zrušit.',
      });
    }
  };

  const signOut = (): void => {
    forgetPortalToken();
    navigate(PORTAL_SIGN_IN_PATH, { replace: true });
  };

  const signOutEverywhereNow = async (): Promise<void> => {
    if (!token) return;
    if (!window.confirm('Odhlásit se ze všech zařízení? Odkazy a přihlášení, které teď používáte, přestanou platit.')) return;
    try {
      await signOutEverywhere(token);
      signOut();
    } catch (error) {
      setNotice({
        severity: 'warning',
        text: error instanceof PortalAuthError ? error.message : 'Odhlášení se nepodařilo.',
      });
    }
  };

  /* /portal without a token is the sign-in page. */
  if (state === 'no-token') return <PatientSignIn />;

  const [next, ...otherUpcoming] = dashboard?.appointments ?? [];
  const hasPassword = dashboard?.hasPassword === true;
  const email = dashboard?.email ?? null;
  const questionnaire = dashboard?.questionnaireStatus ?? null;
  const invoices = dashboard?.invoices ?? [];
  const unpaidCount = invoices.filter((inv) => inv.remainingCzk > 0).length;

  const headerActions = state === 'ok' ? (
    <Button
      onClick={signOut}
      startIcon={<LogoutOutlined sx={{ fontSize: 18 }} />}
      sx={{ color: BRAND.onInk, fontWeight: 600, fontSize: 14, minHeight: 36, px: 1.5, '&:hover': { color: '#FFFFFF', bgcolor: BRAND.onInkWash } }}
    >
      Odhlásit
    </Button>
  ) : undefined;

  return (
    <PublicLayout clinic={clinic} hidePortalLink extra={headerActions}>
      <Box sx={{ bgcolor: BRAND.ink, color: '#fff', pt: { xs: 4, md: 6 }, pb: { xs: 7, md: 9 } }}>
        <Container maxWidth="md">
          <Typography sx={{ color: BRAND.accent, fontWeight: 800, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Můj portál
          </Typography>
          <Typography component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: 28, md: 36 }, mt: 1, lineHeight: 1.1 }}>
            {state === 'ok' && dashboard ? `Dobrý den, ${dashboard.givenName}` : 'Váš portál'}
          </Typography>
          {state === 'ok' && (
            <Typography sx={{ color: BRAND.onInk, mt: 1 }}>
              Vaše termíny, dokumenty a doklady na jednom místě.
            </Typography>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ mt: { xs: -5, md: -6 }, pb: 8 }}>
        {state === 'loading' && (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={26} sx={{ color: BRAND.accent }} />
            <Typography sx={{ mt: 1.5, color: BRAND.muted }}>Načítáme váš portál…</Typography>
          </Card>
        )}

        {state === 'error' && (
          <Card sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Tento odkaz už neplatí nebo je neúplný. Požádejte prosím ordinaci o nový.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" component={RouterLink} to={PORTAL_SIGN_IN_PATH} onClick={forgetPortalToken} sx={{ color: BRAND.ink }}>
                Přihlásit se heslem
              </Button>
              <Button variant="outlined" component={RouterLink} to={LANDING_PATH}>Objednat se</Button>
            </Box>
          </Card>
        )}

        {state === 'ok' && dashboard && (
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, alignItems: 'start' }}>
            {/* ── Main column ── */}
            <Stack spacing={2.5}>
              {notice && (
                <Alert severity={notice.severity} onClose={() => setNotice(null)}>
                  {notice.text}
                </Alert>
              )}

              {next !== undefined ? (
                <NextAppointmentCard appointment={next} onCancel={cancel} />
              ) : (
                <Card sx={{ p: { xs: 2.5, md: 3 }, borderColor: BRAND.accentEdge }}>
                  <SectionTitle icon={<EventAvailableOutlined />}>Vaše nadcházející termíny</SectionTitle>
                  <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2 }}>
                    Nemáte žádný nadcházející termín.
                  </Typography>
                  <Button variant="contained" component={RouterLink} to={LANDING_PATH} startIcon={<AddCircleOutlineOutlined />} sx={{ color: BRAND.ink }}>
                    Objednat termín
                  </Button>
                </Card>
              )}

              {questionnaire === 'Missing' && (
                <Alert severity="warning" icon={<AssignmentOutlined />}>
                  K příštímu termínu zatím chybí vyplněný zdravotní dotazník. Vyplňte ho prosím
                  z odkazu, který jste dostali, nebo ho doplníte na místě.
                </Alert>
              )}
              {questionnaire === 'Complete' && (
                <Alert severity="success" icon={<AssignmentOutlined />}>
                  Zdravotní dotazník máme vyplněný. Na místě už nic nevyplňujete.
                </Alert>
              )}

              {otherUpcoming.length > 0 && (
                <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                  <SectionTitle icon={<EventAvailableOutlined />}>Další termíny</SectionTitle>
                  {otherUpcoming.map((a, i) => (
                    <Box key={`${a.startUtc}-${i}`}>
                      {i > 0 && <Divider />}
                      <AppointmentRow appointment={a} onCancel={cancel} />
                    </Box>
                  ))}
                </Card>
              )}

              {next !== undefined && (
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={LANDING_PATH}
                  startIcon={<AddCircleOutlineOutlined />}
                  sx={{ justifySelf: 'start', alignSelf: 'flex-start' }}
                >
                  Objednat další termín
                </Button>
              )}

              <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                <SectionTitle icon={<DescriptionOutlined />}>Dokumenty</SectionTitle>
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

              {invoices.length > 0 && (
                <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                  <SectionTitle
                    icon={<ReceiptLongOutlined />}
                    action={unpaidCount > 0 ? (
                      <Chip size="small" label={`${unpaidCount} nezaplaceno`} sx={{ bgcolor: BRAND.warnWash, color: BRAND.warn }} />
                    ) : undefined}
                  >
                    Doklady
                  </SectionTitle>
                  {invoices.map((inv, i) => (
                    <Box key={inv.number || `inv-${i}`}>
                      {i > 0 && <Divider />}
                      <InvoiceRow invoice={inv} />
                    </Box>
                  ))}
                </Card>
              )}

              {dashboard.pastAppointments.length > 0 && (
                <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                  <SectionTitle icon={<HistoryOutlined />}>Vaše návštěvy</SectionTitle>
                  {dashboard.pastAppointments.map((a, i) => (
                    <Box key={`past-${a.startUtc}-${i}`}>
                      {i > 0 && <Divider />}
                      <AppointmentRow appointment={a} past />
                    </Box>
                  ))}
                </Card>
              )}
            </Stack>

            {/* ── Side column ── */}
            <Stack spacing={2.5}>
              {token && (
                <PasswordCard
                  token={token}
                  hasPassword={hasPassword}
                  email={email}
                  onPasswordSet={() => setDashboard((d) => (d ? { ...d, hasPassword: true } : d))}
                />
              )}

              <ClinicContactCard clinic={clinic} />

              <Card sx={{ p: { xs: 2.5, md: 3 } }}>
                <SectionTitle icon={<PersonOutlined />}>Účet</SectionTitle>
                <Typography sx={{ fontWeight: 700 }}>
                  {dashboard.givenName} {dashboard.familyName}
                </Typography>
                {email && (
                  <Typography variant="body2" sx={{ color: BRAND.muted, overflowWrap: 'anywhere' }}>{email}</Typography>
                )}
                <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 1 }}>
                  Tento odkaz je jen pro vás, nesdílejte ho.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Button size="small" variant="outlined" onClick={signOut} startIcon={<LogoutOutlined sx={{ fontSize: 16 }} />}>
                    Odhlásit
                  </Button>
                  <Button size="small" onClick={() => { void signOutEverywhereNow(); }} sx={{ color: BRAND.muted }}>
                    Odhlásit všude
                  </Button>
                </Box>
              </Card>
            </Stack>
          </Box>
        )}
      </Container>
    </PublicLayout>
  );
}
