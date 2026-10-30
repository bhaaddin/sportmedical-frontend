/*
 * "Odesílání": who the clinic's e-mail comes from and whether it works, in a few lines, plus one test message. Nothing is
 * edited here - the provider key and the sender live on the server and are never shown (the old E-mail screen, condensed).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, TextField, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Refresh, Send } from '@mui/icons-material';
import { StatusChip } from '../../../components/ui';
import { TARGET_SX } from '../../../ui/shelf';
import { emailStatusApi, problemOf, type EmailStatus } from '../emailStatusApi';
import { DNS_CHECKLIST, GUIDE_URL, OLD_SERVER_TEXT, lastSuccessText, providerName, testProblemText, validAddress } from '../emailStatusModel';

export function SendingStatus() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [oldServer, setOldServer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
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
  const close = () => { if (!sending) { setOpen(false); setResult(null); } };

  if (loadError !== null) {
    return <Alert severity="error" action={<Button color="inherit" onClick={() => { void load(); }} sx={TARGET_SX}>Zkusit znovu</Button>}>{loadError}</Alert>;
  }
  if (oldServer) return <Alert severity="info">{OLD_SERVER_TEXT}</Alert>;
  if (status === null) return <Typography variant="body2" sx={{ color: 'text.secondary' }} aria-busy="true">Načítám stav e-mailu…</Typography>;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusChip tone={status.configured ? 'green' : 'beige'}>{status.configured ? 'Nastaveno' : 'Nenastaveno'}</StatusChip>
        <Typography sx={{ fontWeight: 700 }}>{providerName(status.provider)}</Typography>
        <Typography sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{status.fromAddress ?? 'odesílatel není nastaven'}</Typography>
      </Stack>
      {!status.configured ? (
        <Alert severity="warning">E-maily se zatím neodesílají. Zprávy čekají ve frontě a odejdou, jakmile bude odesílání nastaveno.</Alert>
      ) : null}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Poslední úspěšné odeslání: {lastSuccessText(status.lastSuccessUtc)} · ve frontě {status.pending} · za 24 hodin odesláno {status.sentLast24Hours}, selhalo {status.failedLast24Hours}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button variant="outlined" startIcon={<Send />} onClick={() => { setOpen(true); setResult(null); }} sx={TARGET_SX}>Poslat zkušební e-mail</Button>
        <Button startIcon={<Refresh />} onClick={() => { void load(); }} sx={TARGET_SX}>Obnovit</Button>
        <Button component={RouterLink} to="/nastaveni/fronta-emailu" sx={TARGET_SX}>Fronta e-mailů</Button>
        <Button color="inherit" onClick={() => setHelp((v) => !v)} aria-expanded={help} sx={TARGET_SX}>Co je potřeba nastavit</Button>
      </Stack>
      <Collapse in={help} unmountOnExit>
        <Box component="ul" aria-label="Kontrolní seznam DNS" sx={{ m: 0, pl: 2.5 }}>
          {DNS_CHECKLIST.map((line) => <Typography component="li" key={line} variant="body2">{line}</Typography>)}
        </Box>
        <Link href={GUIDE_URL} target="_blank" rel="noopener noreferrer" sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          Postup krok za krokem
        </Link>
      </Collapse>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="email-test-title">
        <DialogTitle id="email-test-title">Poslat zkušební e-mail</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
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
          {result !== null ? <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 1 }}>{result.text}</Alert> : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={sending} sx={TARGET_SX}>Zavřít</Button>
          <Button
            variant="contained"
            onClick={() => { void send(); }}
            disabled={!addressOk || sending}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Send />}
            sx={TARGET_SX}
          >
            Odeslat
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
