/* ══════════════════════════════════════════════════════════════
   PUBLIC PAGE KIT  (artboards V-Rezervace, V-KlubReg, V-Dotaznik, V-Portal)

   The few pieces every patient-facing application page is built from, so
   /objednat, /dotaznik, /dokonceni, /klub, /portal and /rezervace read as one
   family with the V-Web2 header and footer around them: Archivo headings, white
   panels with a 1 px warm line and a 16 px radius, 12 px uppercase labels, a
   pill call-to-action in the orange, and — on a phone — the main action pinned
   at the bottom of the screen.

   Colours are `brand.ts`'s (the V-Web2 values); nothing here is a text or a
   price, those come from the API.
   ══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { ARCHIVO, BRAND } from './brand';

/** The warm-grey label colour of the artboards (#6E6960). */
export const LABEL_COLOR = '#6E6960';
/** Body text on white (#5C6067). */
export const SOFT_TEXT = '#5C6067';
/** The text colour on the orange pill (#1A1206). */
export const ON_ORANGE = '#1A1206';

/** The side gutters of every page body: 16 px phone, 32 px iPad, 44 px desktop (the artboards). */
export const GUTTERS = { xs: 2, md: 4, lg: '44px' } as const;

/** A page body: centred, with the artboard's gutters (16 phone, 32 iPad, 44 desktop). */
export function PublicMain({
  children, maxWidth = 1100, gap = 3.25, sx,
}: { children: ReactNode; maxWidth?: number; gap?: number; sx?: SxProps<Theme> }) {
  const device = useDevice();
  return (
    <Box
      component="div"
      data-device={device}
      sx={{
        width: '100%',
        maxWidth,
        mx: 'auto',
        boxSizing: 'border-box',
        px: GUTTERS,
        pt: { xs: 3, md: '34px' },
        pb: { xs: 3, md: 7 },
        display: 'flex',
        flexDirection: 'column',
        gap,
        flex: 1,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** Page title: Archivo 800, the artboards' clamp(27px, 3.2vw, 36px). */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography
        component="h1"
        sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 'clamp(27px, 3.2vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1.1, color: BRAND.text }}
      >
        {children}
      </Typography>
      {sub !== undefined && (
        <Typography sx={{ fontSize: 16, color: SOFT_TEXT, lineHeight: 1.5, maxWidth: '62ch' }}>{sub}</Typography>
      )}
    </Box>
  );
}

/** A white panel (the artboards' 16 px card). */
export function Panel({
  children, sx, component = 'section', id, labelledBy,
}: { children: ReactNode; sx?: SxProps<Theme>; component?: 'section' | 'div' | 'aside'; id?: string; labelledBy?: string }) {
  return (
    <Box
      component={component}
      id={id}
      aria-labelledby={labelledBy}
      sx={{
        bgcolor: BRAND.paper,
        border: `1px solid ${BRAND.line}`,
        borderRadius: '16px',
        p: { xs: '18px 16px', md: '22px 24px' },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
        minWidth: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** Panel heading: Archivo 700, 19 px. */
export function PanelTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Typography component="h2" id={id} sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', color: BRAND.text }}>
      {children}
    </Typography>
  );
}

/** The 12 px uppercase label over a value. */
export function FieldLabel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography
      component="span"
      sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: LABEL_COLOR, ...sx }}
    >
      {children}
    </Typography>
  );
}

/** The orange pill every primary action wears (artboards: 50 px, Archivo 700, 16 px). */
export const ctaSx = (height = 50): SxProps<Theme> => ({
  height,
  minHeight: height,
  borderRadius: `${height / 2}px`,
  px: 3.5,
  bgcolor: BRAND.accent,
  color: ON_ORANGE,
  fontFamily: ARCHIVO,
  fontWeight: 700,
  fontSize: 16,
  '&:hover': { bgcolor: BRAND.accentDark },
  '&.Mui-disabled': { bgcolor: '#EFE7DA', color: '#9A9185' },
});

/** The quiet pill next to it (white, 1 px line). */
export const ghostSx = (height = 46): SxProps<Theme> => ({
  height,
  minHeight: height,
  borderRadius: `${height / 2}px`,
  px: 2.75,
  bgcolor: BRAND.paper,
  color: BRAND.text,
  border: `1px solid ${BRAND.line}`,
  fontWeight: 600,
  fontSize: 15,
  '&:hover': { bgcolor: BRAND.page, borderColor: BRAND.lineStrong },
});

/**
 * The main action of a screen. On a phone it is a bar that sticks to the bottom
 * of the screen (≥ 44 px targets, the page's own background behind it); from an
 * iPad up it is drawn inline where it stands.
 */
export function PinnedBar({
  children, label = 'Hlavní akce', card = false,
}: { children: ReactNode; label?: string; /** Draw the inline (iPad / desktop) bar as a white panel. */ card?: boolean }) {
  const phone = useIsPhone();
  if (!phone) {
    return (
      <Box
        data-pinned="false"
        sx={{
          display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'flex-end',
          ...(card ? { bgcolor: BRAND.paper, border: `1px solid ${BRAND.line}`, borderRadius: '16px', p: '20px 24px' } : {}),
        }}
      >
        {children}
      </Box>
    );
  }
  return (
    <Box
      role="region"
      aria-label={label}
      data-pinned="true"
      sx={{
        position: 'sticky',
        bottom: 0,
        mt: 'auto',
        zIndex: 5,
        mx: -2,
        px: 2,
        py: 1.25,
        bgcolor: BRAND.paper,
        borderTop: `1px solid ${BRAND.line}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        '& .MuiButton-root': { width: '100%' },
      }}
    >
      {children}
    </Box>
  );
}

/** The beige information box of the artboards (#FFF6EB, line #F2D9B8, text #8A5A2F). */
export function NoticeBox({ children, tone = 'warm' }: { children: ReactNode; tone?: 'warm' | 'plain' }) {
  return (
    <Box
      sx={{
        p: '14px 16px',
        borderRadius: '12px',
        fontSize: 14,
        lineHeight: 1.6,
        bgcolor: tone === 'warm' ? '#FFF6EB' : BRAND.page,
        border: `1px solid ${tone === 'warm' ? '#F2D9B8' : BRAND.line}`,
        color: tone === 'warm' ? BRAND.warn : SOFT_TEXT,
      }}
    >
      {children}
    </Box>
  );
}

/** The 1 · 2 · 3 progress of V-Rezervace. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <Box component="nav" aria-label="Postup objednání" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', rowGap: 1 }}>
      {steps.map((name, index) => {
        const n = index + 1;
        const done = n < current;
        const active = n === current;
        return (
          <Box key={name} sx={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 && <Box aria-hidden="true" sx={{ width: { xs: 18, sm: 40 }, height: '1px', bgcolor: '#D8D2C9', mx: { xs: 1, sm: 2.25 } }} />}
            <Box
              component="span"
              aria-current={active ? 'step' : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  bgcolor: done ? BRAND.ink : active ? BRAND.accent : 'transparent',
                  color: done ? '#FFFFFF' : active ? ON_ORANGE : LABEL_COLOR,
                  border: done || active ? 'none' : '1px solid #C8C2B8',
                }}
              >
                {done ? '✓' : n}
              </Box>
              <Box component="span" sx={{ fontSize: 15, fontWeight: active || done ? 700 : 400, color: active || done ? BRAND.text : LABEL_COLOR }}>
                {name}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** A failed load, said plainly with a way to try again (brief, rule 8). */
export function LoadError({
  what, onRetry, children,
}: { what: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <Alert
      severity="error"
      sx={{ alignItems: 'center' }}
      action={onRetry !== undefined ? (
        <Button color="inherit" size="small" onClick={onRetry} sx={{ minHeight: 44, fontWeight: 700 }}>
          Zkusit znovu
        </Button>
      ) : undefined}
    >
      {what}
      {children}
    </Alert>
  );
}

/** "Po 26. 10." — the short Prague date the artboards use in summaries. */
export function shortDate(utc: string): string {
  return new Date(utc).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Prague' })
    .replace(/^./, (c) => c.toUpperCase());
}

/** "pondělí 26. října v 10:00" — one line in the clinic's clock. */
export function longWhen(utc: string): string {
  const when = new Date(utc);
  const day = when.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Prague' });
  const time = when.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' });
  return `${day} v ${time}`;
}

/** "10:00" in the clinic's clock. */
export function hhmmPrague(utc: string): string {
  return new Date(utc).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' });
}
