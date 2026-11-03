/*
 * "Fakturovat" for the club's one order: one day, one month, or everything remaining. The chosen part is sent to the
 * server's draft as a subset (`orderIds` / `month`); the dialog shows its lines and total and only then creates the
 * invoice for exactly that subset. The server owns every number.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { CreatedInvoice } from '../../../api/clubOrders';
import type { CombinedOrder } from '../../../api/clubOneOrder';
import { useIsPhone } from '../../../layout/useDevice';
import { formatCzk } from '../../../pages/clubs/clubOrders';
import { invalidateClubWorld } from '../clubWorld';
import { dayWhen, invoiceableDays, invoiceableMonths, invoiceSubset, monthLabel, scopeReady } from './oneOrderModel';
import type { InvoiceScope } from './oneOrderModel';

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message.trim() !== '' ? e.message : fallback);

export function OneOrderInvoiceDialog({ combined, onClose, onChanged }: {
  combined: CombinedOrder;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const days = invoiceableDays(combined);
  const months = invoiceableMonths(combined);
  const [scope, setScope] = useState<InvoiceScope>('rest');
  const [orderId, setOrderId] = useState('');
  const [month, setMonth] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = { orderId, month };
  const ready = scopeReady(scope, pick);
  const subset = invoiceSubset(scope, pick);

  const draftQuery = useQuery({
    queryKey: ['club-order-invoice-draft', combined.rootId, scope, scope === 'day' ? orderId : '', scope === 'month' ? month : ''],
    queryFn: () => clubOrdersApi.invoiceDraft(combined.rootId, subset),
    enabled: ready && created === null,
    retry: false,
  });
  const draft = draftQuery.data;
  const hasLines = draft !== undefined && draft.lines.length > 0;

  const create = async () => {
    if (!hasLines) return;
    setCreating(true);
    setError(null);
    try {
      const invoice = await clubOrdersApi.createInvoice(combined.rootId, subset);
      setCreated(invoice);
      toast.success(invoice.created ? `Faktura ${invoice.invoiceNumber} je vystavena` : `Faktura ${invoice.invoiceNumber} už byla vystavena dříve`);
      void invalidateClubWorld(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['club-order-combined'] });
      onChanged?.();
    } catch (e) {
      setError(messageOf(e, 'Fakturu se nepodařilo vystavit.'));
    } finally {
      setCreating(false);
    }
  };

  const picker = scope === 'day' ? (
    <TextField select size="small" label="Den" value={orderId} onChange={(e) => setOrderId(e.target.value)} fullWidth data-testid="invoice-day-pick" sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}>
      {days.map((d) => <MenuItem key={d.orderId} value={d.orderId}>{`${dayWhen(d)} · ${d.serviceName}`}</MenuItem>)}
    </TextField>
  ) : scope === 'month' ? (
    <TextField select size="small" label="Měsíc" value={month} onChange={(e) => setMonth(e.target.value)} fullWidth data-testid="invoice-month-pick" sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}>
      {months.map((m) => <MenuItem key={m} value={m}>{monthLabel(m)}</MenuItem>)}
    </TextField>
  ) : null;

  const content = () => {
    if (created !== null) {
      return (
        <Stack spacing={1.5} data-testid="invoice-created">
          <Alert severity="success">Faktura je vystavena.</Alert>
          <Typography>Číslo faktury: <strong data-testid="invoice-number">{created.invoiceNumber}</strong></Typography>
          <Typography>Částka: <strong>{formatCzk(created.totalCzk)}</strong></Typography>
          <Button variant="contained" sx={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => { onClose(); navigate('/billing', { state: { invoiceId: created.invoiceId } }); }}>
            Otevřít ve Fakturaci
          </Button>
        </Stack>
      );
    }
    if (days.length === 0) return <Alert severity="info" data-testid="invoice-nothing">Všechno je už vyfakturované.</Alert>;
    return (
      <Stack spacing={1.5}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={scope}
          onChange={(_, next: InvoiceScope | null) => { if (next !== null) { setScope(next); setError(null); } }}
          aria-label="Co fakturovat"
        >
          <ToggleButton value="day" data-testid="invoice-scope-day" sx={{ minHeight: 44 }}>Jeden den</ToggleButton>
          <ToggleButton value="month" data-testid="invoice-scope-month" sx={{ minHeight: 44 }}>Měsíc</ToggleButton>
          <ToggleButton value="rest" data-testid="invoice-scope-rest" sx={{ minHeight: 44 }}>Vše zbývající</ToggleButton>
        </ToggleButtonGroup>
        {picker}
        {!ready ? (
          <Typography variant="body2" color="text.secondary">{scope === 'day' ? 'Vyberte den, který se má fakturovat.' : 'Vyberte měsíc, který se má fakturovat.'}</Typography>
        ) : draftQuery.isPending ? (
          <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>
        ) : draftQuery.isError || draft === undefined ? (
          <Alert severity="error" data-testid="invoice-draft-error">{messageOf(draftQuery.error, 'Podklad faktury se nepodařilo načíst.')}</Alert>
        ) : !hasLines ? (
          <Alert severity="info" data-testid="invoice-nothing">V tomto výběru není nic k fakturaci.</Alert>
        ) : (
          <Stack spacing={1} data-testid="invoice-draft">
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Řádky faktury">
                <TableHead>
                  <TableRow>
                    <TableCell>Služba / činnost</TableCell>
                    <TableCell align="right">Počet</TableCell>
                    <TableCell align="right">Celkem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {draft.lines.map((l, i) => (
                    <TableRow key={`${l.orderId}-${i}`} data-testid="invoice-line">
                      <TableCell>{l.serviceName !== '' ? `${l.serviceName} — ` : ''}{l.activityName}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right">{formatCzk(l.totalCzk)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700 }}>Celkem na faktuře</Typography>
              <Typography sx={{ fontWeight: 700 }} data-testid="invoice-draft-total">{formatCzk(draft.totalCzk)}</Typography>
            </Stack>
            {draft.note !== '' ? <Typography variant="body2" color="text.secondary">{draft.note}</Typography> : null}
          </Stack>
        )}
        {error !== null ? <Alert severity="error" data-testid="invoice-error">{error}</Alert> : null}
      </Stack>
    );
  };

  return (
    <Dialog open onClose={creating ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone} aria-labelledby="one-invoice-title">
      <DialogTitle id="one-invoice-title">Fakturovat</DialogTitle>
      <DialogContent dividers>{content()}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={creating} sx={{ minHeight: 44 }}>Zavřít</Button>
        {created === null && hasLines ? (
          <Button variant="contained" onClick={() => void create()} disabled={creating} data-testid="invoice-create" sx={{ minHeight: 44 }}>Vystavit fakturu</Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export default OneOrderInvoiceDialog;
