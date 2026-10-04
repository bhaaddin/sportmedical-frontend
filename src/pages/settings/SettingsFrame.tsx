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
 *   breadcrumb   Nastavení / Skupina / Položka    14 px, the current part black 600
 *   title        28 / 700 full ink
 *   subtitle     one sentence, 14 grey
 *   actions      top right: Zahodit · Uložit (Uložit lives only while there is a change)
 *   content      up to 1240 wide; from 1280 two columns - the form or table, and
 *                a right card with the preview and "Související nastavení"
 *   at the end   "Poslední změny": the last five changes to this page
 *
 * A screen rendered outside a router - the unit tests do that - gets the
 * header and the content: the breadcrumb is a link, and links need a router.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, useInRouterContext, useLocation } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { ArrowBack, ChevronRight, ExpandMore, Refresh as RefreshIcon, Search as SearchIcon } from '@mui/icons-material';
import { usePermissions } from '../../auth/usePermission';
import { useIsPhone } from '../../layout/useDevice';
import { RecentChanges } from '../../components/settings/RecentChanges';
import {
  DESKTOP_UP, PHONE_ONLY, SETTINGS_MAX_WIDTH, TYPE, focusRing, rowSx, settingsGrey, settingsHover, settingsLine, settingsSelected,
} from '../../components/settings/settingsStyle';
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
              maxHeight: '100vh',
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

      {sections.map((section) => {
        const expanded = compact || searching || openId === section.id;
        return (
        <Box key={section.id} sx={compact ? { mt: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 } : { mt: 0.5 }}>
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
              TYPE.label,
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
                color: 'text.primary',
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
                sx={{ fontSize: 20, color: settingsGrey, transition: 'transform 120ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            )}
          </Box>
          {expanded && (
          <Box
            id={compact ? undefined : `settings-group-${section.id}-items`}
            role={compact ? undefined : 'group'}
            aria-labelledby={compact ? undefined : `settings-group-${section.id}`}
            sx={compact ? { display: 'contents' } : undefined}
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
                        color: active ? '#FFFFFF' : 'text.primary',
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
                        fontSize: 14.5,
                        lineHeight: 1.35,
                        textDecoration: 'none',
                        borderLeft: '3px solid',
                        borderColor: active ? 'primary.main' : 'transparent',
                        borderRadius: '0 8px 8px 0',
                        color: 'text.primary',
                        fontWeight: active ? 700 : 500,
                        bgcolor: active ? settingsSelected : 'transparent',
                        '&:hover': { bgcolor: active ? settingsSelected : settingsHover },
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
 * Every part but the last is a link; the last is where you are, in black 600.
 * 14 px.
 */
export function SettingsCrumbs({ parts }: { parts: Crumb[] }) {
  return (
    <Box
      component="nav"
      aria-label="Kde jste"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, fontSize: 14, lineHeight: 1.5 }}
    >
      {parts.map((part, index) => {
        const last = index === parts.length - 1;
        return (
          <Box key={index} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {index > 0 && <Box component="span" aria-hidden sx={{ color: settingsGrey }}>/</Box>}
            {last || part.to === undefined ? (
              <Box component="span" aria-current={last ? 'page' : undefined} sx={{ color: 'text.primary', fontWeight: 600 }}>
                {part.label}
              </Box>
            ) : (
              <Box
                component={RouterLink}
                to={part.to}
                sx={{
                  color: 'primary.main',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 32,
                  '&:hover': { textDecoration: 'underline' },
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
 * "Nastavení / Skupina / Stránka" for the address the router is on. A screen
 * that is not in the catalogue gets "Nastavení / <title>".
 */
export function SettingsBreadcrumb({ title }: { title?: React.ReactNode }) {
  const location = useLocation();
  const here = settingsItemAt(location.pathname);
  const parts: Crumb[] = [{ label: 'Nastavení', to: '/settings' }];
  if (here !== null) {
    parts.push({ label: here.section.label, to: groupPath(here.section.id) });
    parts.push({ label: here.item.label });
  } else if (title !== undefined) {
    parts.push({ label: title });
  }
  return <SettingsCrumbs parts={parts} />;
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
  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        onClick={save.onDiscard}
        disabled={!save.dirty || save.saving === true}
        sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}
      >
        Zahodit
      </Button>
      <Button
        variant="contained"
        onClick={save.onSave}
        disabled={!save.dirty || save.saving === true}
        sx={{ minHeight: 44, fontWeight: 700 }}
      >
        {save.saving ? 'Ukládám…' : save.saveLabel ?? 'Uložit'}
      </Button>
    </>
  );
}

/** The right-hand card: a title (18/700) and what belongs under it. */
export function SettingsAsideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', p: 2.5 }}
    >
      <Typography component="h2" sx={[TYPE.sectionTitle, { mb: 1.5 }]}>{title}</Typography>
      {children}
    </Box>
  );
}

function RelatedCard({ links }: { links: RelatedLink[] }) {
  return (
    <SettingsAsideCard title="Související nastavení">
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
        {links.map((link) => (
          <Box key={link.to} component="li">
            <Box
              component={RouterLink}
              to={link.to}
              sx={[
                rowSx(false),
                { minHeight: 44, px: 1.5, py: 1, borderRadius: 2, borderLeft: 'none', justifyContent: 'space-between' },
              ]}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={TYPE.itemName}>{link.label}</Typography>
                {link.description !== undefined && (
                  <Typography sx={TYPE.caption}>{link.description}</Typography>
                )}
              </Box>
              <ChevronRight sx={{ color: settingsGrey, flexShrink: 0 }} aria-hidden />
            </Box>
          </Box>
        ))}
      </Box>
    </SettingsAsideCard>
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
 * A settings screen: breadcrumb + title + subtitle + actions above the
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
  const crumbs = <SettingsBreadcrumb title={props.title} />;
  const resolvedRelated = props.related === false ? false : props.related ?? relatedFor(here, held);
  const resolvedScope = props.scope === false ? null : props.scope ?? (here !== null ? scopeOf(here.item) : null);
  return (
    <FrameLayout
      {...props}
      crumbs={crumbs}
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
  crumbs: React.ReactNode;
  backTo?: { label: string; to: string };
  resolvedRelated: RelatedLink[] | false;
  resolvedScope: string | null;
}) {
  const phone = useIsPhone();
  const hasRelated = resolvedRelated !== false && resolvedRelated.length > 0;
  const hasAside = aside !== false && (aside !== undefined || hasRelated);
  const maxWidth = Math.max(width ?? 0, SETTINGS_MAX_WIDTH);
  const pinSave = phone && save !== undefined;

  return (
    <Box sx={{ minWidth: 0, maxWidth, width: '100%' }}>
      {crumbs !== null && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          {backTo !== undefined && (
            <Button
              component={RouterLink}
              to={backTo.to}
              startIcon={<ArrowBack />}
              aria-label={`Zpět na ${backTo.label}`}
              sx={{ minHeight: 44, minWidth: 44, px: 1.5, color: 'text.primary', fontWeight: 600, display: 'none', [PHONE_ONLY]: { display: 'inline-flex' } }}
            >
              Zpět
            </Button>
          )}
          {crumbs}
        </Stack>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 3 }}
        sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between', mb: 3 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={TYPE.pageTitle}>{title}</Typography>
          {subtitle !== undefined && subtitle !== null && (
            <Typography sx={[TYPE.caption, { mt: 0.75, maxWidth: 760 }]}>{subtitle}</Typography>
          )}
        </Box>
        {(actions !== undefined || (save !== undefined && !pinSave)) && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            {actions}
            {save !== undefined && !pinSave && <SaveButtons save={save} />}
          </Stack>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
          ...(hasAside ? { [DESKTOP_UP]: { gridTemplateColumns: 'minmax(0, 1fr) 320px' } } : {}),
        }}
      >
        <Box sx={{ minWidth: 0 }}>
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
              <Skeleton variant="rounded" height={56} sx={{ borderRadius: 2, mb: 2 }} />
              <Skeleton variant="rounded" height={240} sx={{ borderRadius: 3 }} />
            </Box>
          ) : (
            children
          )}
        </Box>
        {hasAside && (
          <Stack spacing={2.5} sx={{ minWidth: 0, [DESKTOP_UP]: { position: 'sticky', top: 16 } }}>
            {aside !== undefined && <SettingsAsideCard title={asideTitle}>{aside}</SettingsAsideCard>}
            {hasRelated && <RelatedCard links={resolvedRelated as RelatedLink[]} />}
          </Stack>
        )}
      </Box>

      {resolvedScope !== null && <RecentChanges scope={resolvedScope} />}

      {pinSave && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 72,
            zIndex: 5,
            mt: 3,
            display: 'flex',
            gap: 1,
            p: 1.5,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: settingsLine,
            borderRadius: 3,
            '& > *': { flex: 1 },
          }}
        >
          <SaveButtons save={save} />
        </Box>
      )}
    </Box>
  );
}

export default SettingsScreen;
