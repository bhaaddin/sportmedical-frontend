import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, Avatar, Typography, Divider, Badge
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ExpandLess, ExpandMore, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: NavItem[];
  badge?: number;
  disabled?: boolean;
}

interface SidebarProps {
  items: NavItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  user?: {
    name: string;
    role: string;
    avatar?: string;
  };
}

const SidebarContainer = styled(Box)<{ collapsed: boolean }>(({ theme, collapsed }) => ({
  width: collapsed ? 72 : 260,
  height: '100vh',
  backgroundColor: theme.palette.background.paper,
  borderRight: `1px solid ${theme.palette.divider}`,
  transition: `width ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

const NavListItem = styled(ListItemButton)<{ active?: boolean; collapsed?: boolean }>(
  ({ theme, active, collapsed }) => ({
    borderRadius: theme.shape.borderRadius,
    margin: theme.spacing(0.5, 1),
    padding: collapsed ? '10px' : '10px 12px',
    minHeight: 44,
    justifyContent: collapsed ? 'center' : 'flex-start',
    ...(active && {
      backgroundColor: (theme.palette.primary.main || '#1976D2') + '15',
      color: theme.palette.primary.main,
      '& .MuiListItemIcon-root': {
        color: theme.palette.primary.main,
      },
    }),
    '&:hover': {
      backgroundColor: active
        ? (theme.palette.primary.main || '#1976D2') + '20'
        : theme.palette.action?.hover || 'rgba(0,0,0,0.04)',
    },
  })
);

export default function Sidebar({
  items,
  collapsed = false,
  onToggleCollapse,
  user,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isActive = (path?: string) => path && location.pathname === path;

  const renderNavItem = (item: NavItem, _level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = openItems.includes(item.id);
    const active = isActive(item.path);

    return (
      <Box key={item.id}>
        <NavListItem
          active={active}
          collapsed={collapsed}
          onClick={() => {
            if (hasChildren) {
              handleToggle(item.id);
            } else if (item.path) {
              navigate(item.path);
            }
          }}
          disabled={item.disabled}
        >
          <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
            {item.badge ? (
              <Badge badgeContent={item.badge} color="error">
                {item.icon}
              </Badge>
            ) : (
              item.icon
            )}
          </ListItemIcon>
          {!collapsed && (
            <>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                }}
              />
              {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
            </>
          )}
        </NavListItem>
        {hasChildren && !collapsed && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map(child => renderNavItem(child, _level + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <SidebarContainer collapsed={collapsed}>
      {/* Logo area */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: '#0D7377', width: 36, height: 36 }}>CM</Avatar>
        {!collapsed && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            CGM MEDISTAR
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {items.map(item => renderNavItem(item))}
      </List>

      <Divider />

      {/* User info */}
      {user && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={user.avatar}
            sx={{ width: 36, height: 36, bgcolor: '#0D7377' }}
          >
            {user.name.split(' ').map(n => n[0]).join('')}
          </Avatar>
          {!collapsed && (
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="subtitle2" noWrap>{user.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.role}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
          <ListItemButton
            onClick={onToggleCollapse}
            sx={{ borderRadius: 1, justifyContent: 'center' }}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </ListItemButton>
        </Box>
      )}
    </SidebarContainer>
  );
}
