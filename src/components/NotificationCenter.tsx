/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CENTER — Phase 4 (RBAC)
   - Bell icon in header with badge count
   - Dropdown with notification list
   - Mark as read/unread
   - Notification types: appointment, document, system, alert
   - WebSocket real-time updates
   ══════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import {
  Box, Typography, IconButton, Badge, Popover, List, ListItem, ListItemIcon,
  ListItemText, Button, Divider, Skeleton, Tooltip,
  type SxProps, type Theme,
} from '@mui/material';
import {
  Notifications, CalendarMonth, Description, Warning,
  Info, Delete, DoneAll, Settings, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ACCENT_SOFT, DESIGN } from './ui';
import { useNotificationFeed, type FeedNotification } from './notifications/useNotificationFeed';
import {
  buildNotificationSections,
  exactNotificationTime,
  type NotificationRow,
  formatNotificationTime,
  groupLabel,
  newSinceBoundary,
  splitAppointmentWhen,
} from './notifications/notificationList';
import { formatPragueDateTime } from '../utils/time';

/* ── Types ── */
export type Notification = FeedNotification;

/* ── Notification config: an icon and one of the board's tones per kind ── */
const NOTIFICATION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  appointment: {
    icon: <CalendarMonth sx={{ fontSize: 18 }} />,
    color: DESIGN.tone.green.fg,
    bgColor: DESIGN.tone.green.bg,
  },
  document: {
    icon: <Description sx={{ fontSize: 18 }} />,
    color: DESIGN.tone.blue.fg,
    bgColor: DESIGN.tone.blue.bg,
  },
  system: {
    icon: <Settings sx={{ fontSize: 18 }} />,
    color: DESIGN.tone.grey.fg,
    bgColor: DESIGN.tone.grey.bg,
  },
  alert: {
    icon: <Warning sx={{ fontSize: 18 }} />,
    color: DESIGN.tone.red.fg,
    bgColor: DESIGN.tone.red.bg,
  },
  info: {
    icon: <Info sx={{ fontSize: 18 }} />,
    color: DESIGN.tone.beige.fg,
    bgColor: DESIGN.tone.beige.bg,
  },
};

/* The unread tint: the board's soft accent surface, with the accent as the left edge. */
const UNREAD_BG = ACCENT_SOFT.bg;

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
          bgcolor: row.read ? 'transparent' : UNREAD_BG,
          borderLeft: '3px solid',
          borderLeftColor: row.read ? 'transparent' : 'primary.main',
          '&:hover': { bgcolor: 'action.hover' },
          cursor: 'pointer',
        }}
        onClick={onOpen}
      >
        <ListItemIcon sx={{ minWidth: 44 }}>
          <Box sx={{ color: config.color, bgcolor: config.bgColor, width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {config.icon}
          </Box>
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: row.read ? 400 : 600 }}>
                {row.title}
              </Typography>
              {/*
                Labelled, because a booking notification carries two times and
                they mean opposite things: this one is when the message
                arrived, and the one inside the message is when the patient is
                actually coming. Side by side and unlabelled they read as one
                thing said twice - which is how it was first reported.
 
                The exact moment stays on the tooltip, so "Před 12 min" is
                never all anybody can find out.
              */}
              <Tooltip title={`přišlo ${exactNotificationTime(row.timestamp)}`}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  přišlo {formatNotificationTime(row.timestamp)}
                </Typography>
              </Tooltip>
            </Box>
          }
          secondary={
            /*
              The appointment's own time, named. Unlabelled it sat beside the
              arrival time meaning the opposite thing, and read as one thing
              said twice.

              Only labelled when a trailing date and time is actually
              recognised; otherwise the sentence renders exactly as the server
              wrote it. The server naming the field is the real fix and has
              been asked for - this cannot claim anything it has not read.
            */
            (() => {
              /*
                The appointment's time, preferred from the field and only then
                from the sentence.
 
                `occursAtUtc` is an instant, so it formats through the one
                Prague formatter this codebase has. `splitAppointmentWhen` is
                the fallback and stays until the field is actually populated -
                nothing sends it yet, and dropping the parse now would trade a
                label that works for one that does not exist.
              */
              if (typeof row.occursAtUtc === 'string' && row.occursAtUtc !== '') {
                const split = splitAppointmentWhen(row.message);
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
                    {split === null ? row.message : split.rest}
                    {' · '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      termín {formatPragueDateTime(row.occursAtUtc)}
                    </Box>
                  </Typography>
                );
              }

              const split = splitAppointmentWhen(row.message);
              if (split === null) {
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
                    {row.message}
                  </Typography>
                );
              }
              return (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
                  {split.rest}
                  {' · '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    termín {split.when}
                  </Box>
                </Typography>
              );
            })()
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
/**
 * The bell and its panel.
 *
 * `placement` is where the panel opens relative to the bell: "below" for a
 * bell in a top bar (phone), "side" for a bell at the foot of a sidebar or
 * rail, where there is no room below - the panel opens upward and to the
 * right, over the content. Either way it never wider than the screen.
 */
export default function NotificationCenter({
  placement = 'below',
  buttonSx,
}: {
  placement?: 'below' | 'side';
  /** Extra styling for the bell button, e.g. a 44px touch target. */
  buttonSx?: SxProps<Theme>;
} = {}) {
  const navigate = useNavigate();
  const {
    notifications, loading, lastSeenAt, unreadCount,
    markRead, markAllRead: markAllAsRead, remove: deleteNotification, stampSeen,
  } = useNotificationFeed();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const open = Boolean(anchorEl);
  const popoverId = open ? 'notification-popover' : undefined;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /*
   * Stamped on close, not on open.
   *
   * On open the line would move out from under the person reading: they glance
   * away, come back, and the mark telling them where they stopped is gone. It
   * has to survive the whole of one look.
   *
   * The server only ever moves it forward, so two tabs closed in the wrong
   * order cannot drag it backwards and redraw the line across things already
   * read.
   */
  const handleClose = () => {
    setAnchorEl(null);
    void stampSeen();
  };

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

  /*
   * Opened either way: the person asked to see what it points at, and a failed
   * mark leaves the row honestly unread rather than blocking that. A row with a
   * link navigates only after its PATCH was sent (a full page load before it
   * could abort it).
   */
  const markAsRead = async (id: string) => {
    const note = await markRead(id);
    if (note?.actionUrl) {
      handleClose();
      navigate(note.actionUrl);
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
          sx={buttonSx}
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
        anchorOrigin={placement === 'side'
          ? { vertical: 'top', horizontal: 'right' }
          : { vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={placement === 'side'
          ? { vertical: 'bottom', horizontal: 'left' }
          : { vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: 'min(480px, calc(100dvh - 24px))',
              borderRadius: 3,
              mt: placement === 'side' ? 0 : 1,
              mb: placement === 'side' ? 1 : 0,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: DESIGN.shadow.menu,
            },
          },
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
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
            <Notifications sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Žádná oznámení</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 360, overflow: 'auto' }}>
            <>
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
                      bgcolor: (t) => (t.palette.mode === 'light' ? DESIGN.head : t.palette.background.default),
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="overline"
                      component="div"
                      sx={{ color: 'text.secondary' }}
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
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'primary.main' }} />
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                          Nové od vašeho posledního pohledu
                        </Typography>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'primary.main' }} />
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
                              bgcolor: item.unreadCount > 0 ? UNREAD_BG : 'transparent',
                              borderLeft: '3px solid',
                              borderLeftColor: item.unreadCount > 0 ? 'primary.main' : 'transparent',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => toggleGroup(groupKey)}
                          >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                              <Box
                                sx={{ color: config.color, bgcolor: config.bgColor, width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                                  <Tooltip title={`přišlo ${exactNotificationTime(item.timestamp)}`}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ whiteSpace: 'nowrap' }}
                                    >
                                      přišlo {formatNotificationTime(item.timestamp)}
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
            </>
          </List>
        )}

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Button size="small" color="primary" onClick={handleClose}>
              Zobrazit vše
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
}
