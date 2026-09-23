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
 * Everything the sections offer leads to a screen that already works. What
 * does not work is named with the reason rather than hidden - hidden, it gets
 * rebuilt from scratch a year later.
 */
import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button,
  Card, CardContent, Chip, Divider, List, ListItemButton, ListItemText,
  Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  ExpandMore, ChevronRight, Logout, Person,
  Tune, Lock,
} from '@mui/icons-material';
import { visibleSections, type SettingsItem } from './settings/catalogue';
import { hasStoredPermissions, storedPermissions } from '../auth/usePermission';

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
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | false>(readStoredSection);
  const [fontScale, setFontScale] = useState<string>(() => {
    try {
      return localStorage.getItem('ui.fontScale') ?? 'medium';
    } catch {
      return 'medium';
    }
  });

  /*
   * What this person may open, from the list the server sent at sign-in.
   *
   * Not their ROLE any more. The owner sets permissions per employee, in
   * three states, and a role check could not see any of it: an administrator
   * whose `settings.clinic.manage` was revoked still saw every screen.
   */
  const sections = visibleSections(storedPermissions());

  /*
   * A session from before the server started sending the list.
   *
   * Every guarded row would be hidden, which on this screen reads as the
   * settings having disappeared rather than as a stale sign-in. Saying so is
   * the difference between a bug report and a thirty-second fix.
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

  const changeFont = (value: string | null) => {
    if (value === null) return;
    setFontScale(value);
    try {
      localStorage.setItem('ui.fontScale', value);
    } catch {
      /* Preference only; nothing depends on it being kept. */
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      /* Leaving is more important than tidying. */
    }
    navigate('/login');
  };

  const renderItem = (item: SettingsItem) => {
    const blocked = item.unavailable !== undefined;

    return (
      <ListItemButton
        key={item.id}
        component={blocked ? 'div' : RouterLink}
        {...(blocked ? {} : { to: item.to })}
        disabled={blocked}
        sx={{ borderRadius: 2, py: 1.25, opacity: blocked ? 0.75 : 1 }}
      >
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
              {blocked && <Chip size="small" color="warning" label="Zatím nedostupné" />}
            </Stack>
          }
          secondary={blocked ? item.unavailable : item.description}
        />
        {!blocked && <ChevronRight sx={{ color: 'text.disabled' }} />}
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Nastavení
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Klikněte na okruh a rozbalí se jen ten.
      </Typography>

      {staleSession && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Přihlášení je starší než nastavení oprávnění, takže se tu teď ukazuje jen část.
          Odhlaste se a přihlaste znovu a uvidíte všechno, na co máte právo.
        </Alert>
      )}

      {sections.map((section) => (
        <Accordion
          key={section.id}
          expanded={open === section.id}
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
              Nastavení, která platí jen pro vás — ne pro celou ordinaci
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: '#0D7377', width: 48, height: 48 }}>
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

          <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                <Tune fontSize="small" sx={{ color: '#0D7377' }} />
                <Typography sx={{ fontWeight: 700 }}>Vzhled</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Velikost písma. Platí na tomhle počítači.
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={fontScale}
                onChange={(_, value) => changeFont(value as string | null)}
              >
                <ToggleButton value="small">Malé</ToggleButton>
                <ToggleButton value="medium">Střední</ToggleButton>
                <ToggleButton value="large">Velké</ToggleButton>
              </ToggleButtonGroup>
            </CardContent>
          </Card>

          <Button
            startIcon={<Logout />}
            color="error"
            onClick={logout}
            sx={{ fontWeight: 600 }}
          >
            Odhlásit se
          </Button>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
