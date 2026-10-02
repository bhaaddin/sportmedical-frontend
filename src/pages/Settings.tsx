/*
 * Nastavení: one screen, six headings, nothing open until it is asked for.
 *
 * What this replaces: twenty entries in the sidebar, most of them things
 * somebody opens twice a year, sitting next to the four they open every
 * morning. And on this screen itself, a "Kalendář" card with a default
 * appointment length, a buffer and working hours - all hardcoded, saving
 * nowhere, and contradicting the real working-hours screen. Two of the three
 * places working hours lived were decoration; they are gone.
 *
 * The grouping is the API's, not an invention. Working hours, exceptions,
 * blocked time and club reservations all hang off a calendar
 * (`/api/calendars/{id}/periods/{p}/working-hours`, `/exceptions`, `/blocks`,
 * `/partner-orders`), so they are shown that way and somebody setting a
 * calendar up finds the whole of it in one place.
 *
 * Everything the sections offer leads to a screen that already works.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button,
  Card, CardContent, Divider, List, ListItemButton, ListItemText,
  Stack, Typography, TextField, InputAdornment,
} from '@mui/material';
import {
  ExpandMore, ChevronRight, Logout, Person, Lock, Check,
  Palette, LightMode, DarkMode, Search as SearchIcon,
} from '@mui/icons-material';
import { visibleSections, type SettingsItem } from './settings/catalogue';
import { hasStoredPermissions, usePermissions } from '../auth/usePermission';
import { signOut } from '../auth/signOut';
import { useThemePrefs } from '../themePrefs';
import { THEME_ACCENTS } from '../theme';

/** Remembered per browser, so re-opening settings lands where you left it. */
const OPEN_KEY = 'settings.openSection';

function readStoredSection(): string | false {
  try {
    return localStorage.getItem(OPEN_KEY) ?? false;
  } catch {
    return false;
  }
}

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

export default function Settings() {
  const [open, setOpen] = useState<string | false>(readStoredSection);

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

  /*
   * Search across every settings row so nothing is a hunt. It matches an item's
   * label and description and its section's name, and while searching every
   * matching section is expanded so the hit is visible without a click. Empty
   * query = the normal accordion.
   */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filteredSections = q
    ? sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            `${item.label} ${item.description} ${section.label} ${section.description}`
              .toLowerCase()
              .includes(q),
          ),
        }))
        .filter((section) => section.items.length > 0)
    : sections;

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

  const toggle = (id: string) => {
    const next = open === id ? false : id;
    setOpen(next);
    try {
      if (next === false) localStorage.removeItem(OPEN_KEY);
      else localStorage.setItem(OPEN_KEY, next);
    } catch {
      /* A browser that refuses storage still gets working settings. */
    }
  };

  const renderItem = (item: SettingsItem) => (
    <ListItemButton
      key={item.id}
      component={RouterLink}
      to={item.to}
      sx={{ borderRadius: 2, py: 1.25 }}
    >
      <ListItemText
        primary={<Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>}
        secondary={item.description}
      />
      <ChevronRight sx={{ color: 'text.disabled' }} />
    </ListItemButton>
  );

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Nastavení
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Klikněte na okruh a rozbalí se jen ten, nebo hledejte napříč vším nastavením.
      </Typography>

      <TextField
        fullWidth
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hledat v nastavení — např. ceník, souhlasy, dvoufázové…"
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {q && filteredSections.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nic odpovídajícího „{query}“. Zkuste jiné slovo.
        </Typography>
      )}

      {staleSession && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
          Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
        </Alert>
      )}

      {filteredSections.map((section) => (
        <Accordion
          key={section.id}
          expanded={q !== '' || open === section.id}
          onChange={() => toggle(section.id)}
          disableGutters
          sx={{
            mb: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            '&:before': { display: 'none' },
            boxShadow: 'none',
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ py: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{section.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {section.description}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Divider sx={{ mb: 1 }} />
            <List disablePadding>{section.items.map(renderItem)}</List>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Appearance — the person's own, like the account below it. Changing the
          accent or the light/dark mode takes effect at once across the app, and
          is remembered in this browser. This is the "admin controls the style,
          nothing hard-coded" the owner asked for, in its first, per-user form. */}
      <Accordion
        expanded={open === 'vzhled'}
        onChange={() => toggle('vzhled')}
        disableGutters
        sx={{
          mb: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
          '&:before': { display: 'none' }, boxShadow: 'none',
        }}
      >
        <AccordionSummary expandIcon={<ExpandMore />} sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Palette sx={{ color: appearance.accent }} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Vzhled</Typography>
              <Typography variant="body2" color="text.secondary">
                Barva a světlý/tmavý režim — platí hned
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Barva aplikace</Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
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
                    bgcolor: a.color, border: '3px solid',
                    borderColor: selected ? 'text.primary' : 'transparent',
                    boxShadow: selected ? `0 4px 14px ${a.color}66` : '0 2px 8px rgba(0,0,0,0.12)',
                    display: 'grid', placeItems: 'center', color: '#fff',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    '&:hover': { transform: 'translateY(-2px)' },
                  }}
                >
                  {selected ? <Check sx={{ fontSize: 20 }} /> : null}
                </Box>
              );
            })}
          </Stack>

          <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Režim</Typography>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant={appearance.mode === 'light' ? 'contained' : 'outlined'}
              startIcon={<LightMode />}
              onClick={() => appearance.setMode('light')}
              sx={{ borderRadius: 2 }}
            >
              Světlý
            </Button>
            <Button
              variant={appearance.mode === 'dark' ? 'contained' : 'outlined'}
              startIcon={<DarkMode />}
              onClick={() => appearance.setMode('dark')}
              sx={{ borderRadius: 2 }}
            >
              Tmavý
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/*
        Kept apart from the rest, and last, because it is the only thing here
        that belongs to the person rather than to the clinic. Two receptionists
        sharing a desk each have their own; the calendars above they share.
      */}
      <Accordion
        expanded={open === 'ucet'}
        onChange={() => toggle('ucet')}
        disableGutters
        sx={{
          mb: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
          '&:before': { display: 'none' }, boxShadow: 'none',
        }}
      >
        <AccordionSummary expandIcon={<ExpandMore />} sx={{ py: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Můj účet</Typography>
            <Typography variant="body2" color="text.secondary">
              Váš účet a odhlášení
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  {initials}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {name === '' ? 'Přihlášený uživatel' : name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email ?? '—'}
                  </Typography>
                </Box>
                <Person sx={{ color: 'text.disabled' }} />
              </Stack>

              {/*
                Read-only, and that is the honest state. There is no endpoint
                for changing your own profile - `/api/account` does not exist -
                so the editable fields that used to sit here saved your name
                into this browser and nowhere else. It looked like it worked
                until you logged in somewhere else.
              */}
              <Alert severity="info" icon={<Lock fontSize="small" />} sx={{ mt: 2 }}>
                Jméno a e-mail mění správce v sekci <strong>Tým a účty</strong>.
                Tady je jen vidíte.
              </Alert>
            </CardContent>
          </Card>

          <Button
            startIcon={<Logout />}
            color="error"
            onClick={() => { void signOut(); }}
            sx={{ fontWeight: 600 }}
          >
            Odhlásit se
          </Button>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
