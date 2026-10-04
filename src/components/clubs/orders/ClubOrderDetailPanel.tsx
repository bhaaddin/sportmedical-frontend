/*
 * The detail of one club order: summary, requested terms against the confirmed windows, činnosti with
 * registered/seats and price per line, the price quote, payment, the club person, the history - and the
 * actions that the status allows. Right drawer on desktop/tablet, full screen on a phone.
 *
 * It owns the dialogs it opens (process / edit through ClubOrderDialog, confirm cancel), so the orders page
 * and the club overview open it the same way.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControlLabel,
  IconButton, LinearProgress, Link, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clubOrdersApi, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { formatCzk } from '../../../pages/clubs/clubOrders';
import { formatPragueDateTime } from '../../../utils/time';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { ClubOrderDialog } from '../order/ClubOrderDialog';
import { copyText } from './LinkCopyRow';
import { absoluteLink, usePublicSiteBase } from './absoluteLink';
import { rangeText, seatPercent, STATUS_TONE } from './orderLogic';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SoftCard sx={{ p: 2 }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </SoftCard>
  );
}

export function ClubOrderDetailPanel({ orderId, initialOrder, onClose, onChanged }: {
  orderId: string;
  /** The row the list already holds: shown at once while the full order loads. */
  initialOrder?: ClubOrderView;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const phone = useIsPhone();
  const publicBase = usePublicSiteBase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'process' | 'edit' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelAthletes, setCancelAthletes] = useState(false);

  const query = useQuery({
    queryKey: ['club-order', orderId],
    queryFn: () => clubOrdersApi.get(orderId),
    placeholderData: initialOrder,
  });
  const order = query.data;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['club-order', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['club-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['club-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
    onChanged?.();
  };

  const cancel = useMutation({
    mutationFn: () => clubOrdersApi.cancel(orderId, cancelAthletes),
    onSuccess: () => {
      toast.success('Objednávka zrušena');
      setCancelOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Objednávku se nepodařilo zrušit'),
  });

  const body = () => {
    if (order === undefined) {
      return query.isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Zkusit znovu</Button>}>
          Objednávku se nepodařilo načíst.
        </Alert>
      ) : (
        <Stack spacing={1.5}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={90} />)}</Stack>
      );
    }
    const confirmedBlocks = order.blocks.filter((b) => b.status === 'Active');
    const lineTotal = (seats: number, unit: number | null) => (unit === null ? '—' : formatCzk(seats * unit));
    return (
      <Stack spacing={2} data-testid="order-detail" data-status={order.status}>
        <Block title="Souhrn">
          <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
            <Box><Typography sx={{ fontSize: 22, fontWeight: 700 }}>{order.totalSeats}</Typography><Typography variant="caption" color="text.secondary">míst</Typography></Box>
            <Box><Typography sx={{ fontSize: 22, fontWeight: 700 }}>{order.registered}</Typography><Typography variant="caption" color="text.secondary">zapsáno</Typography></Box>
            <Box><Typography sx={{ fontSize: 22, fontWeight: 700 }}>{Math.max(0, order.totalSeats - order.registered)}</Typography><Typography variant="caption" color="text.secondary">chybí</Typography></Box>
          </Stack>
          <LinearProgress variant="determinate" value={seatPercent(order.registered, order.totalSeats)} aria-label="Obsazenost míst" />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {order.serviceName !== '' ? order.serviceName : 'Služba zatím nevybrána'}
            {order.createdBy === 'Club' ? ' · vyplnil klub' : ' · založil personál'}
          </Typography>
          {order.note !== '' ? <Typography variant="body2" sx={{ mt: 1 }}>{order.note}</Typography> : null}
        </Block>

        <Block title="Termíny">
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Požadované termíny</Typography>
          {order.requestedRanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Klub žádné termíny neuvedl.</Typography>
          ) : (
            <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="requested-ranges">
              {order.requestedRanges.map((r, i) => <li key={i}><Typography variant="body2">{rangeText(r)}</Typography></li>)}
            </Stack>
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}>Potvrzená okna v kalendáři</Typography>
          {confirmedBlocks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Zatím nic nepotvrzeno.</Typography>
          ) : (
            <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="confirmed-windows">
              {confirmedBlocks.map((b) => (
                <li key={b.id}>
                  <Typography variant="body2">{rangeText({ fromDate: b.fromDate, toDate: b.toDate, dailyFrom: b.dailyFrom, dailyTo: b.dailyTo })}</Typography>
                </li>
              ))}
            </Stack>
          )}
        </Block>

        <Block title="Činnosti">
          {order.activitySeats.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Zatím bez činností.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Činnosti objednávky">
                <TableHead>
                  <TableRow>
                    <TableCell>Činnost</TableCell>
                    <TableCell align="right">Míst</TableCell>
                    <TableCell align="right">Zapsáno</TableCell>
                    <TableCell align="right">Cena</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.activitySeats.map((a) => (
                    <TableRow key={a.activityId} data-testid="order-activity-row">
                      <TableCell sx={{ fontWeight: 600 }}>{a.activityName}</TableCell>
                      <TableCell align="right">{a.seats}</TableCell>
                      <TableCell align="right">{a.registered}</TableCell>
                      <TableCell align="right">{lineTotal(a.seats, a.unitPriceCzk)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Block>

        <Block title="Cena a platba">
          {order.priceQuote === null ? (
            <Typography variant="body2" color="text.secondary">Cena zatím nebyla vypočtena.</Typography>
          ) : (
            <Stack spacing={0.5} data-testid="price-quote">
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2">Ceníková cena</Typography><Typography variant="body2">{formatCzk(order.priceQuote.listTotalCzk)}</Typography></Stack>
              {order.priceQuote.discounts.map((d, i) => (
                <Stack key={i} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{d.label}{d.percent > 0 ? ` (${d.percent} %)` : ''}</Typography>
                  <Typography variant="body2" color="text.secondary">−{formatCzk(Math.abs(d.amountCzk))}</Typography>
                </Stack>
              ))}
              <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 0.5 }}>
                <Typography sx={{ fontWeight: 700 }}>Celkem</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatCzk(order.priceQuote.totalCzk)}</Typography>
              </Stack>
            </Stack>
          )}
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Platba: <strong>{order.paymentMethod === null ? 'zatím neurčena' : PAYMENT_METHOD_LABEL[order.paymentMethod]}</strong>
          </Typography>
        </Block>

        <Block title="Kontakt na klub">
          {order.contact === null ? (
            <Typography variant="body2" color="text.secondary">Klub zatím kontakt neuvedl.</Typography>
          ) : (
            <Stack spacing={0.25}>
              <Typography sx={{ fontWeight: 600 }}>{order.contact.name}</Typography>
              {order.contact.phone !== '' ? <Link href={`tel:${order.contact.phone.replace(/\s+/g, '')}`}>{order.contact.phone}</Link> : null}
              {order.contact.email !== '' ? <Link href={`mailto:${order.contact.email}`}>{order.contact.email}</Link> : null}
            </Stack>
          )}
        </Block>

        <Block title="Historie">
          {order.history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Bez záznamů.</Typography>
          ) : (
            <Stack component="ol" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="order-history">
              {order.history.map((h, i) => (
                <Box component="li" key={i} sx={{ borderLeft: '2px solid', borderColor: 'divider', pl: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : ''}{h.user !== '' ? ` · ${h.user}` : ''}</Typography>
                  <Typography variant="body2">{h.text}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Block>
      </Stack>
    );
  };

  const actions = () => {
    if (order === undefined) return null;
    const btn = { sx: { minHeight: 44 } } as const;
    switch (order.status) {
      case 'Invited':
        return (
          <>
            <Button variant="contained" startIcon={<ContentCopy />} disabled={order.formUrl === ''} onClick={() => void copyText(absoluteLink(order.formUrl, publicBase))} {...btn}>Zkopírovat odkaz na formulář</Button>
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} {...btn}>Zrušit</Button>
          </>
        );
      case 'Requested':
        return (
          <>
            <Button variant="contained" onClick={() => setDialog('process')} {...btn}>Zpracovat</Button>
            <Button variant="outlined" onClick={() => setDialog('edit')} {...btn}>Upravit</Button>
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} {...btn}>Zrušit</Button>
          </>
        );
      case 'Confirmed':
        return (
          <>
            <Button variant="contained" onClick={() => setDialog('edit')} {...btn}>Upravit</Button>
            <Button variant="outlined" startIcon={<ContentCopy />} disabled={order.registrationUrl === ''} onClick={() => void copyText(absoluteLink(order.registrationUrl, publicBase))} {...btn}>Zkopírovat odkaz pro sportovce</Button>
            {order.paymentMethod === 'ClubInvoice' ? (
              <Button
                variant="outlined"
                onClick={() => navigate('/billing', { state: { clubId: order.clubId, clubOrderId: order.id, headcount: order.totalSeats } })}
                {...btn}
              >
                Vystavit fakturu
              </Button>
            ) : null}
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} {...btn}>Zrušit objednávku</Button>
          </>
        );
      default:
        return null;
    }
  };

  const footer = actions();

  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={onClose}
        slotProps={{ paper: { sx: { width: phone ? '100%' : 560, maxWidth: '100%' }, 'data-testid': 'order-drawer', 'data-layout': phone ? 'phone' : 'side' } as object }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          {order?.clubColorHex ? <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: order.clubColorHex }} /> : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }} noWrap>{order?.clubName ?? 'Objednávka klubu'}</Typography>
            {order !== undefined ? <StatusChip tone={STATUS_TONE[order.status]} size="sm">{ORDER_STATUS_LABEL[order.status]}</StatusChip> : null}
          </Box>
          <IconButton aria-label="Zavřít detail" onClick={onClose} sx={{ width: 44, height: 44 }}><Close /></IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>{body()}</Box>
        {footer !== null ? (
          <Stack direction={phone ? 'column' : 'row'} sx={{ gap: 1, p: 2, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }} data-testid="order-actions">
            {footer}
          </Stack>
        ) : null}
      </Drawer>

      <Dialog open={cancelOpen} onClose={cancel.isPending ? undefined : () => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Zrušit objednávku?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Objednávka klubu {order?.clubName ?? ''} bude zrušena a uvolní se její okna v kalendáři.</Typography>
          {order !== undefined && order.registered > 0 ? (
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={cancelAthletes} onChange={(e) => setCancelAthletes(e.target.checked)} />}
              label={`Zrušit i jejich rezervace (${order.registered})`}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>Ponechat</Button>
          <Button variant="contained" color="error" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Ano, zrušit</Button>
        </DialogActions>
      </Dialog>

      {order !== undefined ? (
        <ClubOrderDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          order={dialog === 'edit' ? order : undefined}
          processOrder={dialog === 'process' ? order : undefined}
          onSaved={() => { setDialog(null); refresh(); }}
        />
      ) : null}
    </>
  );
}

export default ClubOrderDetailPanel;
