/*
 * Vzhled a odhlášení: the two things that belong to the person, not to the clinic - the look of the workspace (accent, light
 * or dark, motion) and the account with its sign-out. Drawn at the foot of Nastavení inside one closed row, because it is
 * set once; the account menu in the rail has the same look controls.
 */
import {
  Alert, Avatar, Box, Button, Stack, Typography,
} from '@mui/material';
import type { Theme } from '@mui/material';
import { Logout, Lock, Check, LightMode, DarkMode } from '@mui/icons-material';
import { TABLET_UP, TYPE, focusRing } from '../../components/settings/settingsStyle';
import { MUTED_SX, cardSurface } from '../../ui/shelf/shelfStyle';
import { signOut } from '../../auth/signOut';
import { useThemePrefs } from '../../themePrefs';
import { THEME_ACCENTS } from '../../theme';
import { useMotionPreference } from '../../motion/useMotionPreference';
import { MOTION_LABELS, MOTION_MODES } from '../../motion/preference';


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

/** A board on the page's surface (not a link): the two cards. */
const boardSx = (t: Theme) => ({ ...cardSurface(t, false), p: { xs: 2, md: 2.5 } });

/** The two things that belong to the person, not to the clinic. */
export function PersonalSection() {
  const appearance = useThemePrefs();
  const motion = useMotionPreference();
  const user = readUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || '?';

  return (
    <>
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
    </>
  );
}
