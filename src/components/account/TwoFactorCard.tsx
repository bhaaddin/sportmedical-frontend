/* ══════════════════════════════════════════════════════════════
   DVOUFÁZOVÉ OVĚŘENÍ - the signed-in employee's own second factor

   Off, being set up, or on. Setting up is two steps: the server issues a
   secret, this draws it as a QR code (in the browser, from the otpauth URI -
   no picture leaves the building) and the person proves their phone shows the
   right code before anything is in force. Then the recovery codes are shown
   once. Switching it off asks for a current code, so somebody who found an
   open session cannot quietly remove it.
   ══════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, TextField, Typography,
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { authApi, twoFactorRefusal, type TwoFactorSetup, type TwoFactorStatus } from '../../api/auth';

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'off'; setupPending: boolean }
  | { kind: 'setup'; issued: TwoFactorSetup }
  | { kind: 'codes'; recoveryCodes: string[] }
  | { kind: 'on' };

const CODE_HELP = 'Šest číslic z aplikace Google Authenticator, Microsoft Authenticator nebo jiné, která umí TOTP.';

export function TwoFactorCard() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    authApi.twoFactorStatus()
      .then((status: TwoFactorStatus) =>
        setPhase(status.enabled ? { kind: 'on' } : { kind: 'off', setupPending: status.setupPending }))
      .catch(() => setPhase({ kind: 'failed' }));
  }, []);

  useEffect(load, [load]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const issued = await authApi.beginTwoFactorSetup();
      setCode('');
      setPhase({ kind: 'setup', issued });
    } catch (e) {
      setError(twoFactorRefusal(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const recoveryCodes = await authApi.confirmTwoFactor(code.trim());
      setCode('');
      setPhase({ kind: 'codes', recoveryCodes });
    } catch (e) {
      setError(twoFactorRefusal(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.disableTwoFactor(code.trim());
      setCode('');
      setPhase({ kind: 'off', setupPending: false });
    } catch (e) {
      setError(twoFactorRefusal(e));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = (codes: string[]) => {
    navigator.clipboard?.writeText(codes.join('\n')).catch(() => {});
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Dvoufázové ověření</Typography>
          {phase.kind === 'on' && <Chip size="small" color="success" label="Zapnuto" />}
          {phase.kind === 'off' && <Chip size="small" label="Vypnuto" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Po zadání hesla se navíc ptáme na kód z ověřovací aplikace v telefonu, takže samotné
          uhodnuté heslo k účtu nestačí.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {phase.kind === 'loading' && <CircularProgress size={20} />}

        {phase.kind === 'failed' && (
          <Alert severity="warning" action={<Button size="small" onClick={load}>Zkusit znovu</Button>}>
            Stav dvoufázového ověření se nepodařilo načíst.
          </Alert>
        )}

        {phase.kind === 'off' && (
          <Box>
            {phase.setupPending && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nastavení nebylo dokončeno, takže ověření zatím nic nechrání. Začněte znovu a
                tentokrát potvrďte kódem.
              </Alert>
            )}
            <Button variant="contained" onClick={() => void begin()} disabled={busy}
              sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
              {phase.setupPending ? 'Začít nastavení znovu' : 'Zapnout dvoufázové ověření'}
            </Button>
          </Box>
        )}

        {phase.kind === 'setup' && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              <strong>1.</strong> Načtěte QR kód ověřovací aplikací v telefonu. Když nejde načíst,
              zadejte do aplikace ručně klíč pod ním.
            </Typography>
            <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1 }}>
              <QRCodeSVG value={phase.issued.otpauthUri} size={196} aria-label="QR kód pro ověřovací aplikaci" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-all' }}>
              Klíč pro ruční zadání: <code data-testid="two-factor-secret">{phase.issued.secret}</code>
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>2.</strong> Opište kód, který aplikace právě ukazuje. Tím ověříme, že telefon
              je nastavený správně, a teprve pak se ověření zapne.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                label="Kód z aplikace"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                helperText={CODE_HELP}
                slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 7 } }}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <Button variant="contained" onClick={() => void confirm()} disabled={busy || code.trim().length < 6}
                sx={{ bgcolor: '#0D7377', borderRadius: 2, mt: 0.25 }}>
                Potvrdit a zapnout
              </Button>
              <Button onClick={() => { setError(null); setPhase({ kind: 'off', setupPending: true }); }} disabled={busy}
                sx={{ mt: 0.25 }}>
                Zrušit
              </Button>
            </Stack>
          </Box>
        )}

        {phase.kind === 'codes' && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Dvoufázové ověření je zapnuté. Od teď se při přihlášení ptáme na kód z telefonu.
            </Alert>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Záložní kódy</strong> - uložte si je mimo telefon. Každý funguje jednou a
              přihlásí vás, když telefon nebude po ruce. Ukazují se jen teď.
            </Typography>
            <Box component="ul" sx={{ columns: 2, pl: 3, mb: 2, fontFamily: 'monospace' }}>
              {phase.recoveryCodes.map((c) => <li key={c}>{c}</li>)}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => copyCodes(phase.recoveryCodes)} sx={{ borderRadius: 2 }}>
                Kopírovat kódy
              </Button>
              <Button variant="contained" onClick={() => setPhase({ kind: 'on' })} sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
                Mám je uložené
              </Button>
            </Stack>
          </Box>
        )}

        {phase.kind === 'on' && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Vypnutí chce aktuální kód z aplikace (nebo záložní kód), aby to nemohl udělat nikdo,
              kdo jen našel otevřené přihlášení. Ztracený telefon vám vyřeší správce v sekci
              Tým a účty.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                label="Kód z aplikace"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                helperText={CODE_HELP}
                slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 12 } }}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <Button color="error" variant="outlined" onClick={() => void disable()} disabled={busy || code.trim().length < 6}
                sx={{ borderRadius: 2, mt: 0.25 }}>
                Vypnout dvoufázové ověření
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
