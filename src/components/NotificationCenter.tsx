/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CENTER — Phase 4 (RBAC)
   - Bell icon in header with badge count
   - Dropdown with notification list
   - Mark as read/unread
   - Notification types: appointment, document, system, alert
   - WebSocket real-time updates
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Badge, Popover, List, ListItem, ListItemIcon,
  ListItemText, Button, Divider, Chip, Skeleton, Tooltip,
} from '@mui/material';
import {
  Notifications, CalendarMonth, Description, Warning, CheckCircle,
  Info, Delete, DoneAll, Settings,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import client from '../api/client';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import toast from 'react-hot-toast';

/* ── Types ── */
export interface Notification {
  id: string;
  type: 'appointment' | 'document' | 'system' | 'alert' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

/* ── Notification config ── */
const NOTIFICATION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  appointment: {
    icon: <CalendarMonth sx={{ fontSize: 20 }} />,
    color: '#0D7377',
    bgColor: '#E0F2F1',
  },
  document: {
    icon: <Description sx={{ fontSize: 20 }} />,
    color: '#0288D1',
    bgColor: '#E1F5FE',
  },
  system: {
    icon: <Settings sx={{ fontSize: 20 }} />,
    color: '#757575',
    bgColor: '#F5F5F5',
  },
  alert: {
    icon: <Warning sx={{ fontSize: 20 }} />,
    color: '#D32F2F',
    bgColor: '#FFEBEE',
  },
  info: {
    icon: <Info sx={{ fontSize: 20 }} />,
    color: '#2E7D32',
    bgColor: '#E8F5E9',
  },
};

/* ══════════════════════════════════════════════════════════════ */
export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const popoverId = open ? 'notification-popover' : undefined;

  /* ── Fetch notifications ── */
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await client.get('/api/notifications');
      const data = res.data?.value ?? res.data;
      setNotifications(prev => {
        const api = Array.isArray(data) ? data : data?.items ?? [];
        const bookingNotes = prev.filter(n => n.id.startsWith('booking:'));
        return [...bookingNotes, ...api];
      });
    } catch {
      // No notification API — keep booking notifications only
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /*
   * The list from the server is the truth; the socket is only the fast path.
   *
   * So the bell also asks on a timer, and keeps asking whether the hub is up or
   * not. Three days were spent on a bell that did not ring, and for two of them
   * nobody could tell whether the row was missing or merely undelivered - a
   * distinction that costs nothing to remove: the worst this may do is show a
   * notification a minute late, never not at all.
   *
   * Sixty seconds, and only while the tab is being looked at. A background tab
   * polling forever is a cost with no reader.
   */
  useEffect(() => {
    const POLL_MS = 60_000;
    const tick = () => {
      if (!document.hidden) void fetchNotifications();
    };
    const timer = setInterval(tick, POLL_MS);
    /* Coming back to the tab is the moment the list is most likely stale. */
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchNotifications]);

  /* ── Real booking notifications (poll admin bookings) ── */

  /* ── Real-time sync ── */
  useRealtimeSync({
    onSlotCreated: () => fetchNotifications(),
    onSlotUpdated: () => fetchNotifications(),
    onSlotDeleted: () => fetchNotifications(),
    /* After a gap in the socket, do not assume nothing happened inside it. */
    onReconnected: () => fetchNotifications(),
  });

  /* ── Handlers ── */
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const note = notifications.find(n => n.id === id);
    if (note?.actionUrl) {
      handleClose();
      window.location.href = note.actionUrl;
    }
    try {
      await client.patch(`/api/notifications/${id}/read`);
    } catch {
      // Optimistic update already applied
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await client.patch('/api/notifications/read-all');
    } catch {
      // Optimistic update already applied
    }
    toast.success('Vše označeno jako přečtené');
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await client.delete(`/api/notifications/${id}`);
    } catch {
      // Optimistic update already applied
    }
  };

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Právě teď';
    if (minutes < 60) return `Před ${minutes} min`;
    if (hours < 24) return `Před ${hours}h`;
    return `Před ${days} dny`;
  };

  return (
    <>
      {/* ── Bell Icon ── */}
      <Tooltip title="Oznámení">
        <IconButton
          color="inherit"
          onClick={handleOpen}
          aria-label={`${unreadCount} nepřečtených oznámení`}
          aria-describedby={popoverId}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <Notifications />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* ── Popover ── */}
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: 480,
              borderRadius: 3,
              mt: 1,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Oznámení
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllAsRead} startIcon={<DoneAll />}>
              Přečíst vše
            </Button>
          )}
        </Box>

        {/* ── Notification List ── */}
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Notifications sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
            <Typography color="text.secondary">Žádná oznámení</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 360, overflow: 'auto' }}>
            <AnimatePresence>
              {notifications.map((notification) => {
                const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.info;
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ListItem
                      sx={{
                        py: 1.5,
                        px: 2,
                        bgcolor: notification.read ? 'transparent' : '#F5F9FF',
                        borderLeft: notification.read ? '3px solid transparent' : `3px solid ${config.color}`,
                        '&:hover': { bgcolor: '#F5F5F5' },
                        cursor: 'pointer',
                      }}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 44 }}>
                        <Box sx={{ color: config.color, bgcolor: config.bgColor, p: 1, borderRadius: 2 }}>
                          {config.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: notification.read ? 400 : 600 }}>
                              {notification.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {formatTime(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
                            {notification.message}
                          </Typography>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <Delete sx={{ fontSize: 16 }} />
                      </IconButton>
                    </ListItem>
                    <Divider />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </List>
        )}

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <Box sx={{ p: 1.5, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
            <Button size="small" color="primary" onClick={handleClose}>
              Zobrazit vše
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
}
