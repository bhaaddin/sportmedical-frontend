import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Box, Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Close as CloseIcon } from '@mui/icons-material';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  actions?: React.ReactNode;
  showCloseButton?: boolean;
  children: React.ReactNode;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: (theme.shape.borderRadius ?? 8) * 2,
    boxShadow: theme.shadows[20] || theme.shadows[13],
  },
}));

const sizeMap: Record<string, 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  full: false,
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  actions,
  showCloseButton = true,
  children,
}: ModalProps) {
  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth={sizeMap[size] as any}
      fullWidth={size === 'full'}
      fullScreen={size === 'full'}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pb: subtitle ? 1 : 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="span">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {showCloseButton && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>{children}</DialogContent>
      {actions && <DialogActions sx={{ px: 3, pb: 3 }}>{actions}</DialogActions>}
    </StyledDialog>
  );
}
