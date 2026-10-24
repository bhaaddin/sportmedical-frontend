/*
 * Komunikace > E-mail: which sender the server uses, whether it is set up,
 * what the outbox did in the last 24 hours, and one test message.
 *
 * Nothing is edited here. The key and the sender live in the server's
 * environment (see the guide); this page only reports and tests, so it has no
 * save bar and no field that could hold a secret.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Link, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { Refresh as RefreshIcon, Send as SendIcon } from '@mui/icons-material';
import { SettingsScreen } from './SettingsFrame';
import { StatusChip } from '../../components/ui';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { emailStatusApi, problemOf, type EmailStatus } from './emailStatusApi';
import {
  DNS_CHECKLIST, GUIDE_URL, OLD_SERVER_TEXT, lastSuccessText, providerName, testProblemText, validAddress,
} from './emailStatusModel';

const card = { border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', p: 3 } as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography component="div" sx={[TYPE.label, { mb: 0.5 }]}>{label}</Typography>
      <Typography component="div" sx={TYPE.itemName}>{value}</Typography>
    </Box>
  );
}

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [oldServer, setOldServer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setOldServer(false);
    setStatus(null);
    try {
      setStatus(await emailStatusApi.status());
    } catch (error) {
      const problem = problemOf(error);
      if (problem.status === 404) setOldServer(true);
      else if (problem.status === 403) setLoadError('Stav e-mailu smí zobrazit jen ten, kdo spravuje nastavení ordinace.');
      else setLoadError('Stav e-mailu se nepodařilo načíst.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addressOk = validAddress(address);

  const send = async () => {
    if (!addressOk || sending) return;
    setSending(true);
    setResult(null);
    try {
      await emailStatusApi.sendTest(address.trim());
      setResult({ ok: true, text: 'Zkušební e-mail byl předán poskytovateli. Za chvíli ho hledejte ve schránce (i ve spamu).' });
    } catch (error) {
      setResult({ ok: false, text: testProblemText(problemOf(error)) });
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    if (sending) return;
    setOpen(false);
    setResult(null);
  };

  const aside = (
    <Stack spacing={1}>
      <Typography sx={TYPE.itemName}>Co je potřeba nastavit</Typography>
      <Box component="ul" aria-label="Kontrolní seznam DNS" sx={{ m: 0, pl: 2.5 }}>
        {DNS_CHECKLIST.map((line) => (
          <Typography component="li" key={line} sx={TYPE.caption}>{line}</Typography>
        ))}
      </Box>
      <Link href={GUIDE_URL} target="_blank" rel="noopener noreferrer" sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
        Postup krok za krokem (EMAIL-SETUP)
      </Link>
    </Stack>
  );

  return (
    <SettingsScreen
      title="E-mail"
      subtitle="Odkud ordinace posílá e-maily a jestli to funguje. Klíč poskytovatele je jen na serveru a tady se nikdy nezobrazuje."
      aside={aside}
      asideTitle="DNS pro vaši doménu"
    >
      {loadError !== null ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => { void load(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}
        >
          {loadError}
        </Alert>
      ) : oldServer ? (
        <Alert severity="info">{OLD_SERVER_TEXT}</Alert>
      ) : status === null ? (
        <Box aria-busy="true" aria-label="Načítám stav e-mailu">
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
        </Box>
      ) : (
        <Box component="section" aria-label="Stav e-mailu" sx={card}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Typography component="h2" sx={TYPE.sectionTitle}>Odesílání</Typography>
            <StatusChip tone={status.configured ? 'green' : 'beige'}>{status.configured ? 'Nastaveno' : 'Nenastaveno'}</StatusChip>
          </Stack>

          {!status.configured && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              E-maily se zatím neodesílají. Zprávy čekají ve frontě a odejdou, jakmile bude odesílání nastaveno.
            </Alert>
          )}

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <Fact label="Poskytovatel" value={providerName(status.provider)} />
            <Fact label="Odesílatel" value={status.fromAddress ?? 'není nastaven'} />
            <Fact label="Poslední úspěšné odeslání" value={lastSuccessText(status.lastSuccessUtc)} />
            <Fact label="Ve frontě" value={String(status.pending)} />
            <Fact label="Odesláno za 24 hodin" value={String(status.sentLast24Hours)} />
            <Fact label="Selhalo za 24 hodin" value={String(status.failedLast24Hours)} />
          </Box>

          <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => { setOpen(true); setResult(null); }}
              sx={{ minHeight: 44 }}
            >
              Poslat zkušební e-mail
            </Button>
            <Button startIcon={<RefreshIcon />} onClick={() => { void load(); }} sx={{ minHeight: 44 }}>
              Obnovit
            </Button>
          </Stack>
        </Box>
      )}

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="email-test-title">
        <DialogTitle id="email-test-title">Poslat zkušební e-mail</DialogTitle>
        <DialogContent>
          <Typography sx={[TYPE.caption, { mb: 2 }]}>
            Odešle se jedna krátká zpráva bez jakýchkoli údajů o pacientech. Nejvýše třikrát za hodinu.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="email"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setResult(null); }}
            placeholder="jmeno@example.cz"
            error={address !== '' && !addressOk}
            helperText={address !== '' && !addressOk ? 'Zadejte platnou e-mailovou adresu.' : ' '}
            slotProps={{ htmlInput: { 'aria-label': 'E-mailová adresa příjemce', inputMode: 'email', autoComplete: 'off' } }}
          />
          {result !== null && (
            <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 1 }}>{result.text}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={sending} sx={{ minHeight: 44 }}>Zavřít</Button>
          <Button
            variant="contained"
            onClick={() => { void send(); }}
            disabled={!addressOk || sending}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{ minHeight: 44 }}
          >
            Odeslat
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsScreen>
  );
}
