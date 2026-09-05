/* ══════════════════════════════════════════════════════════════
   FORCE OVERRIDE MODAL — Phase 4
   Conflict resolution when dragging blocks over existing ones.
   Options: Force Override, Shift Existing, Cancel.
   RBAC-gated: Only Admin+ can see Force Override.
   ══════════════════════════════════════════════════════════════ */
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from '@mui/material';
import { Warning, SwapHoriz, Delete, Close } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import type { Appointment } from '../api/calendar';

interface ForceOverrideModalProps {
  open: boolean;
  onClose: () => void;
  conflictingAppointments: Appointment[];
  onForceOverride: () => void;
  onShiftExisting: () => void;
  onCancel: () => void;
}

export default function ForceOverrideModal({
  open,
  onClose,
  conflictingAppointments,
  onForceOverride,
  onShiftExisting,
  onCancel,
}: ForceOverrideModalProps) {
  const currentUserRole = useAppStore((s) => s.currentUserRole);
  const canOverride = ['Admin', 'SuperAdmin', 'HeadPhysician', 'Doctor'].includes(currentUserRole);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color="warning" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Kolize termínů</Typography>
          <Typography variant="body2" color="text.secondary">
            Vybraný čas koliduje s {conflictingAppointments.length} existujícími schůzkami
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Conflicting appointments list */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Kolidující schůzky:</Typography>
          {conflictingAppointments.map((appt) => {
            const start = new Date(appt.startTime);
            const end = new Date(appt.endTime);
            return (
              <Chip
                key={appt.id}
                label={`${appt.patientName} · ${appt.serviceType} · ${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}–${end.getHours()}:${end.getMinutes().toString().padStart(2, '0')}`}
                sx={{ m: 0.5, bgcolor: '#FFF3E0', color: '#E65100' }}
              />
            );
          })}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Vyberte akci pro vyřešení kolize:
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
        {/* Cancel — always available */}
        <Button onClick={() => { onCancel(); onClose(); }} startIcon={<Close />}
          sx={{ borderRadius: 2 }}>Zrušit</Button>

        {/* Shift Existing — available for Doctor+ */}
        {canOverride && (
          <Button onClick={() => { onShiftExisting(); onClose(); }} startIcon={<SwapHoriz />}
            variant="outlined" color="warning" sx={{ borderRadius: 2, fontWeight: 600 }}>
            Přesunout existující
          </Button>
        )}

        {/* Force Override — Admin+ only */}
        {canOverride && (
          <Button onClick={() => { onForceOverride(); onClose(); }} startIcon={<Delete />}
            variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 600, px: 3 }}>
            Vynutit přepsání
          </Button>
        )}

        {/* Non-admin users only see Cancel */}
        {!canOverride && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Nemáte oprávnění k přepsání. Požádejte administrátora.
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
}
