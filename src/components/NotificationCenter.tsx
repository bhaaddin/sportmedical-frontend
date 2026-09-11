/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CENTER — Phase 4 (RBAC)
   - Bell icon in header with badge count
   - Dropdown with notification list
   - Mark as read/unread
   - Notification types: appointment, document, system, alert
   - WebSocket real-time updates
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, IconButton, Badge, Popover, List, ListItem, ListItemIcon,
  ListItemText, Button, Divider, Skeleton, Tooltip,
} from '@mui/material';
import {
  Notifications, CalendarMonth, Description, Warning,
  Info, Delete, DoneAll, Settings, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { AnimatePresence } from 'framer-motion';
import client from '../api/client';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import {
  buildNotificationSections,
  exactNotificationTime,
  type NotificationRow,
  formatNotificationTime,
  groupLabel,
  newSinceBoundary,
} from './notifications/notificationList';
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
  /** Machine-readable event, used for grouping. Absent means "do not group". */
  kind?: string | null;
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

/**
 * One notification. Lives apart from the list so a row inside an expanded
 * group and a row standing on its own are the same thing, not two things that
 * drift.
 */
function NotificationLine({
  row,
  inset = false,
  onOpen,
  onDelete,
}: {
  /* The list's own shape, not the component's narrower one: a row inside a
     group and a row on its own must be the same thing. */
  row: NotificationRow;
  inset?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const config = NOTIFICATION_CONFIG[row.type] ?? NOTIFICATION_CONFIG.info;
  return (
    <>
      <ListItem
        sx={{
          py: 1.5,
          pl: inset ? 5 : 2,
          pr: 2,
          bgcolor: row.read ? 'transparent' : '#F5F9FF',
          borderLeft: row.read ? '3px solid transparent' : `3px solid ${config.color}`,
          '&:hover': { bgcolor: '#F5F5F5' },
          cursor: 'pointer',
        }}
        onClick={onOpen}
      >
        <ListItemIcon sx={{ minWidth: 44 }}>
          <Box sx={{ color: config.color, bgcolor: config.bgColor, p: 1, borderRadius: 2 }}>
            {config.icon}
          </Box>
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: row.read ? 400 : 600 }}>
                {row.title}
              </Typography>
              {/* The exact moment is reachable everywhere, including where the
                  label is relative - so "Před 12 min" is never all anybody can
                  find out. */}
              <Tooltip title={exactNotificationTime(row.timestamp)}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatNotificationTime(row.timestamp)}
                </Typography>
              </Tooltip>
            </Box>
          }
          secondary={
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
              {row.message}
            </Typography>
          }
        />
        <IconButton
          size="small"
          aria-label="Smazat oznámení"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{ ml: 1 }}
        >
          <Delete sx={{ fontSize: 16 }} />
        </IconButton>
      </ListItem>
      <Divider />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /*
   * When this viewer last opened the panel, straight from the server.
   *
   * Null until the server sends it, and then no "new since" line is drawn at
   * all - a divider in the wrong place is worse than no divider, because it
   * makes a confident claim about what somebody has already seen.
   */
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const open = Boolean(anchorEl);
  const popoverId = open ? 'notification-popover' : undefined;

  /* ── Fetch notifications ── */
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await client.get('/api/notifications');
      const data = res.data?.value ?? res.data;
      /* The marker travels with the list when the server has one. Read
         defensively: today it sends a bare array and there is no envelope. */
      const seen = res.data?.lastSeenAt ?? res.data?.value?.lastSeenAt ?? null;
      if (typeof seen === 'string') setLastSeenAt(seen);
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
    /* The hub's nudge carries nothing by design - the answer is to ask. */
    onNotificationsChanged: () => fetchNotifications(),
  });

  /* ── Handlers ── */
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  /*
   * Rebuilt only when the rows or the marker change - not on every render, so
   * a group does not silently re-collapse while somebody is reading it open.
   */
  const sections = useMemo(
    () => buildNotificationSections(notifications, { lastSeenAt }),
    [notifications, lastSeenAt],
  );
  const boundary = useMemo(() => newSinceBoundary(sections), [sections]);

  const toggleGroup = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
              {sections.map((section) => (
                <Box key={section.key}>
                  {/* Day heading. Sticky so it stays readable while scrolling
                      a long day, which is the case it exists for. */}
                  <Box
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      px: 2,
                      py: 0.75,
                      bgcolor: '#FAFAFA',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.4 }}
                    >
                      {section.heading}
                    </Typography>
                  </Box>

                  {section.entries.map((item, index) => {
                    const showBoundary =
                      boundary !== null &&
                      boundary.sectionKey === section.key &&
                      boundary.index === index;

                    const divider = showBoundary ? (
                      <Box
                        key={`${section.key}-boundary`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5 }}
                      >
                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#0D7377' }} />
                        <Typography variant="caption" sx={{ color: '#0D7377', fontWeight: 700 }}>
                          Nové od vašeho posledního pohledu
                        </Typography>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#0D7377' }} />
                      </Box>
                    ) : null;

                    if (item.entry === 'group') {
                      const groupKey = `${section.key}-${item.kind}-${item.timestamp}`;
                      const isOpen = expanded.has(groupKey);
                      const config =
                        NOTIFICATION_CONFIG[item.rows[0].type] ?? NOTIFICATION_CONFIG.info;
                      return (
                        <Box key={groupKey}>
                          {divider}
                          <ListItem
                            sx={{
                              py: 1.25,
                              px: 2,
                              bgcolor: item.unreadCount > 0 ? '#F5F9FF' : 'transparent',
                              borderLeft:
                                item.unreadCount > 0
                                  ? `3px solid ${config.color}`
                                  : '3px solid transparent',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#F5F5F5' },
                            }}
                            onClick={() => toggleGroup(groupKey)}
                          >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                              <Box
                                sx={{ color: config.color, bgcolor: config.bgColor, p: 1, borderRadius: 2 }}
                              >
                                {config.icon}
                              </Box>
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: item.unreadCount > 0 ? 600 : 400 }}
                                  >
                                    {groupLabel(item.kind, item.rows.length)}
                                  </Typography>
                                  <Tooltip title={exactNotificationTime(item.timestamp)}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ whiteSpace: 'nowrap' }}
                                    >
                                      {formatNotificationTime(item.timestamp)}
                                    </Typography>
                                  </Tooltip>
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {item.unreadCount > 0
                                    ? `${item.unreadCount} nepřečtených`
                                    : 'vše přečteno'}
                                </Typography>
                              }
                            />
                            {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </ListItem>
                          <Divider />
                          {isOpen &&
                            item.rows.map((row) => (
                              <NotificationLine
                                key={row.id}
                                row={row}
                                inset
                                onOpen={() => markAsRead(row.id)}
                                onDelete={() => deleteNotification(row.id)}
                              />
                            ))}
                        </Box>
                      );
                    }

                    return (
                      <Box key={item.row.id}>
                        {divider}
                        <NotificationLine
                          row={item.row}
                          onOpen={() => markAsRead(item.row.id)}
                          onDelete={() => deleteNotification(item.row.id)}
                        />
                      </Box>
                    );
                  })}
                </Box>
              ))}
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
