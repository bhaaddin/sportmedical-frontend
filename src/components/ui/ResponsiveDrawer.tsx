import { type ReactNode } from 'react';
import { Drawer, Box, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ResponsiveDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number | string;
  anchor?: 'left' | 'right' | 'top' | 'bottom';
}

export default function ResponsiveDrawer({
  open, onClose, title, children, width = 400, anchor = 'right',
}: ResponsiveDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : anchor}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : width,
          maxHeight: isMobile ? '80vh' : '100%',
          borderTopLeftRadius: isMobile ? 16 : 0,
          borderTopRightRadius: isMobile ? 16 : 0,
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title && <Typography variant="h6">{title}</Typography>}
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ overflow: 'auto', flex: 1 }}>{children}</Box>
    </Drawer>
  );
}
