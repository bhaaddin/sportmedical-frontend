/* ══════════════════════════════════════════════════════════════
   CANDIDATE REVIEW

   The registry does not decide on its own that two people are the same
   person. When a registration resembles existing records it answers
   CandidateReviewRequired with a candidate set and two fingerprints;
   the operator decides, and the decision goes back as `confirmation`
   carrying those exact fingerprints. If the registry has moved on in
   the meantime the confirmation is refused as stale rather than
   applied to a set the operator never saw.
   ══════════════════════════════════════════════════════════════ */

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { PersonSearch } from '@mui/icons-material';
import type { RegistrationCandidate } from '../../api/patientRegistry';

interface Props {
  open: boolean;
  candidates: RegistrationCandidate[];
  submitting: boolean;
  /** Operator says none of these is the same person — register anyway. */
  onConfirmDistinct: () => void;
  /** Operator recognises an existing patient; registration is abandoned. */
  onUseExisting: (candidate: RegistrationCandidate) => void;
  onCancel: () => void;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('cs-CZ');
}

const SEX_LABEL: Record<string, string> = {
  Male: 'muž',
  Female: 'žena',
  NotSpecified: 'neuvedeno',
  Unknown: 'neznámé',
};

export default function CandidateReviewDialog({
  open,
  candidates,
  submitting,
  onConfirmDistinct,
  onUseExisting,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonSearch color="warning" /> Možná shoda s existujícím pacientem
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          V registru jsou pacienti s podobnými údaji. Registrace pokračuje až po vašem rozhodnutí.
        </Alert>

        <List disablePadding>
          {candidates.map((candidate) => (
            <ListItemButton
              key={candidate.patientId}
              disabled={submitting}
              onClick={() => onUseExisting(candidate)}
              sx={{ borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'divider' }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {candidate.fullName ?? `${candidate.firstName} ${candidate.lastName}`}
                    </Typography>
                    <Chip
                      size="small"
                      label={candidate.status === 'Active' ? 'aktivní' : 'archivovaný'}
                      color={candidate.status === 'Active' ? 'success' : 'default'}
                    />
                  </Box>
                }
                secondary={`nar. ${formatDate(candidate.dateOfBirth)} · ${
                  SEX_LABEL[candidate.sex] ?? candidate.sex
                }`}
              />
            </ListItemButton>
          ))}
        </List>

        <Typography variant="caption" color="text.secondary">
          Kliknutím na pacienta registraci ukončíte a otevřete jeho kartu.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={submitting}>
          Zpět do formuláře
        </Button>
        <Button variant="contained" onClick={onConfirmDistinct} disabled={submitting}>
          Je to jiná osoba — registrovat
        </Button>
      </DialogActions>
    </Dialog>
  );
}
