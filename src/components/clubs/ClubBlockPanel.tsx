/*
 * One club block in the club's page: status, days, how many of the places the
 * athletes have taken, the registration link, who took them, and the actions -
 * Upravit, Zkrátit, Prodloužit, Zrušit blok.
 *
 * Drawn as a card; on a phone the athletes become small cards and the actions
 * stack full width (no table to scroll sideways, no touch target under 44 px).
 * A cancelled block stays visible, muted and without actions: the history of
 * what the club had is worth more than a list that forgets.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Typography } from '@mui/material';
import { ContentCopy, FileDownloadOutlined } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../api/calendars';
import { clubBlocksApi, fetchBlockableActivities } from '../../api/clubBlocks';
import type { ClubBlockView } from '../../api/clubBlocks';
import { clubRegistrationLink } from '../../api/publicClub';
import { absoluteLink, usePublicSiteBase } from './orders/absoluteLink';
import { useDevice } from '../../layout/useDevice';
import { formatSlotTime } from '../../pages/clubs/clubOrders';
import { SectionLabel, SoftCard, StatusChip } from '../ui';
import { blockRange, blockTitle, formatPlayers, inkOn } from './blockLogic';
import { SeatBars } from './panel/SeatBars';
import { activityLabel, blockActivitySeats, sumSeats } from './panel/seats';
import { ClubBlockDialog } from './ClubBlockDialog';
import { ClubBlockRangeDialog } from './ClubBlockRangeDialog';
import type { RangeMode } from './ClubBlockRangeDialog';
import { CancelClubBlockDialog } from './CancelClubBlockDialog';
import { ATHLETE_STATUS_LABEL, ATHLETE_STATUS_TONE, downloadAthletesCsv, sortAthletes } from './athleteList';
import type { SortDirection } from './athleteList';
import type { Club } from '../../api/clubs';

const mono = '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export function ClubBlockPanel({
  block,
  clubs,
  allBlocks,
  highlighted = false,
  contactEmail,
  clubName,
}: {
  block: ClubBlockView;
  clubs: Club[];
  allBlocks: ClubBlockView[];
  /** Opened straight from the router: scrolled to and outlined. */
  highlighted?: boolean;
  contactEmail?: string | null;
  clubName: string;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const active = block.status === 'Active';
  const [dialog, setDialog] = useState<null | 'edit' | 'cancel' | RangeMode>(null);
  const root = useRef<HTMLDivElement | null>(null);

  /* Landed on from the calendar or the booking drawer: bring the block into view. */
  useEffect(() => {
    if (highlighted) root.current?.scrollIntoView?.({ block: 'center' });
  }, [highlighted]);

  const detailQuery = useQuery({
    queryKey: ['club-blocks', 'detail', block.id],
    queryFn: () => clubBlocksApi.get(block.id),
    enabled: active,
    staleTime: 15_000,
  });
  const detail = detailQuery.data ?? block;
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activityFilter, setActivityFilter] = useState<string>('');

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });
  const calendarNames = block.calendarIds.map((id) => (calendarsQuery.data ?? []).find((c) => c.id === id)?.name).filter(Boolean) as string[];
  const activityNames = block.activityIds.map((id) => (activitiesQuery.data ?? []).find((a) => a.id === id)?.name).filter(Boolean) as string[];

  const publicBase = usePublicSiteBase();
  const rawLink = block.registrationUrl ?? (block.registrationToken ? clubRegistrationLink(block.registrationToken) : null);
  const link = rawLink === null ? null : absoluteLink(rawLink, publicBase);
  const seatRows = blockActivitySeats(
    { ...block, activitySeats: (detail as { activitySeats?: unknown }).activitySeats ?? (block as { activitySeats?: unknown }).activitySeats },
    (id) => (activitiesQuery.data ?? []).find((a) => a.id === id)?.name ?? '',
  );
  const seatTotals = sumSeats(seatRows);
  const sorted = sortAthletes(detail.athletes, sortDirection);
  const rowKey = (r: { activityId: string; activityName: string }) => r.activityId || r.activityName;
  const filterRow = seatRows.find((r) => rowKey(r) === activityFilter);
  const athletes = filterRow === undefined
    ? sorted
    : sorted.filter((a) => {
        const id = (a as { activityId?: unknown }).activityId;
        return typeof id === 'string' && id !== '' ? id === filterRow.activityId : a.activityName === activityLabel(filterRow);
      });

  const copy = async () => {
    if (link === null) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Odkaz zkopírován');
    } catch {
      toast.error('Odkaz se nepodařilo zkopírovat');
    }
  };

  const mailto =
    link !== null && (contactEmail ?? '') !== ''
      ? `mailto:${encodeURIComponent(contactEmail ?? '')}?subject=${encodeURIComponent(`Registrace sportovců — ${clubName}`)}&body=${encodeURIComponent(
          `Dobrý den,\n\nsportovci klubu ${clubName} se na prohlídku registrují tímto odkazem:\n${link}\n\nS pozdravem`,
        )}`
      : null;

  return (
    <SoftCard
      ref={root}
      id={`club-block-${block.id}`}
      data-testid="club-block-panel"
      data-block-id={block.id}
      sx={{
        opacity: active ? 1 : 0.75,
        ...(highlighted ? { borderColor: 'primary.main', borderWidth: 2 } : {}),
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
          <Box
            aria-hidden="true"
            data-testid="block-color"
            data-color={block.colorHex ?? ''}
            sx={{
              flex: '0 0 40px', height: 40, borderRadius: '10px',
              bgcolor: block.colorHex ?? 'action.hover',
              color: block.colorHex ? inkOn(block.colorHex) : 'text.secondary',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
            }}
          >
            {clubName.slice(0, 2).toUpperCase()}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h3" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
              {blockTitle(block)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {blockRange(block)}
              {block.dailyFrom && block.dailyTo ? ` · denně ${block.dailyFrom}–${block.dailyTo}` : ''}
              {` · ${formatPlayers(block.playerCount)}`}
            </Typography>
          </Box>
        </Stack>
        <StatusChip tone={active ? 'green' : 'grey'}>{active ? 'Aktivní blok' : 'Zrušen'}</StatusChip>
      </Stack>

      {calendarNames.length > 0 || activityNames.length > 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {calendarNames.length > 0 ? `Kalendáře: ${calendarNames.join(', ')}` : ''}
          {calendarNames.length > 0 && activityNames.length > 0 ? ' · ' : ''}
          {activityNames.length > 0 ? `Činnosti: ${activityNames.join(', ')}` : ''}
        </Typography>
      ) : null}
      {block.note ? <Typography variant="body2" sx={{ mb: 1.5 }}>{block.note}</Typography> : null}

      {active ? (
        <>
          <SectionLabel>Registrační odkaz pro sportovce</SectionLabel>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
            <Box
              data-testid="block-link"
              sx={{
                flex: 1, minWidth: 0, px: 1.75, py: 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
                bgcolor: 'background.default', fontFamily: mono, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: link === null ? 'text.secondary' : 'text.primary',
              }}
            >
              {link ?? 'Odkaz zatím není k dispozici — server ho nevrací.'}
            </Box>
            <Button variant="contained" startIcon={<ContentCopy sx={{ fontSize: 16 }} />} disabled={link === null} onClick={() => void copy()} sx={{ minHeight: 44 }}>
              Kopírovat
            </Button>
            <Button variant="outlined" component="a" href={mailto ?? undefined} disabled={mailto === null} sx={{ minHeight: 44 }}>
              Poslat klubu
            </Button>
          </Stack>
        </>
      ) : null}

      <Box sx={{ mt: 2.5 }}>
        <Stack direction="row" data-testid="block-seats-summary" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Obsazeno {seatTotals.registered} z {seatTotals.seats} míst
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{seatTotals.free} volných</Typography>
        </Stack>
        {seatRows.length > 1 ? (
          <SeatBars rows={seatRows} label={`Místa bloku ${blockTitle(block)} podle činností`} />
        ) : (
          <LinearProgress
            variant="determinate"
            value={seatTotals.seats > 0 ? Math.min(100, (seatTotals.registered / seatTotals.seats) * 100) : 0}
            aria-label={`Obsazenost bloku ${blockTitle(block)}`}
          />
        )}
      </Box>

      {active ? (
        <Box sx={{ mt: 2.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <SectionLabel sx={{ mb: 0 }}>{`Sportovci v bloku (${detail.registered})`}</SectionLabel>
            {athletes.length > 0 ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadOutlined sx={{ fontSize: 18 }} />}
                onClick={() => downloadAthletesCsv(athletes, blockTitle(block))}
                sx={{ minHeight: 44 }}
              >
                Stáhnout seznam
              </Button>
            ) : null}
          </Stack>
          {seatRows.length > 1 ? (
            <Stack direction="row" role="group" aria-label="Filtr činnosti" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              <Chip
                label="Vše"
                clickable
                color={activityFilter === '' ? 'primary' : 'default'}
                variant={activityFilter === '' ? 'filled' : 'outlined'}
                aria-pressed={activityFilter === ''}
                onClick={() => setActivityFilter('')}
                sx={{ minHeight: 36 }}
              />
              {seatRows.map((r) => (
                <Chip
                  key={rowKey(r)}
                  label={activityLabel(r)}
                  clickable
                  color={activityFilter === rowKey(r) ? 'primary' : 'default'}
                  variant={activityFilter === rowKey(r) ? 'filled' : 'outlined'}
                  aria-pressed={activityFilter === rowKey(r)}
                  onClick={() => setActivityFilter(rowKey(r))}
                  sx={{ minHeight: 36 }}
                />
              ))}
            </Stack>
          ) : null}
          {detailQuery.isError ? (
            <Alert severity="warning" sx={{ mb: 1 }} action={<Button color="inherit" size="small" onClick={() => void detailQuery.refetch()}>Zkusit znovu</Button>}>
              Sportovce bloku se nepodařilo načíst.
            </Alert>
          ) : null}
          {detailQuery.isLoading ? (
            <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
          ) : athletes.length === 0 ? (
            <Typography variant="body2" data-testid="block-athletes-empty" sx={{ color: 'text.secondary' }}>
              {filterRow !== undefined && sorted.length > 0
                ? `Na ${activityLabel(filterRow)} se zatím nikdo nezaregistroval.`
                : 'Zatím se nikdo nezaregistroval. Sportovci se zapisují přes odkaz výše.'}
            </Typography>
          ) : phone ? (
            <Stack spacing={1} role="list" aria-label="Sportovci v bloku">
              {athletes.map((a) => (
                <Box key={a.id} role="listitem" data-testid="block-athlete" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5, opacity: a.status === 'Cancelled' ? 0.65 : 1 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.name}</Typography>
                    <StatusChip tone={ATHLETE_STATUS_TONE[a.status]} size="sm">{ATHLETE_STATUS_LABEL[a.status]}</StatusChip>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {[a.activityName, a.startUtc ? formatSlotTime(a.startUtc) : null].filter(Boolean).join(' · ')}
                  </Typography>
                  {a.phone ? (
                    <Typography variant="body2" component="a" href={`tel:${a.phone.replace(/\s/g, '')}`} sx={{ color: 'primary.main', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
                      {a.phone}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          ) : (
            <TableContainer sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" aria-label={`Sportovci v bloku ${blockTitle(block)}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Sportovec</TableCell>
                    <TableCell>Činnost</TableCell>
                    <TableCell sortDirection={sortDirection}>
                      <TableSortLabel active direction={sortDirection} onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                        Termín
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Stav</TableCell>
                    <TableCell>Telefon</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {athletes.map((a) => (
                    <TableRow key={a.id} hover data-testid="block-athlete" sx={{ opacity: a.status === 'Cancelled' ? 0.65 : 1 }}>
                      <TableCell sx={{ fontWeight: 600 }}>{a.name}</TableCell>
                      <TableCell>{a.activityName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.startUtc ? formatSlotTime(a.startUtc) : '—'}</TableCell>
                      <TableCell>
                        <StatusChip tone={ATHLETE_STATUS_TONE[a.status]}>{ATHLETE_STATUS_LABEL[a.status]}</StatusChip>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {a.phone ? <Box component="a" href={`tel:${a.phone.replace(/\s/g, '')}`} sx={{ color: 'primary.main' }}>{a.phone}</Box> : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      ) : null}

      {active ? (
        <Stack direction={phone ? 'column' : 'row'} spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" onClick={() => setDialog('shorten')} sx={{ minHeight: 44 }}>Zkrátit</Button>
          <Button variant="outlined" onClick={() => setDialog('extend')} sx={{ minHeight: 44 }}>Prodloužit</Button>
          <Button variant="outlined" onClick={() => setDialog('edit')} sx={{ minHeight: 44 }}>Upravit blok</Button>
          <Button variant="outlined" color="error" onClick={() => setDialog('cancel')} sx={{ minHeight: 44, ml: phone ? 0 : 'auto' }}>
            Zrušit blok
          </Button>
        </Stack>
      ) : null}

      {dialog === 'shorten' || dialog === 'extend' ? (
        <ClubBlockRangeDialog block={detail} mode={dialog} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'cancel' ? <CancelClubBlockDialog block={detail} onClose={() => setDialog(null)} /> : null}
      {dialog === 'edit' ? <ClubBlockDialog clubs={clubs} block={detail} blocks={allBlocks} onClose={() => setDialog(null)} /> : null}
    </SoftCard>
  );
}

export default ClubBlockPanel;
