/*
 * "Vystavit fakturu klubu": the draft of the next invoice of the club's group, and the button that makes it. The first
 * invoice covers every live order of the group. An addendum ("dodatek") added AFTER that is not on it: the draft then
 * lists only the orders no invoice covers yet and is a "Dodatečná faktura" - it names the invoices already issued and
 * says how it is priced (the group's current tier, over all its players, applied to the new lines only; the earlier
 * invoice is never changed). The server owns the numbers; this shows them first, creates on request, then shows the
 * invoice number with a link to Fakturace. Idempotent: asking again answers with the same invoice (HTTP 200,
 * `created: false`).
 *
 * Refusals are shown in the server's own words: 409 `club_order.invoice_per_person` (the group pays per person),
 * 409 `club_order.nothing_to_invoice` (nothing left to bill), 422 `club_order.invoice_not_quotable` / `invoice_nothing` /
 * `invoice_refused`.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { AlreadyInvoiced, CreatedInvoice } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { formatCzk } from '../../../pages/clubs/clubOrders';

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message.trim() !== '' ? e.message : fallback);

/** One entry per invoice (several orders share the first one), in the order they were listed. */
const distinctInvoices = (list: AlreadyInvoiced[]): AlreadyInvoiced[] => {
  const seen = new Set<string>();
  return list.filter((x) => {
    if (seen.has(x.invoiceId)) return false;
    seen.add(x.invoiceId);
    return true;
  });
};

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
  const supplementary = draft !== undefined && draft.supplementary && draft.lines.length > 0;
  const nothingLeft = draft !== undefined && draft.lines.length === 0;

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['club-order'] });
    void queryClient.invalidateQueries({ queryKey: ['club-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['club-billing'] });
    void queryClient.invalidateQueries({ queryKey: ['club-order-invoice-draft'] });
  };

  const create = async () => {
    if (draft === undefined || draft.lines.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      /* The id of an order that is being billed now: asking again then replays exactly this invoice. */
      const invoice = await clubOrdersApi.createInvoice(draft.lines[0].orderId);
      setCreated(invoice);
      const noun = invoice.supplementary ? 'Dodatečná faktura' : 'Faktura';
      toast.success(invoice.created ? `${noun} ${invoice.invoiceNumber} je vystavena` : `${noun} už byla vystavena dříve`);
      refreshAll();
      onChanged?.();
    } catch (e) {
      setError(messageOf(e, 'Fakturu se nepodařilo vystavit.'));
      void queryClient.invalidateQueries({ queryKey: ['club-order-invoice-draft'] });
    } finally {
      setCreating(false);
    }
  };

  const openInvoice = (invoiceId: string) => {
    onClose();
    navigate('/billing', { state: { invoiceId } });
  };

  const issuedList = (list: AlreadyInvoiced[]) => (
    <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="invoice-already">
      {distinctInvoices(list).map((x) => (
        <li key={x.invoiceId}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" data-testid="invoice-already-number"><strong>{x.invoiceNumber !== '' ? x.invoiceNumber : 'Faktura'}</strong></Typography>
            <Button size="small" onClick={() => openInvoice(x.invoiceId)} sx={{ minHeight: 36 }}>Otevřít</Button>
          </Stack>
        </li>
      ))}
    </Stack>
  );

  const content = () => {
    if (created !== null) {
      return (
        <Stack spacing={1.5} data-testid="invoice-created">
          <Alert severity="success">
            {created.supplementary
              ? (created.created ? 'Dodatečná faktura je vystavena.' : 'Dodatečná faktura už byla vystavena — zobrazuji ji.')
              : (created.created ? 'Faktura klubu je vystavena.' : 'Skupina už fakturu má — zobrazuji tu stávající.')}
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
    if (nothingLeft) {
      return (
        <Stack spacing={1.5} data-testid="invoice-exists">
          <Alert severity="info">Všechny objednávky skupiny už jsou vyfakturované.</Alert>
          {issuedList(draft.alreadyInvoiced)}
        </Stack>
      );
    }
    return (
      <Stack spacing={1.5} data-testid="invoice-draft">
        {supplementary ? (
          <Alert severity="info" data-testid="invoice-supplementary">
            <Stack spacing={0.75}>
              <Typography variant="body2">
                <strong>Dodatečná faktura.</strong> Skupina už fakturu má; tato faktura pokryje jen objednávky přidané po jejím vystavení. Dříve vystavená faktura se nemění.
              </Typography>
              <Typography variant="body2" data-testid="invoice-tier-note">
                Sleva se počítá podle aktuálního počtu hráčů celé skupiny ({draft.headcount}) a týká se jen nových položek.
              </Typography>
              <Typography variant="body2">Již vystaveno:</Typography>
              {issuedList(draft.alreadyInvoiced)}
            </Stack>
          </Alert>
        ) : null}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label={supplementary ? 'Řádky dodatečné faktury' : 'Řádky faktury'}>
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
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">{supplementary ? 'Ceníková cena nových položek' : `Ceníková cena (${draft.headcount} hráčů)`}</Typography>
            <Typography variant="body2">{formatCzk(draft.listTotalCzk)}</Typography>
          </Stack>
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
      <DialogTitle id="club-invoice-title">{supplementary ? 'Dodatečná faktura' : 'Jedna faktura klubu'}</DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={creating}>Zavřít</Button>
        {created === null && draft !== undefined && !nothingLeft ? (
          <Button variant="contained" onClick={() => void create()} disabled={creating}>{supplementary ? 'Vystavit dodatečnou fakturu' : 'Vystavit fakturu'}</Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export default ClubInvoiceDialog;
