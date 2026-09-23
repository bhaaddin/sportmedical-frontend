import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Skeleton, Alert,
} from '@mui/material';
import { Download, Delete, ReceiptLong } from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  useExportHistory, useExportAccounting, useDeleteExport, useExportFormats,
  accountingExportApi, exportCommandFrom, isExportFormatName, ExportType,
} from '../services/accountingExportApi';
import type { ExportForm } from '../services/accountingExportApi';

/* The three formats the API has an exporter for, used until it lists its own. */
const FALLBACK_FORMATS: ExportForm['format'][] = ['CSV', 'PohodaXml', 'MoneyS3Xml'];
const EXPORT_TYPES = Object.keys(ExportType) as ExportForm['type'][];

export default function AccountingExportPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const { data: history = [], isLoading, refetch } = useExportHistory();
  const { data: formats = [] } = useExportFormats();
  const doExport = useExportAccounting();
  const doDelete = useDeleteExport();
  const [form, setForm] = useState<ExportForm>({ format: 'CSV', type: 'Invoices', from: firstDay, to: today });
  const listed = formats.map((f) => f.name).filter(isExportFormatName);
  const formatOptions = listed.length > 0 ? listed : FALLBACK_FORMATS;

  const runExport = async () => {
    try {
      const result = await doExport.mutateAsync(exportCommandFrom(form));
      toast.success(`Export hotový (${result.recordCount} záznamů)`);
      const blob = await accountingExportApi.download(result.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName || 'export';
      a.click();
      URL.revokeObjectURL(url);
      refetch();
    } catch {
      toast.error('Export selhal');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Smazat export?')) return;
    try {
      await doDelete.mutateAsync(id);
      toast.success('Smazáno');
      refetch();
    } catch {
      toast.error('Mazání selhalo');
    }
  };

  const download = async (id: string, name: string) => {
    try {
      const blob = await accountingExportApi.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Stažení selhalo');
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptLong color="primary" /> Účetní export
      </Typography>

      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Nový export</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField select fullWidth label="Formát" value={form.format}
                onChange={e => setForm(f => ({ ...f, format: e.target.value as ExportForm['format'] }))}>
                {formatOptions.map((f) => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField select fullWidth label="Typ" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as ExportForm['type'] }))}>
                {EXPORT_TYPES.map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField fullWidth type="date" label="Od" value={form.from}
                onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField fullWidth type="date" label="Do" value={form.to}
                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button variant="contained" onClick={runExport} disabled={doExport.isPending}
                sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600, width: '100%' }}>
                Exportovat
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Historie</Typography>
          {isLoading ? (
            <Skeleton variant="rounded" height={200} />
          ) : history.length === 0 ? (
            <Alert severity="info">Zatím žádné exporty.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Soubor</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Záznamů</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Vytvořeno</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell sx={{ fontWeight: 500 }}>{h.fileName}</TableCell>
                      <TableCell>{h.recordCount}</TableCell>
                      <TableCell>{new Date(h.exportedAt).toLocaleString('cs-CZ')}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Stáhnout">
                          <IconButton size="small" onClick={() => download(h.id, h.fileName)}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Smazat">
                          <IconButton size="small" color="error" onClick={() => remove(h.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
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
