import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Chip,
} from '@mui/material';
import { Refresh, Security, KeyOff } from '@mui/icons-material';
import client from '../../api/client';
import toast from 'react-hot-toast';

const TEAL = '#0D7377';

interface Role { name?: string; description?: string; descriptionCs?: string; [k: string]: unknown }
interface Session { id?: string; email?: string; userEmail?: string; createdAt?: string; expiresAt?: string; [k: string]: unknown }

const ROLE_CS: Record<string, string> = {
  Admin: 'Administrátor – plný přístup',
  Doctor: 'Lékař – zdravotnická dokumentace',
  Nurse: 'Sestra – ošetřovatelská péče',
  Receptionist: 'Recepce – objednávky a pokladna',
  Cashier: 'Pokladní – platby',
  User: 'Uživatel – základní přístup',
};

export default function Zabezpeceni() {
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [rolesBusy, setRolesBusy] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionsBusy, setSessionsBusy] = useState(false);

  const setup2fa = async () => {
    setBusy(true);
    try {
      const res = await client.post('/api/v1/account/2fa/setup');
      const d = res.data ?? {};
      setQrUri(String(d.qrUri ?? d.qrCodeUri ?? d.uri ?? ''));
      setSecret(String(d.secret ?? d.manualEntryKey ?? d.manualCode ?? ''));
      setRecoveryCodes([]);
      toast.success('QR vygenerováno – načtěte do aplikace');
    } catch {
      toast.error('Generování QR selhalo (backend nedostupný?)');
    } finally {
      setBusy(false);
    }
  };

  const verify2fa = async () => {
    if (!/^\d{6}$/.test(verifyCode.trim())) { toast.error('Zadejte 6místný kód'); return; }
    setBusy(true);
    try {
      const res = await client.post('/api/v1/account/2fa/verify', { code: verifyCode.trim() });
      const d = res.data ?? {};
      const codes: string[] = d.recoveryCodes ?? d.codes ?? [];
      setRecoveryCodes(Array.isArray(codes) ? codes.map(String) : []);
      toast.success('2FA zapnuto');
    } catch {
      toast.error('Ověření selhalo');
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    if (!/^\d{6}$/.test(disableCode.trim())) { toast.error('Zadejte 6místný kód'); return; }
    setBusy(true);
    try {
      await client.post('/api/v1/account/2fa/disable', { code: disableCode.trim() });
      toast.success('2FA vypnuto');
      setQrUri(''); setSecret(''); setRecoveryCodes([]);
      setVerifyCode(''); setDisableCode('');
    } catch {
      toast.error('Vypnutí 2FA selhalo');
    } finally {
      setBusy(false);
    }
  };

  const loadRoles = async () => {
    setRolesBusy(true);
    try {
      const res = await client.get('/api/v1/roles');
      const d = res.data;
      setRoles(Array.isArray(d) ? d : (d?.items ?? d?.roles ?? []));
      setRolesLoaded(true);
    } catch {
      toast.error('Načtení rolí selhalo');
      setRoles([]); setRolesLoaded(true);
    } finally {
      setRolesBusy(false);
    }
  };

  const loadSessions = async () => {
    setSessionsBusy(true);
    try {
      const res = await client.get('/api/system/sessions');
      const d = res.data;
      setSessions(Array.isArray(d) ? d : (d?.items ?? d?.sessions ?? []));
      setSessionsLoaded(true);
    } catch {
      toast.error('Načtení relací selhalo');
      setSessions([]); setSessionsLoaded(true);
    } finally {
      setSessionsBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await client.post(`/api/system/sessions/${id}/revoke`);
      toast.success('Relace odhlášena');
      loadSessions();
    } catch {
      toast.error('Odhlášení selhalo');
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: TEAL, fontWeight: 700 }}>
        Zabezpečení
      </Typography>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom><Security fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />Dvoufaktorové ověření (TOTP)</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Button variant="contained" sx={{ bgcolor: TEAL }} onClick={setup2fa} disabled={busy}>Vygenerovat QR</Button>
          </Box>
          {qrUri && (
            <Box sx={{ mb: 2 }}>
              <TextField fullWidth label="QR URI (vložte do authenticator aplikace)" value={qrUri} slotProps={{ input: { readOnly: true } }} sx={{ mb: 1 }} />
              {secret && <TextField fullWidth label="Tajný kód" value={secret} slotProps={{ input: { readOnly: true } }} sx={{ mb: 1 }} />}
              <Alert severity="info">Načtěte QR URI do aplikace (Google/Microsoft Authenticator) pomocí tajného kódu.</Alert>
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="6místný kód (zapnutí)" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }} />
              <Button variant="outlined" sx={{ mt: 1 }} onClick={verify2fa} disabled={busy}>Ověřit a zapnout</Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="6místný kód (vypnutí)" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }} />
              <Button variant="outlined" color="warning" startIcon={<KeyOff />} sx={{ mt: 1 }} onClick={disable2fa} disabled={busy}>Vypnout 2FA</Button>
            </Grid>
          </Grid>
          {recoveryCodes.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <strong>Uložte si záchranné kódy na bezpečné místo:</strong>
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>{recoveryCodes.map((c) => <li key={c}><code>{c}</code></li>)}</Box>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Role v systému</Typography>
          <Button variant="contained" startIcon={<Refresh />} sx={{ bgcolor: TEAL, mb: 2 }} onClick={loadRoles} disabled={rolesBusy}>Načíst role</Button>
          {!rolesLoaded && <Alert severity="info">Role zatím nenačteny.</Alert>}
          {rolesLoaded && roles.length === 0 && <Alert severity="info">Žádné role k zobrazení.</Alert>}
          {roles.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Název</TableCell><TableCell>Popis</TableCell></TableRow></TableHead>
                <TableBody>
                  {roles.map((r, i) => {
                    const name = String(r.name ?? `Role ${i + 1}`);
                    return (
                      <TableRow key={name + i}>
                        <TableCell><Chip label={name} size="small" /></TableCell>
                        <TableCell>{String(r.descriptionCs ?? r.description ?? ROLE_CS[name] ?? '—')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Aktivní relace</Typography>
          <Button variant="contained" startIcon={<Refresh />} sx={{ bgcolor: TEAL, mb: 2 }} onClick={loadSessions} disabled={sessionsBusy}>Načíst relace</Button>
          {!sessionsLoaded && <Alert severity="info">Relace zatím nenačteny.</Alert>}
          {sessionsLoaded && sessions.length === 0 && <Alert severity="info">Žádné aktivní relace.</Alert>}
          {sessions.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>E-mail</TableCell><TableCell>Vytvořeno</TableCell><TableCell>Vyprší</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {sessions.map((s, i) => (
                    <TableRow key={String(s.id ?? i)}>
                      <TableCell>{String(s.email ?? s.userEmail ?? '—')}</TableCell>
                      <TableCell>{String(s.createdAt ?? '—')}</TableCell>
                      <TableCell>{String(s.expiresAt ?? '—')}</TableCell>
                      <TableCell><Button size="small" color="warning" onClick={() => s.id && revoke(String(s.id))}>Odhlásit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
