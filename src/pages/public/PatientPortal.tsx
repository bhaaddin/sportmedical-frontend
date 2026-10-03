/* ══════════════════════════════════════════════════════════════
   PATIENT PORTAL  (route: /portal/:token; /portal shows the sign-in —
   artboards V-Portal and V-Vysledky)

   The patient's own home: the next appointment, the rest of the upcoming ones,
   past visits, released documents, invoices, the clinic's contacts and — in its
   own tab — the results of their diagnostic sessions. The token in the URL is
   the identity (the same model as the manage and completion links). A password
   is optional: set here, it lets the patient come back by e-mail instead of by
   link.

   Wears the V-Web2 frame (PublicLayout) with a Přehled · Výsledky · Dokumenty ·
   Termíny sub-bar. Phone: one column, the booking action pinned at the bottom.
   iPad and desktop: the artboard's main column beside a narrower one.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, TextField, Typography } from '@mui/material';
import {
  CalendarMonthOutlined, DirectionsOutlined, EmailOutlined, LogoutOutlined, PhoneOutlined, PlaceOutlined,
} from '@mui/icons-material';
import {
  PortalAuthError, PortalCancelError, cancelPortalAppointment, changePortalPassword, forgetPortalToken,
  openPortal, portalDocumentUrl, rememberPortalToken, setPortalPassword, signOutEverywhere,
} from '../../api/patientPortal';
import type { PortalAppointment, PortalDashboard, PortalInvoice } from '../../api/patientPortal';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import { useDevice } from '../../layout/useDevice';
import PublicLayout from './PublicLayout';
import PatientSignIn from './PatientSignIn';
import PortalNav from './portal/PortalNav';
import type { PortalView } from './portal/PortalNav';
import ResultsView, { MeasurementTiles } from './portal/ResultsView';
import { toMeasurements } from './portal/resultsModel';
import {
  ARCHIVO, BRAND, clinicMoment, czk, mapsHref, telHref,
} from '../../components/public/brand';
import {
  FieldLabel, LABEL_COLOR, LoadError, Panel, PanelTitle, PinnedBar, PageTitle, PublicMain, ctaSx, ghostSx, NoticeBox,
} from '../../components/public/kit';
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

/** "30 minut" from the appointment's own start and end, or null. */
function lengthText(appointment: PortalAppointment): string | null {
  const minutes = Math.round((new Date(appointment.endUtc).getTime() - new Date(appointment.startUtc).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} minut` : null;
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
  appointment, address, onCancel,
}: {
  appointment: PortalAppointment;
  address: string;
  onCancel: (appointment: PortalAppointment) => void;
}) {
  const soon = daysAway(appointment.startUtc);
  const length = lengthText(appointment);
  const where = [length, address].filter((p): p is string => p !== null && p !== '').join(' · ');
  return (
    <Panel labelledBy="next-appointment" sx={{ borderColor: BRAND.accentEdge, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <FieldLabel sx={{ color: BRAND.accentDark }}>
          <span id="next-appointment">Váš příští termín</span>
        </FieldLabel>
        {soon !== null && (
          <Chip size="small" label={soon} sx={{ bgcolor: BRAND.ink, color: BRAND.accent, height: 20, fontSize: 11 }} />
        )}
        <Box sx={{ flex: 1 }} />
        <StatusPill status={appointment.status} />
      </Box>
      <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: { xs: 22, md: 26 }, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {clinicMoment(appointment.startUtc)}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{appointment.activityName || 'Termín'}</Typography>
      {where !== '' && <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{where}</Typography>}

      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mt: 1 }}>
        <Button variant="contained" startIcon={<CalendarMonthOutlined />} onClick={() => addToCalendar(appointment)} sx={ctaSx(46)}>
          Do kalendáře
        </Button>
        {canStillCancel(appointment) && (
          <Button variant="outlined" onClick={() => onCancel(appointment)} sx={ghostSx(46)}>
            Zrušit termín
          </Button>
        )}
      </Box>
    </Panel>
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
    <Box component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.5, borderTop: `1px solid ${BRAND.line}`, '&:first-of-type': { borderTop: 'none' } }}>
      <Box
        aria-hidden="true"
        sx={{ width: 8, height: 8, borderRadius: '50%', flex: '0 0 8px', mt: '8px', bgcolor: past ? '#C8C2B8' : BRAND.accent }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{appointment.activityName || 'Termín'}</Typography>
        <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
          {clinicMoment(appointment.startUtc)}
          {STATUS_LABELS[appointment.status] !== undefined ? ` · ${STATUS_LABELS[appointment.status].toLowerCase()}` : ''}
        </Typography>
        {!past && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
            <Button
              size="small"
              startIcon={<CalendarMonthOutlined sx={{ fontSize: 16 }} />}
              onClick={() => addToCalendar(appointment)}
              sx={{ color: '#A8560D', minHeight: 44, px: 1, fontSize: 13 }}
            >
              Do kalendáře
            </Button>
            {canCancel && (
              <Button size="small" onClick={() => onCancel?.(appointment)} sx={{ color: LABEL_COLOR, minHeight: 44, px: 1, fontSize: 13 }}>
                Zrušit termín
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function InvoiceRow({ invoice }: { invoice: PortalInvoice }) {
  const unpaid = invoice.remainingCzk > 0;
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderTop: `1px solid ${BRAND.line}`, '&:first-of-type': { borderTop: 'none' } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{invoice.number}</Typography>
        <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>
          Vystaveno {new Date(invoice.issuedAtUtc).toLocaleDateString('cs-CZ')}
          {unpaid && invoice.dueAtUtc && ` · splatnost ${new Date(invoice.dueAtUtc).toLocaleDateString('cs-CZ')}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 800 }}>{czk(invoice.totalCzk) ?? ''}</Typography>
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

const plainList = { listStyle: 'none', m: 0, p: 0 } as const;

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

  const line = { display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 44 } as const;
  const link = { color: 'inherit', fontWeight: 600, textDecoration: 'none' } as const;

  return (
    <Panel labelledBy="portal-help">
      <PanelTitle id="portal-help">Potřebujete pomoc?</PanelTitle>
      <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
        Co tu nejde vyřídit — jiný termín, dotaz k vyšetření — domluvíte přímo s ordinací.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {phone !== '' && (
          <Box sx={line}>
            <PhoneOutlined sx={{ color: LABEL_COLOR }} />
            <Typography component="a" href={telHref(phone)} sx={link}>{phone}</Typography>
          </Box>
        )}
        {email !== '' && (
          <Box sx={line}>
            <EmailOutlined sx={{ color: LABEL_COLOR }} />
            <Typography component="a" href={`mailto:${email}`} sx={{ ...link, overflowWrap: 'anywhere' }}>{email}</Typography>
          </Box>
        )}
        {address !== '' && (
          <Box sx={line}>
            <PlaceOutlined sx={{ color: LABEL_COLOR }} />
            <Typography sx={{ fontWeight: 600 }}>{address}</Typography>
          </Box>
        )}
        {clinic.openingHours && (
          <Typography sx={{ fontSize: 14, color: LABEL_COLOR, pl: 4.5 }}>{clinic.openingHours}</Typography>
        )}
      </Box>
      {address !== '' && (
        <Box>
          <Button variant="outlined" href={mapsHref(address)} target="_blank" rel="noopener noreferrer" startIcon={<DirectionsOutlined />} sx={ghostSx(44)}>
            Navigovat
          </Button>
        </Box>
      )}
    </Panel>
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
    <Panel labelledBy="portal-password" sx={hasPassword ? undefined : { borderColor: BRAND.accentEdge, bgcolor: BRAND.accentWash }}>
      <PanelTitle id="portal-password">{hasPassword ? 'Heslo' : 'Nastavte si heslo'}</PanelTitle>
      <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
        {hasPassword
          ? `Přihlašujete se e-mailem${email ? ` ${email}` : ''}. Heslo můžete kdykoli změnit.`
          : 'S heslem se do portálu dostanete kdykoli z adresy /portal — nebudete potřebovat tento odkaz.'}
      </Typography>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {!open ? (
        <Box>
          <Button variant="outlined" onClick={() => setOpen(true)} sx={ghostSx(44)}>
            {hasPassword ? 'Změnit heslo' : 'Nastavit heslo'}
          </Button>
        </Box>
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
          />
          <TextField
            label="Nové heslo znovu"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button type="submit" variant="contained" disabled={busy} sx={ctaSx(46)}>
              {busy ? 'Ukládám…' : hasPassword ? 'Změnit heslo' : 'Uložit heslo'}
            </Button>
            {hasPassword && (
              <Button variant="outlined" onClick={() => { setOpen(false); setNotice(null); }} sx={ghostSx(46)}>Zrušit</Button>
            )}
          </Box>
        </Box>
      )}
    </Panel>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <Panel sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: LABEL_COLOR }}>
        <CircularProgress size={22} sx={{ color: BRAND.accent }} />
        <Typography>{text}</Typography>
      </Box>
    </Panel>
  );
}

function Section({ id, title, children, action }: { id?: string; title: string; children: ReactNode; action?: ReactNode }) {
  const heading = id !== undefined ? `${id}-title` : undefined;
  return (
    <Panel id={id} labelledBy={heading}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <PanelTitle id={heading}>{title}</PanelTitle>
        {action}
      </Box>
      {children}
    </Panel>
  );
}

export default function PatientPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const device = useDevice();
  const [params, setParams] = useSearchParams();
  const view: PortalView = params.get('zalozka') === 'vysledky' ? 'vysledky' : 'prehled';

  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [notice, setNotice] = useState<{ severity: 'success' | 'warning'; text: string } | null>(null);
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'no-token'>(
    token ? 'loading' : 'no-token',
  );

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return undefined;
    }
    let alive = true;
    setState('loading');
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
  }, [token, attempt]);

  const go = (next: PortalView, anchor?: 'dokumenty' | 'terminy'): void => {
    const nextParams = new URLSearchParams(params);
    if (next === 'vysledky') nextParams.set('zalozka', 'vysledky');
    else nextParams.delete('zalozka');
    setParams(nextParams, { replace: true });
    if (anchor !== undefined) {
      window.setTimeout(() => {
        const target = document.getElementById(anchor);
        if (target !== null && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      document.documentElement.scrollTop = 0;
    }
  };

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
  const measurements = toMeasurements(dashboard?.results);
  const address = clinic?.address.trim() ?? '';
  const fullName = dashboard !== null ? `${dashboard.givenName} ${dashboard.familyName}`.trim() : '';

  const headerActions = state === 'ok' ? (
    <Button
      onClick={signOut}
      startIcon={<LogoutOutlined sx={{ fontSize: 18 }} />}
      sx={{ color: BRAND.onInk, fontWeight: 600, fontSize: 14, minHeight: 44, px: 1.5, '&:hover': { color: '#FFFFFF', bgcolor: BRAND.onInkWash } }}
    >
      Odhlásit
    </Button>
  ) : undefined;

  const twoColumns = device !== 'phone';

  return (
    <PublicLayout clinic={clinic} hidePortalLink extra={headerActions}>
      {state === 'ok' && <PortalNav view={view} go={go} name={fullName} />}

      <PublicMain maxWidth={1240}>
        {state === 'loading' && <Waiting text="Načítáme váš portál…" />}

        {state === 'error' && (
          <>
            <PageTitle>Váš portál</PageTitle>
            <LoadError what="Tento odkaz už neplatí, je neúplný, nebo se portál nepodařilo načíst. Požádejte prosím ordinaci o nový odkaz nebo to zkuste znovu." onRetry={() => setAttempt((n) => n + 1)} />
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" component={RouterLink} to={PORTAL_SIGN_IN_PATH} onClick={forgetPortalToken} sx={ctaSx(50)}>
                Přihlásit se heslem
              </Button>
              <Button variant="outlined" component={RouterLink} to={LANDING_PATH} sx={ghostSx(50)}>Objednat se</Button>
            </Box>
          </>
        )}

        {state === 'ok' && dashboard && view === 'vysledky' && (
          <ResultsView results={dashboard.results} />
        )}

        {state === 'ok' && dashboard && view === 'prehled' && (
          <>
            <PageTitle sub="Vaše termíny, výsledky a dokumenty na jednom místě.">
              {`Dobrý den, ${dashboard.givenName}`}
            </PageTitle>

            {notice && (
              <Alert severity={notice.severity} onClose={() => setNotice(null)}>
                {notice.text}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: twoColumns ? 'minmax(0, 1.6fr) minmax(0, 1fr)' : '1fr', alignItems: 'start' }}>
              {/* ── Main column ── */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
                {next !== undefined ? (
                  <NextAppointmentCard appointment={next} address={address} onCancel={cancel} />
                ) : (
                  <Section title="Vaše nadcházející termíny">
                    <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>Nemáte žádný nadcházející termín.</Typography>
                    <Box>
                      <Button variant="contained" component={RouterLink} to={LANDING_PATH} sx={ctaSx(50)}>
                        Objednat termín
                      </Button>
                    </Box>
                  </Section>
                )}

                {questionnaire === 'Missing' && (
                  <Panel sx={{ bgcolor: '#FFF6EB', borderColor: '#F2D9B8' }} labelledBy="portal-questionnaire">
                    <Typography id="portal-questionnaire" sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 17, color: BRAND.warn }}>
                      Vyplňte vstupní dotazník
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: BRAND.warn }}>
                      K příštímu termínu zatím chybí vyplněný zdravotní dotazník. Vyplňte ho prosím
                      z odkazu, který jste dostali, nebo ho doplníte na místě.
                    </Typography>
                  </Panel>
                )}
                {questionnaire === 'Complete' && (
                  <NoticeBox tone="plain">Zdravotní dotazník máme vyplněný. Na místě už nic nevyplňujete.</NoticeBox>
                )}

                {otherUpcoming.length > 0 && (
                  <Section title="Další termíny">
                    <Box component="ul" sx={plainList}>
                      {otherUpcoming.map((a, i) => (
                        <AppointmentRow key={`${a.startUtc}-${i}`} appointment={a} onCancel={cancel} />
                      ))}
                    </Box>
                  </Section>
                )}

                {measurements.length > 0 && (
                  <Section
                    title="Jak se vyvíjíte"
                    action={
                      <Button onClick={() => go('vysledky')} sx={{ minHeight: 44, color: '#A8560D', fontWeight: 600 }}>
                        Všechna měření
                      </Button>
                    }
                  >
                    <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
                      Poslední měření · {measurements[0].date}
                    </Typography>
                    <MeasurementTiles m={measurements[0]} compact />
                  </Section>
                )}

                {next !== undefined && (
                  <Box>
                    <Button variant="outlined" component={RouterLink} to={LANDING_PATH} sx={ghostSx(46)}>
                      Objednat další termín
                    </Button>
                  </Box>
                )}

                {invoices.length > 0 && (
                  <Section
                    title="Doklady"
                    action={unpaidCount > 0 ? (
                      <Chip size="small" label={`${unpaidCount} nezaplaceno`} sx={{ bgcolor: BRAND.warnWash, color: BRAND.warn }} />
                    ) : undefined}
                  >
                    <Box component="ul" sx={plainList}>
                      {invoices.map((inv, i) => (
                        <InvoiceRow key={inv.number || `inv-${i}`} invoice={inv} />
                      ))}
                    </Box>
                  </Section>
                )}
              </Box>

              {/* ── Side column ── */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
                <Section id="dokumenty" title="Dokumenty">
                  {dashboard.documents.length === 0 ? (
                    <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
                      Zatím tu nemáte žádné dokumenty. Jakmile vám je ordinace uvolní, objeví se zde.
                    </Typography>
                  ) : (
                    <Box component="ul" sx={plainList}>
                      {dashboard.documents.map((d) => (
                        <Box
                          component="li"
                          key={d.id}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderTop: `1px solid ${BRAND.line}`, '&:first-of-type': { borderTop: 'none' } }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{d.title}</Typography>
                            <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>
                              Zpřístupněno {new Date(d.issuedAtUtc).toLocaleDateString('cs-CZ')}
                            </Typography>
                          </Box>
                          <Button
                            component="a"
                            href={portalDocumentUrl(token ?? '', d.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outlined"
                            aria-label={`Otevřít dokument ${d.title}`}
                            sx={ghostSx(44)}
                          >
                            Otevřít
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Section>

                {dashboard.pastAppointments.length > 0 && (
                  <Section id="terminy" title="Vaše návštěvy">
                    <Box component="ul" sx={plainList}>
                      {dashboard.pastAppointments.map((a, i) => (
                        <AppointmentRow key={`past-${a.startUtc}-${i}`} appointment={a} past />
                      ))}
                    </Box>
                  </Section>
                )}

                {token && (
                  <PasswordCard
                    token={token}
                    hasPassword={hasPassword}
                    email={email}
                    onPasswordSet={() => setDashboard((d) => (d ? { ...d, hasPassword: true } : d))}
                  />
                )}

                <ClinicContactCard clinic={clinic} />

                <Section title="Účet">
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{dashboard.givenName} {dashboard.familyName}</Typography>
                    {email && <Typography sx={{ fontSize: 14, color: LABEL_COLOR, overflowWrap: 'anywhere' }}>{email}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>
                    Tento odkaz je jen pro vás, nesdílejte ho.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={signOut} startIcon={<LogoutOutlined sx={{ fontSize: 16 }} />} sx={ghostSx(44)}>
                      Odhlásit
                    </Button>
                    <Button onClick={() => { void signOutEverywhereNow(); }} sx={{ color: LABEL_COLOR, minHeight: 44 }}>
                      Odhlásit všude
                    </Button>
                  </Box>
                </Section>
              </Box>
            </Box>

            {/* The phone's main action, pinned at the bottom of the screen. */}
            {device === 'phone' && (
              <PinnedBar label="Objednat termín">
                <Button variant="contained" component={RouterLink} to={LANDING_PATH} sx={ctaSx(50)}>
                  Objednat termín
                </Button>
              </PinnedBar>
            )}
          </>
        )}
      </PublicMain>
    </PublicLayout>
  );
}
