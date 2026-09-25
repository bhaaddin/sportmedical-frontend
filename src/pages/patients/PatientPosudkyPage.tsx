/*
 * One patient's certificates of medical fitness for sport (posudky).
 *
 * Issued here by the signed-in doctor, listed newest first, printed as a PDF
 * the server renders from Nastavení (the clinic) and the registry (the
 * patient) at that moment. Nothing on this page is a placeholder: the list is
 * the table, the PDF is the file, and a button somebody may not use is not
 * drawn.
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormHelperText, InputLabel, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import { Add, PictureAsPdf, VerifiedUser } from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  POSUDEK_RESULTS, POSUDEK_TYPES, defaultValidUntil, posudkyApi,
  type IssuePosudekInput, type Posudek, type PosudekResult, type PosudekType,
} from '../../api/posudky';
import { usePermission } from '../../auth/usePermission';
import { formatDateOnly } from '../../utils/time';
import { problemMessageOf as problemMessage } from '../settings/settingsProblem';
import type { PatientContext } from './PatientLayout';

const RESULT_COLOUR: Record<PosudekResult, string> = {
  Fit: '#2E7D32',
  FitWithRestrictions: '#EF6C00',
  Unfit: '#C62828',
};

function PosudekRow({ posudek, onPdf, downloading }: { posudek: Posudek; onPdf: () => void; downloading: boolean }) {
  const colour = RESULT_COLOUR[posudek.result] ?? '#607D8B';
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', py: 1.5, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ minWidth: 220, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {posudek.typeText} · {posudek.sport}{posudek.club ? ` (${posudek.club})` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Vystaveno {formatDateOnly(posudek.reportDate)} · {posudek.practitioner} · platí do {formatDateOnly(posudek.validUntil)}
        </Typography>
        {posudek.restrictions && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Omezení: {posudek.restrictions}
          </Typography>
        )}
      </Box>
      <Chip
        size="small"
        label={posudek.resultText}
        sx={{ bgcolor: `${colour}14`, color: colour, fontWeight: 600 }}
      />
      {!posudek.isValidToday && <Chip size="small" label="Platnost skončila" variant="outlined" />}
      <Button size="small" startIcon={<PictureAsPdf />} onClick={onPdf} disabled={downloading}>
        PDF
      </Button>
    </Stack>
  );
}

interface IssueDialogProps {
  open: boolean;
  onClose: () => void;
  onIssue: (input: IssuePosudekInput) => Promise<void>;
  busy: boolean;
}

export function IssuePosudekDialog({ open, onClose, onIssue, busy }: IssueDialogProps) {
  const [type, setType] = useState<PosudekType>('ZakladniProhlidka');
  const [result, setResult] = useState<PosudekResult>('Fit');
  const [restrictions, setRestrictions] = useState('');
  const [sport, setSport] = useState('');
  const [club, setClub] = useState('');
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const sportMissing = sport.trim() === '';
  const restrictionsMissing = result === 'FitWithRestrictions' && restrictions.trim() === '';
  const canSubmit = !sportMissing && !restrictionsMissing && validUntil !== '';

  const submit = async () => {
    setTried(true);
    if (!canSubmit) return;
    await onIssue({
      type,
      result,
      restrictions: restrictions.trim() === '' ? undefined : restrictions.trim(),
      sport: sport.trim(),
      club: club.trim() === '' ? undefined : club.trim(),
      validUntil,
      note: note.trim() === '' ? undefined : note.trim(),
    });
  };

  const typeHelp = POSUDEK_TYPES.find((t) => t.value === type)?.help ?? '';
  const resultHelp = POSUDEK_RESULTS.find((r) => r.value === result)?.help ?? '';

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Vystavit posudek</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Posuzujícím lékařem bude váš účet. Jméno a datum narození pacienta i údaje ordinace se na posudek doplní ze systému.
        </Typography>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="posudek-type">Druh prohlídky</InputLabel>
            <Select labelId="posudek-type" label="Druh prohlídky" value={type} onChange={(e) => setType(e.target.value as PosudekType)}>
              {POSUDEK_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
            <FormHelperText>{typeHelp}</FormHelperText>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="posudek-result">Výsledek</InputLabel>
            <Select labelId="posudek-result" label="Výsledek" value={result} onChange={(e) => setResult(e.target.value as PosudekResult)}>
              {POSUDEK_RESULTS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
            <FormHelperText>{resultHelp}</FormHelperText>
          </FormControl>

          {result !== 'Fit' && (
            <TextField
              label={result === 'Unfit' ? 'Důvod (nepovinné)' : 'Omezení'}
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              multiline
              minRows={2}
              required={result === 'FitWithRestrictions'}
              error={tried && restrictionsMissing}
              helperText={tried && restrictionsMissing
                ? 'U výsledku „způsobilý s omezením“ napište, jaké omezení platí.'
                : 'Tiskne se na posudek doslova, tak jak to napíšete.'}
            />
          )}

          <TextField
            label="Sport / činnost"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            required
            error={tried && sportMissing}
            helperText={tried && sportMissing ? 'Uveďte sport nebo činnost, pro kterou posudek platí.' : 'Pro jaký sport nebo činnost posudek platí, například „Fotbal“.'}
          />

          <TextField
            label="Klub / oddíl (nepovinné)"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            helperText="Pokud posudek žádá klub, uvede se na něm."
          />

          <TextField
            label="Platí do"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            required
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Do kdy posudek platí; obvykle rok od vystavení, nejdéle 24 měsíců."
          />

          <TextField
            label="Poznámka lékaře (nepovinné)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            helperText="Vytiskne se na posudek jako poznámka lékaře."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Zrušit</Button>
        <Button variant="contained" onClick={() => { void submit(); }} disabled={busy} startIcon={<VerifiedUser />}>
          Vystavit posudek
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PatientPosudkyPage() {
  const { patient } = useOutletContext<PatientContext>();
  const mayView = usePermission('documents.view');
  const mayIssue = usePermission('documents.manage');
  const queryClient = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['posudky', patient.id],
    queryFn: () => posudkyApi.list(patient.id),
    enabled: mayView,
  });

  const issue = useMutation({
    mutationFn: (input: IssuePosudekInput) => posudkyApi.issue(patient.id, input),
    onSuccess: () => {
      toast.success('Posudek vystaven.');
      setIssuing(false);
      void queryClient.invalidateQueries({ queryKey: ['posudky', patient.id] });
    },
    onError: (error: unknown) => {
      toast.error(problemMessage(error, 'Posudek se nepodařilo vystavit.'));
    },
  });

  const downloadPdf = async (posudek: Posudek) => {
    setDownloading(posudek.id);
    try {
      const { blob, fileName } = await posudkyApi.pdf(patient.id, posudek.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(problemMessage(error, 'PDF se nepodařilo vystavit.'));
    } finally {
      setDownloading(null);
    }
  };

  if (!mayView) {
    return (
      <Alert severity="info">
        Posudky pacienta vidí jen účet s oprávněním „Vidět dokumenty pacienta“.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
            <VerifiedUser sx={{ color: '#0D7377' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Posudky o zdravotní způsobilosti</Typography>
            <Box sx={{ flex: 1 }} />
            {mayIssue && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setIssuing(true)} sx={{ bgcolor: '#0D7377' }}>
                Vystavit posudek
              </Button>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Lékařský posudek o zdravotní způsobilosti k tělesné výchově a sportu. PDF se tiskne s údaji ordinace z Nastavení a se jménem a datem narození pacienta z registru.
          </Typography>
          <Divider sx={{ mb: 1 }} />

          {list.isError && <Alert severity="error">Posudky se nepodařilo načíst.</Alert>}
          {list.data?.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Pacient zatím nemá žádný posudek.
            </Typography>
          )}
          {(list.data ?? []).map((posudek) => (
            <PosudekRow
              key={posudek.id}
              posudek={posudek}
              onPdf={() => { void downloadPdf(posudek); }}
              downloading={downloading === posudek.id}
            />
          ))}
        </CardContent>
      </Card>

      {mayIssue && (
        <IssuePosudekDialog
          open={issuing}
          onClose={() => setIssuing(false)}
          onIssue={async (input) => { await issue.mutateAsync(input).catch(() => undefined); }}
          busy={issue.isPending}
        />
      )}
    </Stack>
  );
}
