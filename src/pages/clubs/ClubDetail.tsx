/*
 * One club (board screen 17): the blocks it holds with their registration links
 * and athletes, the older bulk reservation (link, places, athletes table), the
 * club's facts and the order's money.
 *
 *   phone     one column - the club's blocks and links, then facts and order;
 *             the main actions are pinned to the bottom of the screen
 *   tablet    two columns, a 250 px rail
 *   desktop   two columns, a 280 px rail as drawn
 *
 * The discount shown is the club's own `discountPercent`, the administrator's
 * choice; nothing here derives a percentage from a headcount.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import { ContentCopy, Delete } from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api/appointments';
import { partnerOrdersApi } from '../../api/partnerOrders';
import type { PartnerOrderDetail } from '../../api/partnerOrders';
import type { ClubBlockView } from '../../api/clubBlocks';
import type { Club } from '../../api/clubs';
import { clubRegistrationLink } from '../../api/publicClub';
import { useDevice } from '../../layout/useDevice';
import { formatPragueDate } from '../../utils/time';
import { ClubScheduleReport } from '../../components/booking/ClubScheduleReport';
import { PageHeader, SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { ClubAvatar } from '../../components/clubs/ClubAvatar';
import { ClubBlockPanel } from '../../components/clubs/ClubBlockPanel';
import { blockRange } from '../../components/clubs/blockLogic';
import { canBeInvoiced } from './payerForm';
import {
  describeDiscount, formatCzk, formatDateRange, formatShortRange, orderDateRange, orderTotal, seatRows,
} from './clubOrders';
import type { SeatState } from './clubOrders';
import type { ClubRow } from './clubRow';
import { PinnedActions } from './PinnedActions';

const SEAT_CHIP: Record<SeatState, { tone: ChipTone; label: string }> = {
  registered: { tone: 'green', label: 'Registrován' },
  missingQuestionnaire: { tone: 'beige', label: 'Chybí dotazník' },
  waiting: { tone: 'grey', label: 'Čeká na sportovce' },
};

/** A small-caps label over its value, the board's way of listing facts. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <SectionLabel sx={{ mb: 0 }}>{label}</SectionLabel>
      <Typography component="div" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{children}</Typography>
    </Box>
  );
}

export function ClubDetail({
  row, clubs, allBlocks, priceOf, pricesReady, focusBlockId, onBack, onEdit, onDeactivate, onReload, onInvoice, onNewReservation, onNewBlock,
}: {
  row: ClubRow;
  clubs: Club[];
  allBlocks: ClubBlockView[];
  priceOf: (activityId: string) => number | null;
  pricesReady: boolean;
  /** A block the router asked to land on. */
  focusBlockId: string | null;
  onBack: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReload: () => void;
  onInvoice: () => void;
  onNewReservation: () => void;
  onNewBlock: () => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const { club, order, headcount, percent, blocks } = row;
  const range = order === null ? null : orderDateRange(order);
  const [reportOpen, setReportOpen] = useState(false);
  const [addingSeats, setAddingSeats] = useState(false);

  const link = order?.token ? clubRegistrationLink(order.token) : null;
  const booked = order?.bookedCount ?? 0;
  const requested = order?.requestedCount ?? 0;
  const freePlaces = Math.max(0, requested - booked);

  /* The athletes who took a place: the appointments inside the held windows. */
  const appointmentsQuery = useQuery({
    queryKey: ['partner-order-seats', order?.id, range?.from, range?.to],
    queryFn: () => appointmentsApi.range(range!.from, range!.to, [order!.calendarId]),
    enabled: order !== null && range !== null,
  });
  const seats = order === null ? [] : seatRows(order, appointmentsQuery.data ?? []);
  const money = order === null ? null : orderTotal(order, priceOf, percent);

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
    link !== null && (club.contactEmail ?? order?.contactEmail ?? '') !== ''
      ? `mailto:${encodeURIComponent(club.contactEmail || order?.contactEmail || '')}?subject=${encodeURIComponent(
          `Registrace sportovců — ${club.name}`,
        )}&body=${encodeURIComponent(
          `Dobrý den,\n\nsportovci klubu ${club.name} se na prohlídku registrují tímto odkazem:\n${link}\n\n` +
            (order?.expiresAt ? `Odkaz platí do ${formatPragueDate(order.expiresAt)}.\n\n` : '') +
            'S pozdravem',
        )}`
      : null;

  const firstBlock = blocks.find((b) => b.status === 'Active') ?? null;
  const subtitle =
    firstBlock !== null
      ? `Blok ${blockRange(firstBlock)}${blocks.filter((b) => b.status === 'Active').length > 1 ? ` a další (${blocks.filter((b) => b.status === 'Active').length})` : ''}`
      : order === null
        ? 'Zatím bez hromadné rezervace'
        : range === null
          ? 'Hromadná rezervace — termíny zatím nejsou vyhrazené'
          : `Hromadná rezervace ${formatDateRange(range.from, range.to)}`;

  const hasAnything = order !== null || blocks.length > 0;
  const railWidth = device === 'desktop' ? '280px' : '250px';

  return (
    <Box data-testid="club-detail" data-layout={device} data-columns={phone ? 1 : 2}>
      <PageHeader
        title={club.name}
        subtitle={subtitle}
        leading={<ClubAvatar name={club.name} color={row.color} size={44} />}
        actions={
          <>
            {!phone ? <Button variant="contained" onClick={onNewBlock}>Nový blok</Button> : null}
            <Button variant="outlined" onClick={onBack} sx={{ minHeight: phone ? 44 : undefined }}>Zpět na kluby</Button>
          </>
        }
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : `minmax(0, 1fr) ${railWidth}`, gap: 2.5, alignItems: 'start' }}>
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          {!hasAnything ? (
            <SoftCard sx={{ textAlign: 'center', py: 5 }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Tento klub zatím nemá hromadnou rezervaci.</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Vyhraďte klubu termíny v kalendářích a pošlete mu odkaz, přes který se sportovci sami registrují.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'center' }}>
                <Button variant="contained" onClick={onNewBlock} sx={{ minHeight: 44 }}>Vytvořit blok</Button>
                <Button variant="outlined" onClick={onNewReservation} sx={{ minHeight: 44 }}>Vytvořit rezervaci</Button>
              </Stack>
            </SoftCard>
          ) : null}

          {blocks.length > 0 ? (
            <Stack spacing={2.5} aria-label="Bloky klubu" role="region">
              {blocks.map((b) => (
                <ClubBlockPanel
                  key={b.id}
                  block={b}
                  clubs={clubs}
                  allBlocks={allBlocks}
                  highlighted={focusBlockId === b.id}
                  contactEmail={club.contactEmail}
                  clubName={club.name}
                />
              ))}
            </Stack>
          ) : null}

          {order !== null ? (
            <>
              <SoftCard>
                <SectionLabel>Registrační odkaz pro sportovce</SectionLabel>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
                  <Box
                    data-testid="club-link"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      px: 1.75,
                      py: 1.25,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: link === null ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {order.isRevoked
                      ? 'Odkaz byl zrušen.'
                      : (link ?? 'Odkaz zatím není k dispozici — server ho nevrací.')}
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                    disabled={link === null || order.isRevoked}
                    onClick={() => void copy()}
                    sx={{ minHeight: 44 }}
                  >
                    Kopírovat
                  </Button>
                  <Button
                    variant="outlined"
                    component="a"
                    href={mailto ?? undefined}
                    disabled={mailto === null || order.isRevoked}
                    sx={{ minHeight: 44 }}
                  >
                    Poslat klubu
                  </Button>
                </Stack>

                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 2.5, mb: 0.75 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Obsazeno {booked} z {requested} míst
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {freePlaces} volných
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={requested > 0 ? Math.min(100, (booked / requested) * 100) : 0}
                  aria-label="Obsazenost míst"
                />
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                  {order.isRevoked
                    ? 'Odkaz byl zrušen — nové registrace přes něj už nejdou. Kdo má termín, ten mu zůstává.'
                    : order.expiresAt
                      ? `Odkaz platí do ${formatPragueDate(order.expiresAt)}. Každý sportovec si vybere jeden z rezervovaných časů.`
                      : 'Každý sportovec si vybere jeden z rezervovaných časů.'}
                </Typography>
              </SoftCard>

              <SoftCard>
                <SectionLabel>Rezervovaná místa</SectionLabel>
                {appointmentsQuery.isError ? (
                  <Alert
                    severity="warning"
                    sx={{ mb: 1.5 }}
                    action={<Button color="inherit" size="small" onClick={() => void appointmentsQuery.refetch()}>Zkusit znovu</Button>}
                  >
                    Registrované sportovce se nepodařilo načíst.
                  </Alert>
                ) : null}
                {appointmentsQuery.isLoading ? (
                  <Stack spacing={1}>
                    {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}
                  </Stack>
                ) : seats.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Objednávka zatím nemá žádná místa — přidejte je vpravo.
                  </Typography>
                ) : phone ? (
                  <Stack spacing={1} role="list" aria-label="Rezervovaná místa">
                    {seats.map((seat) => (
                      <Box key={seat.key} role="listitem" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5 }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{seat.name ?? '—'}</Typography>
                          <StatusChip tone={SEAT_CHIP[seat.state].tone} size="sm">{SEAT_CHIP[seat.state].label}</StatusChip>
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {[seat.name === null ? 'volné místo' : seat.activityName, seat.when || null].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <Table size="small" aria-label="Rezervovaná místa">
                      <TableHead>
                        <TableRow>
                          <TableCell>Sportovec</TableCell>
                          <TableCell>Činnost</TableCell>
                          <TableCell>Termín</TableCell>
                          <TableCell>Stav</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {seats.map((seat) => (
                          <TableRow key={seat.key} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{seat.name ?? '—'}</TableCell>
                            <TableCell sx={{ color: seat.name === null ? 'text.secondary' : 'text.primary' }}>
                              {seat.name === null ? 'volné místo' : seat.activityName}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{seat.when || '—'}</TableCell>
                            <TableCell>
                              <StatusChip tone={SEAT_CHIP[seat.state].tone}>{SEAT_CHIP[seat.state].label}</StatusChip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </SoftCard>
            </>
          ) : null}
        </Stack>

        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <SoftCard>
            <SectionLabel>Klub</SectionLabel>
            <Stack spacing={1.5}>
              <Fact label="Název">{club.name}</Fact>
              <Fact label="Kontakt">{club.contactPerson || '—'}</Fact>
              <Fact label="Telefon">{club.contactPhone || '—'}</Fact>
              <Fact label="E-mail">{club.contactEmail || order?.contactEmail || '—'}</Fact>
              <Fact label="Sportovců">{headcount ?? '—'}</Fact>
              <Fact label="Sleva klubu">{describeDiscount(percent)}</Fact>
              {row.color !== null ? (
                <Fact label="Barva v kalendáři">
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box aria-hidden="true" sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: row.color }} />
                    <span>{row.color.toUpperCase()}</span>
                  </Stack>
                </Fact>
              ) : null}
              <Fact label="Fakturace">
                {canBeInvoiced(club) ? 'Na klub' : (
                  <Box component="span" sx={{ color: 'warning.main' }}>Chybí fakturační údaje</Box>
                )}
              </Fact>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={onEdit} sx={{ minHeight: phone ? 44 : undefined }}>Upravit klub</Button>
              {club.isActive ? (
                <Tooltip title="Deaktivovat klub">
                  <IconButton size="small" color="error" aria-label={`Deaktivovat klub ${club.name}`} onClick={onDeactivate} sx={{ width: 44, height: 44 }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          </SoftCard>

          {order !== null && money !== null ? (
            <SoftCard>
              <SectionLabel>Objednávka</SectionLabel>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {money.seats} míst
                {order.items.length > 0 ? ` · ${order.items.map((i) => i.activityName).join(', ')}` : ''}
                {range !== null ? ` · ${formatShortRange(range.from, range.to)}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                {money.total === null ? (pricesReady ? '—' : '…') : formatCzk(money.total)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}>
                {money.explain}
              </Typography>
              <Stack spacing={1}>
                <Button variant="contained" onClick={() => setAddingSeats(true)} disabled={order.isRevoked} sx={{ minHeight: 44 }}>
                  Přidat místa
                </Button>
                <Button variant="outlined" onClick={onInvoice} sx={{ minHeight: 44 }}>Vystavit fakturu</Button>
                <Button variant="text" size="small" onClick={() => setReportOpen(true)} sx={{ minHeight: 44 }}>Rozpis / tisk</Button>
              </Stack>
              <ClubScheduleReport order={order} open={reportOpen} onClose={() => setReportOpen(false)} />
              {addingSeats ? (
                <AddSeatsDialog order={order} onClose={() => setAddingSeats(false)} onSaved={onReload} />
              ) : null}
            </SoftCard>
          ) : null}
        </Stack>
      </Box>

      <PinnedActions>
        <Button variant="contained" onClick={onNewBlock}>Nový blok</Button>
        <Button variant="outlined" onClick={onEdit}>Upravit klub</Button>
      </PinnedActions>
    </Box>
  );
}

/* ── Přidat místa: more of a činnost the club already ordered ── */

function AddSeatsDialog({
  order, onClose, onSaved,
}: {
  order: PartnerOrderDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activityId, setActivityId] = useState(order.items[0]?.activityId ?? '');
  const [count, setCount] = useState('1');
  const n = Number.parseInt(count, 10);
  const valid = activityId !== '' && Number.isInteger(n) && n > 0;

  const save = useMutation({
    mutationFn: () =>
      partnerOrdersApi.setItems(
        order.calendarId,
        order.id,
        order.items.map((i) => ({
          activityId: i.activityId,
          requestedCount: i.activityId === activityId ? i.requestedCount + n : i.requestedCount,
        })),
      ),
    onSuccess: () => {
      toast.success(`Přidáno ${n} míst`);
      onSaved();
      onClose();
    },
  });

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Přidat místa</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {order.items.length === 0 ? (
            <Alert severity="info">Objednávka zatím nemá žádnou činnost — doplňte ji ve Vyhrazení pro kluby.</Alert>
          ) : (
            <TextField
              select
              size="small"
              label="Činnost"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              {order.items.map((i) => (
                <MenuItem key={i.activityId} value={i.activityId}>
                  {i.activityName} · nyní {i.requestedCount} míst
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            size="small"
            type="number"
            label="Kolik míst přidat"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          {save.isError ? <Alert severity="error">Místa se nepodařilo přidat.</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={save.isPending}>Zrušit</Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Přidat
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ClubDetail;
