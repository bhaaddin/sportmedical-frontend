/*
 * PageFrame - the frame of every shelf page: the header, then the shelves, one under the other.
 *
 *   <PageFrame title="Pacienti" purpose="Kartotéka kliniky" primaryAction={{ label: 'Nový pacient', to: '/patients/register' }}>
 *     <Shelf ...>...</Shelf>
 *     <Shelf ...>...</Shelf>
 *   </PageFrame>
 *
 * The header says what the page is (one h1), what it is for (one line), where it sits (an optional breadcrumb - the shell
 * already draws one on tablet and desktop, so use it only where the shell does not), what to do first (the primary action)
 * and what it is connected to (entity chips, each opening the thing with a peek). On tablet and desktop it carries the
 * search button that opens the command palette (Ctrl/Cmd+K); a phone has that button in its top bar. On a phone the
 * primary action is pinned at the bottom (PinnedActionBar), above the shell's navigation.
 *
 * The frame does not scroll the document and does not fit the window: the shell's #fit-region is the one scroller, so a page
 * of many shelves simply continues down inside it. A shelf that wants its own scroll (a long list) sets `maxHeight`.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { openUniversalSearch } from '../../components/UniversalSearch';
import { PinnedActionBar } from '../../components/ui/PinnedActionBar';
import { FitPage } from '../../components/ui/fit';
import { useDevice } from '../../layout/useDevice';
import type { EntityRef } from './entities';
import { EntityChip } from './EntityLink';
import type { ShelfAction } from './Shelf';
import { MUTED_SX, TARGET_SX } from './shelfStyle';

export interface Crumb {
  label: string;
  to?: string;
}

export interface PageFrameProps {
  title: string;
  /** One line: what this page is for. Under the title. */
  purpose?: ReactNode;
  breadcrumb?: Crumb[];
  primaryAction?: ShelfAction & { icon?: ReactNode };
  /** Secondary actions, left of the primary one. */
  actions?: ReactNode;
  /** What this page is about / connected to. */
  entities?: EntityRef[];
  /** Status chips of the subject ("Aktivní", "Dotazník chybí"), drawn before the connected chips. */
  badges?: ReactNode;
  /** Something before the title: a back button, an avatar. */
  leading?: ReactNode;
  /** Hide the palette button (a page that is itself a search). */
  search?: boolean;
  /** Fit the window (tablet and desktop): the body takes the height left under the header, so a `grow` shelf can scroll inside. */
  fit?: boolean;
  children?: ReactNode;
}

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

/** The button that opens the command palette. Always the same words, always `aria-keyshortcuts`. */
export function PaletteTrigger() {
  const key = isMac() ? '⌘ K' : 'Ctrl K';
  return (
    <Button
      variant="outlined"
      onClick={openUniversalSearch}
      aria-label="Hledat"
      aria-keyshortcuts="Control+K Meta+K"
      title={`Hledat (${key})`}
      startIcon={<Search sx={{ fontSize: 18 }} />}
      data-palette-trigger=""
      sx={(t) => ({
        ...TARGET_SX, minHeight: 40, px: 1.5, color: 'text.secondary', fontWeight: 500, borderColor: t.palette.divider,
        '&:hover': { color: 'text.primary' },
      })}
    >
      Hledat
      <Box
        component="kbd"
        sx={{ ml: 1.25, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, px: 0.75, py: 0.125, borderRadius: 0.75, border: '1px solid', borderColor: 'divider', color: 'text.secondary' }}
      >
        {key}
      </Box>
    </Button>
  );
}

function PrimaryButton({ action }: { action: NonNullable<PageFrameProps['primaryAction']> }) {
  const common = { variant: 'contained' as const, startIcon: action.icon, sx: { ...TARGET_SX, whiteSpace: 'nowrap' as const } };
  return action.to !== undefined
    ? <Button component={RouterLink} to={action.to} state={action.state} {...common}>{action.label}</Button>
    : <Button onClick={action.onClick} {...common}>{action.label}</Button>;
}

export function PageFrame({ title, purpose, breadcrumb, primaryAction, actions, entities, badges, leading, search = true, fit = false, children }: PageFrameProps) {
  const hasChips = badges !== undefined || (entities !== undefined && entities.length > 0);
  const device = useDevice();
  const phone = device === 'phone';
  return (
    <FitPage data-shelf-page="" data-device={device}>
      {breadcrumb !== undefined && breadcrumb.length > 0 && (
        <Breadcrumbs aria-label="Cesta" sx={{ mb: 0.5, fontSize: 13 }}>
          {breadcrumb.map((c, i) =>
            c.to !== undefined && i < breadcrumb.length - 1 ? (
              <Box key={c.label} component={RouterLink} to={c.to} sx={{ ...MUTED_SX, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', ...TARGET_SX, '&:hover': { textDecoration: 'underline' } }}>{c.label}</Box>
            ) : (
              <Typography key={c.label} component="span" sx={{ fontSize: 13, fontWeight: 600 }} aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}>{c.label}</Typography>
            ),
          )}
        </Breadcrumbs>
      )}

      <Box component="header" sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: hasChips ? 1.25 : 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {leading}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{title}</Typography>
            {purpose !== undefined && <Typography sx={{ ...MUTED_SX, mt: 0.25, fontSize: 15 }}>{purpose}</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
          {search && !phone && <PaletteTrigger />}
          {actions}
          {primaryAction !== undefined && !phone && <PrimaryButton action={primaryAction} />}
        </Box>
      </Box>

      {hasChips && (
        <Box data-connected="" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 2.5 }}>
          {badges}
          {entities !== undefined && entities.length > 0 && (
            <Box role="list" aria-label="Propojené" sx={{ display: 'contents' }}>
              {entities.map((e) => (
                <Box component="span" role="listitem" key={`${e.kind}:${e.id}`} sx={{ display: 'inline-flex', maxWidth: '100%' }}><EntityChip entity={e} /></Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      <Box data-shelf-body="" sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 3.5 }, minWidth: 0, ...(fit && !phone ? { flex: '1 1 0', minHeight: 0 } : {}) }}>{children}</Box>

      {phone && primaryAction !== undefined && (
        <PinnedActionBar label="Hlavní akce"><PrimaryButton action={primaryAction} /></PinnedActionBar>
      )}
    </FitPage>
  );
}

export default PageFrame;
