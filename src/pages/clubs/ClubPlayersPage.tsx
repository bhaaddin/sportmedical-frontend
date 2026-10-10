/*
 * Kluby > Hráči (Etapa 4): all athletes registered through club links, across clubs. Filters by club, činnost,
 * status and name; "Stáhnout seznam" downloads the filtered list as CSV.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Link, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ATHLETE_STATUSES, clubBlocksApi, type ClubBlockAthleteStatus } from '../../api/clubBlocks';
import { clubOrdersApi } from '../../api/clubOrders';
import { ATHLETE_STATUS_LABEL, ATHLETE_STATUS_TONE, athletePriceText } from '../../components/clubs/athleteList';
import { PageHeader, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../components/ui/ResponsiveDataList';
import { downloadCsv } from '../statistics/csv';
import { formatSlotTime } from './clubOrders';
import { ClubDot, LoadError, SelectFilter } from './subpages/common';
import { collectPlayers, filterPlayers, playersToCsv, telHref, type PlayerRow } from './subpages/players';

export default function ClubPlayersPage() {
  const [clubId, setClubId] = useState('');
  const [activity, setActivity] = useState('');
  const [status, setStatus] = useState<'' | ClubBlockAthleteStatus>('');
  const [search, setSearch] = useState('');

  const blocksQuery = useQuery({ queryKey: ['club-players', 'blocks'], queryFn: () => clubBlocksApi.list({}) });
  /* An order may carry athletes the block list does not; if it fails the blocks still tell most of the story. */
  const ordersQuery = useQuery({ queryKey: ['club-players', 'orders'], queryFn: () => clubOrdersApi.list({}) });

  const all = useMemo(() => collectPlayers(blocksQuery.data ?? [], ordersQuery.data ?? []), [blocksQuery.data, ordersQuery.data]);
  const clubs = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of all) m.set(p.clubId, p.clubName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'cs'));
  }, [all]);
  const activities = useMemo(() => [...new Set(all.map((p) => p.activityName).filter((a) => a !== ''))].sort((a, b) => a.localeCompare(b, 'cs')), [all]);
  const rows = useMemo(() => filterPlayers(all, { clubId, activity, status, search }), [all, clubId, activity, status, search]);

  const phoneLink = (p: PlayerRow) =>
    p.phone ? (
      <Link href={telHref(p.phone)} onClick={(e) => e.stopPropagation()}>{p.phone}</Link>
    ) : (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
    );
  const chip = (p: PlayerRow) => <StatusChip tone={ATHLETE_STATUS_TONE[p.status]}>{ATHLETE_STATUS_LABEL[p.status]}</StatusChip>;
  const term = (p: PlayerRow) => (p.startUtc === null ? '—' : formatSlotTime(p.startUtc));
  /* Etapa 12: every player with the price of the visit - agreed or list, "(upraveno)" when the desk changed it. */
  const price = (p: PlayerRow) => <Typography variant="body2" data-testid="player-price" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{athletePriceText(p)}</Typography>;

  const columns: DataColumn<PlayerRow>[] = [
    { key: 'name', header: 'Jméno', tablet: true, cell: (p) => <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography> },
    {
      key: 'club', header: 'Klub', tablet: true,
      cell: (p) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ClubDot color={p.clubColorHex} />
          <span>{p.clubName}</span>
        </Stack>
      ),
    },
    { key: 'status', header: 'Stav', cell: chip },
    { key: 'activity', header: 'Činnost', cell: (p) => p.activityName || '—' },
    { key: 'term', header: 'Termín', cell: term },
    { key: 'phone', header: 'Telefon', cell: phoneLink },
    { key: 'price', header: 'Cena', tablet: true, align: 'right', cell: price },
  ];

  const card = (p: PlayerRow) => (
    <Stack spacing={0.75}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
        {chip(p)}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <ClubDot color={p.clubColorHex} />
        <Typography variant="body2">{p.clubName}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{[p.activityName, term(p)].filter((s) => s !== '' && s !== '—').join(' · ')}</Typography>
      {price(p)}
      {phoneLink(p)}
    </Stack>
  );

  return (
    <Box>
      <PageHeader
        title="Hráči klubů"
        subtitle={`Zaregistrovaní přes odkazy klubů · ${rows.length}`}
        actions={
          <Button variant="outlined" disabled={rows.length === 0} onClick={() => downloadCsv('hraci-klubu.csv', `﻿${playersToCsv(rows)}`)}>
            Stáhnout seznam
          </Button>
        }
      />
      <SoftCard sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField size="small" label="Hledat jméno" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <SelectFilter label="Klub" value={clubId} onChange={setClubId} options={[{ value: '', label: 'Všechny kluby' }, ...clubs.map(([id, n]) => ({ value: id, label: n }))]} />
          <SelectFilter label="Činnost" value={activity} onChange={setActivity} options={[{ value: '', label: 'Všechny činnosti' }, ...activities.map((a) => ({ value: a, label: a }))]} />
          <SelectFilter
            label="Stav"
            value={status}
            onChange={(v) => setStatus(v as '' | ClubBlockAthleteStatus)}
            options={[{ value: '', label: 'Všechny' }, ...ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABEL[s] }))]}
          />
        </Stack>
      </SoftCard>

      {blocksQuery.isPending ? (
        <Skeleton variant="rounded" height={160} />
      ) : blocksQuery.isError ? (
        <LoadError onRetry={() => void blocksQuery.refetch()} />
      ) : (
        <ResponsiveDataList
          rows={rows}
          rowKey={(p) => p.id}
          columns={columns}
          renderCard={card}
          ariaLabel="Hráči klubů"
          empty="Zatím se nikdo přes odkazy klubů nezaregistroval."
        />
      )}
    </Box>
  );
}
