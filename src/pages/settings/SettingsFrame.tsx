/*
 * The frame every settings screen sits in.
 *
 * Matko, 3. 10. 2026: "Settings is unusable. I click and can't tell what is a
 * title, what a subtitle, what I clicked ... USE THE WIDTH ... every item must
 * have content, no empty screens."
 *
 * Three levels, never more: the hub (/settings), a group (/settings/:group),
 * one item (its own route). This file is the third level's frame and the
 * settings nav the shell shows in place of its own menu (one sidebar, the
 * settings one - never two side by side).
 *
 * Shelf look (Phase 2, docs/ui-shelf-system.md): the anatomy of PageFrame, so
 * the ~35 screens in this frame read as one product with Přehled and Pacienti:
 *
 *   breadcrumb   Nastavení / Skupina / Položka    13 px quiet links, the current part full ink 600
 *   header       one h1 (24 / 28, 800), one line of purpose (15 muted),
 *                actions top right: Zahodit · Uložit (live only while there is a change)
 *   the rail     the accent hairline under the header - the screen stands on it
 *   content      from 1280 two columns - the form or table, and on the right
 *                shelves (a heading, one board on the shelf surface): Náhled,
 *                Související nastavení; every board inside has the shelf radius
 *   at the end   "Poslední změny": the last five changes to this page, a shelf
 *
 * A screen rendered outside a router - the unit tests do that - gets the
 * header and the content: the breadcrumb is a link, and links need a router.
 */
import { useEffect, useId, useState } from 'react';
import { Link as RouterLink, useInRouterContext, useLocation } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { ArrowBack, ChevronRight, ExpandMore, Refresh as RefreshIcon, Search as SearchIcon } from '@mui/icons-material';
import { usePermissions } from '../../auth/usePermission';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { FIT_SCROLL_SX } from '../../components/ui/fit';
import { RecentChanges } from '../../components/settings/RecentChanges';
import {
  DESKTOP_UP, SETTINGS_MAX_WIDTH, TYPE, focusRing, settingsGrey, settingsHover, settingsLine, settingsSelected,
} from '../../components/settings/settingsStyle';
import { CARD_RADIUS, MUTED_SX, TARGET_SX, cardSurface, railSx, toneOf } from '../../ui/shelf/shelfStyle';
import {
  groupPath, scopeOf, searchSections, settingsItemAt, visibleSections,
  type SettingsItem, type SettingsSection,
} from './catalogue';

/** The width of the settings nav when it stands as its own column (nowhere in the shell now; kept for a page that wants one). */
export const SETTINGS_NAV_WIDTH = 240;

/**
 * The settings nav: search, then the groups in the catalogue's order, one row
 * per screen this person may open. A group's heading is a link to its page
 * (so clicking "Systém" opens something), the row of the screen being looked
 * at carries the 3px forest bar, a soft background and the heavier weight.
 *
 * The search is the nav's own unless the caller wants to share it - the rail
 * does, so one query narrows the rail and the /settings hub together.
 *
 * `plain` is how the rail draws it: no width, border or stickiness of its
 * own, it fills whatever it is put in.
 */
export function SettingsNav({
  query,
  onQueryChange,
  compact = false,
  plain = false,
}: {
  query?: string;
  onQueryChange?: (query: string) => void;
  /** On a phone: one wrapping row of chips above the content instead of a side column. */
  compact?: boolean;
  /** Inside the rail: fill the parent, no frame of its own. */
  plain?: boolean;
}) {
  const location = useLocation();
  const [ownQuery, setOwnQuery] = useState('');
  const q = query ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const sections = searchSections(visibleSections(usePermissions()), q);
  const here = settingsItemAt(location.pathname);
  const hereGroup = /^\/settings\/([a-z0-9-]+)$/.exec(location.pathname)?.[1];
  /*
   * The groups fold (Matko, 4. 10. 2026: "Provoz must not be permanently
   * expanded"): every heading is a disclosure button, all closed except the
   * group of the page you are on. One at a time - opening another closes the
   * open one - and while a search is typed the matching groups are all shown
   * open. Per visit only; nothing is stored.
   */
  const currentGroup = here?.section.id ?? hereGroup ?? null;
  const [openId, setOpenId] = useState<string | null>(currentGroup);
  useEffect(() => { setOpenId(currentGroup); }, [currentGroup]);
  const searching = q.trim() !== '';

  return (
    <Box
      component="nav"
      aria-label="Nastavení — oddíly"
      sx={
        plain
          ? { width: '100%' }
          : compact
          ? { width: '100%', mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: settingsLine }
          : {
              width: SETTINGS_NAV_WIDTH,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              alignSelf: 'flex-start',
              borderRight: '1px solid',
              borderColor: settingsLine,
              pr: 2,
              pb: 2,
              maxHeight: '100dvh',
              overflowY: 'auto',
            }
      }
    >
      <TextField
        fullWidth
        size="small"
        value={q}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Hledat v nastavení"
        slotProps={{
          htmlInput: { 'aria-label': 'Hledat v nastavení' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: settingsGrey }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1.5 }}
      />

      {q !== '' && sections.length === 0 && (
        <Typography sx={[TYPE.caption, { px: 1.5, py: 1 }]}>
          Nic odpovídajícího „{q.trim()}“.
        </Typography>
      )}

      {sections.map((section, sectionIndex) => {
        const expanded = compact || searching || openId === section.id;
        return (
        <Box
          key={section.id}
          sx={
            compact
              ? { mt: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }
              : {
                  mt: sectionIndex === 0 ? 0 : 1.25,
                  pt: sectionIndex === 0 ? 0 : 1.25,
                  borderTop: sectionIndex === 0 ? 0 : '1px solid',
                  borderColor: settingsLine,
                }
          }
        >
          <Box
            {...(compact
              ? { component: RouterLink, to: groupPath(section.id), 'aria-current': hereGroup === section.id ? ('page' as const) : undefined }
              : {
                  component: 'button',
                  type: 'button',
                  id: `settings-group-${section.id}`,
                  'aria-expanded': expanded,
                  'aria-controls': `settings-group-${section.id}-items`,
                  onClick: () => setOpenId((id) => (id === section.id ? null : section.id)),
                })}
            sx={[
              compact
                ? TYPE.label
                : {
                    // A nav heading must clearly outrank the items under it: bolder, darker
                    // and larger than the field-label caption style used elsewhere, never
                    // the same muted caption an item or a hint uses.
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1.4,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase' as const,
                    color: 'text.primary',
                  },
              {
                display: compact ? 'block' : 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                minHeight: compact ? undefined : 44,
                px: 1.5,
                py: 0.75,
                mb: 0.25,
                textDecoration: 'none',
                textAlign: 'left',
                fontFamily: 'inherit',
                border: 0,
                bgcolor: 'transparent',
                cursor: 'pointer',
                borderRadius: 1,
                ...(compact ? { px: 0 } : {}),
                '&:hover': { bgcolor: settingsHover },
                ...focusRing,
              },
            ]}
          >
            {section.label}
            {!compact && (
              <ExpandMore
                aria-hidden
                sx={{ fontSize: 22, color: 'text.primary', transition: 'transform 120ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            )}
          </Box>
          {expanded && (
          <Box
            id={compact ? undefined : `settings-group-${section.id}-items`}
            role={compact ? undefined : 'group'}
            aria-labelledby={compact ? undefined : `settings-group-${section.id}`}
            sx={
              compact
                ? { display: 'contents' }
                : {
                    // A rule down the left ties the items back to their heading, so a group
                    // reads as one nested list rather than a second row of headings.
                    ml: 1.75,
                    pl: 1.25,
                    borderLeft: '1px solid',
                    borderColor: settingsLine,
                  }
            }
          >
          {section.items.map((item) => {
            const active = here?.item.id === item.id && here?.section.id === section.id;
            return (
              <Box
                key={item.id}
                component={RouterLink}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                sx={
                  compact
                    ? {
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 44,
                        px: 1.5,
                        fontSize: 14,
                        textDecoration: 'none',
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: active ? 'primary.main' : settingsLine,
                        color: active ? 'primary.contrastText' : 'text.primary',
                        bgcolor: active ? 'primary.main' : 'background.paper',
                        fontWeight: 600,
                        ...focusRing,
                      }
                    : {
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 40,
                        px: 1.5,
                        py: 0.75,
                        fontSize: 14,
                        lineHeight: 1.35,
                        textDecoration: 'none',
                        borderLeft: '3px solid',
                        borderColor: active ? 'primary.main' : 'transparent',
                        borderRadius: '0 8px 8px 0',
                        // A row that is not where you are reads as a plain, muted option; only
                        // the one you are on earns full ink, bold weight and the forest bar, so
                        // no item ever looks as heavy as the group heading above it.
                        color: active ? 'text.primary' : settingsGrey,
                        fontWeight: active ? 700 : 400,
                        bgcolor: active ? settingsSelected : 'transparent',
                        '&:hover': { bgcolor: active ? settingsSelected : settingsHover, color: 'text.primary' },
                        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 },
                      }
                }
              >
                {item.label}
              </Box>
            );
          })}
          </Box>
          )}
        </Box>
        );
      })}
    </Box>
  );
}

/** One part of a breadcrumb: a link, or - without `to` - the place you are. */
export interface Crumb {
  label: React.ReactNode;
  to?: string;
}

/**
 * "Nastavení / Skupina / Položka" - the way back, named rather than promised.
 * Every part but the last is a quiet link; the last is where you are, in full ink 600. 13 px, as the shelf pages'
 * breadcrumb (PageFrame), so a settings screen and Pacienti read the same.
 */
export function SettingsCrumbs({ parts }: { parts: Crumb[] }) {
  return (
    <Box
      component="nav"
      aria-label="Kde jste"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.75, fontSize: 13, lineHeight: 1.5, minWidth: 0 }}
    >
      {parts.map((part, index) => {
        const last = index === parts.length - 1;
        return (
          <Box key={index} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {index > 0 && <Box component="span" aria-hidden sx={MUTED_SX}>/</Box>}
            {last || part.to === undefined ? (
              <Box component="span" aria-current={last ? 'page' : undefined} sx={{ color: 'text.primary', fontWeight: 600 }}>
                {part.label}
              </Box>
            ) : (
              <Box
                component={RouterLink}
                to={part.to}
                sx={{
                  ...MUTED_SX,
                  ...TARGET_SX,
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  '@media (max-width: 1279.95px)': { minHeight: 44, px: 0.5 },
                  '&:hover': { color: 'text.primary', textDecoration: 'underline' },
                  ...focusRing,
                }}
              >
                {part.label}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * The line above a settings title: on a phone a "Zpět" button to the level above (the crumbs alone are a small target
 * there), then the crumbs. Shared by the frame and the group pages of the hub.
 */
export function SettingsCrumbRow({ parts, back }: { parts: Crumb[]; back?: { label: string; to: string } }) {
  const phone = useIsPhone();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75, flexShrink: 0, minWidth: 0 }}>
      {back !== undefined && phone && (
        <Button
          component={RouterLink}
          to={back.to}
          startIcon={<ArrowBack />}
          aria-label={`Zpět na ${back.label}`}
          sx={{ minHeight: 44, minWidth: 44, px: 1.5, color: 'text.primary', fontWeight: 600 }}
        >
          Zpět
        </Button>
      )}
      <SettingsCrumbs parts={parts} />
    </Stack>
  );
}

/**
 * "Nastavení / Skupina / Stránka" for the address the router is on. A screen
 * that is not in the catalogue gets "Nastavení / <title>".
 */
export function SettingsBreadcrumb({ title }: { title?: React.ReactNode }) {
  const location = useLocation();
  return <SettingsCrumbs parts={crumbsAt(location.pathname, title)} />;
}

function crumbsAt(pathname: string, title?: React.ReactNode): Crumb[] {
  const here = settingsItemAt(pathname);
  const parts: Crumb[] = [{ label: 'Nastavení', to: '/settings' }];
  if (here !== null) {
    parts.push({ label: here.section.label, to: groupPath(here.section.id) });
    parts.push({ label: here.item.label });
  } else if (title !== undefined) {
    parts.push({ label: title });
  }
  return parts;
}

/** A link to related settings: "Ze slev na ceník, z ceníku na činnosti." */
export interface RelatedLink {
  label: string;
  to: string;
  description?: string;
}

/** The standard Zahodit · Uložit pair. Uložit is live only while there is a change. */
export interface SaveBar {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}

function SaveButtons({ save }: { save: SaveBar }) {
  const idle = !save.dirty || save.saving === true;
  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        onClick={save.onDiscard}
        disabled={idle}
        sx={{ minHeight: 44, color: 'text.primary', borderColor: 'divider' }}
      >
        Zahodit
      </Button>
      <Button
        variant="contained"
        onClick={save.onSave}
        disabled={idle}
        sx={{ minHeight: 44, fontWeight: 700, whiteSpace: 'nowrap' }}
      >
        {save.saving ? 'Ukládám…' : save.saveLabel ?? 'Uložit'}
      </Button>
    </>
  );
}

/**
 * A card of the right-hand column, drawn as a shelf: a heading in the shelf's type (15/700), and under it one board on the
 * shelf's surface - so "Náhled" beside Firma a faktury looks like a shelf on Pacienti.
 */
export function SettingsAsideCard({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId} data-shelf="aside" data-state="ready" sx={{ minWidth: 0 }}>
      <Typography id={headingId} component="h2" sx={SHELF_HEADING_SX}>{title}</Typography>
      <Box sx={(t) => ({ ...cardSurface(t, false), p: 2 })}>{children}</Box>
    </Box>
  );
}

/** The shelf's heading: what a Shelf draws over its cards. */
const SHELF_HEADING_SX = { fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.3, mb: 1, minHeight: 24, display: 'flex', alignItems: 'center' } as const;

/** "Související nastavení": the rest of the group, each a quiet row of one board, standing on the rail. */
function RelatedCard({ links }: { links: RelatedLink[] }) {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId} data-shelf="related" data-state="ready" sx={{ minWidth: 0 }}>
      <Typography id={headingId} component="h2" sx={SHELF_HEADING_SX}>Související nastavení</Typography>
      <Box component="ul" sx={(t) => ({ ...cardSurface(t, false), listStyle: 'none', m: 0, p: 0.5, display: 'grid', gap: 0.25 })}>
        {links.map((link) => (
          <Box key={link.to} component="li" sx={{ minWidth: 0 }}>
            <Box
              component={RouterLink}
              to={link.to}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 44,
                px: 1.5,
                py: 0.75,
                borderRadius: `${CARD_RADIUS - 4}px`,
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { bgcolor: toneOf(t, 'primary').bg },
                '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
              })}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 650, lineHeight: 1.35 }}>{link.label}</Typography>
                {link.description !== undefined && (
                  <Typography noWrap sx={{ ...MUTED_SX, fontSize: 13, lineHeight: 1.4 }}>{link.description}</Typography>
                )}
              </Box>
              <ChevronRight sx={{ ...MUTED_SX, fontSize: 20, flexShrink: 0 }} aria-hidden />
            </Box>
          </Box>
        ))}
      </Box>
      <Box aria-hidden sx={(t) => ({ ...(railSx(t) as object), mt: 1.25 })} />
    </Box>
  );
}

interface FrameProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  save?: SaveBar;
  children: React.ReactNode;
  width?: number;
  aside?: React.ReactNode | false;
  asideTitle?: string;
  related?: RelatedLink[] | false;
  scope?: string | false;
  /** The screen's data is on its way: the frame stays, a skeleton holds the place of the content. */
  loading?: boolean;
  /** The data did not load: the frame stays, this says what failed and offers "Zkusit znovu". */
  error?: React.ReactNode;
  onRetry?: () => void;
}

/**
 * A settings screen: breadcrumb + title + one line + actions above the
 * content, and "Poslední změny" under it.
 *
 *  - `actions`  free-form buttons top right ("Nová …" on a screen that lists).
 *  - `save`     the standard Zahodit · Uložit pair; on a phone it is pinned to
 *               the bottom, where the thumb reaches.
 *  - `aside`    the right-hand "Náhled" card (what the change does on real
 *               data). Without it the right column holds only the related
 *               settings; `false` takes the right column away entirely (a wide
 *               table that wants every pixel).
 *  - `related`  "Související nastavení" links. Left out, it lists the rest of
 *               this page's group the person may open; `false` hides it.
 *  - `scope`    the change-history scope for "Poslední změny". Left out, it is
 *               the catalogue's scope for this address; `false` hides the panel.
 *  - `loading` / `error` / `onRetry`  a screen never goes blank: while its data loads the
 *               frame (title, breadcrumb, way back) stays and a skeleton holds the
 *               content's place; when the load fails the frame says what failed and
 *               offers "Zkusit znovu".
 *  - `width`    kept for the many call sites that pass one. The frame is never
 *               narrower than 1240: a form that wants to be narrow is laid out
 *               in two columns by its own grid, not squeezed into a third of
 *               the screen.
 */
export function SettingsScreen(props: FrameProps) {
  const inRouter = useInRouterContext();
  return inRouter ? <RoutedFrame {...props} /> : <FrameLayout {...props} crumbs={null} resolvedRelated={false} resolvedScope={typeof props.scope === 'string' ? props.scope : null} />;
}

function relatedFor(
  here: { item: SettingsItem; section: SettingsSection } | null,
  held: readonly string[],
): RelatedLink[] {
  if (here === null) return [];
  const section = visibleSections(held).find((s) => s.id === here.section.id);
  return (section?.items ?? [])
    .filter((i) => i.id !== here.item.id)
    .slice(0, 6)
    .map((i) => ({ label: i.label, to: i.to, description: i.description }));
}

function RoutedFrame(props: FrameProps) {
  const location = useLocation();
  const held = usePermissions();
  const here = settingsItemAt(location.pathname);
  const resolvedRelated = props.related === false ? false : props.related ?? relatedFor(here, held);
  const resolvedScope = props.scope === false ? null : props.scope ?? (here !== null ? scopeOf(here.item) : null);
  return (
    <FrameLayout
      {...props}
      crumbs={crumbsAt(location.pathname, props.title)}
      backTo={here !== null ? { label: here.section.label, to: groupPath(here.section.id) } : { label: 'Nastavení', to: '/settings' }}
      resolvedRelated={resolvedRelated}
      resolvedScope={resolvedScope}
    />
  );
}

function FrameLayout({
  title,
  subtitle,
  actions,
  save,
  children,
  width,
  aside,
  asideTitle = 'Náhled',
  crumbs,
  backTo,
  resolvedRelated,
  resolvedScope,
  loading,
  error,
  onRetry,
}: FrameProps & {
  crumbs: Crumb[] | null;
  backTo?: { label: string; to: string };
  resolvedRelated: RelatedLink[] | false;
  resolvedScope: string | null;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const titleId = useId();
  const hasRelated = resolvedRelated !== false && resolvedRelated.length > 0;
  const hasAside = aside !== false && (aside !== undefined || hasRelated);
  /* A form page is centred with equal gutters beyond a comfortable width; a page that gives up its right column
     (a wide table) takes every pixel. Phone: the region around scrolls; from 768 the header stays and the columns scroll. */
  const wide = aside === false;
  const maxWidth = wide ? undefined : Math.max(width ?? 0, SETTINGS_MAX_WIDTH);
  const pinSave = phone && save !== undefined;
  const fit = !phone;
  /* Two columns (desktop with a right column): each column scrolls on its own. One column under 1280: the whole stack
     scrolls as one, so a short form is not followed by a window-high gap before the right-hand shelves. */
  const twoColumns = hasAside && device === 'desktop';
  const columnsScroll = fit && (twoColumns || !hasAside);
  const hasActions = actions !== undefined || (save !== undefined && !pinSave);

  return (
    <Box
      data-fit-page=""
      data-shelf-page=""
      data-settings-frame=""
      sx={{
        minWidth: 0,
        width: '100%',
        ...(maxWidth !== undefined ? { maxWidth, mx: 'auto' } : {}),
        ...(fit ? { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' } : {}),
      }}
    >
      {crumbs !== null && <SettingsCrumbRow parts={crumbs} back={backTo} />}

      {/* The header of every shelf page (PageFrame): one h1, one line of purpose, the actions top right. */}
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} variant="h4" component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {subtitle !== undefined && subtitle !== null && (
            <Typography sx={{ ...MUTED_SX, mt: 0.25, fontSize: 15, lineHeight: 1.45, maxWidth: 760 }}>{subtitle}</Typography>
          )}
        </Box>
        {hasActions && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            {actions}
            {save !== undefined && !pinSave && <SaveButtons save={save} />}
          </Stack>
        )}
      </Box>

      {/* The rail: the shelf system's one signature, under the header - the screen stands on it. */}
      <Box aria-hidden data-rail="" sx={(t) => ({ ...(railSx(t) as object), mt: 1.5, mb: { xs: 2.5, md: 3 }, flexShrink: 0 })} />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
          ...(hasAside ? { [DESKTOP_UP]: { gridTemplateColumns: 'minmax(0, 1fr) clamp(300px, 22vw, 400px)' } } : {}),
          ...(columnsScroll ? { flex: '1 1 0', minHeight: 0, alignItems: 'stretch', gridTemplateRows: 'minmax(0, 1fr)' } : {}),
          ...(fit && !columnsScroll ? { flex: '1 1 0', alignContent: 'start', ...FIT_SCROLL_SX, pr: 0.5 } : {}),
        }}
      >
        <Box
          component="section"
          aria-labelledby={titleId}
          data-shelf="settings"
          data-state={error !== undefined && error !== null && error !== false ? 'error' : loading === true ? 'loading' : 'ready'}
          sx={[
            {
              minWidth: 0,
              /* One radius for every board a screen draws inside the frame (SoftCard, outlined papers): the shelf's. */
              '& .MuiPaper-outlined:not(.MuiAlert-root)': { borderRadius: `${CARD_RADIUS}px` },
            },
            ...(columnsScroll ? [FIT_SCROLL_SX, { pr: 0.5 }] : []),
          ]}
        >
          {error !== undefined && error !== null && error !== false ? (
            <Alert
              severity="error"
              action={
                onRetry !== undefined ? (
                  <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry} sx={{ minHeight: 44 }}>
                    Zkusit znovu
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          ) : loading === true ? (
            <Box aria-busy="true" aria-label="Načítám">
              <Skeleton variant="rounded" height={56} sx={{ borderRadius: `${CARD_RADIUS}px`, mb: 2 }} />
              <Skeleton variant="rounded" height={240} sx={{ borderRadius: `${CARD_RADIUS}px` }} />
            </Box>
          ) : (
            children
          )}
          {resolvedScope !== null && <RecentChanges scope={resolvedScope} />}
        </Box>
        {hasAside && (
          <Stack spacing={3} sx={[{ minWidth: 0 }, ...(columnsScroll ? [FIT_SCROLL_SX, { pb: 0.5 }] : [])]}>
            {aside !== undefined && <SettingsAsideCard title={asideTitle}>{aside}</SettingsAsideCard>}
            {hasRelated && <RelatedCard links={resolvedRelated as RelatedLink[]} />}
          </Stack>
        )}
      </Box>

      {pinSave && (
        <Box
          sx={(t) => ({
            ...cardSurface(t, false),
            position: 'sticky',
            bottom: 8,
            zIndex: 5,
            mt: 3,
            display: 'flex',
            gap: 1,
            p: 1.5,
            '& > *': { flex: 1 },
          })}
        >
          <SaveButtons save={save} />
        </Box>
      )}
    </Box>
  );
}

export default SettingsScreen;
