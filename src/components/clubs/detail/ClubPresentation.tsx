/*
 * One club as a presentation page (Etapa 5, Matko's wish): a big centred club name with its colour, a row of key
 * figures, and the facts stacked below as cards - one column on phone and tablet, two on desktop, never wider than
 * 960 px. It replaces the old two-column detail with its right rail; everything the old panel could do is still here
 * (edit, deactivate, new order, orders list, block panels, the athletes' link, add places, invoice, print).
 *
 * Every number is the server's: the summary comes from `clubOrdersApi.clubSummary`, the orders from
 * `clubOrdersApi.list`, the blocks from the page. Every card has its own loading, empty and error state.
 */
import { Alert, Box, Button, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { clubOrdersApi, ORDER_STATUSES, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { ClubAvatar } from '../ClubAvatar';
import { ClubBlockPanel } from '../ClubBlockPanel';
import { blockTitle, plural } from '../blockLogic';
import { useClubSummary } from '../orders/ClubSummaryCard';
import { STATUS_TONE, termsSummary, seatPercent, seatsWithTotal } from '../orders/orderLogic';
import { orderWindows, windowLabel } from '../orders/orderWindows';
import { orderCode } from '../order/orderFormat';
import { ClubOrderCard } from './ClubOrderCard';
import { ClubSeatsCard } from '../panel/ClubSeatsCard';
import { clubActivitySeats } from '../panel/seats';
import { canBeInvoiced } from '../../../pages/clubs/payerForm';
import { describeDiscount, formatDateRange, orderDateRange } from '../../../pages/clubs/clubOrders';
import type { ClubRow } from '../../../pages/clubs/clubRow';
import { PinnedActions } from '../../../pages/clubs/PinnedActions';
import { LegacyReservation } from './LegacyReservation';

const MAX_WIDTH = 960;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <SectionLabel sx={{ mb: 0 }}>{label}</SectionLabel>
      <Typography component="div" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 0 }}>
      <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function ProgressRow({ name, seats, registered, remaining }: { name: string; seats: number; registered: number; remaining: number }) {
  return (
    <Box data-testid="breakdown-row">
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{name}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: '0 0 auto' }}>
          {registered} / {seats} zapsáno · zbývá {remaining}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={seatPercent(registered, seats)} aria-label={`Obsazenost: ${name}`} sx={{ mt: 0.5 }} />
    </Box>
  );
}

export function ClubPresentation({
  row, priceOf, pricesReady, focusBlockId, today, onBack, onEdit, onDeactivate, onReload, onInvoice, onNewReservation, onNewOrder, onOpenOrder,
}: {
  row: ClubRow;
  priceOf: (activityId: string) => number | null;
  pricesReady: boolean;
  focusBlockId: string | null;
  /** yyyy-MM-dd; windows ending before it are not "upcoming". */
  today: string;
  onBack: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReload: () => void;
  onInvoice: () => void;
  onNewReservation: () => void;
  onNewOrder: () => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const wide = device === 'desktop';
  const navigate = useNavigate();
  const { club, order, percent, blocks } = row;
  const accent = row.color;

  const summary = useClubSummary(club.id);
  /* keepPreviousData: a refetch after any order change never swaps the cards for a skeleton. */
  const ordersQuery = useQuery({ queryKey: ['club-orders', club.id, '', ''], queryFn: () => clubOrdersApi.list({ clubId: club.id }), retry: false, placeholderData: keepPreviousData });
  const activeBlocks = blocks.filter((b) => b.status === 'Active');
  const upcoming = activeBlocks.filter((b) => b.toDate >= today);
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000, enabled: activeBlocks.length > 0 });
  const blockSeatRows = clubActivitySeats(activeBlocks, (id) => (activitiesQuery.data ?? []).find((a) => a.id === id)?.name ?? '');

  const orders = ordersQuery.data ?? [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const upcomingByOrder = new Map<string, ClubBlockView[]>();
  for (const b of upcoming) if (b.clubOrderId) upcomingByOrder.set(b.clubOrderId, [...(upcomingByOrder.get(b.clubOrderId) ?? []), b]);
  const upcomingOrders = [...upcomingByOrder.entries()]
    .map(([id, bs]) => ({ id, blocks: [...bs].sort((a, b) => a.fromDate.localeCompare(b.fromDate)) }))
    .sort((a, b) => a.blocks[0].fromDate.localeCompare(b.blocks[0].fromDate));
  const upcomingLegacy = upcoming.filter((b) => !b.clubOrderId);
  const cancelledOrders = orders.filter((o) => o.status === 'Cancelled');
  const firstDate = (o: (typeof orders)[number]) => orderWindows(o)[0]?.fromDate ?? '9999-12-31';
  const RANK: Record<string, number> = { Confirmed: 0, Requested: 1, Invited: 2, Completed: 3 };
  const shownOrders = orders
    .filter((o) => o.status !== 'Cancelled')
    .sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || firstDate(a).localeCompare(firstDate(b)));

  const location = [club.address, [club.postalCode, club.city].filter(Boolean).join(' ')].filter((p) => p && p.trim() !== '').join(', ');
  /* Vedení klubu (Etapa 12): shown only when somebody is listed; an older server sends nothing here. */
  const management = Array.isArray(club.management) ? club.management.filter((m) => m.fullName.trim() !== '') : [];
  const bank = [club.bankAccount ? `${club.bankAccount}${club.bankCode ? `/${club.bankCode}` : ''}` : '', club.iban ?? ''].filter((p) => p !== '');
  const s = summary.data;

  /* One order is one thing: the windows an order owns are counted under it, never as separate blocks. */
  const legacyBlocks = blocks.filter((b) => !b.clubOrderId);
  const activeLegacy = activeBlocks.filter((b) => !b.clubOrderId);
  const ordersHolding = new Set(activeBlocks.flatMap((b) => (b.clubOrderId ? [b.clubOrderId] : []))).size;
  const range = order === null ? null : orderDateRange(order);
  const holding = [
    ordersHolding > 0 ? `${ordersHolding} ${plural(ordersHolding, ['objednávka', 'objednávky', 'objednávek'])} v kalendáři` : '',
    activeLegacy.length > 0 ? `${activeLegacy.length} ${plural(activeLegacy.length, ['starší rezervace', 'starší rezervace', 'starších rezervací'])}` : '',
  ].filter((p) => p !== '').join(' + ');
  const subtitle = activeBlocks.length > 0
    ? `${holding} · ${formatDateRange(activeBlocks.map((b) => b.fromDate).sort()[0], activeBlocks.map((b) => b.toDate).sort().reverse()[0])}`
    : order === null
      ? 'Zatím bez hromadné rezervace'
      : range === null
        ? 'Hromadná rezervace — termíny zatím nejsou vyhrazené'
        : `Hromadná rezervace ${formatDateRange(range.from, range.to)}`;
  const hasAnything = order !== null || blocks.length > 0 || (ordersQuery.data ?? []).length > 0;

  const span = wide ? { gridColumn: '1 / -1' } : {};

  return (
    <Box data-testid="club-detail" data-layout={device} data-columns={wide ? 2 : 1} sx={{ maxWidth: MAX_WIDTH, mx: 'auto', width: '100%', minWidth: 0 }}>
      {/* ── Hero ── */}
      <Box>
        <Button variant="text" startIcon={<ArrowBack />} onClick={onBack} sx={{ minHeight: 44, mb: 1 }}>Zpět na kluby</Button>
      </Box>
      <Box
        data-testid="club-hero"
        sx={{ textAlign: 'center', pb: { xs: 2.5, md: 3.5 }, px: { xs: 0, md: 2 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ClubAvatar name={club.name} color={accent} size={phone ? 64 : 84} />
        </Box>
        <Typography
          component="h1"
          data-testid="club-hero-name"
          sx={{ fontSize: { xs: 30, md: 44 }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12, overflowWrap: 'anywhere' }}
        >
          {club.name}
        </Typography>
        <Box
          aria-hidden="true"
          data-testid="club-hero-accent"
          sx={{ width: 72, height: 5, borderRadius: 3, mx: 'auto', my: 1.5, bgcolor: accent ?? 'divider' }}
        />
        <Stack direction="row" sx={{ gap: 1, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {club.city ? <Typography variant="body1" sx={{ color: 'text.secondary' }}>{club.city}</Typography> : null}
          <StatusChip tone={club.isActive ? 'green' : 'grey'}>{club.isActive ? 'Aktivní' : 'Neaktivní'}</StatusChip>
        </Stack>
        <Typography data-testid="club-hero-subtitle" variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>{subtitle}</Typography>
        {!phone ? (
          <Stack direction="row" sx={{ gap: 1, justifyContent: 'center', mt: 2 }}>
            <Button variant="contained" onClick={onNewOrder}>Nová objednávka klubu</Button>
          </Stack>
        ) : null}
      </Box>

      {/* ── Key figures ── */}
      <SoftCard data-testid="club-figures" role="region" aria-label="Klíčové údaje klubu" sx={{ mb: 2.5 }}>
        {summary.isLoading ? (
          <Skeleton variant="rounded" height={64} data-testid="figures-loading" />
        ) : summary.isError || s === undefined ? (
          <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void summary.refetch()}>Zkusit znovu</Button>}>
            Souhrn klubu se nepodařilo načíst.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
              <Figure value={s.totalSeats} label="hráčů / míst" />
              <Figure value={s.registered} label="zapsáno" />
              <Figure value={s.remaining} label="zbývá" />
            </Box>
            <Stack direction="row" data-testid="summary-statuses" sx={{ gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: 2 }}>
              {ORDER_STATUSES.map((st) => (
                <StatusChip key={st} tone={STATUS_TONE[st]} size="sm">{ORDER_STATUS_LABEL[st]}: {s.ordersByStatus[st]}</StatusChip>
              ))}
            </Stack>
          </>
        )}
      </SoftCard>

      {!hasAnything && !ordersQuery.isLoading ? (
        <SoftCard data-testid="club-empty" sx={{ textAlign: 'center', py: 3, mb: 2.5 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Tento klub zatím nemá hromadnou rezervaci.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Založte klubu objednávku nebo mu vyhraďte termíny v kalendářích — sportovci se pak registrují přes odkaz.
          </Typography>
        </SoftCard>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 2.5, alignItems: 'start' }} data-testid="club-cards">
        {/* ── Kontakt a fakturační údaje ── */}
        <SoftCard data-testid="club-contact" role="region" aria-label="Kontakt a fakturační údaje">
          <SectionLabel>Kontakt a fakturační údaje</SectionLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
            <Fact label="Kontaktní osoba">{club.contactPerson || '—'}</Fact>
            <Fact label="E-mail">{club.contactEmail || order?.contactEmail || '—'}</Fact>
            <Fact label="Telefon">{club.contactPhone || '—'}</Fact>
            <Fact label="Sportovců">{row.headcount ?? '—'}</Fact>
            <Fact label="IČO">{club.ico || '—'}</Fact>
            <Fact label="DIČ">{club.dic || '—'}</Fact>
            <Fact label="Adresa">{location || '—'}</Fact>
            <Fact label="Bankovní spojení">{bank.length > 0 ? bank.join(' · ') : '—'}</Fact>
            <Fact label="Splatnost">{club.paymentTermsDays > 0 ? `${club.paymentTermsDays} dní` : '—'}</Fact>
            <Fact label="Sleva klubu">{describeDiscount(percent)}</Fact>
            <Fact label="Fakturace">
              {canBeInvoiced(club) ? 'Na klub' : <Box component="span" sx={{ color: 'warning.main' }}>Chybí fakturační údaje</Box>}
            </Fact>
            {accent !== null ? (
              <Fact label="Barva v kalendáři">
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box aria-hidden="true" sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: accent }} />
                  <span>{accent.toUpperCase()}</span>
                </Stack>
              </Fact>
            ) : null}
          </Box>
        </SoftCard>

        {/* ── Vedení klubu: the statutory body from ARES and the people added by hand ── */}
        {management.length > 0 ? (
          <SoftCard data-testid="club-management" role="region" aria-label="Vedení klubu">
            <SectionLabel>Vedení klubu</SectionLabel>
            <Stack spacing={1.25} role="list">
              {management.map((m, index) => {
                const contact = [m.phone ?? '', m.email ?? ''].filter((p) => p.trim() !== '').join(' · ');
                return (
                  <Stack key={m.id ?? `${m.fullName}-${index}`} role="listitem" direction="row" data-testid="club-manager" data-source={m.source} sx={{ gap: 1.5, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{m.fullName}</Typography>
                      {m.role.trim() !== '' ? <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{m.role}</Typography> : null}
                      {contact !== '' ? <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }}>{contact}</Typography> : null}
                    </Box>
                    {m.source === 'ares' ? <StatusChip tone="beige" size="sm">z ARES</StatusChip> : null}
                  </Stack>
                );
              })}
            </Stack>
          </SoftCard>
        ) : null}

        {/* ── Nadcházející okna v kalendáři ── */}
        <SoftCard data-testid="club-windows" role="region" aria-label="Nadcházející okna v kalendáři">
          <SectionLabel>Nadcházející okna v kalendáři</SectionLabel>
          {upcoming.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Klub nemá žádné nadcházející okno.</Typography>
          ) : (
            <Stack spacing={1.25} role="list">
              {upcomingOrders.map((g) => {
                const o = orderById.get(g.id);
                return (
                  <Stack key={g.id} role="listitem" direction="row" data-testid="club-window" data-order-id={g.id} sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{`Objednávka ${orderCode(g.id)}${o?.serviceName ? ` · ${o.serviceName}` : ''}`}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{g.blocks.map((b) => windowLabel(b, o)).join(' · ')}</Typography>
                    </Box>
                    {o !== undefined ? <StatusChip tone="green" size="sm">{o.registered} / {o.totalSeats}</StatusChip> : null}
                  </Stack>
                );
              })}
              {upcomingLegacy.map((b) => (
                <Stack key={b.id} role="listitem" direction="row" data-testid="club-window" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{blockTitle(b)}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{windowLabel(b)}</Typography>
                  </Box>
                  <StatusChip tone="green" size="sm">{b.registered} / {b.seats}</StatusChip>
                </Stack>
              ))}
            </Stack>
          )}
        </SoftCard>

        {/* ── Objednávky klubu ── */}
        <SoftCard data-testid="club-orders-list" role="region" aria-label="Objednávky klubu" sx={span}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <SectionLabel>Objednávky klubu</SectionLabel>
            <Button size="small" variant="text" onClick={() => navigate(`/clubs/objednavky?clubId=${club.id}`)} sx={{ minHeight: 44 }}>Všechny objednávky</Button>
          </Stack>
          {ordersQuery.isLoading ? (
            <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
          ) : ordersQuery.isError ? (
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void ordersQuery.refetch()}>Zkusit znovu</Button>}>
              Objednávky klubu se nepodařilo načíst.
            </Alert>
          ) : orders.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím žádná objednávka</Typography>
          ) : (
            <Stack spacing={1.5}>
              {shownOrders.map((o) => (
                <ClubOrderCard key={o.id} order={o} today={today} onOpen={(id) => onOpenOrder?.(id)} onChanged={onReload} />
              ))}
              {cancelledOrders.length > 0 ? (
                <Box data-testid="club-orders-cancelled">
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Zrušené objednávky</Typography>
                  {cancelledOrders.map((o) => (
                    <Stack
                      key={o.id}
                      direction="row"
                      role="button"
                      tabIndex={0}
                      data-testid="club-order-cancelled"
                      onClick={() => onOpenOrder?.(o.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onOpenOrder?.(o.id); }}
                      sx={{ gap: 1.5, alignItems: 'center', minHeight: 44, cursor: 'pointer', justifyContent: 'space-between' }}
                    >
                      <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{`${orderCode(o.id)} · ${o.serviceName || 'Služba nevybrána'} · ${seatsWithTotal(o) === '—' ? `${o.totalSeats} míst` : seatsWithTotal(o)} · ${termsSummary(o)}`}</Typography>
                      <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                    </Stack>
                  ))}
                </Box>
              ) : null}
            </Stack>
          )}
        </SoftCard>

        {/* ── Rozpis podle služeb a činností ── */}
        <Box sx={{ ...span, minWidth: 0 }} data-testid="club-breakdown-wrap">
          {summary.isLoading ? (
            <Skeleton variant="rounded" height={140} />
          ) : s !== undefined && (s.byService.length > 0 || s.byActivity.length > 0) ? (
            <SoftCard data-testid="club-breakdown" role="region" aria-label="Rozpis podle služeb a činností">
              <SectionLabel>Rozpis podle služeb a činností</SectionLabel>
              <Box sx={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 2.5 }}>
                <Stack spacing={1.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Služby</Typography>
                  {s.byService.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography> : s.byService.map((x) => (
                    <ProgressRow key={x.serviceId || x.serviceName} name={x.serviceName} seats={x.seats} registered={x.registered} remaining={Math.max(0, x.seats - x.registered)} />
                  ))}
                </Stack>
                <Stack spacing={1.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Činnosti</Typography>
                  {s.byActivity.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography> : s.byActivity.map((x) => (
                    <ProgressRow key={x.activityId || x.activityName} name={x.serviceName !== '' ? `${x.activityName} (${x.serviceName})` : x.activityName} seats={x.seats} registered={x.registered} remaining={x.remaining} />
                  ))}
                </Stack>
              </Box>
            </SoftCard>
          ) : summary.isError && blockSeatRows.length > 0 ? (
            <ClubSeatsCard rows={blockSeatRows} />
          ) : (
            <SoftCard data-testid="club-breakdown-empty" role="region" aria-label="Rozpis podle služeb a činností">
              <SectionLabel>Rozpis podle služeb a činností</SectionLabel>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {summary.isError ? 'Rozpis se nepodařilo načíst.' : 'Zatím nic k rozepsání — klub nemá žádná místa.'}
              </Typography>
            </SoftCard>
          )}
        </Box>

        {/* ── Starší rezervace: bloky bez objednávky (the windows of an order live in its card above) ── */}
        {legacyBlocks.length > 0 ? (
          <Stack spacing={2.5} aria-label="Starší rezervace (bez objednávky)" role="region" data-testid="club-legacy-blocks" sx={{ ...span, minWidth: 0 }}>
            <SectionLabel sx={{ mb: 0 }}>Starší rezervace (bez objednávky)</SectionLabel>
            {legacyBlocks.map((b) => (
              <ClubBlockPanel
                key={b.id}
                block={b}
                highlighted={focusBlockId === b.id}
                contactEmail={club.contactEmail}
                clubName={club.name}
              />
            ))}
          </Stack>
        ) : null}

        {order !== null ? (
          <Box sx={{ ...span, minWidth: 0 }}>
            <LegacyReservation club={club} order={order} percent={percent} priceOf={priceOf} pricesReady={pricesReady} onInvoice={onInvoice} onReload={onReload} />
          </Box>
        ) : null}

        {/* ── Akce ── */}
        <SoftCard data-testid="club-actions" role="region" aria-label="Akce klubu" sx={span}>
          <SectionLabel>Akce</SectionLabel>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={onNewOrder} sx={{ minHeight: 44 }}>Nová objednávka klubu</Button>
            <Button variant="outlined" onClick={onNewReservation} sx={{ minHeight: 44 }}>Vytvořit rezervaci</Button>
            <Button variant="outlined" onClick={() => navigate('/clubs/hraci')} sx={{ minHeight: 44 }}>Sportovci klubů</Button>
            <Button variant="outlined" onClick={onEdit} sx={{ minHeight: 44 }}>Upravit klub</Button>
            {club.isActive ? (
              <Button variant="outlined" color="error" aria-label={`Deaktivovat klub ${club.name}`} onClick={onDeactivate} sx={{ minHeight: 44 }}>Deaktivovat</Button>
            ) : null}
          </Stack>
        </SoftCard>
      </Box>

      <PinnedActions>
        <Button variant="contained" onClick={onNewOrder}>Nová objednávka</Button>
        <Button variant="outlined" onClick={onEdit}>Upravit klub</Button>
      </PinnedActions>
    </Box>
  );
}

export default ClubPresentation;
