/*
 * Účetní export - the accountant's files for a period: invoices, credit notes, payments.
 *
 * Built as shelves (docs/ui-shelf-system.md): "Nový export" (the period and the format, a board) says before anything is
 * made how many invoices were issued in that period (read off the invoice list Fakturace uses, by the issue date - a hint,
 * the server decides what the file holds), with a link to them on Fakturace; "Poslední exporty" is the history, a shelf
 * that takes the height that is left. From 1280 px the two stand side by side.
 */
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Grid, TextField, MenuItem, Stack,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useExportHistory, useExportAccounting, useDeleteExport, useExportFormats,
  accountingExportApi, exportCommandFrom, isExportFormatName, ExportType,
} from '../services/accountingExportApi';
import type { ExportForm, ExportResult } from '../services/accountingExportApi';
import { FitBody } from '../components/ui/fit';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';
import { useTouchSx } from './sports/touch';
import { billingApi } from '../api/billing';
import { PageFrame, Shelf, TARGET_SX } from '../ui/shelf';
import { PEEK_KEYS } from '../ui/shelf/peekKeys';
import { czk } from './billing/money';
import { doklady, issuedBetween } from './billing/invoiceView';
import { pragueDateKey } from '../utils/time';
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
  /* The clinic's days, not UTC ones: `toISOString` of local midnight on the 1st used to give the 30th/31st of the month before. */
  const today = pragueDateKey(new Date());
  const firstDay = `${today.slice(0, 8)}01`;
  const device = useDevice();
  const touch = useTouchSx();
  const { data: history = [], isLoading, isError, refetch } = useExportHistory();
  const { data: formats = [] } = useExportFormats();
  const doExport = useExportAccounting();
  const doDelete = useDeleteExport();
  const [form, setForm] = useState<ExportForm>({ format: 'CSV', type: 'Invoices', from: firstDay, to: today });
  const listed = formats.map((f) => f.name).filter(isExportFormatName);
  const formatOptions = listed.length > 0 ? listed : FALLBACK_FORMATS;

  /* What the period holds, before anything is exported: the invoice list Fakturace reads (same cache). */
  const invoicesQuery = useQuery({ queryKey: PEEK_KEYS.invoices, queryFn: () => billingApi.getInvoices(), staleTime: 60_000, retry: false });
  const inPeriod = useMemo(
    () => (invoicesQuery.data === undefined ? null : issuedBetween(invoicesQuery.data, form.from, form.to)),
    [invoicesQuery.data, form.from, form.to],
  );
  const asksInvoices = form.type === 'Invoices' || form.type === 'All';

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

  /* One sentence under the form: what the chosen period holds (invoices only; the other types have no list here). */
  const periodLine = !asksInvoices || invoicesQuery.isError ? null : inPeriod === null ? (
    invoicesQuery.isPending ? 'Zjišťuji, co období obsahuje…' : 'Zvolte platné období.'
  ) : inPeriod.count === 0 ? 'V tomto období nebyla vystavena žádná faktura.' : (
    `V období vystaveno ${doklady(inPeriod.count)} za ${czk(inPeriod.total)}.`
  );

  return (
    <PageFrame fit title="Účetní export" purpose="Podklady pro účetní — faktury, dobropisy a platby za období">
      {/* From 1280 the form stands left and the history takes the rest of the width and height; below, they stack. */}
      <FitBody
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: device === 'phone' ? undefined : 'auto minmax(0, 1fr)',
          '@media (min-width: 1280px)': { gridTemplateColumns: 'clamp(300px, 28vw, 440px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Shelf id="period" title="Nový export" layout="board">
            <Box sx={{ p: 2 }}>
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
                {periodLine !== null && (
                  <Grid size={{ xs: 12 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }} data-period-summary="">
                      <Typography variant="body2" sx={{ color: 'text.secondary', flex: '1 1 200px' }} aria-live="polite">{periodLine}</Typography>
                      {inPeriod !== null && inPeriod.count > 0 && (
                        <Button component={RouterLink} to="/billing" size="small" sx={TARGET_SX}>Faktury</Button>
                      )}
                    </Stack>
                  </Grid>
                )}
                {device === 'desktop' && (
                  <Grid size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    {exportButton}
                  </Grid>
                )}
              </Grid>
            </Box>
          </Shelf>

          {/* Tablet: the button sits under the form; phone: pinned at the bottom. */}
          {device !== 'desktop' && <PinnedActionBar label="Exportovat">{exportButton}</PinnedActionBar>}
        </Box>

        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', ...(device === 'phone' ? {} : { minHeight: 0, height: '100%' }) }}>
          <Shelf
            id="history"
            title="Poslední exporty"
            count={isLoading || isError ? undefined : history.length}
            layout="free"
            grow
            loading={isLoading}
            error={isError ? 'Historii exportů se nepodařilo načíst.' : false}
            onRetry={() => void refetch()}
          >
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
          </Shelf>
        </Box>
      </FitBody>
    </PageFrame>
  );
}
