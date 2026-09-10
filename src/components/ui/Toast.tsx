import { toast, Toaster, type ToastOptions } from 'react-hot-toast';
import { Box, Typography, IconButton } from '@mui/material';
import { CheckCircle, Error, Warning, Info, Close } from '@mui/icons-material';

const toastStyles = {
  success: { background: '#E8F5E9', color: '#1B5E20', border: '1px solid #4CAF50' },
  error: { background: '#FFEBEE', color: '#B71C1C', border: '1px solid #F44336' },
  warning: { background: '#FFF8E1', color: '#F57F17', border: '1px solid #FFC107' },
  info: { background: '#E3F2FD', color: '#1565C0', border: '1px solid #2196F3' },
};

const icons = {
  success: <CheckCircle sx={{ color: '#4CAF50' }} />,
  error: <Error sx={{ color: '#F44336' }} />,
  warning: <Warning sx={{ color: '#FF9800' }} />,
  info: <Info sx={{ color: '#2196F3' }} />,
};

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export function showToast({ message, type = 'info', duration = 4000, action }: ToastProps) {
  return toast(
    (t) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {icons[type]}
        <Typography variant="body2" sx={{ flex: 1 }}>{message}</Typography>
        {action && (
          <Typography
            variant="body2"
            sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => { action.onClick(); toast.dismiss(t.id); }}
          >
            {action.label}
          </Typography>
        )}
        <IconButton size="small" onClick={() => toast.dismiss(t.id)} sx={{ ml: 1 }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
    ),
    { duration, style: toastStyles[type] }
  );
}

export const toastSuccess = (message: string, options?: Partial<ToastOptions>) =>
  showToast({ message, type: 'success', ...options });

export const toastError = (message: string, options?: Partial<ToastOptions>) =>
  showToast({ message, type: 'error', ...options });

export const toastWarning = (message: string, options?: Partial<ToastOptions>) =>
  showToast({ message, type: 'warning', ...options });

export const toastInfo = (message: string, options?: Partial<ToastOptions>) =>
  showToast({ message, type: 'info', ...options });

export function showUndoToast(message: string, onUndo: () => void, duration = 6000) {
  return showToast({ message, type: 'info', duration, action: { label: 'Zpět', onClick: onUndo } });
}

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { borderRadius: '8px', padding: '12px 16px', fontSize: '14px', maxWidth: '400px' },
        success: { iconTheme: { primary: '#4CAF50', secondary: '#FFFFFF' } },
        error: { iconTheme: { primary: '#F44336', secondary: '#FFFFFF' } },
      }}
    />
  );
}
