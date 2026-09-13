/*
 * Reports from other doctors - cardiology, orthopaedics, whatever the patient
 * is being treated for.
 *
 * Deliberately its own list, away from the required documents. A required
 * document answers "may this person be seen"; a report answers "what else is
 * going on with them". Mixing the two was the owner's first worry when he
 * asked for this - "nesmie sa to miešať s výpisom" - and he was right for a
 * reason he did not have to name: a cardiology report counted as the výpis
 * would let the readiness gate pass somebody whose výpis is missing.
 *
 * The separation is not enforced here. It comes from the shape: these carry no
 * `templateId`, and the readiness check pairs documents to templates, so a
 * report has nothing to pair with. This screen only has to avoid undoing that.
 *
 * Sorted by the date on the report, not the date it was uploaded. "Newer or
 * older" is the first thing a doctor asks of a stack of these, and the day
 * somebody got round to scanning them says nothing about it.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import {
  Add, Edit, MedicalInformation, PersonOutlined, Check, Close, Badge as BadgeIcon,
} from '@mui/icons-material';
import SpecialtyPicker, { type SpecialtyValue } from './SpecialtyPicker';
import { documentsApi } from '../../api/documents';
import type { PatientDocument } from '../../api/documents';
import { formatDateOnly } from '../../utils/time';

export interface MedicalReportsProps {
  documents: PatientDocument[];
  onChanged: () => void;
  onAdd: () => void;
}

/** A report belongs to no template - that absence is what keeps it out of the rules. */
export function isMedicalReport(doc: PatientDocument): boolean {
  return doc.templateId === null;
}

/** Newest report first, by the date written on it. Undated sink to the bottom. */
export function byReportDate(a: PatientDocument, b: PatientDocument): number {
  if (a.reportDate === null && b.reportDate === null) return 0;
  if (a.reportDate === null) return 1;
  if (b.reportDate === null) return -1;
  return b.reportDate.localeCompare(a.reportDate);
}

/**
 * What the row calls this report.
 *
 * `names` maps a code to its name. Without it the row reads "107", which is
 * the register's word for cardiology and nobody else's - a receptionist has no
 * reason to know the numbers, and a list of them is unreadable at a glance.
 * The code is kept as the fallback rather than hidden: it is still better than
 * a blank while the names are loading, or if the lookup fails.
 */
/**
 * What the row calls this report.
 *
 * The name comes from the server beside the code now. It used to be fetched
 * here, one request per distinct code - which worked, and was a second place
 * deciding what a code is called. Two lanes resolving the same code
 * separately is how the two end up disagreeing, so when the field arrived the
 * lookup went.
 *
 * The code stays as the fallback: the register retires entries, and a report
 * filed under one that no longer exists still has to be readable.
 */
export function specialtyLabel(doc: PatientDocument): string {
  if (doc.specialtyOther !== null && doc.specialtyOther !== '') return doc.specialtyOther;
  if (doc.specialtyName !== null && doc.specialtyName !== '') return doc.specialtyName;
  if (doc.specialtyCode !== null && doc.specialtyCode !== '') return doc.specialtyCode;
  return 'Neurčený obor';
}

export default function MedicalReports({
  documents, onChanged, onAdd,
}: MedicalReportsProps) {
  const [editing, setEditing] = useState<PatientDocument | null>(null);
  const [draft, setDraft] = useState<SpecialtyValue>({ specialtyCode: null, specialtyOther: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reports = useMemo(
    () => documents.filter(isMedicalReport).sort(byReportDate),
    [documents],
  );


  const openEdit = (doc: PatientDocument) => {
    setDraft({ specialtyCode: doc.specialtyCode, specialtyOther: doc.specialtyOther });
    setError(null);
    setEditing(doc);
  };

  const saveSpecialty = async () => {
    if (editing === null) return;
    setBusy(true);
    setError(null);
    try {
      await documentsApi.reclassify(editing.id, draft);
      setEditing(null);
      onChanged();
    } catch {
      setError('Obor se nepodařilo změnit. Zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  const review = async (doc: PatientDocument, accepted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await documentsApi.review(doc.id, accepted);
      onChanged();
    } catch {
      setError(
        accepted
          ? 'Dokument se nepodařilo přijmout. Zkuste to prosím znovu.'
          : 'Dokument se nepodařilo zamítnout. Zkuste to prosím znovu.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <MedicalInformation sx={{ color: '#0D7377' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Lékařské zprávy
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<Add />} onClick={onAdd}>
            Přidat zprávu
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Zprávy od jiných lékařů. Nepočítají se mezi povinné dokumenty.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {error !== null && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {reports.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Zatím tu žádná zpráva není.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {reports.map((doc) => {
              const fromPatient = doc.source === 'Patient';
              const waiting = fromPatient && doc.status === 'Pending';

              return (
                <Box
                  key={doc.id}
                  sx={{
                    border: '1px solid',
                    borderColor: waiting ? 'warning.light' : 'divider',
                    bgcolor: waiting ? 'warning.light' : 'transparent',
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600 }}>{specialtyLabel(doc)}</Typography>
                    {/* Truthiness on purpose. The type says `string | null`,
                        and a server that simply omits the field sends neither -
                        `undefined !== null` is true, and `formatDateOnly`
                        splits it and takes the page down. Found by a test whose
                        fixture predates the field, which is exactly the shape a
                        real older document has. */}
                    {typeof doc.reportDate === 'string' && doc.reportDate !== '' && (
                      <Chip size="small" variant="outlined" label={formatDateOnly(doc.reportDate)} />
                    )}
                    {/*
                      Said plainly, because it is the reason the row needs
                      looking at. Without it, "čeká na kontrolu" is a delay
                      with no explanation.
                    */}
                    {fromPatient && (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<PersonOutlined />}
                        label="Nahrál pacient"
                      />
                    )}
                    {doc.reviewedByUserId !== null && (
                      <Tooltip title="Zkontroloval a přijal zaměstnanec">
                        <Chip size="small" variant="outlined" icon={<BadgeIcon />} label="Zkontrolováno" />
                      </Tooltip>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" onClick={() => openEdit(doc)} aria-label="Změnit obor">
                      <Edit fontSize="small" />
                    </IconButton>
                  </Stack>

                  {waiting && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
                        Poslal pacient z domova — podívejte se prosím, jestli je to,
                        co má být, a pak ji přijměte.
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Check />}
                        disabled={busy}
                        onClick={() => void review(doc, true)}
                      >
                        Přijmout
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<Close />}
                        disabled={busy}
                        onClick={() => void review(doc, false)}
                      >
                        Zamítnout
                      </Button>
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Změnit obor</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <SpecialtyPicker
              value={draft}
              onChange={setDraft}
              suggestion={editing?.specialtySuggestedByPatient}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Zrušit</Button>
          <Button variant="contained" disabled={busy} onClick={() => void saveSpecialty()}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
