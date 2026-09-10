import { useState, type ReactNode } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, Box } from '@mui/material';

interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownItem[];
  width?: number;
}

export default function DropdownMenu({ trigger, items, width = 200 }: DropdownMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Box onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ cursor: 'pointer' }}>{trigger}</Box>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width, maxHeight: 400 } }}>
        {items.map((item) => {
          if (item.divider) return <Divider key={item.id} />;
          return (
            <MenuItem
              key={item.id}
              onClick={() => { if (!item.disabled && item.onClick) item.onClick(); setAnchorEl(null); }}
              disabled={item.disabled}
              sx={{ color: item.danger ? 'error.main' : 'inherit' }}
            >
              {item.icon && (
                <ListItemIcon sx={{ color: item.danger ? 'error.main' : 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
              )}
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
