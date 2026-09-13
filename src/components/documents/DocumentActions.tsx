/*
 * What can be done with a document that is already filed: open it, move it to
 * the patient it actually belongs to, or strike it out.
 *
 * Opening it is the one that was missing entirely. Until today there was no
 * way to read a stored file at any level - it could be uploaded, listed and
 * counted, and never seen. A required-documents list that says "Hotovo" and
 * cannot show you what is behind it is asking to be trusted rather than read.
 *
 * Moving carries a warning, and the warning is the point. A výpis moved away
 * stops counting for the patient it left - correctly, it is not theirs - but
 * somebody should learn that before pressing the button, not by noticing a red
 * banner on a card they have already navigated away from.
 */
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, TextField, Tooltip, Typography, CircularProgress,
} from '@mui/material';
import {
  Visibility, DriveFileMove, Block, Close,
} from '@mui/icons-material';
import {
  documentsApi, INVALIDATION_REASONS, INVALIDATION_REASON_LABEL,
  type PatientDocument, type InvalidationReason,
} from '../../api/documents';
import { patientsApi } from '../../api/patients';

export interface DocumentActionsProps {
  document: PatientDocument;
  /** Everything on file for this patient, to work out what moving would cost. */
  patientDocuments: PatientDocument[];
  patientName: string;
  onChanged: () => void;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * True when moving this document away would leave the patient without the
 * required document it satisfies.
 *
 * Counted rather than assumed: a patient can hold several valid copies of the
 * same thing, and moving one of three costs nothing. The other lane's first
 * measurement of this was taken on a patient with three and looked like the
 * move had failed to do anything.
 */
export function lastOfItsKind(
  document: PatientDocument,
  patientDocuments: PatientDocument[],
): boolean {
  if (document.templateId === null) return false;
  const siblings = patientDocuments.filter(
    (d) => d.templateId === document.templateId && d.status === 'SignedOff',
  );
  return document.status === 'SignedOff' && siblings.length <= 1;
}

export default function DocumentActions({
  document: doc, patientDocuments, patientName, onChanged,
}: DocumentActionsProps) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [moving, setMoving] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState<InvalidationReason>('unreadable');
  const [note, setNote] = useState('');

  /* The blob URL pins its bytes in memory until it is revoked, and these are
     scans. Released whenever the viewer closes or the document changes. */
  useEffect(() => {
    return () => {
      if (viewing !== null) URL.revokeObjectURL(viewing);
    };
  }, [viewing]);

  useEffect(() => {
    if (!moving || patients.length > 0) return;
    patientsApi
      .getAll()
      .then((all) => setPatients(all as PatientOption[]))
      .catch(() => setError('Seznam pacientů se nepodařilo načíst.'));
  }, [moving, patients.length]);

  const open = async () => {
    setLoadingView(true);
    setError(null);
    try {
      setViewing(await documentsApi.content(doc.id));
    } catch (caught) {
      const status = (caught as { response?: { status?: number } })?.response?.status;
      setError(
        status === 404
          ? 'Soubor k tomuhle dokumentu na serveru není. Záznam zůstal, soubor ne — nahrajte ho prosím znovu.'
          : 'Dokument se nepodařilo otevřít. Zkuste to prosím znovu.',
      );
    } finally {
      setLoadingView(false);
    }
  };

  const closeViewer = () => {
    if (viewing !== null) URL.revokeObjectURL(viewing);
    setViewing(null);
  };

  const doMove = async () => {
    if (target === '') return;
    setBusy(true);
    setError(null);
    try {
      await documentsApi.move(doc.id, target);
      setMoving(false);
      setTarget('');
      onChanged();
    } catch {
      setError('Dokument se nepodařilo přesunout. Zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  const doInvalidate = async () => {
    setBusy(true);
    setError(null);
    try {
      await documentsApi.invalidate(doc.id, reason, note.trim());
      setInvalidating(false);
      setNote('');
      onChanged();
    } catch {
      setError('Dokument se nepodařilo zneplatnit. Zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  const wouldLeaveGap = lastOfItsKind(doc, patientDocuments);
  const alreadyInvalid = doc.invalidatedAtUtc !== null;

  return (
    <>
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Otevřít">
          <span>
            <IconButton size="small" aria-label="Otevřít dokument" onClick={() => void open()} disabled={loadingView}>
              {loadingView ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Přesunout k jinému pacientovi">
          <span>
            <IconButton size="small" aria-label="Přesunout dokument" onClick={() => setMoving(true)} disabled={alreadyInvalid}>
              <DriveFileMove fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={alreadyInvalid ? 'Už je zneplatněný dokument' : 'Zneplatnit'}>
          <span>
            <IconButton size="small" aria-label={alreadyInvalid ? 'Už je zneplatněný' : 'Zneplatnit dokument'} onClick={() => setInvalidating(true)} disabled={alreadyInvalid}>
              <Block fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {error !== null && (
        <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* The file itself. Shown rather than downloaded - somebody checking
          whether the right page was scanned should not have to open a
          downloads folder to find out. */}
      <Dialog open={viewing !== null} onClose={closeViewer} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          Dokument
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={closeViewer} aria-label="Zavřít"><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '75vh' }}>
          {viewing !== null && (
            <Box
              component="iframe"
              src={viewing}
              title="Dokument"
              sx={{ width: '100%', height: '100%', border: 0 }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={moving} onClose={() => setMoving(false)} fullWidth maxWidth="sm">
        <DialogTitle>Přesunout k jinému pacientovi</DialogTitle>
        <DialogContent>
          {/*
            Said before the button is pressed, not discovered afterwards. A
            výpis moved away stops counting for the patient it left - which is
            right, it is not theirs - but that is a consequence somebody should
            see coming.
          */}
          {wouldLeaveGap && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Je to jediný platný dokument tohohle druhu, který {patientName} má.
              Po přesunu bude {patientName} chybět.
            </Alert>
          )}
          <TextField
            select
            fullWidth
            label="Komu dokument patří"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            sx={{ mt: 1 }}
          >
            {patients
              .filter((p) => p.id !== doc.patientId)
              .map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </MenuItem>
              ))}
          </TextField>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Z karty {patientName} zmizí úplně — patří někomu jinému.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoving(false)}>Zrušit</Button>
          <Button variant="contained" disabled={busy || target === ''} onClick={() => void doMove()}>
            Přesunout
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={invalidating} onClose={() => setInvalidating(false)} fullWidth maxWidth="sm">
        <DialogTitle>Zneplatnit dokument</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Dokument zůstane v kartě, ale přestane se počítat mezi doložené.
            Důvod se uloží spolu s vaším jménem a časem.
          </Typography>
          <TextField
            select
            fullWidth
            label="Důvod"
            value={reason}
            onChange={(event) => setReason(event.target.value as InvalidationReason)}
          >
            {INVALIDATION_REASONS.map((code) => (
              <MenuItem key={code} value={code}>
                {INVALIDATION_REASON_LABEL[code]}
              </MenuItem>
            ))}
          </TextField>
          {/* Not on the list on purpose: a document belonging to somebody else
              is not invalid, it is misfiled, and the answer is the move. */}
          <Alert severity="info" sx={{ mt: 2 }}>
            Patří-li dokument jinému pacientovi, nezneplatňujte ho — přesuňte ho.
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Poznámka"
            placeholder="Co přesně je s dokumentem špatně"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvalidating(false)}>Zrušit</Button>
          <Button color="error" variant="contained" disabled={busy} onClick={() => void doInvalidate()}>
            Zneplatnit
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
