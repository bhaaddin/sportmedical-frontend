/*
 * Kluby > Objednávky > Historie: the history of ONE club order on a page of its own.
 *
 * The order's detail stays the main page of the order (summary, terms, činnosti, money, contact, actions); everything that
 * happened to the order lives here, reached by the "Historie" button in that detail. Two views of the same list:
 *   Vše            the full internal history, newest first;
 *   Co vidí klub   exactly the entries the club reads in its portal (`visibleToClub`), so the desk sees what the club sees.
 * "Zpět na objednávku" returns to the orders page with that order open again.
 */
import { useState } from 'react';
import { Alert, Box, Button, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { OrderHistoryItem } from '../../../api/clubOrders';
import { orderCode } from '../../../components/clubs/order/orderFormat';
import { STATUS_TONE } from '../../../components/clubs/orders/orderLogic';
import { visibleToClub } from '../../../components/clubs/orders/ClubVisibleHistory';
import { PageHeader, SoftCard, StatusChip } from '../../../components/ui';
import { FitBody, FitPage, FitPanel } from '../../../components/ui/fit';
import { formatPragueDateTime } from '../../../utils/time';

export type HistoryView = 'all' | 'club';

/** Newest first, entries without a date last; stable for equal times. */
export function newestFirst(history: readonly OrderHistoryItem[]): OrderHistoryItem[] {
  return history
    .map((item, index) => ({ item, index, at: Date.parse(item.atUtc) }))
    .sort((a, b) => {
      const ta = Number.isNaN(a.at) ? -Infinity : a.at;
      const tb = Number.isNaN(b.at) ? -Infinity : b.at;
      return tb !== ta ? tb - ta : a.index - b.index;
    })
    .map((x) => x.item);
}

export function historyEntries(history: readonly OrderHistoryItem[], view: HistoryView): OrderHistoryItem[] {
  return view === 'club' ? visibleToClub(history) : newestFirst(history);
}

export default function ClubOrderHistoryPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<HistoryView>('all');

  const query = useQuery({
    queryKey: ['club-order', orderId],
    queryFn: () => clubOrdersApi.get(orderId),
    enabled: orderId !== '',
  });
  const order = query.data;
  const back = () => navigate('/clubs/objednavky', { state: { openOrderId: orderId } });

  const entries = order !== undefined ? historyEntries(order.history, view) : [];
  const clubCount = order !== undefined ? visibleToClub(order.history).length : 0;

  return (
    <FitPage>
      <PageHeader
        title="Historie objednávky"
        subtitle={order !== undefined ? `${order.clubName} · ${orderCode(order.id)}` : 'Co se s objednávkou dělo'}
        leading={(
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={back}
            data-testid="history-back"
            sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
          >
            Zpět na objednávku
          </Button>
        )}
        actions={order !== undefined ? <StatusChip tone={STATUS_TONE[order.status]} size="sm">{ORDER_STATUS_LABEL[order.status]}</StatusChip> : undefined}
        mb={2}
      />

      <FitBody>
        {query.isPending ? (
          <Stack spacing={1.5}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}</Stack>
        ) : query.isError || order === undefined ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Zkusit znovu</Button>}>
            Historii se nepodařilo načíst.
          </Alert>
        ) : (
          <SoftCard sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 0' }}>
            <FitPanel
              head={(
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ToggleButtonGroup
                    exclusive
                    value={view}
                    onChange={(_, next: HistoryView | null) => { if (next !== null) setView(next); }}
                    aria-label="Rozsah historie"
                    size="small"
                  >
                    <ToggleButton value="all" data-testid="history-view-all" sx={{ minHeight: 44, px: 2 }}>{`Vše (${order.history.length})`}</ToggleButton>
                    <ToggleButton value="club" data-testid="history-view-club" sx={{ minHeight: 44, px: 2 }}>{`Co vidí klub (${clubCount})`}</ToggleButton>
                  </ToggleButtonGroup>
                  {view === 'club' ? (
                    <Typography variant="body2" color="text.secondary">Takto změny vidí klub ve svém portálu.</Typography>
                  ) : null}
                </Stack>
              )}
              bodySx={{ p: 2.5 }}
            >
              {entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary" data-testid="history-empty">
                  {view === 'club' ? 'Klub zatím nevidí žádné změny.' : 'Bez záznamů.'}
                </Typography>
              ) : (
                <Stack component="ol" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="order-history">
                  {entries.map((h, i) => (
                    <Box
                      component="li"
                      key={`${h.atUtc}-${i}`}
                      sx={{ borderLeft: '2px solid', borderColor: h.visibleToClub === true ? 'primary.main' : 'divider', pl: 1.5 }}
                    >
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : ''}{view === 'all' && h.user !== '' ? ` · ${h.user}` : ''}
                        </Typography>
                        {view === 'all' && h.visibleToClub === true ? (
                          <StatusChip tone="blue" size="sm">Vidí klub</StatusChip>
                        ) : null}
                      </Stack>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{h.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </FitPanel>
          </SoftCard>
        )}
      </FitBody>
    </FitPage>
  );
}
