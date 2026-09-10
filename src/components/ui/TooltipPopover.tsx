import { type ReactNode, useState } from 'react';
import { Tooltip, Popover, Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface EnhancedTooltipProps {
  children: ReactNode;
  content: ReactNode;
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  interactive?: boolean;
  maxWidth?: number;
}

export function EnhancedTooltip({ children, content, title, placement = 'top', interactive = false, maxWidth = 300 }: EnhancedTooltipProps) {
  return (
    <Tooltip title={<Box sx={{ maxWidth }}>{title && <Typography variant="subtitle2" gutterBottom>{title}</Typography>}{content}</Box>} placement={placement} interactive={interactive} arrow>
      {children}
    </Tooltip>
  );
}

interface InfoTooltipProps {
  content: ReactNode;
  title?: string;
}

export function InfoTooltip({ content, title }: InfoTooltipProps) {
  return (
    <EnhancedTooltip content={content} title={title}>
      <IconButton size="small" sx={{ ml: 0.5 }}>
        <Typography variant="caption" sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>?</Typography>
      </IconButton>
    </EnhancedTooltip>
  );
}

interface ContentPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  title?: string;
  width?: number | string;
}

export function ContentPopover({ trigger, children, title, width = 300 }: ContentPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box onClick={(e) => setAnchorEl(e.currentTarget)}>{trigger}</Box>
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Box sx={{ width, p: 2 }}>
          {title && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">{title}</Typography>
              <IconButton size="small" onClick={() => setAnchorEl(null)}><CloseIcon fontSize="small" /></IconButton>
            </Box>
          )}
          {children}
        </Box>
      </Popover>
    </>
  );
}
