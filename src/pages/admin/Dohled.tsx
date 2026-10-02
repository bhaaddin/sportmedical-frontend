import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
} from '@mui/material';
import { Refresh, Download } from '@mui/icons-material';
import client from '../../api/client';
import toast from 'react-hot-toast';

const TEAL = '#0D7377';

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v === null || v === undefined ? '—' : String(v));
const asArray = (d: unknown): Row[] => {
  if (Array.isArray(d)) return d as Row[];
  if (d && typeof d === 'object') {
    const o = d as Row;
    for (const k of ['items', 'errors', 'rows', 'data', 'entries']) {
      if (Array.isArray(o[k])) return o[k] as Row[];
    }
  }
  return [];
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function GenericTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <Alert severity="info">Žádná data.</Alert>;
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {})))).slice(0, 6);
  if (cols.length === 0) {
    return <Alert severity="info">{rows.map((r) => JSON.stringify(r)).join('; ')}</Alert>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead><TableRow>{cols.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => {
                const v = r[c];
                return <TableCell key={c}>{typeof v === 'object' && v !== null ? JSON.stringify(v) : str(v)}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Dohled() {
  const [health, setHealth] = useState<Row | null>(null);
  const [healthLoaded, setHealthLoaded] = useState(false);

  const [errors, setErrors] = useState<Row[]>([]);
  const [errorsLoaded, setErrorsLoaded] = useState(false);

  const [fUser, setFUser] = useState('');
  const [fAction, setFAction] = useState('');
  const [fEntity, setFEntity] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [audit, setAudit] = useState<Row[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [sensitive, setSensitive] = useState<Row[]>([]);
  const [sensLoaded, setSensLoaded] = useState(false);

  const [ruian, setRuian] = useState<Row | null>(null);
  const [ruianLoaded, setRuianLoaded] = useState(false);
  const [csv, setCsv] = useState('');
  const [dry, setDry] = useState<Row | null>(null);

  const loadHealth = async () => {
    try {
      const res = await client.get('/api/system/health');
      const d = res.data;
      setHealth(d && typeof d === 'object' && !Array.isArray(d) ? (d as Row) : { data: JSON.stringify(d) });
      setHealthLoaded(true);
    } catch { toast.error('Stav systému se nepodařilo načíst'); setHealth(null); setHealthLoaded(true); }
  };

  const loadErrors = async () => {
    try {
      const res = await client.get('/api/system/errors?take=50');
      setErrors(asArray(res.data));
      setErrorsLoaded(true);
    } catch { toast.error('Načtení chyb selhalo'); setErrors([]); setErrorsLoaded(true); }
  };

  const downloadBackup = async () => {
    try {
      const res = await client.post('/api/system/backup', {}, { responseType: 'blob' });
      downloadBlob(res.data as Blob, 'sportmedical-backup.db');
      toast.success('Záloha stažena');
    } catch { toast.error('Stažení zálohy selhalo'); }
  };

  const searchAudit = async () => {
    try {
      const p = new URLSearchParams();
      if (fUser) p.set('user', fUser);
      if (fAction) p.set('action', fAction);
      if (fEntity) p.set('entity', fEntity);
      if (fFrom) p.set('from', fFrom);
      if (fTo) p.set('to', fTo);
      if (fSearch) p.set('search', fSearch);
      const res = await client.get(`/api/audit/search?${p.toString()}`);
      setAudit(asArray(res.data));
      setAuditLoaded(true);
    } catch { toast.error('Vyhledávání v auditu selhalo'); setAudit([]); setAuditLoaded(true); }
  };

  const exportAuditCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (fFrom) p.set('from', fFrom);
      if (fTo) p.set('to', fTo);
      p.set('format', 'csv');
      const res = await client.get(`/api/audit/export?${p.toString()}`, { responseType: 'blob' });
      downloadBlob(res.data as Blob, 'audit-export.csv');
      toast.success('Audit exportován');
    } catch { toast.error('Export auditu selhal'); }
  };

  const loadSensitive = async () => {
    try {
      const res = await client.get('/api/audit/sensitive-access');
      setSensitive(asArray(res.data));
      setSensLoaded(true);
    } catch { toast.error('Načtení citlivých přístupů selhalo'); setSensitive([]); setSensLoaded(true); }
  };

  const exportPatients = async () => {
    try {
      const res = await client.post('/api/admin/data/patients/export', {}, { responseType: 'blob' });
      downloadBlob(res.data as Blob, 'pacienti-export.csv');
      toast.success('Export pacientů stažen');
    } catch { toast.error('Export pacientů selhal'); }
  };

  const loadRuian = async () => {
    try {
      const res = await client.get('/api/admin/data/ruian/status');
      const d = res.data;
      setRuian(d && typeof d === 'object' && !Array.isArray(d) ? (d as Row) : { data: JSON.stringify(d) });
      setRuianLoaded(true);
    } catch { toast.error('Stav RÚIAN se nepodařilo načíst'); setRuian(null); setRuianLoaded(true); }
  };

  const dryRun = async () => {
    if (!csv.trim()) { toast.error('Vložte CSV text'); return; }
    try {
      const res = await client.post('/api/admin/data/patients/import/dry-run', { csv });
      const d = res.data;
      setDry(d && typeof d === 'object' && !Array.isArray(d) ? (d as Row) : { data: d });
    } catch { toast.error('Dry-run importu selhal'); setDry(null); }
  };

  const dryErrors: Row[] = dry && Array.isArray((dry as Row).errors) ? ((dry as Row).errors as Row[]) : [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: TEAL, fontWeight: 700 }}>Dohled</Typography>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Stav systému</Typography>
          <Button variant="contained" startIcon={<Refresh />} sx={{ bgcolor: TEAL, mb: 2 }} onClick={loadHealth}>Načíst stav</Button>
          {!healthLoaded && <Alert severity="info">Stav zatím nenačten.</Alert>}
          {healthLoaded && !health && <Alert severity="warning">Systém nedostupný.</Alert>}
          {health && (
            <Grid container spacing={2}>
              {[
                ['Verze', str(health.version)],
                ['Doba běhu', str(health.uptime ?? health.uptimeSeconds)],
                ['Latence DB (ms)', str(health.dbLatencyMs ?? health.dbLatency)],
                ['Aktivní relace', str(health.activeSessions)],
                ['Čas', str(health.timestamp ?? health.time)],
              ].map(([label, val]) => (
                <Grid key={label} size={{ xs: 12, md: 4 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent><Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="h6">{val}</Typography></CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Chyby</Typography>
          <Button variant="contained" startIcon={<Refresh />} sx={{ bgcolor: TEAL, mb: 2 }} onClick={loadErrors}>Načíst chyby</Button>
          {!errorsLoaded && <Alert severity="info">Chyby zatím nenačteny.</Alert>}
          {errorsLoaded && <GenericTable rows={errors} />}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Záloha databáze</Typography>
          <Button variant="contained" startIcon={<Download />} sx={{ bgcolor: TEAL }} onClick={downloadBackup}>Stáhnout zálohu</Button>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Audit</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Uživatel" value={fUser} onChange={(e) => setFUser(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Akce" value={fAction} onChange={(e) => setFAction(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Entita" value={fEntity} onChange={(e) => setFEntity(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="date" label="Od" slotProps={{ inputLabel: { shrink: true } }} value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="date" label="Do" slotProps={{ inputLabel: { shrink: true } }} value={fTo} onChange={(e) => setFTo(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Hledaný text" value={fSearch} onChange={(e) => setFSearch(e.target.value)} /></Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Refresh />} sx={{ bgcolor: TEAL }} onClick={searchAudit}>Hledat v auditu</Button>
            <Button variant="outlined" startIcon={<Download />} onClick={exportAuditCsv}>Export CSV</Button>
          </Box>
          {!auditLoaded && <Alert severity="info">Audit zatím nevyhledán.</Alert>}
          {auditLoaded && <GenericTable rows={audit} />}
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Citlivé přístupy</Typography>
          <Button variant="outlined" sx={{ mb: 2 }} onClick={loadSensitive}>Načíst citlivé přístupy</Button>
          {!sensLoaded && <Alert severity="info">Citlivé přístupy zatím nenačteny.</Alert>}
          {sensLoaded && <GenericTable rows={sensitive} />}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Data pacientů</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Download />} sx={{ bgcolor: TEAL }} onClick={exportPatients}>Export CSV</Button>
            <Button variant="outlined" onClick={loadRuian}>RÚIAN stav</Button>
          </Box>
          {ruianLoaded && !ruian && <Alert severity="warning">Dataset není nahrán.</Alert>}
          {ruian && (
            Object.keys(ruian).length === 0
              ? <Alert severity="warning">Dataset není nahrán.</Alert>
              : <Alert severity={ruian.loaded === false ? 'warning' : 'success'}>
                {ruian.loaded === false ? 'Dataset není nahrán. ' : ''}
                Verze: {str(ruian.version)} | Záznamů: {str(ruian.count ?? ruian.records)}
              </Alert>
          )}
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>Import dry-run</Typography>
          <TextField fullWidth multiline minRows={4} label="CSV text" value={csv} onChange={(e) => setCsv(e.target.value)} sx={{ mb: 1 }} />
          <Button variant="contained" sx={{ bgcolor: TEAL, mb: 2 }} onClick={dryRun}>Spustit dry-run</Button>
          {dry && (
            <Box>
              <Alert severity="info">
                Platné: {str(dry.valid ?? dry.validCount)} | Neplatné: {str(dry.invalid ?? dry.invalidCount)}
              </Alert>
              {dryErrors.length > 0 && (
                <Box sx={{ mt: 1 }}><GenericTable rows={dryErrors} /></Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
