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
  Alert, Box, Button, Drawer,
  IconButton, LinearProgress, Link, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { clubOrdersApi, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { formatCzk } from '../../../pages/clubs/clubOrders';
import { formatPragueDateTime } from '../../../utils/time';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { todayInPrague } from '../blockLogic';
import { ClubOrderDialog } from '../order/ClubOrderDialog';
import { editSessionFor } from '../order/editSession';
import type { CoverageActivity } from '../order/coverage';
import { CancelOrderDialog } from './CancelOrderDialog';
import { ChangePlayersDialog } from './ChangePlayersDialog';
import { WindowPills } from './WindowPills';
import { RemoveWindowDialog } from './RemoveWindowDialog';
import { orderWindows, termsWord } from './orderWindows';
import { copyText } from './LinkCopyRow';
import { absoluteLink, usePublicSiteBase } from './absoluteLink';
import { OfferedDaysBlock } from './OfferedDaysBlock';
import { ClubInvoiceDialog } from './ClubInvoiceDialog';
import { hasGroup, OrderGroupBlock } from './OrderGroupBlock';
import { orderCode } from '../order/orderFormat';
import { rangeText, registeredLine, seatPercent, STATUS_TONE } from './orderLogic';
import { formatPlayersTotal } from '../panel/seats';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SoftCard sx={{ p: 2 }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </SoftCard>
  );
}

export function ClubOrderDetailPanel({ orderId: initialId, initialOrder, onClose, onChanged }: {
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
  const [playersOpen, setPlayersOpen] = useState(false);
  const [removing, setRemoving] = useState<ClubBlockView | null>(null);
  /* Etapa 5: a row of the group opens that order in the same drawer. */
  const [orderId, setOrderId] = useState(initialId);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });

  const query = useQuery({
    queryKey: ['club-order', orderId],
    queryFn: () => clubOrdersApi.get(orderId),
    placeholderData: orderId === initialId ? initialOrder : undefined,
  });
  const order = query.data;
  const rootId = order?.parentOrderId ?? null;
  const rootQuery = useQuery({
    queryKey: ['club-order', rootId],
    queryFn: () => clubOrdersApi.get(rootId ?? ''),
    enabled: rootId !== null,
  });
  /* Which orders of the group an invoice covers, and which still wait for one (the same read the invoice dialog opens on). */
  const invoiceBillable = order !== undefined && order.paymentMethod !== 'PerPerson'
    && (order.status === 'Requested' || order.status === 'Confirmed' || order.status === 'Completed');
  const invoiceDraftQuery = useQuery({
    queryKey: ['club-order-invoice-draft', orderId],
    queryFn: () => clubOrdersApi.invoiceDraft(orderId),
    enabled: invoiceBillable,
    retry: false,
  });
  const invoiceDraft = invoiceDraftQuery.data;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['club-order', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['club-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['club-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
    onChanged?.();
  };

  /* "Upravit termíny": the calendar in pick mode, prefilled with every window of this order (and, from "Změnit hráče", the new numbers). */
  const editTerms = (o: ClubOrderView, activities?: CoverageActivity[]) => {
    setPlayersOpen(false);
    navigate('/planovani', { state: { pickOrder: { start: editSessionFor(o, activitiesQuery.data ?? [], todayInPrague(), activities) } } });
  };

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
    const windows = orderWindows(order);
    const today = todayInPrague();
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
          <Typography variant="body2" data-testid="order-seats-breakdown" sx={{ fontWeight: 600, mt: 1 }}>
            {registeredLine(order)}{order.activitySeats.length > 0 ? ` (${formatPlayersTotal(order.activitySeats)})` : ''}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {order.serviceName !== '' ? order.serviceName : 'Služba zatím nevybrána'}
            {order.createdBy === 'Club' ? ' · vyplnil klub' : ' · založil personál'}
          </Typography>
          {order.note !== '' ? <Typography variant="body2" sx={{ mt: 1 }}>{order.note}</Typography> : null}
          {order.status === 'Requested' || order.status === 'Confirmed' ? (
            <Stack direction={phone ? 'column' : 'row'} data-testid="order-edit-buttons" sx={{ gap: 1, mt: 2 }}>
              <Button variant="contained" onClick={() => setPlayersOpen(true)} data-testid="change-players" sx={{ minHeight: 48, flex: 1 }}>Změnit hráče</Button>
              {order.status === 'Confirmed' ? (
                <Button variant="contained" color="secondary" onClick={() => editTerms(order)} disabled={activitiesQuery.isLoading} data-testid="edit-terms" sx={{ minHeight: 48, flex: 1 }}>Upravit termíny</Button>
              ) : null}
            </Stack>
          ) : null}
        </Block>

        {hasGroup(order) ? (
          <OrderGroupBlock order={order} root={rootQuery.data} onOpen={setOrderId} />
        ) : null}

        {order.invoiceId !== null || invoiceDraft !== undefined ? (
          <Block title="Faktura">
            <Stack spacing={0.75} data-testid="order-invoices">
              {order.invoiceId !== null ? (
                <Stack direction="row" data-testid="order-invoice" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2">Tato objednávka je na faktuře:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} data-testid="order-invoice-number">
                    {invoiceDraft?.alreadyInvoiced.find((x) => x.orderId === order.id)?.invoiceNumber || 'vystavena'}
                  </Typography>
                  <Button size="small" onClick={() => navigate('/billing', { state: { invoiceId: order.invoiceId } })} sx={{ minHeight: 36 }}>Otevřít</Button>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" data-testid="order-invoice-pending">Tato objednávka zatím není vyfakturovaná.</Typography>
              )}
              {invoiceDraft !== undefined && hasGroup(order) ? (
                <>
                  {invoiceDraft.alreadyInvoiced.map((x) => (
                    <Typography key={x.orderId} variant="body2" color="text.secondary" data-testid="group-invoice-row">
                      {orderCode(x.orderId)} · faktura {x.invoiceNumber !== '' ? x.invoiceNumber : 'vystavena'}
                    </Typography>
                  ))}
                  {[...new Set(invoiceDraft.lines.map((l) => l.orderId))].map((id) => (
                    <Typography key={id} variant="body2" color="warning.main" data-testid="group-invoice-pending">
                      {orderCode(id)} · čeká na {invoiceDraft.supplementary ? 'dodatečnou ' : ''}fakturu
                    </Typography>
                  ))}
                </>
              ) : null}
            </Stack>
          </Block>
        ) : null}

        <OfferedDaysBlock order={order} onChanged={refresh} />

        <Block title="Termíny objednávky">
          {windows.length > 0 ? (
            <>
              <WindowPills
                order={order}
                today={today}
                testId="confirmed-windows"
                {...(order.status === 'Confirmed'
                  ? { onRemove: setRemoving, removeBlockedReason: windows.length <= 1 ? 'Poslední termín nelze odebrat — zrušte celou objednávku.' : null }
                  : {})}
              />
              {order.status === 'Confirmed' ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  {`${windows.length} ${termsWord(windows.length)} v kalendáři. Křížek odebere jen ten termín; objednávka zůstane jedna.`}
                </Typography>
              ) : null}
            </>
          ) : order.requestedRanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{order.status === 'Confirmed' ? 'Objednávka nemá žádný termín.' : 'Klub žádné termíny neuvedl.'}</Typography>
          ) : (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Požadované termíny</Typography>
              <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="requested-ranges">
                {order.requestedRanges.map((r, i) => <li key={i}><Typography variant="body2">{rangeText(r)}</Typography></li>)}
              </Stack>
            </>
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

  const addAddendum = (o: ClubOrderView) =>
    navigate('/planovani', {
      state: { pickOrder: { clubId: o.clubId, parent: { orderId: o.groupId, clubId: o.clubId, clubName: o.clubName, paymentMethod: o.paymentMethod } } },
    });

  const actions = () => {
    if (order === undefined) return null;
    const btn = { sx: { minHeight: 44 } } as const;
    const takesAddendum = order.status === 'Requested' || order.status === 'Confirmed' || order.status === 'Completed';
    const perPerson = order.paymentMethod === 'PerPerson';
    const addendumButton = takesAddendum ? (
      <Button key="addendum" variant="contained" onClick={() => addAddendum(order)} data-testid="add-addendum" {...btn}>Přidat další službu / další hráče</Button>
    ) : null;
    const invoiceButton = takesAddendum ? (
      <Box key="invoice" sx={{ display: 'contents' }}>
        <Button
          variant="outlined"
          disabled={perPerson}
          aria-describedby={perPerson ? 'invoice-per-person-hint' : undefined}
          onClick={() => setInvoiceOpen(true)}
          data-testid="club-invoice"
          {...btn}
        >
          {invoiceDraft !== undefined
            ? (invoiceDraft.lines.length === 0 ? 'Faktura klubu' : invoiceDraft.supplementary ? 'Vystavit dodatečnou fakturu' : 'Vystavit jednu fakturu klubu')
            : (order.invoiceId !== null ? 'Faktura klubu' : 'Vystavit jednu fakturu klubu')}
        </Button>
        {perPerson ? (
          <Typography id="invoice-per-person-hint" variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }} data-testid="invoice-per-person-hint">
            Skupina platí po osobách — jedna faktura klubu se nevystavuje.
          </Typography>
        ) : null}
      </Box>
    ) : null;
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
            {addendumButton}
            <Button variant="outlined" onClick={() => setDialog('process')} {...btn}>Zpracovat</Button>
            <Button variant="outlined" onClick={() => setDialog('edit')} {...btn}>Upravit</Button>
            {invoiceButton}
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} {...btn}>Zrušit</Button>
          </>
        );
      case 'Confirmed':
        return (
          <>
            {addendumButton}
            <Button variant="outlined" onClick={() => setDialog('edit')} {...btn}>Upravit</Button>
            <Button variant="outlined" startIcon={<ContentCopy />} disabled={order.registrationUrl === ''} onClick={() => void copyText(absoluteLink(order.registrationUrl, publicBase))} {...btn}>Zkopírovat odkaz pro sportovce</Button>
            {invoiceButton}
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} {...btn}>Zrušit objednávku</Button>
          </>
        );
      case 'Completed':
        return (
          <>
            {addendumButton}
            {invoiceButton}
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

      {cancelOpen && order !== undefined ? (
        <CancelOrderDialog order={order} onClose={() => setCancelOpen(false)} onCancelled={() => { setCancelOpen(false); refresh(); }} />
      ) : null}

      {playersOpen && order !== undefined ? (
        <ChangePlayersDialog
          order={order}
          onClose={() => setPlayersOpen(false)}
          onSaved={() => { setPlayersOpen(false); refresh(); }}
          onEditTerms={order.status === 'Confirmed' ? (activities) => editTerms(order, activities) : undefined}
        />
      ) : null}

      {removing !== null && order !== undefined ? (
        <RemoveWindowDialog order={order} block={removing} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); refresh(); }} />
      ) : null}

      {invoiceOpen ? <ClubInvoiceDialog orderId={orderId} onClose={() => setInvoiceOpen(false)} onChanged={onChanged} /> : null}

      {order !== undefined ? (
        <ClubOrderDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          order={dialog === 'edit' ? order : undefined}
          processOrder={dialog === 'process' ? order : undefined}
          onEditTerms={(session) => {
            setDialog(null);
            navigate('/planovani', { state: { pickOrder: { start: session } } });
          }}
          onSaved={() => { setDialog(null); refresh(); }}
        />
      ) : null}
    </>
  );
}

export default ClubOrderDetailPanel;
