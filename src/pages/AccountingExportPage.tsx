import { useState } from 'react';
import {
  Box, Typography, Button, Grid, TextField, MenuItem, Stack,
} from '@mui/material';
import toast from 'react-hot-toast';
import {
  useExportHistory, useExportAccounting, useDeleteExport, useExportFormats,
  accountingExportApi, exportCommandFrom, isExportFormatName, ExportType,
} from '../services/accountingExportApi';
import type { ExportForm, ExportResult } from '../services/accountingExportApi';
import { PageHeader, SectionLabel, SoftCard, DESIGN } from '../components/ui';
import { FitBody, FitPage } from '../components/ui/fit';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';
import { ListSkeleton, LoadError } from './sports/LoadStates';
import { useTouchSx } from './sports/touch';
import { ExportGate } from '../components/ui/ExportGate';
import { download, isExportForbidden, EXPORT_FORBIDDEN_MESSAGE } from '../utils/download';

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

const madeAt = (h: ExportResult) => new Date(h.exportedAt).toLocaleString('cs-CZ');

export default function AccountingExportPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const device = useDevice();
  const touch = useTouchSx();
  const { data: history = [], isLoading, isError, refetch } = useExportHistory();
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
      await download(
        { kind: 'accounting', fileName: result.fileName || 'export', failureMessage: 'Stažení selhalo' },
        { kind: 'fetch', fetch: () => accountingExportApi.download(result.id) },
      );
      refetch();
    } catch (error) {
      toast.error((await isExportForbidden(error)) ? EXPORT_FORBIDDEN_MESSAGE : 'Export selhal');
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

  const saveExport = (id: string, name: string) =>
    download(
      { kind: 'accounting', fileName: name, failureMessage: 'Stažení selhalo' },
      { kind: 'fetch', fetch: () => accountingExportApi.download(id) },
    );

  const actions = (h: ExportResult) => (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
      <ExportGate>
        {(blocked) => (
          <Button size="small" variant="text" sx={touch} disabled={blocked} onClick={() => void saveExport(h.id, h.fileName)}>
            Stáhnout
          </Button>
        )}
      </ExportGate>
      <Button size="small" variant="text" sx={{ color: 'error.main', ...touch }} onClick={() => remove(h.id)}>
        Smazat
      </Button>
    </Stack>
  );

  /* Tablet: file, date and the two actions. Desktop adds the record count. */
  const columns: DataColumn<ExportResult>[] = [
    { key: 'file', header: 'Soubor', tablet: true, cell: (h) => <Box sx={{ fontWeight: 600 }}>{h.fileName}</Box> },
    {
      key: 'count', header: 'Záznamů', align: 'right',
      cell: (h) => <Box sx={{ fontVariantNumeric: 'tabular-nums' }}>{h.recordCount}</Box>,
    },
    { key: 'made', header: 'Vytvořeno', tablet: true, cell: (h) => <Box sx={{ whiteSpace: 'nowrap' }}>{madeAt(h)}</Box> },
    { key: 'actions', header: 'Akce', align: 'right', tablet: true, cell: actions },
  ];

  const exportButton = (
    <ExportGate>
      {(blocked) => (
        <Button variant="contained" onClick={runExport} disabled={blocked || doExport.isPending} fullWidth={device !== 'desktop'} sx={touch}>
          Exportovat
        </Button>
      )}
    </ExportGate>
  );

  return (
    <FitPage>
      <PageHeader title="Účetní export" subtitle="Podklady pro účetní — faktury, dobropisy a platby za období" />

      {/* From 1280 the form stands left and the history takes the rest of the width and height; below, they stack. */}
      <FitBody
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: device === 'phone' ? undefined : 'auto minmax(0, 1fr)',
          '@media (min-width: 1280px)': { gridTemplateColumns: 'clamp(300px, 28vw, 440px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
      <Box sx={{ minWidth: 0 }}>
      <SoftCard sx={{ mb: 0 }}>
        <SectionLabel>Nový export</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth label="Formát" value={form.format}
              onChange={e => setForm(f => ({ ...f, format: e.target.value as ExportForm['format'] }))}>
              {formatOptions.map((f) => (
                <MenuItem key={f} value={f}>{FORMAT_LABELS[f] ?? f}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth label="Typ" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as ExportForm['type'] }))}>
              {EXPORT_TYPES.map(t => (
                <MenuItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="date" label="Od" value={form.from}
              onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="date" label="Do" value={form.to}
              onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          {device === 'desktop' && (
            <Grid size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center' }}>
              {exportButton}
            </Grid>
          )}
        </Grid>
      </SoftCard>

      {/* Tablet: the button sits under the form; phone: pinned at the bottom. */}
      {device !== 'desktop' && <PinnedActionBar label="Exportovat">{exportButton}</PinnedActionBar>}
      </Box>

      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', ...(device === 'phone' ? {} : { minHeight: 0, height: '100%' }) }}>
        <Box sx={{ flexShrink: 0 }}><SectionLabel>Historie</SectionLabel></Box>
        {isLoading ? (
          <ListSkeleton rows={3} height={device === 'phone' ? 96 : 56} />
        ) : isError ? (
          <LoadError what="Historii exportů" onRetry={() => void refetch()} />
        ) : (
          <ResponsiveDataList
            ariaLabel="Historie exportů"
            rows={history}
            rowKey={(h: ExportResult) => h.id}
            columns={columns}
            empty="Zatím žádné exporty."
            fill
            renderCard={(h) => (
              <Stack spacing={1}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>{h.fileName}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {madeAt(h)} · {h.recordCount} záznamů
                </Typography>
                <Stack direction="row" spacing={1} sx={{ '& .MuiButton-root': { flex: 1 } }}>
                  <ExportGate>
                    {(blocked) => (
                      <Button variant="outlined" sx={{ minHeight: 44 }} disabled={blocked} onClick={() => void saveExport(h.id, h.fileName)}>
                        Stáhnout
                      </Button>
                    )}
                  </ExportGate>
                  <Button variant="outlined" color="error" sx={{ minHeight: 44 }} onClick={() => remove(h.id)}>
                    Smazat
                  </Button>
                </Stack>
              </Stack>
            )}
          />
        )}
      </Box>
      </FitBody>
    </FitPage>
  );
}
