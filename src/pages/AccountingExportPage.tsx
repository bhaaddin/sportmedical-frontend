import { useState } from 'react';
import {
  Box, Typography, Button, Grid, TextField, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Skeleton,
} from '@mui/material';
import toast from 'react-hot-toast';
import {
  useExportHistory, useExportAccounting, useDeleteExport, useExportFormats,
  accountingExportApi, exportCommandFrom, isExportFormatName, ExportType,
} from '../services/accountingExportApi';
import type { ExportForm, ExportResult } from '../services/accountingExportApi';
import { PageHeader, SectionLabel, SoftCard, DESIGN } from '../components/ui';

/* The three formats the API has an exporter for, used until it lists its own. */
const FALLBACK_FORMATS: ExportForm['format'][] = ['CSV', 'PohodaXml', 'MoneyS3Xml'];
const EXPORT_TYPES = Object.keys(ExportType) as ExportForm['type'][];

/* The enum names the API binds, in the accountant's words. The value sent
   stays the name (see exportCommandFrom); only the label changes. */
const FORMAT_LABELS: Record<ExportForm['format'], string> = {
  CSV: 'CSV',
  PohodaXml: 'Pohoda (XML)',
  MoneyS3Xml: 'Money S3 (XML)',
  IdokladXml: 'iDoklad (XML)',
};

const TYPE_LABELS: Record<ExportForm['type'], string> = {
  Invoices: 'Faktury',
  CreditNotes: 'Dobropisy',
  Payments: 'Platby',
  All: 'Vše',
};

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
      <PageHeader title="Účetní export" subtitle="Podklady pro účetní — faktury, dobropisy a platby za období" />

      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Nový export</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField select fullWidth label="Formát" value={form.format}
              onChange={e => setForm(f => ({ ...f, format: e.target.value as ExportForm['format'] }))}>
              {formatOptions.map((f) => (
                <MenuItem key={f} value={f}>{FORMAT_LABELS[f] ?? f}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField select fullWidth label="Typ" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as ExportForm['type'] }))}>
              {EXPORT_TYPES.map(t => (
                <MenuItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</MenuItem>
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
            <Button variant="contained" onClick={runExport} disabled={doExport.isPending} fullWidth>
              Exportovat
            </Button>
          </Grid>
        </Grid>
      </SoftCard>

      <SectionLabel>Historie</SectionLabel>
      {isLoading ? (
        <Skeleton variant="rounded" height={200} />
      ) : (
        <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Soubor</TableCell>
                <TableCell align="right">Záznamů</TableCell>
                <TableCell>Vytvořeno</TableCell>
                <TableCell align="right">Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h: ExportResult) => (
                <TableRow key={h.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{h.fileName}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{h.recordCount}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(h.exportedAt).toLocaleString('cs-CZ')}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="text" onClick={() => download(h.id, h.fileName)}>
                      Stáhnout
                    </Button>
                    <Button size="small" variant="text" sx={{ color: DESIGN.danger }} onClick={() => remove(h.id)}>
                      Smazat
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.secondary' }}>Zatím žádné exporty.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
