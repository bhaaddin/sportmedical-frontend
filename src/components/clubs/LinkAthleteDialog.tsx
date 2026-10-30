/*
 * "Spojit s pacientem": the desk says that this club athlete IS a registered patient. All the athlete's places in the block
 * are linked and the patient becomes an active member of the club. Never automatic: a person, a patient and a reason.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import PatientPicker from '../patients/PatientPicker';
import type { Patient } from '../../api/patients';
import { clubBlocksApi, linkAthleteProblem, type AthleteLinkResult } from '../../api/clubBlocks';

export const LINK_REASON_MAX = 500;

export function LinkAthleteDialog({ blockId, athleteId, athleteName, onClose, onLinked }: {
  blockId: string;
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onLinked: (result: AthleteLinkResult) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ready = patient !== null && reason.trim() !== '' && reason.length <= LINK_REASON_MAX;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      onLinked(await clubBlocksApi.linkAthleteToPatient(blockId, athleteId, { patientId: patient.id, reason: reason.trim() }));
    } catch (error) {
      setProblem(linkAthleteProblem(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="link-athlete-title">
      <DialogTitle id="link-athlete-title">Spojit s pacientem</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {athleteName} se spojí s vybraným pacientem ve všech místech tohoto bloku a pacient se stane členem klubu.
        </Typography>
        <PatientPicker value={patient} onChange={setPatient} label="Pacient" required />
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Důvod spojení"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reason.length > LINK_REASON_MAX}
          helperText={reason.length > LINK_REASON_MAX ? `Nejvýše ${LINK_REASON_MAX} znaků.` : 'Např. „stejná osoba, ověřeno telefonem“. Zapíše se do historie.'}
          sx={{ mt: 2 }}
        />
        {problem !== null ? <Alert severity="error" sx={{ mt: 1 }}>{problem}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>Zavřít</Button>
        <Button variant="contained" onClick={() => { void submit(); }} disabled={!ready || busy} sx={{ minHeight: 44 }}>Spojit</Button>
      </DialogActions>
    </Dialog>
  );
}
