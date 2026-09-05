import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Stack, Chip,
} from '@mui/material';
import client from '../../api/client';
import toast from 'react-hot-toast';
import axios from 'axios';

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed';

interface OutboxRow {
  id?: string;
  to?: string;
  channel?: string;
  subject?: string;
  status?: string;
  attempts?: number;
  createdAt?: string;
  [key: string]: unknown;
}

function errMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { message?: string } | string | undefined;
    if (typeof d === 'string' && d) return d;
    if (d && typeof d === 'object' && d.message) return d.message;
    if (err.response?.status) return `Chyba ${err.response.status}`;
  }
  return 'Požadavek selhal';
}

const statusColor = (s?: string) =>
  s === 'sent' ? 'success' : s === 'failed' ? 'error' : 'warning';

export default function Oznameni() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [channel, setChannel] = useState('email');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadOutbox = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/api/notifications/outbox?status=${status}&take=50`);
      const payload = res.data as OutboxRow[] | { items?: OutboxRow[] };
      setRows(Array.isArray(payload) ? payload : (payload.items ?? []));
      setLoaded(true);
    } catch (err) {
      setRows([]);
      setLoaded(true);
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const res = await client.post('/api/notifications/outbox/process');
      const d = res.data as { sent?: number; failed?: number; pending?: number } | null;
      const parts: string[] = [];
      if (d && typeof d === 'object') {
        if (d.sent !== undefined) parts.push(`odesláno: ${d.sent}`);
        if (d.failed !== undefined) parts.push(`selhalo: ${d.failed}`);
        if (d.pending !== undefined) parts.push(`čeká: ${d.pending}`);
      }
      toast.success(parts.length > 0 ? `Fronta zpracována (${parts.join(', ')})` : 'Fronta zpracována');
      loadOutbox();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setProcessing(false);
    }
  };

  const enqueue = async () => {
    if (!to.trim() || !body.trim()) {
      toast.error('Vyplňte příjemce a text zprávy');
      return;
    }
    if (channel === 'email' && !subject.trim()) {
      toast.error('Vyplňte předmět e-mailu');
      return;
    }
    setSending(true);
    try {
      await client.post('/api/notifications/enqueue', {
        channel,
        to: to.trim(),
        subject: channel === 'email' ? subject.trim() : undefined,
        body: body.trim(),
      });
      toast.success('Zpráva zařazena do fronty');
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Oznámení</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Fronta zpráv</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField select label="Stav" size="small" value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)} sx={{ minWidth: 170 }}>
                  <MenuItem value="all">Vše</MenuItem>
                  <MenuItem value="pending">Čekající</MenuItem>
                  <MenuItem value="sent">Odeslané</MenuItem>
                  <MenuItem value="failed">Selhalo</MenuItem>
                </TextField>
                <Button variant="contained" onClick={loadOutbox} disabled={loading}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
                  {loading ? 'Načítám…' : 'Načíst frontu'}
                </Button>
                <Button variant="outlined" onClick={processQueue} disabled={processing}
                  sx={{ borderRadius: 2, fontWeight: 600 }}>
                  {processing ? 'Zpracovávám…' : 'Zpracovat frontu'}
                </Button>
              </Stack>
              {!loaded ? (
                <Alert severity="info">Zatím nenačteno.</Alert>
              ) : rows.length === 0 ? (
                <Alert severity="info">Fronta je prázdná.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Příjemce</TableCell>
                        <TableCell>Kanál</TableCell>
                        <TableCell>Předmět</TableCell>
                        <TableCell>Stav</TableCell>
                        <TableCell>Pokusy</TableCell>
                        <TableCell>Vytvořeno</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={String(r.id ?? i)}>
                          <TableCell>{r.to ?? '—'}</TableCell>
                          <TableCell>{r.channel ?? '—'}</TableCell>
                          <TableCell>{r.subject ?? '—'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.status ?? '—'} color={statusColor(r.status)} />
                          </TableCell>
                          <TableCell>{r.attempts ?? 0}</TableCell>
                          <TableCell>{r.createdAt ? new Date(r.createdAt).toLocaleString('cs-CZ') : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Nová zpráva</Typography>
              <Stack spacing={2}>
                <TextField select label="Kanál" size="small" value={channel}
                  onChange={(e) => setChannel(e.target.value)}>
                  <MenuItem value="email">E-mail</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                </TextField>
                <TextField label={channel === 'email' ? 'Komu (e-mail)' : 'Komu (telefon)'} size="small"
                  value={to} onChange={(e) => setTo(e.target.value)} />
                {channel === 'email' && (
                  <TextField label="Předmět" size="small" value={subject}
                    onChange={(e) => setSubject(e.target.value)} />
                )}
                <TextField label="Text zprávy" multiline rows={4} size="small" value={body}
                  onChange={(e) => setBody(e.target.value)} />
                <Button variant="contained" onClick={enqueue} disabled={sending}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
                  {sending ? 'Odesílám…' : 'Zařadit do fronty'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Šablony e-mailů</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pro hromadné a opakované zprávy použijte předpřipravené šablony.
              </Typography>
              <Button component={Link} to="/email-templates" variant="outlined" sx={{ borderRadius: 2, fontWeight: 600 }}>
                Otevřít šablony e-mailů
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
