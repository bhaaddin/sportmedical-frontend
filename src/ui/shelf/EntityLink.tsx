/*
 * EntityChip / EntityLink - the connection between pages. A patient, a club, an appointment, an invoice, a document, a
 * service wherever it is mentioned is one of these: the same icon and colour, a click that opens it, and - when somebody
 * rests the pointer on it or tabs to it - a peek card with three or four facts, fetched only then.
 *
 *   <EntityChip entity={{ kind: 'club', id, label: 'FC Sparta' }} />         a pill (icon + label)
 *   <EntityLink entity={{ kind: 'patient', id, label: 'Jana Marková' }} />   the label as an inline link
 *
 * - The address comes from `entityTarget` (entities.ts); a page never writes `/patients/${id}`.
 * - A person who may not open the kind (no `patients.view`, no `billing.manage` ...) gets plain text, not a dead link.
 * - The peek opens after 350 ms of a mouse resting there (keyboard focus: 150 ms) and closes at once on leaving or
 *   Escape; a touch never opens it (a tap navigates). It reads the application's own api modules and their shared query
 *   keys, shows no identifying numbers, and its text is the same on every page that wears the chip.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Fade, Paper, Popper, Skeleton, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../auth/usePermission';
import { StatusChip } from '../../components/ui/StatusChip';
import { ENTITY_LABEL, entityTarget, mayOpen, refKey, type EntityRef } from './entities';
import { ENTITY_ICON, ENTITY_TONE, EntityBadge } from './entityMeta';
import { toneOf } from './shelfStyle';
import { DESIGN, darkOf } from '../../theme';

const OPEN_DELAY_MOUSE = 350;
const OPEN_DELAY_FOCUS = 150;
const CLOSE_DELAY = 140;

/** Hover / focus state of one trigger, with the delays above. The peek stays open while the pointer is over it. */
function usePeekState(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* A focus that follows a press of the mouse or a finger is a click already on its way; only the keyboard peeks. */
  const pressed = useRef(false);
  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const schedule = useCallback((next: boolean, delay: number) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);
  useEffect(() => clear, []);

  const handlers = enabled
    ? {
        onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') schedule(true, OPEN_DELAY_MOUSE); },
        onPointerLeave: () => schedule(false, CLOSE_DELAY),
        onPointerDown: () => { pressed.current = true; },
        onPointerUp: () => { pressed.current = false; },
        onFocus: () => { if (!pressed.current) schedule(true, OPEN_DELAY_FOCUS); },
        onBlur: () => { pressed.current = false; schedule(false, 0); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') { clear(); setOpen(false); } },
      }
    : {};
  const keepOpen = { onPointerEnter: () => schedule(true, 0), onPointerLeave: () => schedule(false, CLOSE_DELAY) };
  return { open: enabled && open, handlers, keepOpen };
}

/* ───────────────────────────── the peek card ───────────────────────────── */

function PeekCard({ entity, anchorEl, id, keepOpen }: { entity: EntityRef; anchorEl: HTMLElement; id: string; keepOpen: Record<string, unknown> }) {
  const queryClient = useQueryClient();
  const peek = useQuery({
    queryKey: ['shelf', 'peek', refKey(entity)],
    /* The peek's api modules are fetched only now, when somebody has rested on a chip. */
    queryFn: async () => (await import('./peek')).loadPeek(entity, queryClient),
    staleTime: 60_000,
    retry: false,
  });
  return (
    <Popper open anchorEl={anchorEl} placement="bottom-start" role="presentation" transition modifiers={[{ name: 'offset', options: { offset: [0, 6] } }, { name: 'flip', enabled: true }]} sx={{ zIndex: (t) => t.zIndex.tooltip }}>
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={120}>
          <Paper
            id={id}
            role="tooltip"
            elevation={0}
            {...keepOpen}
            sx={(t) => ({
              width: 280, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: '14px', border: '1px solid',
              borderColor: t.palette.mode === 'dark' ? darkOf(t).panelLine : t.palette.divider,
              boxShadow: t.palette.mode === 'dark' ? darkOf(t).floatingGlow : DESIGN.shadow.menu,
              ...(t.palette.mode === 'dark' ? { backgroundImage: 'none', bgcolor: darkOf(t).glass } : {}),
            })}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <EntityBadge kind={entity.kind} size={34} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{entity.label}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{ENTITY_LABEL[entity.kind]}</Typography>
              </Box>
              {peek.data?.status !== undefined && <StatusChip tone={peek.data.status.tone} size="sm">{peek.data.status.label}</StatusChip>}
            </Box>
            <Box sx={{ mt: 1.25 }}>
              {peek.isPending && (
                <Box aria-busy="true" aria-label="Načítám údaje">
                  <Skeleton height={16} width="80%" />
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={16} width="70%" />
                </Box>
              )}
              {peek.isError && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Údaje se nepodařilo načíst.</Typography>
              )}
              {peek.data !== undefined && peek.data.facts.length > 0 && (
                <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.5 }}>
                  {peek.data.facts.map((f) => (
                    <Box key={f.label} sx={{ display: 'contents' }}>
                      <Typography component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>{f.label}</Typography>
                      <Typography component="dd" sx={{ fontSize: 13, fontWeight: 600, m: 0, overflowWrap: 'anywhere' }}>{f.value}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {peek.data !== undefined && peek.data.facts.length === 0 && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Víc se dozvíte po otevření.</Typography>
              )}
            </Box>
          </Paper>
        </Fade>
      )}
    </Popper>
  );
}

/* ───────────────────────────── the chip and the link ───────────────────────────── */

interface Common {
  entity: EntityRef;
  /** `false`: no peek (a dense list, a place where a hover card would cover what is being read). */
  peek?: boolean;
  /** Runs on the click, before the router navigates (a table row that also opens it calls `e.stopPropagation()` here). */
  onNavigate?: (event: React.MouseEvent) => void;
}

function useAccess(entity: EntityRef): boolean {
  return mayOpen(entity.kind, usePermissions());
}

export function EntityChip({ entity, peek = true, onNavigate, size = 'md' }: Common & { size?: 'sm' | 'md' }) {
  const allowed = useAccess(entity);
  const target = entityTarget(entity);
  const [anchorEl, setAnchorEl] = useState<HTMLAnchorElement | null>(null);
  const popId = useId();
  const { open, handlers, keepOpen } = usePeekState(peek && allowed);
  const Icon = ENTITY_ICON[entity.kind];

  const pill = (
    <Box
      component="span"
      sx={(t) => {
        const c = toneOf(t, ENTITY_TONE[entity.kind]);
        return {
          display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%', minWidth: 0,
          height: size === 'sm' ? 26 : 32, pl: size === 'sm' ? 0.875 : 1.125, pr: size === 'sm' ? 1.125 : 1.5, borderRadius: 999,
          fontSize: size === 'sm' ? 12 : 13, fontWeight: 600, lineHeight: 1,
          color: c.fg, bgcolor: c.bg, boxShadow: `inset 0 0 0 1px ${c.line}`,
          transition: 'box-shadow 120ms',
        };
      }}
    >
      <Icon aria-hidden sx={{ fontSize: size === 'sm' ? 14 : 16, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.label}</Box>
    </Box>
  );

  if (!allowed) {
    return <Box component="span" data-entity={entity.kind} sx={{ display: 'inline-flex', maxWidth: '100%' }}>{pill}</Box>;
  }
  return (
    <>
      <Box
        component={RouterLink}
        ref={setAnchorEl}
        to={target.to}
        state={target.state}
        data-entity={entity.kind}
        aria-describedby={open ? popId : undefined}
        aria-label={`${ENTITY_LABEL[entity.kind]}: ${entity.label}`}
        onClick={onNavigate}
        {...handlers}
        sx={(t) => ({
          display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0, textDecoration: 'none', borderRadius: 999,
          /* The pill is 32 px; under 1280 the hit area around it is 44 px (a thumb, not a pointer). */
          '@media (max-width: 1279.95px)': { minHeight: 44 },
          '&:hover span:first-of-type, &:focus-visible span:first-of-type': { boxShadow: `inset 0 0 0 1.5px ${toneOf(t, ENTITY_TONE[entity.kind]).fg}` },
          '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
        })}
      >
        {pill}
      </Box>
      {open && anchorEl !== null && <PeekCard entity={entity} anchorEl={anchorEl} id={popId} keepOpen={keepOpen} />}
    </>
  );
}

export function EntityLink({ entity, children, peek = true, onNavigate }: Common & { children?: ReactNode }) {
  const allowed = useAccess(entity);
  const target = entityTarget(entity);
  const [anchorEl, setAnchorEl] = useState<HTMLAnchorElement | null>(null);
  const popId = useId();
  const { open, handlers, keepOpen } = usePeekState(peek && allowed);
  const text = children ?? entity.label;

  if (!allowed) return <Box component="span" data-entity={entity.kind}>{text}</Box>;
  return (
    <>
      <Box
        component={RouterLink}
        ref={setAnchorEl}
        to={target.to}
        state={target.state}
        data-entity={entity.kind}
        aria-describedby={open ? popId : undefined}
        onClick={onNavigate}
        {...handlers}
        sx={(t) => ({
          color: t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.primary.main,
          fontWeight: 600, textDecoration: 'none', borderRadius: 0.5,
          '&:hover': { textDecoration: 'underline' },
          '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
          '@media (max-width: 1279.95px)': { display: 'inline-flex', alignItems: 'center', minHeight: 44 },
        })}
      >
        {text}
      </Box>
      {open && anchorEl !== null && <PeekCard entity={entity} anchorEl={anchorEl} id={popId} keepOpen={keepOpen} />}
    </>
  );
}
