/*
 * Nastavení: the hub and the group pages, as shelf pages (docs/ui-shelf-system.md, Phase 2).
 *
 *   /settings            the HUB: a PageFrame (one h1, one line), the search, then
 *                        - "Vyžaduje nastavení" - only when a source the app already
 *                          reads says something is wrong (settings/hubModel.ts); never an all-clear,
 *                        - ONE SHELF PER GROUP, in the catalogue's order, whose cards are the
 *                          group's screens: the name and one quiet line of what is inside
 *                          (the catalogue's own description; the security screen also shows
 *                          its light once the lights have answered),
 *                        - Osobní: the look of the workspace and the person's own account.
 *                        A search replaces the shelves with one shelf of results that link
 *                        straight to the screen.
 *   /settings/:group     the GROUP: breadcrumb "Nastavení / Skupina", the group's name and
 *                        sentence, and one shelf of its screens with their whole description.
 *
 * R18 (the owner's first rule): clear before anything else. Title > shelf > card, one weight
 * each; no icons on the cards (the group's name says it), a description is one line on the hub.
 * Three layouts: a phone swipes each group's row (the next card peeks in), a tablet and a
 * desktop wrap them into a grid. Permission hiding is the catalogue's (`visibleSections`).
 */
import { Link as RouterLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Alert, Avatar, Box, Button, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import type { Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Logout, Lock, Check, LightMode, DarkMode, Search as SearchIcon,
} from '@mui/icons-material';
import {
  groupPath, normalizeText, searchSettingsItems, sectionById, visibleSections,
  type SettingsItem,
} from './settings/catalogue';
import { SettingsCrumbRow } from './settings/SettingsFrame';
import { SECURITY_ITEM_ID, settingsNeeds, visibleItem, type SettingsNeed } from './settings/hubModel';
import { useSettingsSearch } from '../components/shell/settingsSearch';
import { SecurityLightChip, SecurityStatusChip, useSecurityLights } from '../components/settings/SecurityStatusChip';
import { TABLET_UP, TYPE, focusRing, settingsGrey } from '../components/settings/settingsStyle';
import { PageFrame } from '../ui/shelf/PageFrame';
import { Shelf } from '../ui/shelf/Shelf';
import { CARD_RADIUS, MUTED_SX, cardSurface, toneOf } from '../ui/shelf/shelfStyle';
import { StatusChip } from '../components/ui';
import { hasStoredPermissions, usePermissions } from '../auth/usePermission';
import { useIsPhone } from '../layout/useDevice';
import { signOut } from '../auth/signOut';
import { useThemePrefs } from '../themePrefs';
import { THEME_ACCENTS } from '../theme';
import { useMotionPreference } from '../motion/useMotionPreference';
import { MOTION_LABELS, MOTION_MODES } from '../motion/preference';

interface StoredUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

function readUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem('user') ?? '{}') as StoredUser;
  } catch {
    return {};
  }
}

/** A board on the shelf's surface (not a link): the two Osobní cards. */
const boardSx = (t: Theme) => ({ ...cardSurface(t, false), p: { xs: 2, md: 2.5 } });

/**
 * One settings screen as a card on a shelf: its name, one quiet line, and - only where it is known - its state.
 * The whole card is the link (its accessible name is what it says). `overline` names the group (search results);
 * `full` lets the description run (the group page) instead of one line (the hub).
 */
function SettingCard({ item, overline, full = false, trailing }: { item: SettingsItem; overline?: string; full?: boolean; trailing?: ReactNode }) {
  return (
    <Box role="listitem" data-card="setting" data-setting={item.id} sx={{ minWidth: 0, display: 'flex' }}>
      <Box
        component={RouterLink}
        to={item.to}
        sx={(t: Theme) => ({
          ...cardSurface(t, true),
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.75,
          py: 1.25,
          minHeight: full ? 76 : 64,
        })}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {overline !== undefined && (
            <Typography component="span" sx={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.3, ...MUTED_SX }}>
              {overline}
            </Typography>
          )}
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{item.label}</Typography>
          <Typography component="span" noWrap={!full} title={full ? undefined : item.description} sx={{ display: 'block', ...MUTED_SX, fontSize: 13, lineHeight: 1.45, mt: 0.25 }}>
            {item.description}
          </Typography>
        </Box>
        {trailing !== undefined && <Box sx={{ flexShrink: 0 }}>{trailing}</Box>}
      </Box>
    </Box>
  );
}

/** One case of "Vyžaduje nastavení": the screen that fixes it, what is wrong in words, an edge in its tone. */
function NeedCard({ need }: { need: SettingsNeed }) {
  return (
    <Box role="listitem" data-card="need" sx={{ minWidth: 0, display: 'flex' }}>
      <Box
        component={RouterLink}
        to={need.to}
        sx={(t: Theme) => ({
          ...cardSurface(t, true),
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.75,
          py: 1.25,
          minHeight: 64,
          boxShadow: `inset 3px 0 0 ${alpha(toneOf(t, need.tone).fg, 0.9)}`,
        })}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 650, lineHeight: 1.3 }}>{need.title}</Typography>
          <Typography component="span" sx={{ display: 'block', ...MUTED_SX, fontSize: 13, lineHeight: 1.45, mt: 0.25 }}>{need.detail}</Typography>
        </Box>
        <StatusChip tone={need.tone} size="sm" dot>{need.tone === 'red' ? 'Problém' : 'Pozor'}</StatusChip>
      </Box>
    </Box>
  );
}

function SearchBox({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  return (
    <TextField
      fullWidth
      value={query}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Hledat v nastavení — název nebo slovo, které vás napadne"
      slotProps={{
        htmlInput: { 'aria-label': 'Hledat v nastavení' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: settingsGrey }} />
            </InputAdornment>
          ),
          sx: { minHeight: 48, fontSize: 15, bgcolor: 'background.paper', borderRadius: `${CARD_RADIUS - 4}px` },
        },
      }}
    />
  );
}

const ROOT_CRUMB = { label: 'Nastavení', to: '/settings' };

/** /settings/:group - the screens of one group, one shelf. */
function GroupPage({ groupId }: { groupId: string }) {
  const held = usePermissions();
  const section = visibleSections(held).find((s) => s.id === groupId);
  const known = sectionById(groupId);

  if (known === null) {
    return (
      <>
        <SettingsCrumbRow parts={[ROOT_CRUMB, { label: 'Skupina' }]} back={ROOT_CRUMB} />
        <PageFrame
          title="Tuhle skupinu nastavení neznáme"
          purpose="Adresa může být stará. Vyberte skupinu na přehledu nastavení."
          primaryAction={{ label: 'Na přehled nastavení', to: '/settings' }}
        />
      </>
    );
  }

  const items = section?.items ?? [];
  return (
    <>
      <SettingsCrumbRow parts={[ROOT_CRUMB, { label: known.label }]} back={ROOT_CRUMB} />
      <PageFrame title={known.label} purpose={known.description}>
        <Shelf
          id="items"
          title="Položky"
          count={items.length}
          layout="grid"
          minCardWidth={340}
          cardHeight={76}
          empty={items.length === 0}
          emptyState={{
            text: 'V téhle skupině pro vás zatím není nic, co byste smět otevřít. Oprávnění přiděluje správce v sekci Systém.',
            action: { label: 'Na přehled nastavení', to: '/settings' },
          }}
        >
          {items.map((item) => (
            <SettingCard key={item.id} item={item} full trailing={item.id === SECURITY_ITEM_ID ? <SecurityStatusChip /> : undefined} />
          ))}
        </Shelf>
      </PageFrame>
    </>
  );
}

/** The two things that belong to the person, not to the clinic. */
function PersonalSection() {
  const appearance = useThemePrefs();
  const motion = useMotionPreference();
  const user = readUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || '?';

  return (
    <Shelf id="osobni" title="Osobní" hint="Vzhled a váš účet — platí jen pro vás" layout="free">
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 1fr)', [TABLET_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
        <Box sx={boardSx}>
          <Typography sx={{ fontSize: 15, fontWeight: 650, mb: 0.25 }}>Vzhled</Typography>
          <Typography sx={{ ...MUTED_SX, fontSize: 13, mb: 2 }}>Barva, světlý/tmavý režim a pohyb — platí hned</Typography>

          <Typography sx={[TYPE.label, { mb: 1 }]}>Barva aplikace</Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.25, mb: 2.5 }}>
            {THEME_ACCENTS.map((a) => {
              const selected = appearance.accent.toLowerCase() === a.color.toLowerCase();
              return (
                <Box
                  key={a.key}
                  component="button"
                  type="button"
                  aria-label={a.label}
                  aria-pressed={selected}
                  onClick={() => appearance.setAccent(a.color)}
                  sx={{
                    width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
                    bgcolor: a.color, border: '2px solid', p: 0,
                    borderColor: selected ? 'text.primary' : 'transparent',
                    outline: '1px solid', outlineColor: 'divider', outlineOffset: 2,
                    display: 'grid', placeItems: 'center', color: '#fff',
                    ...focusRing,
                  }}
                >
                  {selected ? <Check sx={{ fontSize: 20 }} /> : null}
                </Box>
              );
            })}
          </Stack>

          <Typography sx={[TYPE.label, { mb: 1 }]}>Režim</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant={appearance.mode === 'light' ? 'contained' : 'outlined'}
              startIcon={<LightMode />}
              onClick={() => appearance.setMode('light')}
              sx={{ minHeight: 44 }}
            >
              Světlý
            </Button>
            <Button
              variant={appearance.mode === 'dark' ? 'contained' : 'outlined'}
              startIcon={<DarkMode />}
              onClick={() => appearance.setMode('dark')}
              sx={{ minHeight: 44 }}
            >
              Tmavý
            </Button>
          </Stack>

          <Typography sx={[TYPE.label, { mb: 1, mt: 2.5 }]}>Pohyb</Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }} role="group" aria-label="Pohyb v aplikaci">
            {MOTION_MODES.map((option) => (
              <Button
                key={option}
                variant={motion.mode === option ? 'contained' : 'outlined'}
                aria-pressed={motion.mode === option}
                onClick={() => motion.setMode(option)}
                sx={{ minHeight: 44 }}
              >
                {MOTION_LABELS[option].label}
              </Button>
            ))}
          </Stack>
          <Typography sx={[TYPE.caption, { mt: 1 }]}>
            {MOTION_LABELS[motion.mode].hint}
            {motion.followsSystem ? ' — podle nastavení vašeho zařízení' : ''}
          </Typography>
          {!motion.followsSystem && (
            <Button size="small" onClick={() => motion.setMode(null)} sx={{ minHeight: 44, mt: 0.5, alignSelf: 'flex-start' }}>
              Řídit se nastavením zařízení
            </Button>
          )}
        </Box>

        <Box sx={boardSx}>
          <Typography sx={{ fontSize: 15, fontWeight: 650, mb: 0.25 }}>Můj účet</Typography>
          <Typography sx={{ ...MUTED_SX, fontSize: 13, mb: 2 }}>Váš účet a odhlášení</Typography>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ width: 44, height: 44 }}>{initials}</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={TYPE.itemName}>
                {name === '' ? 'Přihlášený uživatel' : name}
              </Typography>
              <Typography sx={TYPE.caption}>{user.email ?? '—'}</Typography>
            </Box>
          </Stack>

          {/*
            Read-only, and that is the honest state. There is no endpoint for
            changing your own profile, so editable fields here would save your
            name into this browser and nowhere else.
          */}
          <Alert severity="info" icon={<Lock fontSize="small" />} sx={{ mb: 2 }}>
            Jméno a e-mail mění správce v sekci <strong>Systém → Uživatelé a práva</strong>.
            Tady je jen vidíte.
          </Alert>

          <Button
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            onClick={() => { void signOut(); }}
            sx={{ minHeight: 44 }}
          >
            Odhlásit se
          </Button>
        </Box>
      </Box>
    </Shelf>
  );
}

/** /settings - the hub. */
function Hub() {
  const phone = useIsPhone();
  /*
   * What this person may open, from the list the server last sent - at
   * sign-in, and again from GET /api/v1/account on start, on focus and after
   * a refusal. Read through the hook, so a grant or revocation that arrives
   * while this screen is open redraws it.
   */
  const sections = visibleSections(usePermissions());
  /* One query shared with the rail's box when the shell draws one; then the rail's box is the one search on screen. */
  const { query, setQuery, inRail } = useSettingsSearch();
  const searching = normalizeText(query) !== '';
  const hits = searching ? searchSettingsItems(sections, query) : [];
  /* The lights are asked only for somebody who may open the screen they belong to. */
  const lights = useSecurityLights(visibleItem(sections, SECURITY_ITEM_ID) !== null);
  const needs = settingsNeeds(sections, lights);

  /*
   * A session from before the server started sending the list: every guarded
   * row would be hidden, which here reads as the settings having disappeared
   * rather than as a stale sign-in.
   */
  const staleSession = !hasStoredPermissions();

  const stateOf = (item: SettingsItem) => (item.id === SECURITY_ITEM_ID && lights !== null ? <SecurityLightChip lights={lights} /> : undefined);

  return (
    <PageFrame
      title="Nastavení"
      purpose="Jak klinika pracuje: provoz, služby, kluby, komunikace, dokumenty, web a systém"
    >
      {!inRail && (
        <Box sx={{ maxWidth: 640 }}>
          <SearchBox query={query} onChange={setQuery} />
        </Box>
      )}

      {staleSession && (
        <Alert severity="info">
          Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
          Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
        </Alert>
      )}

      {searching ? (
        <Shelf
          id="results"
          title="Výsledky hledání"
          count={hits.length}
          layout="grid"
          minCardWidth={300}
          stagger={false}
          empty={hits.length === 0}
          emptyState={{ text: `Nic odpovídajícího „${query.trim()}“. Zkuste jiné slovo.`, action: { label: 'Zrušit hledání', onClick: () => setQuery('') } }}
        >
          {hits.map((hit) => (
            <SettingCard key={hit.item.id} item={hit.item} overline={hit.section.label} trailing={stateOf(hit.item)} />
          ))}
        </Shelf>
      ) : (
        <>
          {needs.length > 0 && (
            <Shelf id="needs" title="Vyžaduje nastavení" count={needs.length} countTone="red" layout="grid" minCardWidth={300} stagger={false}>
              {needs.map((need) => <NeedCard key={need.id} need={need} />)}
            </Shelf>
          )}
          {sections.map((section) => (
            <Shelf
              key={section.id}
              id={`group-${section.id}`}
              title={section.label}
              hint={section.description}
              layout={phone ? 'row' : 'grid'}
              minCardWidth={260}
              cardHeight={64}
              viewAll={{ to: groupPath(section.id), label: 'Celá skupina' }}
            >
              {section.items.map((item) => <SettingCard key={item.id} item={item} trailing={stateOf(item)} />)}
            </Shelf>
          ))}
          <PersonalSection />
        </>
      )}
    </PageFrame>
  );
}

export default function Settings() {
  const location = useLocation();
  const group = /^\/settings\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  return group !== undefined ? <GroupPage groupId={group} /> : <Hub />;
}
