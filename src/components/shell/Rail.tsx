/*
 * The rail: the application's sidebar, folded to 76px when nobody is near it.
 *
 * Matko's words (3. 10. 2026): "make the sidebar open only near the mouse and
 * let the work area grow; when you approach the sidebar it expands and the
 * content shifts right, dynamic." So:
 *
 *   - at rest it is 76px: an icon with a one-line 11px label under it per entry;
 *   - the pointer entering it, keyboard focus inside it, or the pin at its
 *     bottom widens it to 272px, and the main area's left margin grows with
 *     it (180ms ease-out) - the content is PUSHED, nothing is covered;
 *   - it folds again 300ms after the pointer leaves, unless pinned or focused;
 *   - a settings route pins it open, because there it is the only navigation;
 *   - on a phone it is not drawn at all - App.tsx keeps the temporary drawer.
 *
 * Nothing moves sideways while it opens: every row keeps its icon centred in
 * the same 60px column whether folded or open, and keeps the same height, so
 * widening only reveals the labels beside the icons.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ListItemButton, Tooltip, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import { PushPin, PushPinOutlined } from '@mui/icons-material';

export const RAIL_COLLAPSED = 76;
export const RAIL_EXPANDED = 272;
/** The rail's own horizontal padding; the icon column is what is left of 76. */
export const RAIL_PAD = 8;
export const RAIL_ICON_COL = RAIL_COLLAPSED - 2 * RAIL_PAD;
/** How long the rail and the main area take to move. One number, two transitions. */
export const RAIL_MOTION = '180ms ease-out';
const COLLAPSE_DELAY_MS = 300;
const PIN_STORAGE_KEY = 'sm-rail-pinned';

function readPinned(): boolean {
  try { return localStorage.getItem(PIN_STORAGE_KEY) === '1'; } catch { return false; }
}

export interface RailState {
  /** Whether the rail is 272px wide right now. */
  expanded: boolean;
  pinned: boolean;
  togglePin: () => void;
  width: number;
  /** Spread onto the rail's root element. */
  handlers: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: (event: React.FocusEvent<HTMLElement>) => void;
  };
}

/**
 * Hover, focus and the pin, folded into one `expanded`.
 *
 * `forcedOpen` is the settings route: there the rail is the only navigation,
 * so it stays at 272 whatever the pointer does.
 */
export function useRailState(forcedOpen: boolean): RailState {
  const [pinned, setPinned] = useState<boolean>(readPinned);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const onPointerEnter = useCallback(() => {
    clearTimer();
    setHovered(true);
  }, []);
  const onPointerLeave = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      setHovered(false);
    }, COLLAPSE_DELAY_MS);
  }, []);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    /* Focus moving between two things inside the rail is not leaving it. */
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setFocused(false);
  }, []);

  const togglePin = useCallback(() => {
    setPinned((was) => {
      try { localStorage.setItem(PIN_STORAGE_KEY, was ? '0' : '1'); } catch { /* private mode */ }
      return !was;
    });
  }, []);

  const expanded = forcedOpen || pinned || hovered || focused;
  return {
    expanded,
    pinned,
    togglePin,
    width: expanded ? RAIL_EXPANDED : RAIL_COLLAPSED,
    handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}

/**
 * The rail's surface: fixed to the left edge, full height, white with a
 * hairline on the right. Its width is the only thing that animates; the
 * content inside is laid out for the open width at once and clipped, so the
 * labels are revealed rather than reflowed.
 */
export function Rail({ state, label, children }: { state: RailState; label: string; children: React.ReactNode }) {
  return (
    <Box
      component="nav"
      aria-label={label}
      aria-expanded={state.expanded}
      data-expanded={state.expanded ? 'true' : 'false'}
      {...state.handlers}
      sx={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        width: state.width,
        transition: `width ${RAIL_MOTION}`,
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        zIndex: (t) => t.zIndex.drawer,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          width: state.expanded ? RAIL_EXPANDED - 1 : RAIL_COLLAPSED - 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          px: `${RAIL_PAD}px`,
          pt: 1.5,
          pb: 1.25,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * The icon column every row shares: 60px wide, icon centred. The rail's whole
 * trick is that this column is in the same place folded and open.
 */
export function IconCell({ children, active = false, size = 22 }: { children: React.ReactNode; active?: boolean; size?: number }) {
  return (
    <Box
      sx={{
        width: RAIL_ICON_COL,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: active ? 'primary.main' : 'text.secondary',
        '& svg': { fontSize: size },
      }}
    >
      {children}
    </Box>
  );
}

/**
 * One row of the rail's navigation.
 *
 * Folded: the icon with its label under it, 11px, one line. Open: the icon in
 * its column and the label beside it - the board's row, with the open screen
 * on a soft pill carrying a 3px accent bar. Both are 52px tall, so the list
 * does not shift when the rail opens.
 *
 * A child row (`indent`) exists only in the open rail: 38px, 14px text, its
 * own small icon.
 */
export function RailRow({
  to,
  label,
  icon,
  active,
  expanded,
  indent = false,
  onNavigate,
  trailing,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  expanded: boolean;
  indent?: boolean;
  onNavigate?: () => void;
  /** Drawn at the row's right edge when open - the chevron of a parent with children. */
  trailing?: React.ReactNode;
}) {
  if (indent) {
    return (
      <ListItemButton
        component={Link as any}
        to={to}
        selected={active}
        onClick={onNavigate}
        sx={{
          borderRadius: 2,
          mb: 0.25,
          minHeight: 38,
          pl: `${RAIL_ICON_COL - 4}px`,
          pr: 1.25,
          gap: 1,
          color: active ? 'primary.main' : 'text.primary',
          fontWeight: active ? 700 : 500,
          fontSize: 14,
          boxShadow: active ? (t) => `inset 3px 0 0 ${t.palette.primary.main}` : 'none',
        }}
      >
        <Box sx={{ display: 'flex', color: active ? 'primary.main' : 'text.secondary', '& svg': { fontSize: 18 } }}>{icon}</Box>
        <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
      </ListItemButton>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', mb: 0.25 }}>
      <ListItemButton
        component={Link as any}
        to={to}
        selected={active}
        onClick={onNavigate}
        aria-label={expanded ? undefined : label}
        sx={{
          flex: 1,
          minWidth: 0,
          borderRadius: 2,
          minHeight: 52,
          p: 0,
          pr: expanded ? 1 : 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          color: active ? 'primary.main' : 'text.primary',
          fontWeight: active ? 700 : 500,
          boxShadow: active ? (t) => `inset 3px 0 0 ${t.palette.primary.main}` : 'none',
        }}
      >
        <Box
          sx={{
            width: RAIL_ICON_COL,
            flexShrink: 0,
            minHeight: 52,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Box sx={{ display: 'flex', color: active ? 'primary.main' : 'text.secondary', '& svg': { fontSize: 22 } }}>{icon}</Box>
          {!expanded && (
            <Box
              component="span"
              sx={{
                fontSize: 11,
                lineHeight: 1.1,
                fontWeight: active ? 700 : 500,
                maxWidth: RAIL_ICON_COL - 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'center',
              }}
            >
              {label}
            </Box>
          )}
        </Box>
        {expanded && (
          <Box component="span" sx={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {label}
          </Box>
        )}
      </ListItemButton>
      {/* Beside the link, not inside it: a button in an anchor is two controls in one. */}
      {expanded && trailing !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.25 }}>{trailing}</Box>
      )}
    </Box>
  );
}

/** The pin at the rail's foot: keeps it open across hovers, remembered in this browser. */
export function RailPin({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <Tooltip title={pinned ? 'Odepnout lištu' : 'Připnout lištu otevřenou'} placement="right">
      <IconButton
        size="small"
        onClick={onToggle}
        aria-label={pinned ? 'Odepnout lištu' : 'Připnout lištu otevřenou'}
        aria-pressed={pinned}
        sx={{ color: pinned ? 'primary.main' : 'text.disabled' }}
      >
        {pinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" sx={{ transform: 'rotate(45deg)' }} />}
      </IconButton>
    </Tooltip>
  );
}
