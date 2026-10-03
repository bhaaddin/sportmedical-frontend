/*
 * The account: what the avatar opens (Nastavení, appearance, sign out), and
 * the appearance controls on their own for the phone's "Více" sheet.
 */
import { Box, Button, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import { Logout, Settings } from '@mui/icons-material';
import { THEME_ACCENTS } from '../../theme';
import { useThemePrefs } from '../../themePrefs';
import { signOut } from '../../auth/signOut';

/** Accent colour and light/dark mode, the one thing a person chooses about the look. */
export function AppearanceControls() {
  const { accent, mode, setAccent, setMode } = useThemePrefs();
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
        Vzhled
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, mb: 1.25 }}>
        {THEME_ACCENTS.map((a) => (
          <Box
            key={a.key}
            component="button"
            type="button"
            aria-label={a.label}
            aria-pressed={accent === a.color}
            title={a.label}
            onClick={() => setAccent(a.color)}
            sx={{
              width: 28,
              height: 28,
              p: 0,
              border: 0,
              borderRadius: '50%',
              cursor: 'pointer',
              bgcolor: a.color,
              outline: '2px solid',
              outlineColor: accent === a.color ? 'text.primary' : 'transparent',
              outlineOffset: 2,
              '&:focus-visible': { outlineColor: 'primary.main' },
            }}
          />
        ))}
      </Box>
      <Button size="small" variant="outlined" fullWidth onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
        {mode === 'light' ? 'Tmavý režim' : 'Světlý režim'}
      </Button>
    </Box>
  );
}

export function AccountMenu({
  anchorEl,
  onClose,
  onOpenSettings,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transitionDuration={120}
    >
      <MenuItem onClick={() => { onClose(); onOpenSettings(); }} sx={{ minHeight: 44 }}>
        <ListItemIcon><Settings fontSize="small" /></ListItemIcon> Nastavení
      </MenuItem>
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <AppearanceControls />
      </Box>
      <MenuItem onClick={() => { onClose(); void signOut(); }} sx={{ minHeight: 44 }}>
        <ListItemIcon><Logout fontSize="small" /></ListItemIcon> Odhlásit se
      </MenuItem>
    </Menu>
  );
}
