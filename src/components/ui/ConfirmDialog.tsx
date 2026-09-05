import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { Warning as WarningIcon, Info as InfoIcon } from '@mui/icons-material';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'warning' | 'danger' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Potvrdit', cancelLabel = 'Zrušit',
  type = 'warning', loading = false,
}: ConfirmDialogProps) {
  const iconColor = { warning: 'warning.main', danger: 'error.main', info: 'info.main' }[type];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ p: 1, borderRadius: '50%', bgcolor: `${iconColor}20`, color: iconColor }}>
          {type === 'info' ? <InfoIcon /> : <WarningIcon />}
        </Box>
        {title}
      </DialogTitle>
      <DialogContent><Typography>{message}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button onClick={onConfirm} variant="contained" color={type === 'danger' ? 'error' : 'primary'} disabled={loading}>
          {loading ? 'Probíhá...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
