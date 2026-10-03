import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';

/**
 * The dialog every "Nový ..." button opens. On a phone it takes the whole
 * screen and its action row stays at the bottom, one field per row above it;
 * on a tablet or desktop it is the board's centred 600 px dialog.
 */
export function FormDialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const phone = useIsPhone();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={phone} data-layout={phone ? 'fullscreen' : 'dialog'}>
      <DialogTitle component="h2">{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions sx={{ '& .MuiButton-root': { minHeight: 44, ...(phone && { flex: 1 }) } }}>
        {actions}
      </DialogActions>
    </Dialog>
  );
}
