/*
 * Nastavení and Administrace: the two plain pages (Matko, 1. 11. 2026: "Settings are too complicated").
 *
 *   /nastaveni      the daily work. A big search box, then the row "Můj účet a zabezpečení" (for everybody), then the most
 *                   used screens under four plain headings - Provoz, Služby a ceny, Komunikace a dokumenty, Kluby - and
 *                   ONE closed list "Další nastavení" for the rest. No tiles inside tiles: a heading, one list.
 *   /administrace   users and rights, security, the clinic's own data, the public site, the connections, the records of
 *                   changes. The same plain list and search. Only for somebody who may manage users or the clinic; for
 *                   everybody else the address is the ordinary "no access" and no menu, search or palette mentions it.
 *
 * ONE source: the catalogue (`area`, `common`). Older addresses keep working: /settings goes to Nastavení, /settings/:group
 * to the area its group became (`legacyGroupPath`), and every screen keeps its own address.
 *
 * R18: clear before anything else. Three layouts: the rows are full width on a phone, a column about 760 px wide on a
 * tablet and a desktop; 44 px targets; light and dark from the theme.
 */
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, ButtonBase, InputAdornment, TextField, Typography } from '@mui/material';
import type { Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronRight, ExpandMore, Search as SearchIcon } from '@mui/icons-material';
import {
  ACCOUNT_ITEM_ID, AREA_LABEL, canSeeAdmin, legacyGroupPath, normalizeText, searchSettingsItems, visibleSections,
  type SettingsArea, type SettingsItem, type SettingsSection,
} from './settings/catalogue';
import { SECURITY_ITEM_ID, settingsNeeds, visibleItem, type SettingsNeed } from './settings/hubModel';
import { useHiddenSettingsIds, withoutHidden } from './settings/availability';
import { PersonalSection } from './settings/PersonalSection';
import { useSettingsSearch } from '../components/shell/settingsSearch';
import { SecurityLightChip, useSecurityLights } from '../components/settings/SecurityStatusChip';
import { focusRing, settingsGrey, settingsHover } from '../components/settings/settingsStyle';
import { PageFrame } from '../ui/shelf/PageFrame';
import { CARD_RADIUS, MUTED_SX, cardSurface, toneOf } from '../ui/shelf/shelfStyle';
import { StatusChip } from '../components/ui';
import { hasStoredPermissions, usePermissions } from '../auth/usePermission';

/** The wide hubs keep their rows readable: a column, not a ruler across 2000 px. */
const COLUMN = 760;

/** The surface that holds one list of rows: ONE bordered block, the rows inside it only separated by hairlines. */
const listSx = (t: Theme) => ({
  ...cardSurface(t, false),
  overflow: 'hidden',
  listStyle: 'none',
  m: 0,
  p: 0,
});

/** One screen as a row of the list: its name, one quiet line, an arrow. The whole row is the link. */
function Row({ item, overline, trailing }: { item: SettingsItem; overline?: string; trailing?: ReactNode }) {
  return (
    <Box
      component="li"
      data-setting={item.id}
      sx={{ '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}
    >
      <Box
        component={RouterLink}
        to={item.to}
        sx={(t: Theme) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 60,
          px: { xs: 1.75, md: 2.25 },
          py: 1.25,
          color: 'text.primary',
          textDecoration: 'none',
          '&:hover': { bgcolor: settingsHover(t) },
          ...focusRing,
          '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 },
        })}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {overline !== undefined && (
            <Typography component="span" sx={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.3, ...MUTED_SX }}>
              {overline}
            </Typography>
          )}
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
            {item.label}
          </Typography>
          <Typography
            component="span"
            title={item.description}
            sx={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              ...MUTED_SX,
              fontSize: 13,
              lineHeight: 1.45,
              mt: 0.25,
            }}
          >
            {item.description}
          </Typography>
        </Box>
        {trailing !== undefined && <Box sx={{ flexShrink: 0 }}>{trailing}</Box>}
        <ChevronRight aria-hidden sx={{ color: (t: Theme) => settingsGrey(t), flexShrink: 0 }} />
      </Box>
    </Box>
  );
}

function Heading({ children, id }: { children: ReactNode; id: string }) {
  return (
    <Typography id={id} component="h2" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, mb: 1, px: 0.25 }}>
      {children}
    </Typography>
  );
}

/** One case of "Vyžaduje nastavení": the screen that fixes it and what is wrong, in words. */
function NeedRow({ need }: { need: SettingsNeed }) {
  return (
    <Box component="li" data-card="need" sx={{ '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Box
        component={RouterLink}
        to={need.to}
        sx={(t: Theme) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 60,
          px: { xs: 1.75, md: 2.25 },
          py: 1.25,
          color: 'text.primary',
          textDecoration: 'none',
          boxShadow: `inset 3px 0 0 ${alpha(toneOf(t, need.tone).fg, 0.9)}`,
          '&:hover': { bgcolor: settingsHover(t) },
          ...focusRing,
        })}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>{need.title}</Typography>
          <Typography component="span" sx={{ display: 'block', ...MUTED_SX, fontSize: 13, lineHeight: 1.45, mt: 0.25 }}>{need.detail}</Typography>
        </Box>
        <StatusChip tone={need.tone} size="sm" dot>{need.tone === 'red' ? 'Problém' : 'Pozor'}</StatusChip>
      </Box>
    </Box>
  );
}

function SearchBox({ query, onChange, area }: { query: string; onChange: (value: string) => void; area: SettingsArea }) {
  return (
    <TextField
      fullWidth
      value={query}
      onChange={(e) => onChange(e.target.value)}
      placeholder={area === 'admin' ? 'Hledat v administraci — název nebo slovo, které vás napadne' : 'Hledat v nastavení — název nebo slovo, které vás napadne'}
      slotProps={{
        htmlInput: { 'aria-label': 'Hledat v nastavení', type: 'search' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: (t: Theme) => settingsGrey(t) }} />
            </InputAdornment>
          ),
          sx: { minHeight: 56, fontSize: 16, bgcolor: 'background.paper', borderRadius: `${CARD_RADIUS - 4}px` },
        },
      }}
    />
  );
}

/** A closed row that opens a list (or a block) below it. One plain button; nothing animates. */
function Disclosure({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <ButtonBase
        id={`${id}-button`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        sx={(t: Theme) => ({
          ...cardSurface(t, true),
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          minHeight: 56,
          px: { xs: 1.75, md: 2.25 },
          py: 1,
          textAlign: 'left',
          font: 'inherit',
        })}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650 }}>{title}</Typography>
          {hint !== undefined && <Typography component="span" sx={{ display: 'block', ...MUTED_SX, fontSize: 13 }}>{hint}</Typography>}
        </Box>
        <ExpandMore aria-hidden sx={{ transform: open ? 'rotate(180deg)' : 'none', color: (t: Theme) => settingsGrey(t), flexShrink: 0 }} />
      </ButtonBase>
      {open && (
        <Box id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} sx={{ mt: 1.5 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

/** The rows of a list under a heading; nothing when there are none. */
function Group({ id, title, items, stateOf }: { id: string; title: string; items: SettingsItem[]; stateOf: (item: SettingsItem) => ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} data-group={id}>
      <Heading id={id}>{title}</Heading>
      <Box component="ul" sx={listSx}>
        {items.map((item) => <Row key={item.id} item={item} trailing={stateOf(item)} />)}
      </Box>
    </section>
  );
}

/** The overline of a search result: the group it sits in, or "Administrace". */
const overlineOf = (section: SettingsSection): string => (section.area === 'admin' ? AREA_LABEL.admin : section.label);

function Hub({ area }: { area: SettingsArea }) {
  const held = usePermissions();
  const hidden = useHiddenSettingsIds();
  /* What this person may open, from the list the server last sent - redrawn when a grant or revocation arrives. */
  const allSections = withoutHidden(visibleSections(held), hidden);
  const sections = allSections.filter((s) => s.area === area);
  const { query, setQuery } = useSettingsSearch();
  const searching = normalizeText(query) !== '';
  /* A search looks in everything this person may open (the Administrace only if they may see it), best answer first. */
  const hits = searching ? searchSettingsItems(allSections, query) : [];
  /* The lights are asked only for somebody who may open the screen they belong to. */
  const lights = useSecurityLights(area === 'admin' && visibleItem(sections, SECURITY_ITEM_ID) !== null);
  const needs = area === 'admin' ? settingsNeeds(sections, lights) : [];
  /* A session from before the server started sending the list: every guarded row would be hidden, which reads as the
     settings having disappeared rather than as a stale sign-in. */
  const staleSession = !hasStoredPermissions();
  const stateOf = (item: SettingsItem): ReactNode => (item.id === SECURITY_ITEM_ID && lights !== null ? <SecurityLightChip lights={lights} /> : undefined);

  const account = area === 'daily' ? allSections.flatMap((s) => s.items).find((i) => i.id === ACCOUNT_ITEM_ID) : undefined;
  const others = sections.flatMap((s) => s.items.filter((i) => i.id !== ACCOUNT_ITEM_ID && i.common !== true).map((i) => ({ item: i, section: s })));

  return (
    <PageFrame
      title={AREA_LABEL[area]}
      purpose={area === 'admin'
        ? 'Uživatelé a práva, zabezpečení, údaje ordinace, web a záznamy změn'
        : 'To, co v ordinaci nastavujete během práce'}
    >
      <Box sx={{ maxWidth: COLUMN, width: '100%', display: 'grid', gap: 3 }}>
        <SearchBox query={query} onChange={setQuery} area={area} />

        {staleSession && (
          <Alert severity="info">
            Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
            Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
          </Alert>
        )}

        {searching ? (
          <section aria-label="Výsledky hledání" data-group="results">
            {hits.length === 0 ? (
              <Box sx={(t: Theme) => ({ ...cardSurface(t, false), p: 2.5 })}>
                <Typography sx={{ fontSize: 15 }}>Nic odpovídajícího „{query.trim()}“. Zkuste jiné slovo.</Typography>
                <ButtonBase onClick={() => setQuery('')} sx={{ mt: 1, minHeight: 44, px: 1, borderRadius: 1, color: 'primary.main', fontWeight: 600, ...focusRing }}>
                  Zrušit hledání
                </ButtonBase>
              </Box>
            ) : (
              <Box component="ul" sx={listSx}>
                {hits.map((hit) => <Row key={hit.item.id} item={hit.item} overline={overlineOf(hit.section)} trailing={stateOf(hit.item)} />)}
              </Box>
            )}
          </section>
        ) : area === 'admin' ? (
          <>
            {needs.length > 0 && (
              <section aria-labelledby="needs" data-group="needs">
                <Heading id="needs">Vyžaduje nastavení</Heading>
                <Box component="ul" sx={listSx}>{needs.map((need) => <NeedRow key={need.id} need={need} />)}</Box>
              </section>
            )}
            {sections.map((section) => (
              <Group key={section.id} id={`group-${section.id}`} title="Administrace" items={section.items} stateOf={stateOf} />
            ))}
          </>
        ) : (
          <>
            {account !== undefined && (
              <Box component="ul" aria-label="Můj účet" data-group="account" sx={listSx}>
                <Row item={account} />
              </Box>
            )}
            {sections.filter((s) => s.items.some((i) => i.id !== ACCOUNT_ITEM_ID && i.common === true)).map((section) => (
              <Group
                key={section.id}
                id={`group-${section.id}`}
                title={section.label}
                items={section.items.filter((i) => i.id !== ACCOUNT_ITEM_ID && i.common === true)}
                stateOf={stateOf}
              />
            ))}
            {others.length > 0 && (
              <Disclosure id="more" title="Další nastavení" hint={`Méně používané (${others.length})`}>
                <Box component="ul" sx={listSx}>
                  {others.map(({ item, section }) => <Row key={item.id} item={item} overline={section.label} />)}
                </Box>
              </Disclosure>
            )}
            <Disclosure id="personal" title="Vzhled aplikace a odhlášení" hint="Barva, světlý nebo tmavý režim, pohyb">
              <PersonalSection />
            </Disclosure>
          </>
        )}
      </Box>
    </PageFrame>
  );
}

/**
 * The router's one door to both pages. `/settings` (the old hub) and `/settings/:group` (the old group pages) forward to the
 * area they became; `/administrace` is the Administrace, everything else here is Nastavení.
 */
export default function Settings({ area }: { area?: SettingsArea } = {}) {
  const { pathname } = useLocation();
  const held = usePermissions();

  const legacy = /^\/settings(?:\/([^/]+))?\/?$/.exec(pathname);
  if (legacy !== null) return <Navigate to={legacyGroupPath(legacy[1])} replace />;

  const wanted: SettingsArea = area ?? (pathname.startsWith('/administrace') ? 'admin' : 'daily');
  /* The router already refuses the address without the right; this keeps the page itself honest wherever it is mounted. */
  if (wanted === 'admin' && !canSeeAdmin(held)) return <Navigate to="/nastaveni" replace />;
  return <Hub area={wanted} />;
}
