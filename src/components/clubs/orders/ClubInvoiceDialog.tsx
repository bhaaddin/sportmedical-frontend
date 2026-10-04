/*
 * "Vystavit jednu fakturu klubu": the draft of the group's one invoice (every live order of the group, its
 * discounts, its total) and the button that makes it. The server owns the numbers; this shows them first, creates
 * on request, and then shows the invoice number with a link to Fakturace. Idempotent: asking again answers with the
 * same invoice (HTTP 200, `created: false`).
 *
 * Refusals are shown in the server's own words: 409 `club_order.invoice_per_person` (the group pays per person),
 * 422 `club_order.invoice_not_quotable` / `invoice_nothing` / `invoice_refused`.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { CreatedInvoice } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { formatCzk } from '../../../pages/clubs/clubOrders';

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message.trim() !== '' ? e.message : fallback);

export function ClubInvoiceDialog({ orderId, onClose, onChanged }: {
  orderId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftQuery = useQuery({
    queryKey: ['club-order-invoice-draft', orderId],
    queryFn: () => clubOrdersApi.invoiceDraft(orderId),
    retry: false,
  });
  const draft = draftQuery.data;

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const invoice = await clubOrdersApi.createInvoice(orderId);
      setCreated(invoice);
      toast.success(invoice.created ? `Faktura ${invoice.invoiceNumber} je vystavena` : 'Faktura už byla vystavena dříve');
      void queryClient.invalidateQueries({ queryKey: ['club-order'] });
      void queryClient.invalidateQueries({ queryKey: ['club-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['club-billing'] });
      onChanged?.();
    } catch (e) {
      setError(messageOf(e, 'Fakturu se nepodařilo vystavit.'));
    } finally {
      setCreating(false);
    }
  };

  const existingId = created?.invoiceId ?? draft?.invoiceId ?? null;
  const openInvoice = (invoiceId: string) => {
    onClose();
    navigate('/billing', { state: { invoiceId } });
  };

  const content = () => {
    if (created !== null) {
      return (
        <Stack spacing={1.5} data-testid="invoice-created">
          <Alert severity="success">
            {created.created ? 'Faktura klubu je vystavena.' : 'Skupina už fakturu má — zobrazuji tu stávající.'}
          </Alert>
          <Typography>Číslo faktury: <strong data-testid="invoice-number">{created.invoiceNumber}</strong></Typography>
          <Typography>Částka: <strong>{formatCzk(created.totalCzk)}</strong></Typography>
          <Button variant="contained" sx={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => openInvoice(created.invoiceId)}>Otevřít ve Fakturaci</Button>
        </Stack>
      );
    }
    if (draftQuery.isPending) return <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>;
    if (draftQuery.isError || draft === undefined) {
      return <Alert severity="error" data-testid="invoice-draft-error">{messageOf(draftQuery.error, 'Podklad faktury se nepodařilo načíst.')}</Alert>;
    }
    return (
      <Stack spacing={1.5} data-testid="invoice-draft">
        {existingId !== null ? (
          <Alert
            severity="info"
            data-testid="invoice-exists"
            action={<Button color="inherit" size="small" onClick={() => openInvoice(existingId)}>Otevřít</Button>}
          >
            Tato objednávka už má vystavenou fakturu. Dodatky přidané po vystavení na ni nepřibudou — vystavte je zvlášť ve Fakturaci.
          </Alert>
        ) : null}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Řádky faktury">
            <TableHead>
              <TableRow>
                <TableCell>Služba / činnost</TableCell>
                <TableCell align="right">Počet</TableCell>
                <TableCell align="right">Cena za kus</TableCell>
                <TableCell align="right">Celkem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {draft.lines.map((l, i) => (
                <TableRow key={`${l.orderId}-${i}`} data-testid="invoice-line">
                  <TableCell>{l.serviceName !== '' ? `${l.serviceName} — ` : ''}{l.activityName}</TableCell>
                  <TableCell align="right">{l.quantity}</TableCell>
                  <TableCell align="right">{formatCzk(l.unitPriceCzk)}</TableCell>
                  <TableCell align="right">{formatCzk(l.totalCzk)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Stack spacing={0.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2">Ceníková cena ({draft.headcount} hráčů)</Typography><Typography variant="body2">{formatCzk(draft.listTotalCzk)}</Typography></Stack>
          {draft.discounts.map((d, i) => (
            <Stack key={i} direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">{d.label}{d.percent > 0 ? ` (${d.percent} %)` : ''}</Typography>
              <Typography variant="body2" color="text.secondary">−{formatCzk(Math.abs(d.amountCzk))}</Typography>
            </Stack>
          ))}
          <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 0.5 }}>
            <Typography sx={{ fontWeight: 700 }}>Celkem na faktuře</Typography>
            <Typography sx={{ fontWeight: 700 }} data-testid="invoice-draft-total">{formatCzk(draft.totalCzk)}</Typography>
          </Stack>
        </Stack>
        {draft.note !== '' ? <Typography variant="body2" color="text.secondary">{draft.note}</Typography> : null}
        {error !== null ? <Alert severity="error" data-testid="invoice-error">{error}</Alert> : null}
      </Stack>
    );
  };

  return (
    <Dialog open onClose={creating ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone} aria-labelledby="club-invoice-title">
      <DialogTitle id="club-invoice-title">Jedna faktura klubu</DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={creating}>Zavřít</Button>
        {created === null && draft !== undefined && existingId === null ? (
          <Button variant="contained" onClick={() => void create()} disabled={creating}>Vystavit fakturu</Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export default ClubInvoiceDialog;
