/*
 * Two-factor authentication — the signed-in user turns it on for their own account.
 *
 * The backend TOTP flow was complete and unreachable; this is the screen that
 * was missing. Begin setup shows the secret once (to add to an authenticator
 * app), a live code confirms it and switches 2FA on, and the recovery codes are
 * shown once. Turning it off needs a current code. The login half (being asked
 * for the code at sign-in) is handled in Login + auth.ts.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { twoFactorApi } from '../../api/twoFactor';
import type { TwoFactorSetup } from '../../api/twoFactor';
import { errorText } from '../../components/booking/errorText';

export default function TwoFactorPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const statusQuery = useQuery({
    queryKey: ['two-factor-status'],
    queryFn: twoFactorApi.status,
  });
  const status = statusQuery.data;

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });

  const begin = useMutation({
    mutationFn: twoFactorApi.beginSetup,
    onSuccess: (s) => { setSetup(s); setCode(''); },
  });
  const confirm = useMutation({
    mutationFn: () => twoFactorApi.confirm(code.trim()),
    onSuccess: (r) => { setRecoveryCodes(r.recoveryCodes); setSetup(null); setCode(''); void refreshStatus(); },
  });
  const disable = useMutation({
    mutationFn: () => twoFactorApi.disable(disableCode.trim()),
    onSuccess: () => { setDisableCode(''); void refreshStatus(); },
  });

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShieldIcon color="primary" />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Dvoufázové ověření</Typography>
        </Stack>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Přidá k heslu jednorázový kód z ověřovací aplikace (Google Authenticator,
          Authy a podobné). Platí jen pro váš účet.
        </Typography>
      </Box>

      {/* Recovery codes — shown once, right after enabling. */}
      {recoveryCodes !== null ? (
        <Card variant="outlined" sx={{ mb: 2, borderColor: 'warning.main' }}>
          <CardContent>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Záložní kódy — uložte si je teď</Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Zobrazí se jen jednou. Každý kód použijete jednou, když nemáte telefon po ruce.
            </Alert>
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {recoveryCodes.map((rc) => (
                <Chip key={rc} label={rc} sx={{ fontFamily: 'monospace' }} />
              ))}
            </Stack>
            <Button variant="contained" onClick={() => setRecoveryCodes(null)}>Mám uloženo</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          {statusQuery.isLoading ? (
            <Typography sx={{ color: 'text.secondary' }}>Načítám…</Typography>
          ) : statusQuery.error ? (
            <Alert severity="error">{errorText(statusQuery.error, t)}</Alert>
          ) : status?.enabled ? (
            /* ── Enabled: offer to turn off ── */
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip color="success" label="Zapnuto" />
                <Typography>Váš účet je chráněný dvoufázovým ověřením.</Typography>
              </Stack>
              <Divider />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Vypnutí potvrďte aktuálním kódem z aplikace.
              </Typography>
              {disable.error ? <Alert severity="error">{errorText(disable.error, t)}</Alert> : null}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <TextField
                  label="Kód z aplikace"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  size="small"
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 10 } }}
                />
                <Button
                  color="error"
                  variant="outlined"
                  disabled={disableCode.trim().length < 6 || disable.isPending}
                  onClick={() => disable.mutate()}
                  sx={{ mt: 0.5 }}
                >
                  Vypnout
                </Button>
              </Stack>
            </Stack>
          ) : setup !== null ? (
            /* ── Setup in progress: show secret, confirm with a code ── */
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700 }}>1. Přidejte do ověřovací aplikace</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                V aplikaci zvolte „přidat účet ručně" a zadejte tento klíč:
              </Typography>
              <TextField
                value={setup.secret}
                slotProps={{ input: { readOnly: true }, htmlInput: { style: { fontFamily: 'monospace', letterSpacing: 2 } } }}
                fullWidth
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                {setup.otpauthUri}
              </Typography>
              <Divider />
              <Typography sx={{ fontWeight: 700 }}>2. Opište kód, který aplikace ukáže</Typography>
              {confirm.error ? <Alert severity="error">{errorText(confirm.error, t)}</Alert> : null}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <TextField
                  label="Šestimístný kód"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  size="small"
                  autoFocus
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
                />
                <Button
                  variant="contained"
                  disabled={code.trim().length < 6 || confirm.isPending}
                  onClick={() => confirm.mutate()}
                  sx={{ mt: 0.5 }}
                >
                  Potvrdit a zapnout
                </Button>
                <Button color="inherit" onClick={() => setSetup(null)} sx={{ mt: 0.5 }}>Zrušit</Button>
              </Stack>
            </Stack>
          ) : (
            /* ── Off: offer to begin ── */
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label="Vypnuto" />
                <Typography>Účet je chráněný jen heslem.</Typography>
              </Stack>
              {begin.error ? <Alert severity="error">{errorText(begin.error, t)}</Alert> : null}
              <Box>
                <Button
                  variant="contained"
                  startIcon={<ShieldIcon />}
                  disabled={begin.isPending}
                  onClick={() => begin.mutate()}
                >
                  Zapnout dvoufázové ověření
                </Button>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
