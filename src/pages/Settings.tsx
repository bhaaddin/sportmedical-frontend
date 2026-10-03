/*
 * Nastavení: the hub and the group pages.
 *
 *   /settings            the HUB, on the full content width: one tile per
 *                        group (name 18/700, one sentence 14 grey, how many
 *                        items, an icon) and a search on top that finds an
 *                        item by its name, its description or the words a
 *                        receptionist would type - the result is a link
 *                        straight to the item, not to its group.
 *   /settings/:group     the GROUP: its items as large rows (name 15/600,
 *                        description 14 grey, a chevron), breadcrumb
 *                        "Nastavení / Skupina" and a back button.
 *
 * An item is its own route and wears the SettingsScreen frame. Three levels,
 * never more. On a phone the hub is a list of groups, not a grid of tiles; on
 * an iPad two tiles to a row, on a desktop three.
 *
 * Last on the hub come the two things that belong to the person rather than to
 * the clinic - the look of their workspace and their own account.
 */
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import {
  Logout, Lock, Check, LightMode, DarkMode, Search as SearchIcon, ArrowBack, ChevronRight,
} from '@mui/icons-material';
import {
  groupPath, itemCountLabel, normalizeText, searchSettingsItems, sectionById, visibleSections,
  type SettingsHit, type SettingsSection,
} from './settings/catalogue';
import { SettingsCrumbs } from './settings/SettingsFrame';
import { useSettingsSearch } from '../components/shell/settingsSearch';
import { GroupIcon } from '../components/settings/groupIcons';
import {
  DESKTOP_UP, TABLET_UP, TYPE, focusRing, rowSx, settingsGrey, settingsHover, settingsLine,
} from '../components/settings/settingsStyle';
import { hasStoredPermissions, usePermissions } from '../auth/usePermission';
import { useIsPhone } from '../layout/useDevice';
import { signOut } from '../auth/signOut';
import { useThemePrefs } from '../themePrefs';
import { THEME_ACCENTS } from '../theme';

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

const cardSx = {
  border: '1px solid',
  borderColor: settingsLine,
  borderRadius: 3,
  bgcolor: 'background.paper',
};

/** A group, as a tile: icon, name, one sentence, how many items. */
function GroupTile({ section, listRow }: { section: SettingsSection; listRow: boolean }) {
  const count = itemCountLabel(section.items.length);
  if (listRow) {
    /* Phone: a list of groups, each row a 64px+ touch target. */
    return (
      <Box
        component={RouterLink}
        to={groupPath(section.id)}
        aria-label={`${section.label} — ${count}`}
        sx={[rowSx(false), { px: 2, py: 2, minHeight: 72 }]}
      >
        <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <GroupIcon name={section.icon} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={TYPE.sectionTitle}>{section.label}</Typography>
          <Typography sx={TYPE.caption}>{section.description}</Typography>
          <Typography sx={[TYPE.label, { mt: 0.5 }]}>{count}</Typography>
        </Box>
        <ChevronRight sx={{ color: settingsGrey, flexShrink: 0 }} aria-hidden />
      </Box>
    );
  }
  return (
    <Box
      component={RouterLink}
      to={groupPath(section.id)}
      aria-label={`${section.label} — ${count}`}
      sx={[
        cardSx,
        {
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 3,
          minHeight: 200,
          minWidth: 0,
          textDecoration: 'none',
          color: 'text.primary',
          '&:hover': { bgcolor: settingsHover, borderColor: 'primary.main' },
          '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        },
      ]}
    >
      <Box sx={{ color: 'primary.main', mb: 0.5 }}>
        <GroupIcon name={section.icon} sx={{ fontSize: 32 }} />
      </Box>
      <Typography component="h2" sx={TYPE.sectionTitle}>{section.label}</Typography>
      <Typography sx={[TYPE.caption, { flex: 1 }]}>{section.description}</Typography>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography sx={TYPE.label}>{count}</Typography>
        <ChevronRight sx={{ color: 'primary.main' }} aria-hidden />
      </Stack>
    </Box>
  );
}

/** One search result: a link straight to the item, with the group it lives in. */
function ResultRow({ hit }: { hit: SettingsHit }) {
  return (
    <Box component={RouterLink} to={hit.item.to} sx={rowSx(false)}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={TYPE.itemName}>{hit.item.label}</Typography>
        <Typography sx={TYPE.caption}>{hit.item.description}</Typography>
      </Box>
      <Typography sx={[TYPE.label, { flexShrink: 0, display: { xs: 'none', sm: 'block' } }]}>{hit.section.label}</Typography>
      <ChevronRight sx={{ color: settingsGrey, flexShrink: 0 }} aria-hidden />
    </Box>
  );
}

function SearchBox({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  return (
    <TextField
      fullWidth
      value={query}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Hledat v nastavení — název, popis nebo slovo, které by vás napadlo"
      slotProps={{
        htmlInput: { 'aria-label': 'Hledat v nastavení' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: settingsGrey }} />
            </InputAdornment>
          ),
          sx: { minHeight: 52, fontSize: 16, bgcolor: 'background.paper' },
        },
      }}
    />
  );
}

/** Title, one sentence, and - on a group - the breadcrumb and the way back. */
function HubHeader({ title, subtitle, crumbs, back }: {
  title: string;
  subtitle: string;
  crumbs?: React.ReactNode;
  back?: { label: string; to: string };
}) {
  return (
    <Box sx={{ mb: 3 }}>
      {crumbs !== undefined && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          {back !== undefined && (
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
          {crumbs}
        </Stack>
      )}
      <Typography component="h1" sx={TYPE.pageTitle}>{title}</Typography>
      <Typography sx={[TYPE.caption, { mt: 0.75, maxWidth: 760 }]}>{subtitle}</Typography>
    </Box>
  );
}

/** /settings/:group - the items of one group as large rows. */
function GroupPage({ groupId }: { groupId: string }) {
  const held = usePermissions();
  const section = visibleSections(held).find((s) => s.id === groupId);
  const known = sectionById(groupId);

  if (known === null) {
    return (
      <Box sx={{ maxWidth: 1240 }}>
        <HubHeader
          title="Tuhle skupinu nastavení neznáme"
          subtitle="Adresa může být stará. Vyberte skupinu na přehledu nastavení."
          crumbs={<SettingsCrumbs parts={[{ label: 'Nastavení', to: '/settings' }, { label: 'Skupina' }]} />}
          back={{ label: 'Nastavení', to: '/settings' }}
        />
        <Button component={RouterLink} to="/settings" variant="contained" sx={{ minHeight: 44 }}>Na přehled nastavení</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1240 }}>
      <HubHeader
        title={known.label}
        subtitle={known.description}
        crumbs={<SettingsCrumbs parts={[{ label: 'Nastavení', to: '/settings' }, { label: known.label }]} />}
        back={{ label: 'Nastavení', to: '/settings' }}
      />
      {section === undefined ? (
        <Alert severity="info">
          V téhle skupině pro vás zatím není nic, co byste smět otevřít. Oprávnění přiděluje správce v sekci Systém.
        </Alert>
      ) : (
        <Box component="ul" aria-label={known.label} sx={[cardSx, { listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }]}>
          {section.items.map((item, index) => (
            <Box key={item.id} component="li" sx={{ borderTop: index === 0 ? 'none' : '1px solid', borderColor: settingsLine }}>
              <Box component={RouterLink} to={item.to} sx={[rowSx(false), { minHeight: 76 }]}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={TYPE.itemName}>{item.label}</Typography>
                  <Typography sx={TYPE.caption}>{item.description}</Typography>
                </Box>
                <ChevronRight sx={{ color: settingsGrey, flexShrink: 0 }} aria-hidden />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** The two things that belong to the person, not to the clinic. */
function PersonalSection() {
  const appearance = useThemePrefs();
  const user = readUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || '?';

  return (
    <Box component="section" sx={{ mt: 5, mb: 3.5 }}>
      <Typography component="h2" sx={[TYPE.sectionTitle, { mb: 0.5 }]}>Osobní</Typography>
      <Typography sx={[TYPE.caption, { mb: 2 }]}>
        Vzhled vašeho pracovního prostředí a váš účet — platí jen pro vás
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)', [TABLET_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
        <Box sx={[cardSx, { p: 3 }]}>
          <Typography sx={[TYPE.itemName, { mb: 0.25 }]}>Vzhled</Typography>
          <Typography sx={[TYPE.caption, { mb: 2 }]}>Barva a světlý/tmavý režim — platí hned</Typography>

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
        </Box>

        <Box sx={[cardSx, { p: 3 }]}>
          <Typography sx={[TYPE.itemName, { mb: 0.25 }]}>Můj účet</Typography>
          <Typography sx={[TYPE.caption, { mb: 2 }]}>Váš účet a odhlášení</Typography>

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
    </Box>
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
  /* One query shared with the rail's box when the shell draws one. */
  const { query, setQuery } = useSettingsSearch();
  const searching = normalizeText(query) !== '';
  const hits = searching ? searchSettingsItems(sections, query) : [];

  /*
   * A session from before the server started sending the list: every guarded
   * row would be hidden, which here reads as the settings having disappeared
   * rather than as a stale sign-in.
   */
  const staleSession = !hasStoredPermissions();

  return (
    <Box sx={{ maxWidth: 1240, minWidth: 0 }}>
      <HubHeader
        title="Nastavení"
        subtitle="Provoz, služby a ceny, kluby, komunikace, dokumenty, web a systém — vyberte skupinu nebo hledejte"
      />

      <Box sx={{ mb: 3 }}>
        <SearchBox query={query} onChange={setQuery} />
      </Box>

      {staleSession && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
          Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
        </Alert>
      )}

      {searching ? (
        hits.length === 0 ? (
          <Typography sx={[TYPE.caption, { mb: 2.5 }]}>
            Nic odpovídajícího „{query.trim()}“. Zkuste jiné slovo.
          </Typography>
        ) : (
          <Box component="section" aria-label="Výsledky hledání">
            <Typography component="h2" sx={[TYPE.sectionTitle, { mb: 1.5 }]}>
              Nalezeno {hits.length}
            </Typography>
            <Box component="ul" sx={[cardSx, { listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }]}>
              {hits.map((hit, index) => (
                <Box key={hit.item.id} component="li" sx={{ borderTop: index === 0 ? 'none' : '1px solid', borderColor: settingsLine }}>
                  <ResultRow hit={hit} />
                </Box>
              ))}
            </Box>
          </Box>
        )
      ) : (
        <>
          {phone ? (
            <Box component="ul" sx={[cardSx, { listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }]}>
              {sections.map((section, index) => (
                <Box key={section.id} component="li" sx={{ borderTop: index === 0 ? 'none' : '1px solid', borderColor: settingsLine }}>
                  <GroupTile section={section} listRow />
                </Box>
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                [DESKTOP_UP]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {sections.map((section) => (
                <GroupTile key={section.id} section={section} listRow={false} />
              ))}
            </Box>
          )}
          <PersonalSection />
        </>
      )}
    </Box>
  );
}

export default function Settings() {
  const location = useLocation();
  const group = /^\/settings\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  return group !== undefined ? <GroupPage groupId={group} /> : <Hub />;
}
