/*
 * Nastavení: the board's three-pane screen (design 19).
 *
 * The application's sidebar on the left (App.tsx), the 240px settings nav
 * with its search and the catalogue's groups, and here in the content the
 * same catalogue as cards - one card per screen, one line under each saying
 * what is inside, grouped under the board's headings. Nothing is drawn twice
 * from two lists: the nav and the cards both read `catalogue.ts`, so what
 * one offers the other offers.
 *
 * Last come the two things that belong to the person rather than to the
 * clinic - the look of their workspace and their own account - because two
 * receptionists sharing a desk each have their own, and share everything above.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, InputAdornment, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  Logout, Lock, Check, LightMode, DarkMode, Search as SearchIcon,
} from '@mui/icons-material';
import { searchSections, visibleSections, type SettingsItem } from './settings/catalogue';
import { SettingsNav } from './settings/SettingsFrame';
import { PageHeader, SectionLabel, SoftCard } from '../components/ui';
import { hasStoredPermissions, usePermissions } from '../auth/usePermission';
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

/** One screen, as a card: its name, and the line that saves the click. */
function SettingsCard({ item }: { item: SettingsItem }) {
  return (
    <Box
      component={RouterLink}
      to={item.to}
      aria-label={item.label}
      sx={{ display: 'block', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
    >
      <SoftCard sx={{ p: 2, height: '100%', '&:hover': { borderColor: 'primary.main' } }}>
        <Typography sx={{ fontWeight: 600, mb: 0.25 }}>{item.label}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {item.description}
        </Typography>
      </SoftCard>
    </Box>
  );
}

export default function Settings() {
  /*
   * What this person may open, from the list the server last sent - at
   * sign-in, and again from GET /api/v1/account on start, on focus and after
   * a refusal. Read through the hook, so a grant or revocation that arrives
   * while this screen is open redraws it rather than waiting for the next
   * visit.
   *
   * Not their ROLE any more. The owner sets permissions per employee, in
   * three states, and a role check could not see any of it: an administrator
   * whose `settings.clinic.manage` was revoked still saw every screen.
   */
  const sections = visibleSections(usePermissions());
  const appearance = useThemePrefs();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));

  /*
   * One search for the nav and the cards: it matches an item's label and
   * description and its section's name, so nothing is a hunt. Empty query =
   * the whole catalogue.
   */
  const [query, setQuery] = useState('');
  const q = query.trim();
  const filteredSections = searchSections(sections, query);

  /*
   * A session from before the server started sending the list.
   *
   * Every guarded row would be hidden, which on this screen reads as the
   * settings having disappeared rather than as a stale sign-in. Saying so is
   * the difference between a bug report and a thirty-second fix. The account
   * refresh usually fills the list in a moment, and this goes away with it;
   * it stays only when the server could not be asked.
   */
  const staleSession = !hasStoredPermissions();
  const user = readUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || '?';

  const searchField = (
    <TextField
      fullWidth
      size="small"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
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
      sx={{ mb: 2.5 }}
    />
  );

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      {!narrow && <SettingsNav query={query} onQueryChange={setQuery} />}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title="Nastavení"
          subtitle="Provoz, služby a ceny, kluby, komunikace a vše ostatní na jednom místě"
        />

        {/* The nav carries the search on a wide screen; on a narrow one the
            nav is gone and the search has to be here. */}
        {narrow && searchField}

        {staleSession && (
          <Alert severity="info" sx={{ mb: 2.5 }}>
            Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
            Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
          </Alert>
        )}

        {q !== '' && filteredSections.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            Nic odpovídajícího „{q}“. Zkuste jiné slovo.
          </Typography>
        )}

        {filteredSections.map((section) => (
          <Box key={section.id} component="section" sx={{ mb: 3.5 }}>
            <SectionLabel component="h2" sx={{ mb: 0.25 }}>
              {section.label}
            </SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {section.description}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {section.items.map((item) => (
                <SettingsCard key={item.id} item={item} />
              ))}
            </Box>
          </Box>
        ))}

        {/* Appearance — the person's own, like the account below it. Changing the
            accent or the light/dark mode takes effect at once across the app, and
            is remembered in this browser. This is the "admin controls the style,
            nothing hard-coded" the owner asked for, in its first, per-user form. */}
        {q === '' && (
          <Box component="section" sx={{ mb: 3.5 }}>
            <SectionLabel component="h2" sx={{ mb: 0.25 }}>Osobní</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Vzhled vašeho pracovního prostředí a váš účet — platí jen pro vás
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <SoftCard>
                <Typography sx={{ fontWeight: 600, mb: 0.25 }}>Vzhled</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Barva a světlý/tmavý režim — platí hned
                </Typography>

                <SectionLabel>Barva aplikace</SectionLabel>
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
                          width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                          bgcolor: a.color, border: '2px solid', p: 0,
                          borderColor: selected ? 'text.primary' : 'transparent',
                          outline: '1px solid', outlineColor: 'divider', outlineOffset: 2,
                          display: 'grid', placeItems: 'center', color: '#fff',
                        }}
                      >
                        {selected ? <Check sx={{ fontSize: 18 }} /> : null}
                      </Box>
                    );
                  })}
                </Stack>

                <SectionLabel>Režim</SectionLabel>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant={appearance.mode === 'light' ? 'contained' : 'outlined'}
                    startIcon={<LightMode />}
                    onClick={() => appearance.setMode('light')}
                  >
                    Světlý
                  </Button>
                  <Button
                    variant={appearance.mode === 'dark' ? 'contained' : 'outlined'}
                    startIcon={<DarkMode />}
                    onClick={() => appearance.setMode('dark')}
                  >
                    Tmavý
                  </Button>
                </Stack>
              </SoftCard>

              {/*
                Kept apart from the rest, and last, because it is the only thing
                here that belongs to the person rather than to the clinic.
              */}
              <SoftCard>
                <Typography sx={{ fontWeight: 600, mb: 0.25 }}>Můj účet</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Váš účet a odhlášení
                </Typography>

                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ width: 44, height: 44 }}>{initials}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {name === '' ? 'Přihlášený uživatel' : name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {user.email ?? '—'}
                    </Typography>
                  </Box>
                </Stack>

                {/*
                  Read-only, and that is the honest state. There is no endpoint
                  for changing your own profile - `/api/account` does not exist -
                  so the editable fields that used to sit here saved your name
                  into this browser and nowhere else. It looked like it worked
                  until you logged in somewhere else.
                */}
                <Alert severity="info" icon={<Lock fontSize="small" />} sx={{ mb: 2 }}>
                  Jméno a e-mail mění správce v sekci <strong>Tým → Zaměstnanci</strong>.
                  Tady je jen vidíte.
                </Alert>

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Logout />}
                  onClick={() => { void signOut(); }}
                >
                  Odhlásit se
                </Button>
              </SoftCard>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
