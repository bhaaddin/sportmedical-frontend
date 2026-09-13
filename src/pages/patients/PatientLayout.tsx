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
import { Outlet, useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { ArrowBack, Edit, Science } from '@mui/icons-material';
import { patientsApi } from '../../api/patients';
import type { Patient } from '../../api/patients';
import { documentsApi, DOCUMENT_SATISFIES_REQUIREMENT } from '../../api/documents';
import type { DocumentTemplate, PatientDocument } from '../../api/documents';
import ConsentLine from '../../components/patients/ConsentLine';
import { formatDateOnly } from '../../utils/time';

/** The sections a patient has. Kept as data so the tabs and the routes cannot drift. */
export const PATIENT_SECTIONS = [
  { id: 'prehled', label: 'Přehled', path: '' },
  { id: 'dokumenty', label: 'Dokumenty', path: 'dokumenty' },
] as const;

export interface PatientContext {
  patient: Patient;
  documents: PatientDocument[];
  templates: DocumentTemplate[];
  reloadDocuments: () => void;
}

/** Which section the current address is in. */
export function activeSection(pathname: string, patientId: string): string {
  const rest = pathname.replace(`/patients/${patientId}`, '').replace(/^\//, '');
  const match = PATIENT_SECTIONS.find((s) => s.path !== '' && rest.startsWith(s.path));
  return match?.id ?? 'prehled';
}

/** Required documents still missing, for the banner that stays on every section. */
export function missingRequired(
  templates: DocumentTemplate[],
  documents: PatientDocument[],
): DocumentTemplate[] {
  return templates
    .filter((t) => t.isActive && t.requiredForVisit)
    .filter(
      (t) =>
        !documents.some(
          (d) => d.templateId === t.id && d.status === DOCUMENT_SATISFIES_REQUIREMENT,
        ),
    );
}

export default function PatientLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [notFound, setNotFound] = useState(false);

  const reloadDocuments = useCallback(() => {
    if (id === undefined) return;
    documentsApi.getPatientDocuments(id).then(setDocuments).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    setNotFound(false);
    patientsApi.getById(id).then(setPatient).catch(() => setNotFound(true));
    documentsApi.getTemplates().then(setTemplates).catch(() => setTemplates([]));
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

  const missing = missingRequired(templates, documents);
  const current = activeSection(location.pathname, id);
  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`;

  const context: PatientContext = { patient, documents, templates, reloadDocuments };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/patients')} sx={{ mb: 2 }}>
        Zpět na pacienty
      </Button>

      {/* Stays on screen whichever section is open: somebody who walked away
          from the overview should not lose sight of what is missing. */}
      {missing.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chybí: {missing.map((t) => t.name).join(', ')}
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

      {/* Real links, not state. Each section has its own address, so it can be
          opened in a second tab, bookmarked, and come back on a reload. */}
      <Tabs value={current} sx={{ mb: 2 }}>
        {PATIENT_SECTIONS.map((section) => (
          <Tab
            key={section.id}
            value={section.id}
            label={section.label}
            component={RouterLink}
            to={section.path === '' ? `/patients/${id}` : `/patients/${id}/${section.path}`}
          />
        ))}
      </Tabs>

      <Outlet context={context} />
    </Box>
  );
}
