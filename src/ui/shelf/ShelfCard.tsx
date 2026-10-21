/*
 * The four cards that stand on a shelf. One surface (shelfStyle `cardSurface`), four jobs:
 *
 *   EntityCard     one thing of the clinic (a patient, an invoice ...): its badge, its name, two quiet lines, a status.
 *                  The whole card opens it; a pin and any extra control sit above the link so they stay clickable.
 *   MetricCard     one figure - counts up once, says in a line what it counts, and links to where it is worked on.
 *   ActionCard     something to DO next: a verb, a sentence, one press.
 *   AttentionCard  one thing that needs a person today (src/ui/shelf/attention.ts): its count, the first few cases as
 *                  links straight to where each is fixed, and one button for the rest.
 *
 * A card is `role="listitem"` (its shelf is a list). A link card is a stretched link: the title is the one `<a>`, and its
 * `::after` covers the card, so there is no link inside a link and every control on the card is still its own target.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowForward } from '@mui/icons-material';
import { CountUp } from '../../motion/CountUp';
import { StatusChip, type ChipTone } from '../../components/ui/StatusChip';
import { ENTITY_LABEL, entityTarget, type EntityRef } from './entities';
import { EntityBadge } from './entityMeta';
import { EntityChip } from './EntityLink';
import type { AttentionGroup, Severity } from './attention';
import { CARD_RADIUS, MUTED_SX, TARGET_SX, cardSurface, toneOf, type ShelfTone } from './shelfStyle';

/** The link whose `::after` is the whole card. */
const stretched = {
  textDecoration: 'none',
  color: 'inherit',
  '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: `${CARD_RADIUS}px` },
  '&:focus-visible': { outline: 'none' },
  '&:focus-visible::after': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
} as const;

/** What sits above the stretched link (a pin, a chip) so it keeps its own click. */
export const ABOVE_LINK = { position: 'relative', zIndex: 1 } as const;

interface Target { to: string; state?: Record<string, unknown> }

/* ───────────────────────────── EntityCard ───────────────────────────── */

export function EntityCard({
  entity, subtitle, detail, status, trailing, label, dense = false,
}: {
  /** One line: the badge and the name, nothing else (a shelf that is context, not content). */
  dense?: boolean;
  entity: EntityRef;
  subtitle?: string;
  detail?: string;
  status?: { label: string; tone: ChipTone };
  /** A control that belongs to the card (a pin button). It is raised above the stretched link. */
  trailing?: ReactNode;
  /** Replaces the default accessible name of the link ("Pacient: Jana Marková"). */
  label?: string;
}) {
  const target = entityTarget(entity);
  if (dense) {
    return (
      <Box role="listitem" data-card="entity" data-entity={entity.kind} data-dense="" sx={(t) => ({ ...cardSurface(t, true), px: 1.25, py: 0.5, minHeight: 48, display: 'flex', gap: 1, alignItems: 'center' })}>
        <EntityBadge kind={entity.kind} size={28} />
        <Box component={RouterLink} to={target.to} state={target.state} aria-label={label ?? `${ENTITY_LABEL[entity.kind]}: ${entity.label}`} sx={{ ...stretched, display: 'block', flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 650 }}>{entity.label}</Typography>
        </Box>
        {trailing !== undefined && <Box sx={ABOVE_LINK}>{trailing}</Box>}
      </Box>
    );
  }
  return (
    <Box role="listitem" data-card="entity" data-entity={entity.kind} sx={(t) => ({ ...cardSurface(t, true), p: 1.5, display: 'flex', gap: 1.25, alignItems: 'flex-start' })}>
      <EntityBadge kind={entity.kind} size={36} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', ...MUTED_SX, lineHeight: 1.2 }}>
          {ENTITY_LABEL[entity.kind]}
        </Typography>
        <Box component={RouterLink} to={target.to} state={target.state} aria-label={label ?? `${ENTITY_LABEL[entity.kind]}: ${entity.label}`} sx={{ ...stretched, display: 'block', mt: 0.25 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{entity.label}</Typography>
        </Box>
        {subtitle !== undefined && <Typography sx={{ ...MUTED_SX, fontSize: 13, mt: 0.25, overflowWrap: 'anywhere' }}>{subtitle}</Typography>}
        {detail !== undefined && <Typography sx={{ ...MUTED_SX, fontSize: 12.5, overflowWrap: 'anywhere' }}>{detail}</Typography>}
        {status !== undefined && <Box sx={{ mt: 0.75 }}><StatusChip tone={status.tone} size="sm">{status.label}</StatusChip></Box>}
      </Box>
      {trailing !== undefined && <Box sx={ABOVE_LINK}>{trailing}</Box>}
    </Box>
  );
}

/* ───────────────────────────── MetricCard ───────────────────────────── */

export function MetricCard({
  label, value, hint, tone = 'grey', to, state, format,
}: {
  label: string;
  /** A number counts up once (with `format` for money); a string is shown as it is. */
  value: number | string | null;
  hint?: string;
  /** Colours the figure: `red` for money owed, `green` for the waiting room, `grey` for ink. */
  tone?: ShelfTone;
  to?: string;
  state?: Record<string, unknown>;
  format?: (n: number) => string;
}) {
  const body = (
    <>
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', ...MUTED_SX, lineHeight: 1.2 }}>{label}</Typography>
      <Typography
        component="div"
        sx={(t) => ({
          fontSize: 28, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.15, mt: 0.5, fontVariantNumeric: 'tabular-nums',
          color: tone === 'grey' ? 'text.primary' : toneOf(t, tone).fg,
        })}
      >
        {typeof value === 'number' ? <CountUp value={value} format={format} /> : (value ?? '—')}
      </Typography>
      {hint !== undefined && <Typography sx={{ ...MUTED_SX, fontSize: 12.5, mt: 0.5, lineHeight: 1.35 }}>{hint}</Typography>}
    </>
  );
  return (
    <Box role="listitem" data-card="metric" sx={(t) => ({ ...cardSurface(t, to !== undefined), p: 1.75 })}>
      {to === undefined ? body : <Box component={RouterLink} to={to} state={state} aria-label={`${label}: ${typeof value === 'number' ? (format ? format(value) : value) : (value ?? 'bez údaje')}`} sx={{ ...stretched, display: 'block' }}>{body}</Box>}
    </Box>
  );
}

/* ───────────────────────────── ActionCard ───────────────────────────── */

export function ActionCard({
  title, description, icon, to, state, onClick, primary = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  to?: string;
  state?: Record<string, unknown>;
  onClick?: () => void;
  /** The one thing the page wants done: filled with the accent. */
  primary?: boolean;
}) {
  const inner = (
    <>
      {icon !== undefined && (
        <Box
          aria-hidden
          sx={(t) => ({
            width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
            color: primary ? t.palette.primary.contrastText : toneOf(t, 'primary').fg,
            bgcolor: primary ? 'primary.main' : toneOf(t, 'primary').bg,
            boxShadow: primary ? 'none' : `inset 0 0 0 1px ${toneOf(t, 'primary').line}`,
          })}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.3 }}>{title}</Typography>
        {description !== undefined && <Typography component="span" sx={{ display: 'block', ...MUTED_SX, fontSize: 13, mt: 0.25, lineHeight: 1.35 }}>{description}</Typography>}
      </Box>
      <ArrowForward aria-hidden sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
    </>
  );
  const surface = (t: Parameters<typeof cardSurface>[0]) => ({
    ...cardSurface(t, true),
    p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 64,
    ...(primary ? { borderColor: toneOf(t, 'primary').line, backgroundColor: toneOf(t, 'primary').bg, backgroundImage: 'none' } : {}),
  });
  return (
    <Box role="listitem" data-card="action" sx={surface}>
      {to !== undefined ? (
        <Box component={RouterLink} to={to} state={state} sx={{ ...stretched, display: 'flex', alignItems: 'center', gap: 1.25, width: '100%' }}>{inner}</Box>
      ) : (
        <Box component="button" type="button" onClick={onClick} sx={{ ...stretched, display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', textAlign: 'left', background: 'none', border: 0, p: 0, font: 'inherit', cursor: 'pointer' }}>{inner}</Box>
      )}
    </Box>
  );
}

/* ───────────────────────────── AttentionCard ───────────────────────────── */

const SEVERITY_TONE: Record<Severity, ShelfTone> = { high: 'red', medium: 'beige', low: 'blue' };
const SEVERITY_WORD: Record<Severity, string> = { high: 'Naléhavé', medium: 'Čeká', low: 'Brzy' };

export function AttentionCard({ group }: { group: AttentionGroup }) {
  const tone = SEVERITY_TONE[group.severity];
  return (
    <Box
      role="listitem"
      data-card="attention"
      data-attention={group.id}
      data-severity={group.severity}
      sx={(t) => ({
        ...cardSurface(t, false), p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        /* The edge says how urgent it is; the colour is a tone of the board, never a colour of its own. */
        borderLeft: `3px solid ${toneOf(t, tone).fg}`,
      })}
    >
      <Box sx={{ p: 1.5, pb: 1, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography
          aria-hidden
          sx={(t) => ({ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: toneOf(t, tone).fg })}
        >
          <CountUp value={group.count} />
        </Typography>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.25 }}>
            {group.title}
            <Box component="span" sx={visuallyHidden}>{`: ${group.count}`}</Box>
          </Typography>
          <Typography sx={{ ...MUTED_SX, fontSize: 12, mt: 0.25, lineHeight: 1.35 }}>{group.summary}</Typography>
        </Box>
        <StatusChip tone={tone} size="sm">{SEVERITY_WORD[group.severity]}</StatusChip>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, px: 0.75, pb: 0.5, flex: 1 }}>
        {group.items.map((item: AttentionGroup['items'][number]) => (
          <Box component="li" key={item.id}>
            <Box
              component={RouterLink}
              to={item.to}
              state={item.state}
              sx={(t) => ({
                display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.75, borderRadius: 1.5, textDecoration: 'none', color: 'inherit',
                ...TARGET_SX,
                '&:hover': { bgcolor: t.palette.action.hover },
                '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
              })}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</Typography>
                <Typography sx={{ ...MUTED_SX, fontSize: 12.5, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{item.detail}</Typography>
              </Box>
              <ArrowForward aria-hidden sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={(t) => ({ px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: alpha(t.palette.divider, 0.8) })}>
        <Button
          component={RouterLink}
          to={group.action.to}
          state={group.action.state}
          size="small"
          endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
          sx={{ ...TARGET_SX, px: 0.5, fontWeight: 650 }}
        >
          {group.action.label}
        </Button>
      </Box>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const;

/* Re-exported so a page that draws a connected chip inside its own card needs one import. */
export { EntityChip };
export type { Target as ShelfTarget };
