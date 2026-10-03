/*
 * The frame around one patient: who they are at the top, and a row of sections
 * underneath that are pages of their own (design-15, "Pacient - karta").
 *
 * Everything here is about one person and nothing else. That is the rule the
 * owner set and it is the one thing this layout has to hold on to - the
 * sections below belong to this patient, carry their id in the address, and
 * can be linked to, bookmarked and reopened. A panel that slides over the list
 * cannot be any of those things: close it and the address says you are still
 * looking at a list of everybody.
 *
 * The header stays put while the sections change, so the name and the missing
 * paperwork are on screen wherever you are inside the patient.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link as RouterLink, Outlet, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, CircularProgress, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';
import PinnedActionBar from '../../components/ui/PinnedActionBar';
import { ArrowBack } from '@mui/icons-material';
import { patientsApi } from '../../api/patients';
import { usePermission } from '../../auth/usePermission';
import type { Patient } from '../../api/patients';
import { documentsApi } from '../../api/documents';
import type {
  AppointmentRequirementDto, DocumentTemplate, PatientDocument,
} from '../../api/documents';
import type { DayAppointment } from '../../api/bookingContracts';
import patientRegistryApi from '../../api/patientRegistry';
import type { PhoneInspection } from '../../api/patientRegistry';
import { HOME_REGION, storedNumberDisplay } from '../../services/patientRegistration/phoneDisplay';
import ConsentLine from '../../components/patients/ConsentLine';
import PortalPasswordReset from '../../components/patients/PortalPasswordReset';
import { PageHeader, SoftCard, StatusChip } from '../../components/ui';
import { fetchUpcomingWindow } from '../../components/patients/appointmentsSource';
import { birthYear, initialsOf, questionnaireMissing } from '../../components/patients/patientActivity';
import { formatDateOnly } from '../../utils/time';
import { contactOfKind, profileContacts } from './cardContacts';
import {
  NOTHING_REQUIRED_TEXT, anyBlocks, expiringSoon, requirementLine, stillMissing,
  validityText,
} from './paperworkStanding';
import { PATIENT_SECTIONS, sectionPath } from './sections';

export interface PatientContext {
  patient: Patient;
  /** `GET /api/patients/{id}/profile` - the registration data; null until known or when absent. */
  profile: Record<string, unknown> | null;
  documents: PatientDocument[];
  templates: DocumentTemplate[];
  /** What the booked appointments ask for; null while unanswered. */
  requirements: AppointmentRequirementDto[] | null;
  /** The booking window from today (paperwork, calendar ids); null while unanswered. */
  upcoming: DayAppointment[] | null;
  /** The telephone and e-mail, the way the desk reads them. Empty when there are none. */
  displayPhone: string;
  displayEmail: string;
  reloadDocuments: () => void;
}

/*
 * What this patient has to bring is no longer decided here.
 *
 * Until 14. 9. 2026 this file filtered templates on `requiredForVisit` and
 * split them on `firstVisitOnly`, and it carried its own copy of "a výpis
 * lasts a year" to decide whether one still stood. All three are gone:
 *
 *   the two flags   moved onto the rule, where they belong - the server
 *                   stopped sending them and this filter silently matched
 *                   nothing, so the paperwork section vanished on every
 *                   patient without an error
 *   the year        the rule says how many months and the server counts,
 *                   which ends three answers to one question: this copy,
 *                   booking’s `PaperworkRule`, and a column nobody wrote
 *
 * The requirement comes from `GET /api/documents/patient/{id}/check` now, per
 * appointment. NOT unioned across every rule: a rule hangs on a service, and
 * which service applies is a fact about the booking. Unioning them is the bug
 * the owner had removed two days earlier, when this told somebody booked for
 * a blood draw that their medical record was missing.
 */

/**
 * The server's code for a patient who exists but is outside the calendars
 * this employee may see (no `patients.view_all`). The same code comes from
 * the card, the profile and the registry detail.
 */
export const NOT_IN_YOUR_CALENDARS = 'patients.not_in_your_calendars';

const NOT_IN_YOUR_CALENDARS_TEXT =
  'Tento pacient nemá rezervaci v žádném z kalendářů, ke kterým máte přístup.';

const NOT_THERE_TEXT = 'Tenhle pacient neexistuje, nebo na něj nemáte přístup.';

/**
 * Why the patient could not be opened, in the words to show.
 *
 * A patient outside this person's calendars is a refusal with a reason, and
 * the reason is worth saying: "neexistuje, nebo nemáte přístup" sends the desk
 * checking the id, when the answer is that the patient is booked with somebody
 * else. The server's own sentence is used when it sends one.
 */
function whyNotOpened(error: unknown): string {
  const problem = (error as { response?: { data?: { code?: unknown; message?: unknown } } } | null)
    ?.response?.data;
  if (problem?.code !== NOT_IN_YOUR_CALENDARS) return NOT_THERE_TEXT;
  return typeof problem.message === 'string' && problem.message.trim() !== ''
    ? problem.message
    : NOT_IN_YOUR_CALENDARS_TEXT;
}

/**
 * The tabs of the card, in the board's order: Přehled · Termíny · Výsledky ·
 * Faktury · Dokumenty · Historie. Four are sections under the patient; two
 * are the existing diagnostics and billing screens, opened for this patient,
 * since neither has a section of its own yet.
 */
function cardTabs(patientId: string, mayBill: boolean) {
  const section = (id: string) => {
    const found = PATIENT_SECTIONS.find((s) => s.id === id);
    return found === undefined ? null : { value: found.id, label: found.label, to: sectionPath(patientId, found) };
  };
  return [
    section('prehled'),
    section('terminy'),
    section('vysledky'),
    mayBill ? section('faktury') : null,
    section('dokumenty'),
    section('historie'),
  ].filter((tab): tab is { value: string; label: string; to: string } => tab !== null);
}

/** Which section the address is in: the part after `/patients/{id}/`, or the overview. */
function sectionOf(pathname: string, patientId: string): string {
  const rest = pathname.replace(`/patients/${patientId}`, '').replace(/^\//, '');
  const found = PATIENT_SECTIONS.find((s) => s.path === rest);
  return found?.id ?? 'prehled';
}

export default function PatientLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const mayEdit = usePermission('patients.edit');
  const mayBill = usePermission('billing.manage');
  const phone = useIsPhone();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  /* The sentence to show instead of the patient; `null` while there is hope. */
  const [notOpened, setNotOpened] = useState<string | null>(null);
  /*
   * `null` until the answer arrives. An empty array is a real answer - "no
   * appointment asks for anything" - and drawing that sentence before the
   * request has come back would state it of every patient for a moment,
   * including the ones who are missing something.
   */
  const [requirements, setRequirements] = useState<AppointmentRequirementDto[] | null>(null);
  const [upcoming, setUpcoming] = useState<DayAppointment[] | null>(null);
  const [phoneLook, setPhoneLook] = useState<PhoneInspection | null>(null);

  const reloadDocuments = useCallback(() => {
    if (id === undefined) return;
    documentsApi.getPatientDocuments(id).then(setDocuments).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    setNotOpened(null);
    setProfile(null);
    setUpcoming(null);
    patientsApi.getById(id)
      .then(setPatient)
      .catch((error: unknown) => setNotOpened(whyNotOpened(error)));
    /* The registration data carries the telephone and the e-mail; the card
       itself does not. Absent is drawn as absent, never as a failure. */
    Promise.resolve(patientsApi.getProfile(id))
      .then((data: unknown) => setProfile(data && typeof data === 'object' ? (data as Record<string, unknown>) : null))
      .catch(() => setProfile(null));
    documentsApi.getTemplates().then(setTemplates).catch(() => setTemplates([]));
    /* Left null on failure, not emptied: a request that did not come back is
       not an answer, and "nothing is required" is a claim. */
    documentsApi.checkRequired(id)
      .then((r) => setRequirements(r.requirements))
      .catch(() => setRequirements(null));
    /* The next booking and whether its questionnaire is in. Scoped by the
       server to the calendars this account may see. */
    fetchUpcomingWindow()
      .then(setUpcoming)
      .catch(() => setUpcoming(null));
    reloadDocuments();
  }, [id, reloadDocuments]);

  /*
   * The telephone, written the way the desk reads it: a Czech number without
   * its dialling code, a foreign one with. `phone/inspect` works the grouping
   * out on the same libphonenumber that stored the number; any failure leaves
   * the stored string on screen, so a card never loses a number it had.
   */
  const contacts = useMemo(() => profileContacts(profile?.contactsJson), [profile]);
  const storedPhone = contactOfKind('phone', patient?.phone, contacts);
  const displayEmail = contactOfKind('email', patient?.email, contacts);

  useEffect(() => {
    if (storedPhone === '') {
      setPhoneLook(null);
      return;
    }
    let cancelled = false;
    patientRegistryApi
      .inspectPhone({ value: storedPhone, regionCode: HOME_REGION })
      .then((result) => { if (!cancelled) setPhoneLook(result); })
      .catch(() => { if (!cancelled) setPhoneLook(null); });
    return () => { cancelled = true; };
  }, [storedPhone]);

  if (notOpened !== null) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 6 }}>
        <Alert severity="warning">{notOpened}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/patients')} sx={{ mt: 2 }}>
          Zpět na pacienty
        </Button>
      </Box>
    );
  }

  if (patient === null || id === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  /* The server's verdict, read rather than recomputed. `ExpiringSoon` is not
     in `missing`: the document still covers that appointment, so it is a
     reminder, not an alarm. */
  const missing = requirements === null ? [] : stillMissing(requirements);
  const expiring = requirements === null ? [] : expiringSoon(requirements);
  const displayPhone = storedNumberDisplay(phoneLook, storedPhone);
  const questionnaireIsMissing = upcoming !== null && questionnaireMissing(id, upcoming);
  const archived = patient.status === 'Archived';
  const year = birthYear(patient.dateOfBirth);
  const headline = [
    year === '' ? null : `nar. ${year}`,
    displayPhone === '' ? null : displayPhone,
    displayEmail === '' ? null : displayEmail,
  ].filter((part): part is string => part !== null).join(' · ');

  const context: PatientContext = {
    patient, profile, documents, templates, requirements, upcoming, displayPhone, displayEmail,
    reloadDocuments,
  };

  const tabs = cardTabs(id, mayBill);
  const current = sectionOf(location.pathname, id);

  return (
    <Box>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle="Karta pacienta"
        actions={(
          <Button variant="outlined" component={RouterLink} to="/patients">
            Zpět na seznam
          </Button>
        )}
      />

      {/*
        * Stays on screen whichever section is open: somebody who walked away
        * from the overview should not lose sight of what is missing.
        *
        * One row per thing one appointment asks for, saying which appointment
        * and why - "Sportovní lékařské prohlídky 24. 9. — Výpis". The old
        * banner said only "Chybí: Výpis", which is the sentence that sent
        * somebody booked for a blood draw looking for their medical record.
        */}
      {missing.length > 0 && (
        <Alert severity={anyBlocks(missing) ? 'error' : 'warning'} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {anyBlocks(missing)
              ? 'Chybí doklad, bez kterého nejde objednat'
              : 'Chybí doklady k objednaným termínům'}
          </Typography>
          {missing.map((r) => (
            <Typography key={`${r.appointmentId}-${r.templateId}`} variant="body2">
              {requirementLine(r, (iso) => formatDateOnly(iso.slice(0, 10)))}
              {r.blocksBooking === true ? ' — bez něj nejde objednat' : ''}
            </Typography>
          ))}
        </Alert>
      )}

      {/*
        * The third state, and the reason for this rewrite.
        *
        * No appointment that asks for anything is not "everything is in
        * order", and for three days the two were the same silence. Said
        * plainly rather than drawn as a warning - it is the ordinary state of
        * most patients most of the time.
        */}
      {requirements !== null && requirements.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>{NOTHING_REQUIRED_TEXT}</Typography>
      )}

      {/* Still good, and this is the cheap moment to renew it. Amber, because
          the appointment is covered - `allRequiredPresent` stays true - and
          an alarm that is not true is the one people learn to ignore. */}
      {expiring.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Brzy skončí platnost
          </Typography>
          {expiring.map((r) => {
            const until = validityText(r, (iso) => formatDateOnly(iso.slice(0, 10)));
            return (
              <Typography key={`${r.appointmentId}-${r.templateId}`} variant="body2">
                {requirementLine(r, (iso) => formatDateOnly(iso.slice(0, 10)))}
                {until === null ? '' : ` — ${until}`}
              </Typography>
            );
          })}
        </Alert>
      )}

      {/* What the appointments ask for and the patient already has. A fact
          worth showing: it is the half that says the paperwork is done. */}
      {requirements !== null && requirements.length > 0
        && missing.length === 0 && expiring.length === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Doklady k objednaným termínům jsou v pořádku
          </Typography>
          {requirements.map((r) => {
            const until = validityText(r, (iso) => formatDateOnly(iso.slice(0, 10)));
            return (
              <Typography key={`${r.appointmentId}-${r.templateId}`} variant="body2">
                {requirementLine(r, (iso) => formatDateOnly(iso.slice(0, 10)))}
                {until === null ? '' : ` — ${until}`}
              </Typography>
            );
          })}
        </Alert>
      )}

      <SoftCard sx={{ mb: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'flex-start', md: 'center' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: 18 }}>{initialsOf(patient)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h2">
                {patient.firstName} {patient.lastName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, overflowWrap: 'anywhere' }}>
                {headline === '' ? (patient.sex === 'Male' ? 'Muž' : 'Žena') : headline}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {questionnaireIsMissing && <StatusChip tone="beige">Dotazník chybí</StatusChip>}
            <StatusChip tone={archived ? 'grey' : 'green'}>{archived ? 'Archivovaný' : 'Aktivní'}</StatusChip>
          </Stack>

          {/* The calendar opens its booking drawer on `newAppointment` and
              takes this patient as the one being booked. On a phone that
              button is the screen's main action and is pinned at the bottom
              (below); on the wider layouts it stands with the others. */}
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', rowGap: 1, '& .MuiButton-root': { minHeight: 44 } }}>
            {!phone && (
              <Button
              variant="contained"
              onClick={() => navigate('/planovani', { state: { newAppointment: Date.now(), patientId: id } })}
            >
              Objednat termín
            </Button>
            )}
            {mayEdit && (
              <Button variant="outlined" onClick={() => navigate(`/patients/${id}/edit`)}>
                Upravit kartu
              </Button>
            )}
            {mayEdit && <PortalPasswordReset patientId={id} />}
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <ConsentLine patientId={id} />
        </Box>
      </SoftCard>

      {/* The same sections the sidebar lists, as the board's tab row. Inside
          somebody's file the navigation is theirs, and the two agree because
          both read `PATIENT_SECTIONS`. */}
      <Tabs
        value={tabs.some((t) => t.value === current) ? current : false}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 44 } }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={tab.label} component={RouterLink} to={tab.to} />
        ))}
      </Tabs>

      <Outlet context={context} />

      {phone && (
        <PinnedActionBar label="Objednat termín">
          <Button
              variant="contained"
              onClick={() => navigate('/planovani', { state: { newAppointment: Date.now(), patientId: id } })}
            >
              Objednat termín
            </Button>
        </PinnedActionBar>
      )}
    </Box>
  );
}
