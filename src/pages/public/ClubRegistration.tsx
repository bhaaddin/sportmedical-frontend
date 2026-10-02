/* ══════════════════════════════════════════════════════════════
   KLUBOVÁ REGISTRACE  (route: /klub/:token)

   An athlete follows their club's link, picks one of the examinations the club
   ordered, gives their name, and the clinic's reserved time generates the exact
   slot. No account, no login — the same brand the public booking page wears.

   Everything shown comes from the server's offer for this one token: the club's
   name, the examinations it ordered, the days held for it and how many places
   are left. Nothing is decided here that the clinic has not already decided.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  CheckCircleOutlined,
  EventAvailableOutlined,
  GroupsOutlined,
} from '@mui/icons-material';
import {
  ClubLinkDeadError,
  claimClubSlot,
  getClubOffer,
} from '../../api/publicClub';
import type { ClubOffer } from '../../api/publicClub';

/* ── Brand, the same one /objednat wears ── */
const BRAND = {
  ink: '#0B0B0C',
  accent: '#FF9D00',
  accentDark: '#E08A00',
  accentWash: 'rgba(255, 157, 0, 0.09)',
  page: '#F4F4F6',
  line: '#E5E5E9',
  muted: 'rgba(17, 17, 17, 0.58)',
};

const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: BRAND.muted },
    divider: BRAND.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: INTER,
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

const clinicDateTime = (utc: string): string =>
  new Date(utc).toLocaleString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

const dayLabel = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const hhmm = (time: string): string => time.slice(0, 5);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page, py: { xs: 3, sm: 6 } }}>
        <Container maxWidth="sm">{children}</Container>
      </Box>
    </ThemeProvider>
  );
}

export default function ClubRegistration() {
  const { token = '' } = useParams();

  const [offer, setOffer] = useState<ClubOffer | null>(null);
  const [dead, setDead] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const [activityId, setActivityId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOffer(null);
    setDead(false);
    setLoadFailed(false);

    getClubOffer(token)
      .then((result) => {
        if (!alive) return;
        setOffer(result);
        if (result.activities.length === 1) {
          setActivityId(result.activities[0].activityId);
        }
      })
      .catch((error) => {
        if (!alive) return;
        if (error instanceof ClubLinkDeadError) setDead(true);
        else setLoadFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async () => {
    if (name.trim() === '' || activityId === '') return;
    setSubmitting(true);
    setComplaint(null);
    try {
      const claim = await claimClubSlot(token, {
        activityId,
        name: name.trim(),
        phone: phone.trim() === '' ? undefined : phone.trim(),
      });
      if (claim.startUtc) {
        setBookedAt(claim.startUtc);
      } else {
        setComplaint('Rezervaci se nepodařilo dokončit.');
      }
    } catch (error) {
      setComplaint(error instanceof Error ? error.message : 'Rezervaci se nepodařilo dokončit.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Dead / failed / loading ── */
  if (dead) {
    return (
      <Shell>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Tento odkaz už není platný nebo vypršel. Ozvěte se prosím svému klubu.
        </Alert>
      </Shell>
    );
  }

  if (loadFailed) {
    return (
      <Shell>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Registraci se nepodařilo načíst. Zkuste to prosím za chvíli znovu.
        </Alert>
      </Shell>
    );
  }

  if (offer === null) {
    return (
      <Shell>
        <Stack sx={{ alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Stack>
      </Shell>
    );
  }

  /* ── Confirmed ── */
  if (bookedAt) {
    return (
      <Shell>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
          <CheckCircleOutlined sx={{ fontSize: 56, color: BRAND.accent }} />
          <Typography variant="h4">Máte rezervováno</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {clinicDateTime(bookedAt)}
          </Typography>
          <Typography sx={{ color: BRAND.muted }}>
            Těšíme se na vás. Dorazte prosím včas; registraci dokončíme na místě.
          </Typography>
        </Stack>
      </Shell>
    );
  }

  /* ── The offer + the form ── */
  const openWindows = offer.windows.filter((w) => w.places > 0);
  const canSubmit = name.trim() !== '' && activityId !== '' && !submitting;

  return (
    <Shell>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <GroupsOutlined sx={{ color: BRAND.accent }} />
            <Typography variant="overline" sx={{ color: BRAND.muted, letterSpacing: '0.08em' }}>
              Klubová registrace
            </Typography>
          </Stack>
          <Typography variant="h4">{offer.partnerName}</Typography>
          <Typography sx={{ color: BRAND.muted, mt: 0.5 }}>
            Vyberte vyšetření a zapište se. Termín vám přidělíme v čase, který klub rezervoval.
          </Typography>
        </Box>

        {offer.remaining <= 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Všechna místa jsou obsazená. Ozvěte se prosím svému klubu.
          </Alert>
        ) : (
          <>
            {/* Held days */}
            <Box
              sx={{
                border: `1px solid ${BRAND.line}`,
                borderRadius: 2,
                p: 2,
                bgcolor: BRAND.accentWash,
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <EventAvailableOutlined fontSize="small" sx={{ color: BRAND.accentDark }} />
                <Typography sx={{ fontWeight: 700 }}>Rezervované dny</Typography>
              </Stack>
              {openWindows.length === 0 ? (
                <Typography variant="body2" sx={{ color: BRAND.muted }}>
                  Momentálně není volný žádný den.
                </Typography>
              ) : (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {openWindows.map((w) => (
                    <Chip
                      key={`${w.date}-${w.startTime}`}
                      label={`${dayLabel(w.date)} · ${hhmm(w.startTime)}–${hhmm(w.endTime)}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* The form */}
            <Stack spacing={2}>
              <TextField
                select
                fullWidth
                label="Vyšetření"
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
              >
                {offer.activities.map((a) => (
                  <MenuItem key={a.activityId} value={a.activityId}>
                    {a.activityName} · {a.durationMinutes} min
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                required
                label="Jméno a příjmení"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                fullWidth
                type="tel"
                label="Telefon (nepovinné)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              {complaint ? (
                <Alert severity="warning" onClose={() => setComplaint(null)} sx={{ borderRadius: 2 }}>
                  {complaint}
                </Alert>
              ) : null}

              <Button
                variant="contained"
                size="large"
                disabled={!canSubmit}
                onClick={submit}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {submitting ? 'Rezervuji…' : 'Zapsat se a rezervovat termín'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Shell>
  );
}
