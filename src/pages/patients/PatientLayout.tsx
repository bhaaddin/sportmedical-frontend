/*
 * The frame around one patient: who they are at the top, and a row of sections
 * underneath that are pages of their own.
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
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import { ArrowBack, Edit, Science } from '@mui/icons-material';
import { PATIENT_SECTIONS } from './sections';
import { patientsApi } from '../../api/patients';
import type { Patient } from '../../api/patients';
import { documentsApi } from '../../api/documents';
import type {
  AppointmentRequirementDto, DocumentTemplate, PatientDocument,
} from '../../api/documents';
import ConsentLine from '../../components/patients/ConsentLine';
import { formatDateOnly } from '../../utils/time';
import {
  NOTHING_REQUIRED_TEXT, anyBlocks, expiringSoon, requirementLine, stillMissing,
  validityText,
} from './paperworkStanding';

export interface PatientContext {
  patient: Patient;
  documents: PatientDocument[];
  templates: DocumentTemplate[];
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

export default function PatientLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [notFound, setNotFound] = useState(false);
  /*
   * `null` until the answer arrives. An empty array is a real answer - "no
   * appointment asks for anything" - and drawing that sentence before the
   * request has come back would state it of every patient for a moment,
   * including the ones who are missing something.
   */
  const [requirements, setRequirements] = useState<AppointmentRequirementDto[] | null>(null);

  const reloadDocuments = useCallback(() => {
    if (id === undefined) return;
    documentsApi.getPatientDocuments(id).then(setDocuments).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    setNotFound(false);
    patientsApi.getById(id).then(setPatient).catch(() => setNotFound(true));
    documentsApi.getTemplates().then(setTemplates).catch(() => setTemplates([]));
    /* Left null on failure, not emptied: a request that did not come back is
       not an answer, and "nothing is required" is a claim. */
    documentsApi.checkRequired(id)
      .then((r) => setRequirements(r.requirements))
      .catch(() => setRequirements(null));
    reloadDocuments();
  }, [id, reloadDocuments]);

  if (notFound) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 6 }}>
        <Alert severity="warning">
          Tenhle pacient neexistuje, nebo na něj nemáte přístup.
        </Alert>
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
  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`;

  const context: PatientContext = { patient, documents, templates, reloadDocuments };

  return (
    <Box>
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
        <Alert severity="info" sx={{ mb: 2 }}>{NOTHING_REQUIRED_TEXT}</Alert>
      )}

      {/* What the appointments ask for and the patient already has. A fact
          worth showing: it is the half that says the paperwork is done. */}
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

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar sx={{ bgcolor: '#0D7377', width: 56, height: 56, fontSize: 20 }}>
              {initials}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {patient.firstName} {patient.lastName}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={formatDateOnly(patient.dateOfBirth?.slice(0, 10))} />
                <Chip size="small" label={patient.sex === 'Male' ? 'Muž' : 'Žena'} />
              </Stack>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => navigate(`/patients/${id}/edit`)}
            >
              Upravit
            </Button>
            <Button
              variant="contained"
              startIcon={<Science />}
              onClick={() => navigate(`/diagnostics/new?patientId=${id}`)}
              sx={{ bgcolor: '#0D7377' }}
            >
              Nová diagnostika
            </Button>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <ConsentLine patientId={id} />
          </Box>
        </CardContent>
      </Card>

      {/* The sections are in the sidebar now, where the owner asked for them:
          while you are inside somebody's file, the navigation on the left is
          theirs and not the application's. */}
      <Outlet context={context} />
    </Box>
  );
}
