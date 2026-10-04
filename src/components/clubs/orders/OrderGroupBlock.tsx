/*
 * Etapa 5: the group an order belongs to - the root order, its addenda ("dodatky") as stacked rows, and the totals of
 * the WHOLE order ("Celkem za celou objednávku"). Shown only when the order is part of a group of two or more.
 * The server adds the totals up (live orders only, recomputed over the combined head count); nothing is summed here.
 */
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ClubOrderView } from '../../../api/clubOrders';
import { ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import { formatCzk } from '../../../pages/clubs/clubOrders';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { orderCode } from '../order/orderFormat';
import { STATUS_TONE } from './orderLogic';

export const hasGroup = (o: ClubOrderView): boolean => o.addenda.length > 0 || o.parentOrderId !== null;

function Row({ code, service, seats, status, price, current, onOpen }: {
  code: string; service: string; seats: number; status: ClubOrderView['status']; price: number | null; current: boolean; onOpen?: () => void;
}) {
  return (
    <Stack
      direction="row"
      data-testid="group-row"
      data-current={current ? 'true' : 'false'}
      sx={{ alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}
    >
      <Box sx={{ flex: 1, minWidth: 140 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{service !== '' ? service : 'Služba nevybrána'}</Typography>
        <Typography variant="caption" color="text.secondary">{code}{current ? ' · tato objednávka' : ''}</Typography>
      </Box>
      <Typography variant="body2">{seats} míst</Typography>
      <StatusChip tone={STATUS_TONE[status]} size="sm">{ORDER_STATUS_LABEL[status]}</StatusChip>
      <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right', fontWeight: 600 }}>{price === null ? '—' : formatCzk(price)}</Typography>
      {onOpen !== undefined ? <Button size="small" onClick={onOpen} sx={{ minHeight: 36 }}>Otevřít</Button> : null}
    </Stack>
  );
}

export function OrderGroupBlock({ order, root, onOpen }: {
  order: ClubOrderView;
  /** The root order when `order` is an addendum (so its row and the other addenda can be shown). */
  root?: ClubOrderView;
  onOpen: (orderId: string) => void;
}) {
  const head = order.parentOrderId === null ? order : root;
  const t = order.groupTotals;
  return (
    <SoftCard sx={{ p: 2 }} data-testid="order-group">
      <SectionLabel>Dodatky a celá objednávka</SectionLabel>
      {order.parentOrderId !== null ? (
        <Typography variant="body2" sx={{ mb: 1 }} data-testid="addendum-of">
          Dodatek k objednávce <strong>{orderCode(order.parentOrderId)}</strong> — jedna objednávka, jedna faktura.
        </Typography>
      ) : null}
      <Box data-testid="group-rows">
        {head !== undefined ? (
          <>
            <Row
              code={orderCode(head.id)}
              service={head.serviceName}
              seats={head.totalSeats}
              status={head.status}
              price={head.priceQuote?.totalCzk ?? null}
              current={head.id === order.id}
              onOpen={head.id === order.id ? undefined : () => onOpen(head.id)}
            />
            {head.addenda.map((a) => (
              <Row
                key={a.id}
                code={`Dodatek ${orderCode(a.id)}`}
                service={a.serviceName}
                seats={a.totalSeats}
                status={a.status}
                price={a.totalCzk}
                current={a.id === order.id}
                onOpen={a.id === order.id ? undefined : () => onOpen(a.id)}
              />
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">Původní objednávka {order.parentOrderId !== null ? orderCode(order.parentOrderId) : ''} se načítá…</Typography>
        )}
      </Box>
      <Stack spacing={0.5} sx={{ mt: 1.5 }} data-testid="group-totals">
        <Typography sx={{ fontWeight: 700 }}>Celkem za celou objednávku</Typography>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2">Hráčů celkem</Typography><Typography variant="body2" data-testid="group-seats">{t.totalSeats}</Typography></Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2">Ceníková cena</Typography><Typography variant="body2">{formatCzk(t.listTotalCzk)}</Typography></Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Sleva</Typography><Typography variant="body2" color="text.secondary" data-testid="group-discount">−{formatCzk(Math.abs(t.discountCzk))}</Typography></Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 0.5 }}><Typography sx={{ fontWeight: 700 }}>Celkem</Typography><Typography sx={{ fontWeight: 700 }} data-testid="group-total">{formatCzk(t.totalCzk)}</Typography></Stack>
      </Stack>
    </SoftCard>
  );
}

export default OrderGroupBlock;
