import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useIsPhone } from '../../../layout/useDevice';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** A yes/no question before something that cannot be undone. Full-screen on a phone, targets ≥ 44 px. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const phone = useIsPhone();
  return (
    <Dialog open={request !== null} onClose={onClose} fullScreen={phone} fullWidth maxWidth="xs" aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title" sx={{ fontSize: 18, fontWeight: 700 }}>{request?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{request?.body}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, ...(phone ? { flexDirection: 'column-reverse', '& > *': { width: '100%', m: 0 } } : {}) }}>
        <Button onClick={onClose} color="inherit" sx={{ minHeight: 44 }}>Ne, nechat</Button>
        <Button
          onClick={() => {
            const confirm = request?.onConfirm;
            onClose();
            confirm?.();
          }}
          variant="contained"
          color="error"
          sx={{ minHeight: 44, fontWeight: 700 }}
        >
          {request?.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
