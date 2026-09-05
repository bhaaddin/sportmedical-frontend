import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Stack, Chip,
} from '@mui/material';
import client from '../../api/client';
import toast from 'react-hot-toast';
import axios from 'axios';

const czk = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(n ?? 0);

const todayStr = () => new Date().toISOString().split('T')[0];
const monthStr = () => new Date().toISOString().slice(0, 7);

interface ClosingData {
  totalRevenue?: number;
  count?: number;
  byMethod?: { cash?: number; card?: number; transfer?: number; club?: number };
  [key: string]: unknown;
}

interface ClubRow {
  clubName?: string;
  memberCount?: number;
  transactionTotal?: number;
  [key: string]: unknown;
}

interface SeriesRow {
  documentType?: string;
  prefix?: string;
  year?: number;
  current?: number;
  nextPreview?: string | number;
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

export default function Provoz() {
  // 1. Denní uzávěrka
  const [closingDate, setClosingDate] = useState(todayStr());
  const [closing, setClosing] = useState<ClosingData | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);

  // 2. Zámek období
  const [lockDate, setLockDate] = useState(todayStr());
  const [lockLoading, setLockLoading] = useState(false);

  // 3. Klubová fakturace
  const [billMonth, setBillMonth] = useState(monthStr());
  const [billRows, setBillRows] = useState<ClubRow[]>([]);
  const [billLoaded, setBillLoaded] = useState(false);
  const [billLoading, setBillLoading] = useState(false);

  // 4. Číselné řady
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesLoaded, setSeriesLoaded] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [gaps, setGaps] = useState<Record<string, string>>({});
  const [gapLoading, setGapLoading] = useState<string | null>(null);

  const loadClosing = async () => {
    setClosingLoading(true);
    try {
      const res = await client.get(`/api/cashier/closing?date=${closingDate}`);
      setClosing(res.data as ClosingData);
    } catch (err) {
      setClosing(null);
      toast.error(errMsg(err));
    } finally {
      setClosingLoading(false);
    }
  };

  const lockPeriod = async () => {
    setLockLoading(true);
    try {
      await client.post('/api/cashier/closing/lock', { date: lockDate });
      toast.success('Období zamknuto');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLockLoading(false);
    }
  };

  const loadBilling = async () => {
    setBillLoading(true);
    try {
      const res = await client.get(`/api/cashier/club-billing/preview?month=${billMonth}`);
      const payload = res.data as ClubRow[] | { items?: ClubRow[] };
      setBillRows(Array.isArray(payload) ? payload : (payload.items ?? []));
      setBillLoaded(true);
    } catch (err) {
      setBillRows([]);
      setBillLoaded(true);
      toast.error(errMsg(err));
    } finally {
      setBillLoading(false);
    }
  };

  const loadSeries = async () => {
    setSeriesLoading(true);
    try {
      const res = await client.get('/api/number-series/overview');
      const payload = res.data as SeriesRow[] | { items?: SeriesRow[] };
      setSeries(Array.isArray(payload) ? payload : (payload.items ?? []));
      setSeriesLoaded(true);
    } catch (err) {
      setSeries([]);
      setSeriesLoaded(true);
      toast.error(errMsg(err));
    } finally {
      setSeriesLoading(false);
    }
  };

  const checkGaps = async (type: string) => {
    setGapLoading(type);
    try {
      const res = await client.get(`/api/number-series/gaps/${type}`);
      const d = res.data as { gaps?: (string | number)[] } | (string | number)[] | null;
      const list = Array.isArray(d) ? d : (d?.gaps ?? []);
      setGaps((p) => ({ ...p, [type]: list.length === 0 ? 'bez mezer' : `Mezery: ${list.join(', ')}` }));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setGapLoading(null);
    }
  };

  const correctCounter = async (type: string) => {
    const nextStr = window.prompt(`Nové číslo čítače pro "${type}":`);
    if (nextStr === null || nextStr.trim() === '') return;
    const nextNumber = Number(nextStr);
    if (!Number.isFinite(nextNumber)) {
      toast.error('Neplatné číslo');
      return;
    }
    const reason = window.prompt('Důvod opravy:') ?? '';
    if (reason === null) return;
    try {
      await client.post(`/api/number-series/correct/${type}`, { nextNumber, reason });
      toast.success('Čítač opraven');
      loadSeries();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Provoz</Typography>

      <Grid container spacing={2}>
        {/* 1. Denní uzávěrka */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Denní uzávěrka</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField type="date" label="Datum" size="small" value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)} sx={{ minWidth: 170 }} />
                <Button variant="contained" onClick={loadClosing} disabled={closingLoading}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
                  {closingLoading ? 'Načítám…' : 'Načíst uzávěrku'}
                </Button>
              </Stack>
              {closing ? (
                <Stack spacing={1}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{czk(closing.totalRevenue ?? 0)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Počet transakcí: {closing.count ?? 0}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`Hotovost: ${czk(closing.byMethod?.cash ?? 0)}`} />
                    <Chip label={`Karta: ${czk(closing.byMethod?.card ?? 0)}`} />
                    <Chip label={`Převod: ${czk(closing.byMethod?.transfer ?? 0)}`} />
                    <Chip label={`Klub: ${czk(closing.byMethod?.club ?? 0)}`} />
                  </Stack>
                </Stack>
              ) : (
                <Alert severity="info">Zatím nenačteno — vyberte datum a klikněte na tlačítko.</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Zámek období */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Zámek období</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <TextField type="date" label="Zamknout do data" size="small" value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)} sx={{ minWidth: 170 }} />
                <Button variant="outlined" onClick={lockPeriod} disabled={lockLoading}
                  sx={{ borderRadius: 2, fontWeight: 600 }}>
                  {lockLoading ? 'Zamykám…' : 'Zamknout do data'}
                </Button>
              </Stack>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Zamknuté období nelze zpětně měnit. Pokračujte opatrně.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Klubová fakturace */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Klubová fakturace</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField type="month" label="Měsíc" size="small" value={billMonth}
                  onChange={(e) => setBillMonth(e.target.value)} sx={{ minWidth: 170 }} />
                <Button variant="contained" onClick={loadBilling} disabled={billLoading}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
                  {billLoading ? 'Načítám…' : 'Načíst náhled'}
                </Button>
              </Stack>
              {!billLoaded ? (
                <Alert severity="info">Zatím nenačteno.</Alert>
              ) : billRows.length === 0 ? (
                <Alert severity="info">Žádná data pro daný měsíc.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Klub</TableCell>
                        <TableCell>Počet členů</TableCell>
                        <TableCell align="right">Celkem</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {billRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.clubName ?? '—'}</TableCell>
                          <TableCell>{r.memberCount ?? 0}</TableCell>
                          <TableCell align="right">{czk(r.transactionTotal ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Číselné řady */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Číselné řady</Typography>
              <Button variant="contained" onClick={loadSeries} disabled={seriesLoading}
                sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600, mb: 2 }}>
                {seriesLoading ? 'Načítám…' : 'Načíst'}
              </Button>
              {!seriesLoaded ? (
                <Alert severity="info">Zatím nenačteno.</Alert>
              ) : series.length === 0 ? (
                <Alert severity="info">Žádné číselné řady.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Typ dokladu</TableCell>
                        <TableCell>Prefix</TableCell>
                        <TableCell>Rok</TableCell>
                        <TableCell>Aktuální</TableCell>
                        <TableCell>Další náhled</TableCell>
                        <TableCell>Mezery</TableCell>
                        <TableCell align="right">Akce</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {series.map((s, i) => {
                        const t = String(s.documentType ?? i);
                        return (
                          <TableRow key={t + i}>
                            <TableCell>{s.documentType ?? '—'}</TableCell>
                            <TableCell>{s.prefix ?? '—'}</TableCell>
                            <TableCell>{s.year ?? '—'}</TableCell>
                            <TableCell>{s.current ?? 0}</TableCell>
                            <TableCell>{s.nextPreview ?? '—'}</TableCell>
                            <TableCell>{gaps[t] ?? '—'}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                <Button size="small" variant="outlined" sx={{ borderRadius: 2 }}
                                  disabled={gapLoading === t}
                                  onClick={() => checkGaps(t)}>
                                  Zkontrolovat mezery
                                </Button>
                                <Button size="small" variant="outlined" sx={{ borderRadius: 2 }}
                                  onClick={() => correctCounter(t)}>
                                  Opravit čítač
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
