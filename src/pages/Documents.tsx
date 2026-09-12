import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Grid, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, List, ListItem,
  ListItemIcon, ListItemText, Divider, Alert, Skeleton, Tabs, Tab,
  TableContainer,
} from '@mui/material';
import {
  Description, Upload, CheckCircle, Pending, Error, VerifiedUser, PersonSearch,
  HealthAndSafety, Info, Download, Visibility, CloudUpload, Assignment,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { documentsApi } from '../api/documents';
import type { DocumentTemplate, DocumentStatus, PatientDocument } from '../api/documents';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import toast from 'react-hot-toast';

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode; required: boolean }> = {
  Vypis: { label: 'Výpis ze zdravotní dokumentace', color: '#D32F2F', icon: <Description />, required: true },
  Dotaznik: { label: 'Dotazník před prohlídkou', color: '#ED6C02', icon: <Assignment />, required: true },
  GDPR: { label: 'GDPR souhlas', color: '#0288D1', icon: <VerifiedUser />, required: true },
  Guardian: { label: 'Zákonný zástupce (mladší 18)', color: '#9C27B0', icon: <PersonSearch />, required: true },
  InfoProhlidka: { label: 'Info prohlídka', color: '#2E7D32', icon: <Info />, required: false },
  InfoDiagnostika: { label: 'Info diagnostika', color: '#0D7377', icon: <Info />, required: false },
  InfoSport: { label: 'Info sport', color: '#FF5722', icon: <Info />, required: false },
};

/*
 * Keyed by `DocumentStatus` so the compiler requires every state to be
 * handled. The previous map was keyed by `string` and listed `Uploaded` and
 * `Signed`, neither of which the server has ever sent - so a signed document
 * drew no icon at all, and `Superseded` and `Rejected` were not there either.
 */
const STATUS_ICON: Record<DocumentStatus, React.ReactNode> = {
  Pending: <Pending sx={{ color: '#ED6C02' }} />,
  SignedOff: <CheckCircle sx={{ color: '#2E7D32' }} />,
  Expired: <Error sx={{ color: '#D32F2F' }} />,
  Superseded: <Error sx={{ color: '#9E9E9E' }} />,
  Rejected: <Error sx={{ color: '#D32F2F' }} />,
};

/** The chip said `SignedOff` in English on a Czech screen. */
const STATUS_LABEL: Record<DocumentStatus, string> = {
  Pending: 'Čeká na podpis',
  SignedOff: 'Podepsáno',
  Expired: 'Vypršelo',
  Superseded: 'Nahrazeno',
  Rejected: 'Zamítnuto',
};

const STATUS_COLOR: Record<DocumentStatus, string> = {
  Pending: '#ED6C02',
  SignedOff: '#2E7D32',
  Expired: '#D32F2F',
  Superseded: '#9E9E9E',
  Rejected: '#D32F2F',
};

export default function Documents() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patientDocs, setPatientDocs] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [uploadDialog, setUploadDialog] = useState<{ open: boolean; templateId: string }>({ open: false, templateId: '' });

  useEffect(() => {
    Promise.all([
      documentsApi.getTemplates().catch(() => []),
      patientsApi.getAll().catch(() => []),
    ]).then(([t, p]) => {
      setTemplates(t);
      setPatients(p);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      documentsApi.getPatientDocuments(selectedPatient).then(setPatientDocs).catch(() => {});
    }
  }, [selectedPatient]);

  /*
   * There is no upload endpoint in this API, and this screen has been offering
   * one. Measured against the running server on 10. 9. 2026, with a control
   * sample so a `404` could be told apart from a request that never arrived:
   *
   *   POST /api/documents/upload  (JSON)       400, and it wants `FilePath`
   *   POST /api/documents/upload  (multipart)  415 Unsupported Media Type
   *   POST /api/documents/files                404
   *   POST /api/files/upload                   404
   *   POST /api/documents/nezmysel             404   <- the control
   *
   * `documentsApi.upload` posts `{ patientId, templateId, filePath }` as JSON,
   * where `filePath` is a **string path to a file that already exists on the
   * server**. Handing it a `File` serialised to `{}`, so every attempt went out
   * malformed, came back `400`, and the user was told "Chyba při nahrávání" -
   * an error with nothing in it, which they would reasonably read as a problem
   * with their PDF.
   *
   * The type error could have been silenced by passing `file.name`. That would
   * have been worse than the bug: a bare filename is a plausible-looking path,
   * the call might well have succeeded, and the patient would have a document
   * registered against a file that is not there. A visible failure is better
   * than a false success.
   *
   * So nothing is sent. The dialog says what is missing and the picker is gone
   * until there is somewhere for a file to go. Reported to the `app` lane.
   */
  const handleUpload = async (_file: File) => {
    toast.error('Nahrávání souborů zatím není — chybí koncový bod na serveru.');
  };

  const getDocStatus = (templateId: string) => {
    return patientDocs.find(d => d.templateId === templateId);
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description color="primary" /> Dokumenty
            </Typography>
            <Typography variant="body2" color="text.secondary">Správa šablon a dokumentů pacientů</Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Patient Selector */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Pacient:</Typography>
        <TextField
          select fullWidth size="small" value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        >
          <MenuItem value="">— Vyberte pacienta —</MenuItem>
          {patients.map(p => (
            <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label="Šablony" />
          <Tab label="Dokumenty pacienta" disabled={!selectedPatient} />
        </Tabs>
      </Paper>

      {/* Templates Tab */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {Object.entries(typeConfig).map(([type, config], i) => {
            const template = templates.find(t => t.type === type);
            return (
              <Grid key={type} size={{ xs: 12, sm: 6, md: 4 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card sx={{ height: '100%', borderLeft: `4px solid ${config.color}`, position: 'relative' }}>
                    {config.required && (
                      <Chip label="Povinný" size="small"
                        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: '#D32F2F14', color: '#D32F2F', fontWeight: 600 }} />
                    )}
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Box sx={{ color: config.color }}>{config.icon}</Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 15 }}>{config.label}</Typography>
                      </Box>
                      {template && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">Verze: {template.version}</Typography>
                          {template.ageGated && <Chip label="Věkově omezený" size="small" sx={{ mt: 0.5 }} />}
                          {template.firstVisitOnly && <Chip label="Pouze 1. návštěva" size="small" sx={{ mt: 0.5, ml: 0.5 }} />}
                        </Box>
                      )}
                      {!template && (
                        <Alert severity="info" sx={{ mt: 2, borderRadius: 1 }}>Šablona není k dispozici</Alert>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Patient Documents Tab */}
      {tab === 1 && selectedPatient && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {patientDocs.length === 0 ? (
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <CloudUpload sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
              <Typography color="text.secondary">Žádné dokumenty pro tohoto pacienta</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Nahrajte povinné dokumenty kliknutím na šablonu níže
              </Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
              <List>
                {patientDocs.map((doc, i) => (
                  <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <ListItem sx={{ py: 1.5 }}>
                      <ListItemIcon>{STATUS_ICON[doc.status]}</ListItemIcon>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 500 }}>{doc.templateName}</Typography>}
                        secondary={`Nahráno: ${new Date(doc.uploadedAt).toLocaleDateString('cs-CZ')}${doc.signedAt ? ` • Podepsáno: ${new Date(doc.signedAt).toLocaleDateString('cs-CZ')}` : ''}`}
                      />
                      <Chip label={STATUS_LABEL[doc.status]} size="small" sx={{
                        bgcolor: `${STATUS_COLOR[doc.status]}14`,
                        color: STATUS_COLOR[doc.status],
                        fontWeight: 500,
                      }} />
                      <Tooltip title="Stáhnout"><IconButton size="small"><Download fontSize="small" /></IconButton></Tooltip>
                    </ListItem>
                    <Divider />
                  </motion.div>
                ))}
              </List>
            </TableContainer>
          )}

          {/* Upload buttons for each template */}
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>Nahrát dokument</Typography>
          <Grid container spacing={2}>
            {templates.map((tmpl, i) => {
              const existing = getDocStatus(tmpl.id);
              const cfg = typeConfig[tmpl.type] || typeConfig.InfoProhlidka;
              return (
                <Grid key={tmpl.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ borderLeft: `3px solid ${existing ? '#2E7D32' : cfg.color}` }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{cfg.label}</Typography>
                        {existing && (
                          <Chip icon={<CheckCircle />} label={existing.status} size="small"
                            sx={{ mt: 0.5, bgcolor: '#2E7D3214', color: '#2E7D32' }} />
                        )}
                      </Box>
                      <Button size="small" variant={existing ? 'outlined' : 'contained'} startIcon={<Upload />}
                        onClick={() => setUploadDialog({ open: true, templateId: tmpl.id })}
                        sx={{ borderColor: '#0D7377', color: existing ? '#0D7377' : '#fff',
                          bgcolor: existing ? 'transparent' : '#0D7377', borderRadius: 2, fontWeight: 600 }}>
                        {existing ? 'Aktualizovat' : 'Nahrát'}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </motion.div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog.open} onClose={() => setUploadDialog({ open: false, templateId: '' })}>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Nahrát dokument</Typography>
        </DialogTitle>
        <DialogContent>
          {/*
            The picker is not drawn, because there is nothing behind it. Saying
            so beats a button that takes a file and loses it.
          */}
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
              Nahrát soubor zatím nelze
            </Typography>
            <Typography variant="body2">
              Server pro dokumenty přijímá jen cestu k souboru, který už na něm
              je — koncový bod pro nahrání zatím neexistuje. Dokud nebude, soubor
              se sem dostat nedá; nahlášeno.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUploadDialog({ open: false, templateId: '' })} sx={{ borderRadius: 2 }}>Zrušit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
