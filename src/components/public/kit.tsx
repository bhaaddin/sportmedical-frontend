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

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { ARCHIVO, BRAND } from './brand';
import { GUTTER as SITE_GUTTER } from '../../web/tokens';

/** The warm-grey label colour of the artboards (#6E6960). */
export const LABEL_COLOR = '#6E6960';
/** Body text on white (#5C6067). */
export const SOFT_TEXT = '#5C6067';
/** The text colour on the orange pill (#1A1206). */
export const ON_ORANGE = '#1A1206';

/** The side gutters of every page body: 16 px phone, 32 px iPad, 44 px desktop (the artboards). */
export const GUTTERS = { xs: 2, md: 4, lg: '44px' } as const;

/**
 * THE FIT RULE of the application's public pages (booking, portal, club pages, manage, feedback, questionnaire):
 * the DOCUMENT never scrolls. PublicLayout is exactly one viewport high (100dvh) and the page body lives in a region
 * that fills what the header leaves. From an iPad in portrait up (FIT_WIDE) a page may be a workspace: panes side by
 * side, each scrolling on its own under a fixed head; below that, or when the window is short, the panes stack and the
 * region itself scrolls, between the fixed header and the pinned action bar, like a native app.
 */
export const FIT_WIDE = '@media (min-width: 720px) and (min-height: 520px)';
/** The complement of FIT_WIDE: phone, landscape phone, a very short window (stacked panes in one scrolling region). */
/** A screen that has room for a third column (a 1920 monitor and up). */
export const FIT_XL = '@media (min-width: 1800px) and (min-height: 520px)';
export const FIT_NARROW = '@media not all and (min-width: 720px) and (min-height: 520px)';

/** The layout hands the full footer to the page's own scrolling region (narrow); it keeps a slim bar for the wide layout. */
export const FitContext = createContext<{ footer: ReactNode }>({ footer: null });

/** Scrolls the page's own region back to the top (the document does not scroll in fit pages). */
export function scrollPublicTop(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.scrollTop = 0;
  document.querySelectorAll('[data-fit-scroll]').forEach((el) => { el.scrollTop = 0; });
}

/** Scrolls an element of the page into view inside the page's own region. */
export function scrollPublicTo(id: string): void {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  if (target !== null && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * A page body: centred, with the artboard's gutters (16 phone, 32 iPad, 44 desktop) in a region of exactly the height
 * the layout leaves. `workspace`: from FIT_WIDE up the children become panes of a grid that fills that height
 * (`head` stays on top, outside the panes); otherwise (and below FIT_WIDE) the region scrolls as one column.
 * `maxWidth` caps the body: a number in px, or 'none' for a page that should use every pixel of a big screen.
 */
export function PublicMain({
  children, maxWidth = 1100, gap = 3.25, sx, workspace = false, head, columns, columnsXl, band, foot, siteGutters = false,
}: {
  children: ReactNode; maxWidth?: number | string; gap?: number; sx?: SxProps<Theme>;
  workspace?: boolean; head?: ReactNode;
  /** CSS grid-template-columns of the workspace panes (default: one column). */
  columns?: string;
  /** The columns from FIT_XL up (e.g. a third column on a big screen). */
  columnsXl?: string;
  /** A full-bleed band above the body (a hero): it scrolls away on a stacked layout and stays on top of a workspace. */
  band?: ReactNode;
  /** The gutters of the prerendered site's sections (tokens.ts GUTTER) instead of the application pages': one edge with the site header. */
  siteGutters?: boolean;
  /** The action bar under the body (a PinnedBar): under the panes on a workspace, pinned to the region's bottom when stacked. */
  foot?: ReactNode;
}) {
  const device = useDevice();
  const { footer } = useContext(FitContext);
  const cap = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  return (
    <Box
      data-fit-region="true"
      data-device={device}
      suppressHydrationWarning
      sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}
    >
      <Box
        data-fit-scroll="true"
        sx={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain',
          display: 'flex', flexDirection: 'column',
          [FIT_WIDE]: workspace ? { overflowY: 'hidden' } : undefined,
        }}
      >
        {band}
        <Box
          sx={{
            width: '100%',
            maxWidth: cap,
            mx: 'auto',
            boxSizing: 'border-box',
            ...(siteGutters
              ? { pl: SITE_GUTTER, pr: SITE_GUTTER }
              : {
                pl: { xs: 'max(16px, env(safe-area-inset-left))', md: 4, lg: '44px' },
                pr: { xs: 'max(16px, env(safe-area-inset-right))', md: 4, lg: '44px' },
              }),
            pt: { xs: 3, md: '28px' },
            pb: { xs: 3, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap,
            flex: '1 0 auto',
            // Stacked: at least one screen tall, so the footer behind it starts below the fold and does not jump while the page loads.
            [FIT_NARROW]: { minHeight: '100%' },
            [FIT_WIDE]: workspace ? { flex: '1 1 0', minHeight: 0, pb: '20px' } : undefined,
            ...sx,
          }}
        >
          {head !== undefined && <Box sx={{ display: 'flex', flexDirection: 'column', gap, flex: '0 0 auto' }}>{head}</Box>}
          {workspace ? (
            <Box
              data-fit-workspace="true"
              sx={{
                display: 'flex', flexDirection: 'column', gap: 2.5, flex: '1 0 auto', minWidth: 0,
                [FIT_WIDE]: {
                  display: 'grid', gridTemplateColumns: columns ?? 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)',
                  flex: '1 1 0', minHeight: 0, alignItems: 'stretch', gridAutoRows: 'minmax(0, 1fr)',
                  '& > *': { minHeight: 0, minWidth: 0 },
                },
                ...(columnsXl !== undefined ? { [FIT_XL]: { gridTemplateColumns: columnsXl } } : {}),
              }}
            >
              {children}
            </Box>
          ) : children}
          {foot}
        </Box>
        {footer !== null && <Box sx={{ [FIT_WIDE]: { display: 'none' }, mt: 'auto' }}>{footer}</Box>}
      </Box>
    </Box>
  );
}

/**
 * A pane of a workspace: a panel whose header stays and whose body scrolls (FIT_WIDE up); in the stacked layout it is
 * simply a panel. `title` and `actions` make the fixed header.
 */
export function Pane({
  children, title, actions, sx, id, labelledBy, component = 'section',
}: {
  children: ReactNode; title?: ReactNode; actions?: ReactNode; sx?: SxProps<Theme>; id?: string; labelledBy?: string;
  component?: 'section' | 'div' | 'aside';
}) {
  return (
    <Panel
      component={component}
      id={id}
      labelledBy={labelledBy}
      sx={{
        [FIT_WIDE]: { overflow: 'hidden', gap: 0, p: 0, maxHeight: '100%', minHeight: 0 },
        ...sx,
      }}
    >
      {(title !== undefined || actions !== undefined) && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
            [FIT_WIDE]: { flex: '0 0 auto', px: '24px', py: '16px', borderBottom: `1px solid ${BRAND.line}` },
          }}
        >
          {title}
          {actions}
        </Box>
      )}
      <Box
        data-pane-body="true"
        sx={{
          display: 'flex', flexDirection: 'column', gap: 2.25, minWidth: 0,
          [FIT_WIDE]: { flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', p: '20px 24px' },
        }}
      >
        {children}
      </Box>
    </Panel>
  );
}

/**
 * A column of a workspace: stacked panels that scroll together (FIT_WIDE up). `nested`: one of the columns of a
 * ColumnGroup — it only scrolls on its own once the group is spread over the grid (FIT_XL).
 */
export function PaneColumn({ children, sx, nested = false }: { children: ReactNode; sx?: SxProps<Theme>; nested?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0,
        [FIT_WIDE]: nested ? {} : { overflowY: 'auto', overscrollBehaviorY: 'contain', pr: '4px', pb: '2px' },
        ...(nested ? { [FIT_XL]: { overflowY: 'auto', overscrollBehaviorY: 'contain', pr: '4px', pb: '2px' } } : {}),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Two or more nested PaneColumns that share ONE grid column (they stack and scroll together) until the screen has room
 * for a column each (FIT_XL), where the group dissolves into the grid.
 */
export function ColumnGroup({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0,
        [FIT_WIDE]: { overflowY: 'auto', overscrollBehaviorY: 'contain', pr: '4px', pb: '2px' },
        [FIT_XL]: { display: 'contents' },
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
          ...(card ? { bgcolor: BRAND.paper, border: `1px solid ${BRAND.line}`, borderRadius: '16px', p: '14px 24px' } : {}),
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
        ml: 'calc(-1 * max(16px, env(safe-area-inset-left)))',
        mr: 'calc(-1 * max(16px, env(safe-area-inset-right)))',
        pl: 'max(16px, env(safe-area-inset-left))',
        pr: 'max(16px, env(safe-area-inset-right))',
        pt: 1.25,
        pb: 'max(10px, env(safe-area-inset-bottom))',
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

/** The card of a whole-screen notice: one pane, the message centred in a readable column. */
export function NoticePane({ children, maxWidth = 640 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <Pane>
      <Box sx={{ width: '100%', maxWidth, mx: 'auto', my: 'auto', display: 'flex', flexDirection: 'column', gap: 2, py: 3 }}>
        {children}
      </Box>
    </Pane>
  );
}

/**
 * A whole-screen notice (thanks, a dead link, a confirmation): one pane that fills the region, its message centred in
 * a readable column. The pane takes the window's width so no strip of the page is left empty beside a small card.
 */
export function NoticeScreen({ children, maxWidth = 640, head, band }: { children: ReactNode; maxWidth?: number; head?: ReactNode; band?: ReactNode }) {
  return (
    <PublicMain maxWidth="none" workspace head={head} band={band} gap={2.5}>
      <NoticePane maxWidth={maxWidth}>{children}</NoticePane>
    </PublicMain>
  );
}
