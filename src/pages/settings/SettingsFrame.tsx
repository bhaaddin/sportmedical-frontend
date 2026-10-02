/*
 * The frame every settings screen sits in - the board's screen 19.
 *
 * Three panes: the application's sidebar (App.tsx, not here), a 240px
 * settings nav with the search box and the catalogue's groups, and the
 * content with its breadcrumb "Nastavení / Skupina / Stránka", a title, one
 * line under it and the screen's actions ("Zahodit" · "Uložit") top-right.
 *
 * Drawn once, from the catalogue, so the twenty settings screens agree about
 * where they are and the nav never offers a screen the catalogue does not.
 *
 * A screen rendered outside a router - the unit tests do that - gets the
 * header alone: the nav and the breadcrumb are links, and links need a router.
 */
import { useState } from 'react';
import { Link as RouterLink, useInRouterContext, useLocation } from 'react-router-dom';
import { Box, InputAdornment, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { PageHeader, SectionLabel } from '../../components/ui';
import { usePermissions } from '../../auth/usePermission';
import { searchSections, settingsItemAt, visibleSections } from './catalogue';

export const SETTINGS_NAV_WIDTH = 240;

/**
 * The settings nav: search, then the groups in the board's order, one row per
 * screen this person may open. The row of the screen being looked at carries
 * the 3px accent bar on its left and accent text.
 *
 * The search is the nav's own unless the screen wants to share it - /settings
 * does, so one query narrows the nav and the cards together.
 */
export function SettingsNav({
  query,
  onQueryChange,
}: {
  query?: string;
  onQueryChange?: (query: string) => void;
}) {
  const location = useLocation();
  const [ownQuery, setOwnQuery] = useState('');
  const q = query ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const sections = searchSections(visibleSections(usePermissions()), q);
  const here = settingsItemAt(location.pathname);

  return (
    <Box
      component="nav"
      aria-label="Nastavení — oddíly"
      sx={{
        width: SETTINGS_NAV_WIDTH,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        borderRight: '1px solid',
        borderColor: 'divider',
        pr: 2,
        pb: 2,
        maxHeight: '100vh',
        overflowY: 'auto',
      }}
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
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1.5 }}
      />

      {q !== '' && sections.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 1.5, py: 1 }}>
          Nic odpovídajícího „{q.trim()}“.
        </Typography>
      )}

      {sections.map((section) => (
        <Box key={section.id} sx={{ mt: 2 }}>
          <SectionLabel sx={{ px: 1.5, mb: 0.5 }}>{section.label}</SectionLabel>
          {section.items.map((item) => {
            const active = here?.item.id === item.id && here?.section.id === section.id;
            return (
              <Box
                key={item.id}
                component={RouterLink}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                sx={{
                  display: 'block',
                  px: 1.5,
                  py: 1.125,
                  fontSize: 14,
                  lineHeight: 1.35,
                  textDecoration: 'none',
                  borderLeft: '3px solid',
                  borderColor: active ? 'primary.main' : 'transparent',
                  borderRadius: '0 8px 8px 0',
                  color: active ? 'primary.main' : 'text.primary',
                  fontWeight: active ? 600 : 500,
                  bgcolor: active ? 'background.paper' : 'transparent',
                  '&:hover': { bgcolor: 'background.paper', color: active ? 'primary.main' : 'text.primary' },
                }}
              >
                {item.label}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

/**
 * "Nastavení / Skupina / Stránka" - the way back, named rather than promised.
 * The first part is a link to the catalogue; the last is where you are.
 */
export function SettingsBreadcrumb({ title }: { title?: React.ReactNode }) {
  const location = useLocation();
  const here = settingsItemAt(location.pathname);
  const crumbs: React.ReactNode[] = [
    <Box key="root" component={RouterLink} to="/settings" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
      Nastavení
    </Box>,
  ];
  if (here !== null) {
    crumbs.push(<Box key="section" component="span" sx={{ color: 'text.secondary' }}>{here.section.label}</Box>);
    crumbs.push(<Box key="item" component="span" sx={{ color: 'text.primary' }}>{here.item.label}</Box>);
  } else if (title !== undefined) {
    crumbs.push(<Box key="title" component="span" sx={{ color: 'text.primary' }}>{title}</Box>);
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', fontSize: 13, mb: 1.5, flexWrap: 'wrap' }} aria-label="Kde jste">
      {crumbs.map((crumb, index) => (
        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {index > 0 && <Box component="span" sx={{ color: 'text.disabled' }}>/</Box>}
          {crumb}
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * A settings screen: nav on the left, breadcrumb + title + subtitle + actions
 * above the content. `actions` is where "Zahodit" · "Uložit" go on a screen
 * that saves, and "Nová …" on a screen that lists.
 *
 * `width` caps the content - a form reads better at 720 than across 1400.
 */
export function SettingsScreen({
  title,
  subtitle,
  actions,
  children,
  width,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  const inRouter = useInRouterContext();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const withNav = inRouter && !narrow;

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      {withNav && <SettingsNav />}
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: width }}>
        {inRouter && <SettingsBreadcrumb title={title} />}
        <PageHeader title={title} subtitle={subtitle} actions={actions} />
        {children}
      </Box>
    </Box>
  );
}

export default SettingsScreen;
