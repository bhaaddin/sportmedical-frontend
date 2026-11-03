/*
 * The club's ONE order (the root's KO reference) as the staff reads it: open / closed, where it was split from, four
 * tiles, the list of days and the actions - Přidat den, Rozdělit, Fakturovat, Uzavřít / Znovu otevřít.
 * Shown only when the server has the combined view (`useCombinedOrder` gives null on a 404 and the panel then draws the
 * order as it always did). The server adds every number up; nothing is summed here.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCombined, closeOrder, reopenOrder } from '../../../api/clubOneOrder';
import type { CombinedDay, CombinedOrder } from '../../../api/clubOneOrder';
import { ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { formatPragueDateTime } from '../../../utils/time';
import { STATUS_TONE } from './orderLogic';
import { dayWhen, invoiceableDays } from './oneOrderModel';
import { SplitOrderDialog } from './SplitOrderDialog';

export const COMBINED_KEY = 'club-order-combined';
export const ONE_ORDER_SETTINGS_KEY = ['club-one-order-settings'] as const;

/** Draw the one-order block only for a real group (or a club in the mode): a lone order of a club outside the mode stays as it was. */
export const isOneOrder = (c: CombinedOrder | null | undefined): c is CombinedOrder =>
  c !== null && c !== undefined && (c.oneOrderMode || c.days.length > 1 || c.splitFrom !== null || c.splitInto.length > 0);

/** The combined view of an order; `data === null` = the server has none (404) and the feature stays hidden. */
export function useCombinedOrder(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: [COMBINED_KEY, orderId],
    queryFn: () => getCombined(orderId),
    enabled,
    retry: false,
    staleTime: 15_000,
  });
}

const Tile = ({ value, label, testId }: { value: string; label: string; testId: string }) => (
  <Box sx={{ minWidth: 0 }} data-testid={testId}>
    <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Box>
);

function DayRow({ day, onOpen, current }: { day: CombinedDay; onOpen: (id: string) => void; current: boolean }) {
  return (
    <Box
      component="li"
      data-testid="one-order-day"
      data-current={current ? 'true' : 'false'}
      sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'grid', gap: 0.25 }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, flex: '1 1 160px', minWidth: 0 }}>{dayWhen(day)}</Typography>
        <StatusChip tone={STATUS_TONE[day.status]} size="sm">{ORDER_STATUS_LABEL[day.status]}</StatusChip>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {`${day.serviceName || 'Služba nevybrána'} · ${day.registered} / ${day.seats} hráčů`}
      </Typography>
      <Typography variant="body2" data-testid="one-order-day-invoice">
        {day.invoiceId !== null ? `Faktura ${day.invoiceNumber ?? ''}`.trim() : 'Faktura: zatím ne'}
      </Typography>
      {day.note !== '' ? <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{day.note}</Typography> : null}
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">
          {`Přidáno ${day.createdAtUtc !== '' ? formatPragueDateTime(day.createdAtUtc) : ''}${day.createdByName !== null ? ` · ${day.createdByName}` : ''}`.trim()}
        </Typography>
        {!current ? <Button size="small" onClick={() => onOpen(day.orderId)} sx={{ minHeight: 44 }}>Otevřít {day.reference}</Button> : null}
      </Stack>
    </Box>
  );
}

export function OneOrderBlock({ combined, currentId, mayBill, perPerson, onOpen, onAddDay, onInvoice, onChanged }: {
  combined: CombinedOrder;
  /** The order the panel is showing (one of the days). */
  currentId: string;
  mayBill: boolean;
  perPerson: boolean;
  onOpen: (orderId: string) => void;
  onAddDay: () => void;
  onInvoice: () => void;
  onChanged: () => void;
}) {
  const phone = useIsPhone();
  const queryClient = useQueryClient();
  const [splitOpen, setSplitOpen] = useState(false);
  const [confirm, setConfirm] = useState<'close' | 'reopen' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = combined.closedAtUtc !== null;
  const canInvoice = mayBill && !perPerson && invoiceableDays(combined).length > 0;
  const { totals, clubTotal } = combined;
  const btn = { sx: { minHeight: 44, flex: phone ? '1 1 100%' : '0 1 auto' } } as const;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [COMBINED_KEY] });
    onChanged();
  };

  const run = async () => {
    if (confirm === null) return;
    setBusy(true);
    setError(null);
    try {
      if (confirm === 'close') await closeOrder(combined.rootId);
      else await reopenOrder(combined.rootId);
      setConfirm(null);
      refresh();
    } catch (e) {
      const m = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
      setError(typeof m === 'string' && m.trim() !== '' ? m : 'Změnu se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SoftCard sx={{ p: 2 }} data-testid="one-order" data-closed={closed ? 'true' : 'false'}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <SectionLabel>{`Objednávka ${combined.reference}`}</SectionLabel>
        <StatusChip tone={closed ? 'grey' : 'green'} size="sm" testId="one-order-state">{closed ? 'Uzavřená' : 'Otevřená'}</StatusChip>
      </Stack>

      {combined.splitFrom !== null || combined.splitInto.length > 0 ? (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 1 }} data-testid="one-order-links">
          {combined.splitFrom !== null ? (
            <>
              <Typography variant="body2" color="text.secondary">Rozděleno z</Typography>
              <Button size="small" onClick={() => onOpen(combined.splitFrom!.orderId)} sx={{ minHeight: 44 }}>{combined.splitFrom.reference}</Button>
            </>
          ) : null}
          {combined.splitInto.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary">Rozděleno do</Typography>
              {combined.splitInto.map((l) => (
                <Button key={l.orderId} size="small" onClick={() => onOpen(l.orderId)} sx={{ minHeight: 44 }}>{l.reference}</Button>
              ))}
            </>
          ) : null}
        </Stack>
      ) : null}

      <Box
        data-testid="one-order-tiles"
        sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, my: 1.5 }}
      >
        <Tile testId="tile-days" value={String(totals.orders)} label="dny" />
        <Tile testId="tile-seats" value={`${totals.registered} / ${totals.seats}`} label="registrováno / míst" />
        <Tile testId="tile-invoiced" value={`${totals.invoicedOrders} z ${totals.orders}`} label="vyfakturováno" />
        {clubTotal.parts > 1 ? <Tile testId="tile-club" value={`${clubTotal.registered} / ${clubTotal.seats}`} label={`celkem za klub (${clubTotal.parts} ${clubTotal.parts < 5 ? 'části' : 'částí'})`} /> : null}
      </Box>

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 1 }} data-testid="one-order-actions">
        {!closed ? <Button variant="contained" onClick={onAddDay} data-testid="one-order-add-day" {...btn}>Přidat den</Button> : null}
        {combined.days.length > 1 ? <Button variant="outlined" onClick={() => setSplitOpen(true)} data-testid="one-order-split" {...btn}>Rozdělit</Button> : null}
        {mayBill ? <Button variant="outlined" disabled={!canInvoice} onClick={onInvoice} data-testid="one-order-invoice" {...btn}>Fakturovat</Button> : null}
        <Button variant="outlined" onClick={() => setConfirm(closed ? 'reopen' : 'close')} data-testid="one-order-toggle" {...btn}>
          {closed ? 'Znovu otevřít' : 'Uzavřít objednávku'}
        </Button>
      </Stack>
      {mayBill && perPerson ? <Typography variant="caption" color="text.secondary">Skupina platí po osobách — jedna faktura klubu se nevystavuje.</Typography> : null}

      <Box component="ul" aria-label="Dny objednávky" sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="one-order-days">
        {combined.days.map((d) => <DayRow key={d.orderId} day={d} current={d.orderId === currentId} onOpen={onOpen} />)}
      </Box>

      {splitOpen ? (
        <SplitOrderDialog
          combined={combined}
          onClose={() => setSplitOpen(false)}
          onSplit={(newRootId) => { setSplitOpen(false); refresh(); if (newRootId !== null) onOpen(newRootId); }}
        />
      ) : null}

      {confirm !== null ? (
        <Dialog open onClose={busy ? undefined : () => setConfirm(null)} fullWidth maxWidth="xs" aria-labelledby="one-order-confirm-title">
          <DialogTitle id="one-order-confirm-title">{confirm === 'close' ? 'Uzavřít objednávku?' : 'Znovu otevřít objednávku?'}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {confirm === 'close'
                ? 'Nové dny klubu už se do ní nepřidají - začne nová objednávka. Dosavadní dny zůstanou beze změny.'
                : 'Nové dny klubu se budou zase přidávat do této objednávky.'}
            </DialogContentText>
            {error !== null ? <Alert severity="error" sx={{ mt: 1.5 }} data-testid="one-order-error">{error}</Alert> : null}
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setConfirm(null)} disabled={busy} sx={{ minHeight: 44 }}>Zrušit</Button>
            <Button variant="contained" onClick={() => void run()} disabled={busy} data-testid="one-order-confirm" sx={{ minHeight: 44 }}>
              {confirm === 'close' ? 'Uzavřít' : 'Znovu otevřít'}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </SoftCard>
  );
}

export default OneOrderBlock;
