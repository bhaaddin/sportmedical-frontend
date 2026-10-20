/* ══════════════════════════════════════════════════════════════
   BUILDING BLOCKS OF THE PUBLIC SITE  (artboard V-Web2)

   Every page under /web is made from these, so the landing and the inner pages
   (Služby, Ceník, Kontakt, …) share one rhythm: section bands, an eyebrow, a big
   Archivo title, arrow links, pill buttons, price rows that react to hover.
   Sizes, colours and spacing are copied from the artboard; nothing here is a
   price or a sentence.
   ══════════════════════════════════════════════════════════════ */

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { SiteLink } from './SiteLink';
import { Magnetic } from '../motion/Magnetic';
import { useReveal } from '../motion/Reveal';
import { KineticLines } from '../motion/KineticText';
import { FONT_HEAD, GUTTER, MQ, SITE_MAX, W } from './tokens';
import { formatCzk, formatMinutes } from '../api/priceList';
import type { PriceItem } from '../api/priceList';

export const NBSP = String.fromCharCode(0xa0);

/* ── Icons (inline: no icon-font download, no barrel import) ── */

export function ArrowIcon({ size = 17, stroke = 2.3, className }: { size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

export function PersonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

/* ── Section band ── */

export interface WebSectionProps {
  children: ReactNode;
  /** Band colour: 'white' | 'warm' | 'ink'. */
  tone?: 'white' | 'warm' | 'ink';
  /** Vertical padding, px: [phone, desktop]. */
  py?: [number, number];
  id?: string;
  /** Padding-top override (the hero starts higher than it ends). */
  pt?: [number, number];
  pb?: [number, number];
  borderTop?: boolean;
  innerSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  /** px, or any CSS width; the default is the site's fluid column (tokens.ts, SITE_MAX). */
  maxWidth?: number | string;
  component?: 'section' | 'div';
  /** The inner content rises in when it scrolls into view (default). The home page's own scenes pass false. */
  reveal?: boolean;
  /** A section transition of the scroll scenes (src/motion/scenes/fx.ts), put on the band itself. */
  fx?: string;
  /** Marks the band for a scroll scene (data-sm). */
  dataSm?: string;
  /** Drawn behind the content (the hero's shader). */
  backdrop?: ReactNode;
}

const BAND = {
  white: { bgcolor: W.white, color: W.text },
  warm: { bgcolor: W.warm, color: W.text },
  ink: { bgcolor: W.ink, color: W.white },
} as const;

export function WebSection({
  children, tone = 'white', py = [56, 84], pt, pb, id, borderTop = false, innerSx, sx, maxWidth = SITE_MAX, component = 'section',
  reveal = true, fx, dataSm, backdrop,
}: WebSectionProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  useReveal(innerRef, { variant: 'rise', enabled: reveal });
  return (
    <Box
      component={component}
      id={id}
      data-fx={fx}
      data-sm={dataSm}
      sx={[
        {
          ...BAND[tone],
          ...(backdrop !== undefined ? { position: 'relative' } : {}),
          px: GUTTER,
          pt: { xs: `${(pt ?? py)[0]}px`, md: `${(pt ?? py)[1]}px` },
          pb: { xs: `${(pb ?? py)[0]}px`, md: `${(pb ?? py)[1]}px` },
          overflow: 'hidden',
          ...(borderTop ? { borderTop: `1px solid ${W.line}` } : {}),
        },
        ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []),
      ]}
    >
      {backdrop}
      <Box ref={innerRef} sx={[{ maxWidth, mx: 'auto', ...(backdrop !== undefined ? { position: 'relative', zIndex: 1 } : {}) }, ...(Array.isArray(innerSx) ? innerSx : innerSx !== undefined ? [innerSx] : [])]}>{children}</Box>
    </Box>
  );
}

/* ── Type ── */

/** The small uppercase label over a title. `onInk` = on a dark band. */
export function Eyebrow({ children, onInk = false, rule = false, sx }: { children: ReactNode; onInk?: boolean; rule?: boolean; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="span"
      sx={[
        {
          display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: 12, fontWeight: onInk ? 600 : 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: onInk ? W.orange : W.orangeText,
        },
        ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []),
      ]}
    >
      {rule && <Box component="span" aria-hidden="true" sx={{ width: 28, height: '1px', bgcolor: W.orange }} />}
      {children}
    </Box>
  );
}

/** Section title, Archivo 800. `size` picks the clamp of the artboard. */
export function SectionTitle({
  children, as = 'h2', size = 'lg', sx, fx,
}: { children: ReactNode; as?: 'h1' | 'h2' | 'h3'; size?: 'xl' | 'lg' | 'md'; sx?: SxProps<Theme>; fx?: string }) {
  const font = {
    xl: { fontSize: 'clamp(32px, 4.4vw, 54px)', lineHeight: 1.02, letterSpacing: '-0.04em' },
    lg: { fontSize: 'clamp(32px, 4.2vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.035em' },
    md: { fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.06, letterSpacing: '-0.035em' },
  }[size];
  return (
    <Box component={as} data-fx={fx} sx={[{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, ...font }, ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : [])]}>
      {children}
    </Box>
  );
}

/* ── Links and buttons ── */

/** "Detail prohlídek →" — the arrow slides on hover of the nearest `.blok`, or of the link itself. */
export function ArrowLink({ to, children, onInk = false, sx }: { to: string; children: ReactNode; onInk?: boolean; sx?: SxProps<Theme> }) {
  return (
    <Box
      component={SiteLink}
      to={to}
      sx={[
        {
          display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: 16, fontWeight: 700, textDecoration: 'none',
          minHeight: 44, color: onInk ? W.white : W.orangeText, alignSelf: 'flex-start',
          '&:hover': { color: onInk ? W.orange : W.orangeTextHover },
          '& .sipka': { transition: 'transform .2s ease', [MQ.reduceMotion]: { transition: 'none' } },
          '&:hover .sipka': { transform: 'translateX(6px)', [MQ.reduceMotion]: { transform: 'none' } },
        },
        ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []),
      ]}
    >
      {children}
      <ArrowIcon className="sipka" />
    </Box>
  );
}

export interface CtaButtonProps {
  to: string;
  children: ReactNode;
  /** primary = orange pill; ghostDark = outline on a dark band; ghostLight = outline on white. */
  variant?: 'primary' | 'ghostDark' | 'ghostLight';
  /** Pill height in px (46 header, 50 light, 54 club, 56 hero). Never below 44. */
  height?: number;
  px?: number;
  fontSize?: number;
  arrow?: boolean;
  /** The pill leans toward the pointer (fine pointers, full motion only). */
  magnetic?: boolean;
  sx?: SxProps<Theme>;
}

export function CtaButton({ to, children, variant = 'primary', height = 56, px, fontSize = 17, arrow = false, magnetic = false, sx }: CtaButtonProps) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: Math.max(44, height),
    borderRadius: `${height / 2}px`, textDecoration: 'none', whiteSpace: 'nowrap', fontSize,
    transition: 'transform .14s ease, box-shadow .14s ease, scale var(--sm-dur-quick, 140ms) var(--sm-ease-pop, ease)', [MQ.reduceMotion]: { transition: 'none' },
    '&:active': { scale: 'var(--sm-press, 1)' },
  } as const;
  const look = {
    primary: {
      px: `${px ?? 32}px`, bgcolor: W.orange, color: W.onOrange, fontFamily: FONT_HEAD, fontWeight: 700,
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(240,145,46,.34)', color: W.onOrange, [MQ.reduceMotion]: { transform: 'none' } },
    },
    ghostDark: {
      px: `${px ?? 28}px`, border: `1px solid ${W.inkBorder}`, color: W.white, fontWeight: 600,
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(0,0,0,.18)', color: W.white, [MQ.reduceMotion]: { transform: 'none' } },
    },
    ghostLight: {
      px: `${px ?? 24}px`, border: `1px solid ${W.text}`, color: W.text, fontWeight: 600,
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(0,0,0,.18)', color: W.text, [MQ.reduceMotion]: { transform: 'none' } },
    },
  }[variant];
  const button = (
    <Box component={SiteLink} to={to} sx={[base, look, ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : [])]}>
      {children}
      {arrow && <ArrowIcon size={18} stroke={2.4} />}
    </Box>
  );
  return magnetic ? <Magnetic style={{ display: 'inline-flex', maxWidth: '100%' }}>{button}</Magnetic> : button;
}

/* ── Price row ── */

/**
 * One line of a price list: name · duration · price. The whole row is a link and
 * reacts to hover (background + indent), as in V-Web2. The price comes from the
 * price list — an unknown price is "—", never a remembered number. `name` is the
 * API's own (or the registry's fallback when the API is down).
 */
export function PriceRow({
  to, name, item, last = false, showDuration = true,
}: { to: string; name: string; item?: PriceItem | null; last?: boolean; showDuration?: boolean }) {
  const price = formatCzk(item?.priceCzk);
  const minutes = showDuration ? formatMinutes(item?.durationMinutes) : null;
  return (
    <Box
      component={SiteLink}
      to={to}
      data-fx-item=""
      sx={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'baseline', py: '15px', textDecoration: 'none', color: W.text,
        borderTop: `1px solid ${W.line}`, ...(last ? { borderBottom: `1px solid ${W.line}` } : {}),
        transition: 'background-color .14s ease, padding-left .14s ease', [MQ.reduceMotion]: { transition: 'none' },
        // Hover only where there is a hover (a phone must not stick in the "hovered" state after a tap).
        '@media (hover: hover)': { '&:hover': { bgcolor: W.warm, pl: '24px' } },
        minHeight: 44,
      }}
    >
      <Box component="span" sx={{ flex: '999 1 200px', minWidth: 0, fontSize: 17, fontWeight: 600 }}>{name}</Box>
      {minutes !== null && (
        <Box component="span" sx={{ flex: { xs: '0 0 auto', sm: '0 0 110px' }, fontSize: 14, color: W.muted }}>{minutes}</Box>
      )}
      <Box
        component="span"
        sx={{ flex: '0 0 auto', fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums', ...(price === null ? { color: W.muted } : {}) }}
      >
        {price ?? '—'}
      </Box>
    </Box>
  );
}

/* ── Inner-page header (dark band with eyebrow / h1 / lead) ── */

export function PageHero({ eyebrow, title, lead, children }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <WebSection tone="ink" py={[48, 72]} sx={{ borderBottom: `1px solid ${W.inkLine}` }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: 820 }}>
        {eyebrow !== undefined && <Eyebrow onInk rule>{eyebrow}</Eyebrow>}
        <Box component="h1" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 0.98, letterSpacing: '-0.04em' }}>
          {typeof title === 'string' ? <KineticLines text={title} delay={0.1} /> : title}
        </Box>
        {lead !== undefined && (
          <Box component="p" sx={{ m: 0, fontSize: { xs: 17, md: 19 }, lineHeight: 1.55, color: W.onInk, maxWidth: '52ch' }}>{lead}</Box>
        )}
        {children}
      </Box>
    </WebSection>
  );
}
