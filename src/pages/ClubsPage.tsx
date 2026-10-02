/*
 * Kluby a týmy - design board 3. 10. 2026, screens 16 and 17.
 *
 * One screen, two views. The list is a grid of cards: the club, whether it has
 * a reservation running, who to call, how many athletes it brings and which
 * discount band that puts it in. Opening a card shows the club's bulk
 * reservation the way the board draws it - the athletes' registration link,
 * how many of the places are taken, who took them and when, and on the right
 * the club's facts and the order's money.
 *
 * The data is what the API already answers. Payers come from `/api/clubs`,
 * reservations are the partner orders of every calendar the user may see
 * (4.7), the discount is the clinic's own band table applied to the headcount,
 * and prices come through the activities from the price list. Nothing on this
 * screen is a number of its own: every count is the server's and every sum is
 * worked out in `clubs/clubOrders.ts`, where the tests can see it.
 *
 * The payer record itself - IČO, fakturační adresa, bankovní spojení - is still
 * edited here ("Upravit klub", "Nový klub"), because an invoice to a club
 * needs all of that and the day it is due is the wrong day to find it missing.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, IconButton, InputAdornment, LinearProgress, MenuItem, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import { ContentCopy, Delete, Search } from '@mui/icons-material';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubsApi } from '../services/clubsApi';
import type { Club } from '../services/clubsApi';
import { calendarsApi } from '../api/calendars';
import { activitiesApi } from '../api/activities';
import { appointmentsApi } from '../api/appointments';
import { partnerOrdersApi, type PartnerOrderDetail } from '../api/partnerOrders';
import { clubRegistrationLink } from '../api/publicClub';
import { GROUP_DISCOUNTS_QUERY_KEY, readGroupDiscounts } from '../api/groupDiscounts';
import type { GroupDiscountTier } from '../api/groupDiscounts';
import { formatPragueDate, toDateOnly } from '../utils/time';
import { ClubScheduleReport } from '../components/booking/ClubScheduleReport';
import { FilterChips, PageHeader, SectionLabel, SoftCard, StatusChip } from '../components/ui';
import type { ChipTone } from '../components/ui';
import {
  EMPTY_PAYER, canBeInvoiced, hasPayerErrors, toPayerRequest, validatePayer,
} from './clubs/payerForm';
import type { PayerDraft, PayerErrors } from './clubs/payerForm';
import {
  clubStatus, describeTier, discountPercentFor, formatCzk, formatDateRange, formatDiscount,
  formatShortRange, headcountOf, matchesFilter, matchesSearch, orderDateRange, orderTotal,
  ordersOfClub, primaryOrder, seatRows,
} from './clubs/clubOrders';
import type { ClubFilter, ClubStatus, SeatState } from './clubs/clubOrders';

const draftFromClub = (club: Club): PayerDraft => ({
  name: club.name ?? '',
  ico: club.ico ?? '',
  dic: club.dic ?? '',
  address: club.address ?? '',
  city: club.city ?? '',
  postalCode: club.postalCode ?? '',
  contactPerson: club.contactPerson ?? '',
  contactEmail: club.contactEmail ?? '',
  contactPhone: club.contactPhone ?? '',
  bankAccount: club.bankAccount ?? '',
  bankCode: club.bankCode ?? '',
  iban: club.iban ?? '',
  paymentTermsDays: String(club.paymentTermsDays ?? 14),
});

const STATUS_CHIP: Record<ClubStatus, { tone: ChipTone; label: string }> = {
  active: { tone: 'green', label: 'Aktivní rezervace' },
  none: { tone: 'grey', label: 'Bez objednávky' },
  done: { tone: 'grey', label: 'Dokončeno' },
};

const SEAT_CHIP: Record<SeatState, { tone: ChipTone; label: string }> = {
  registered: { tone: 'green', label: 'Registrován' },
  missingQuestionnaire: { tone: 'beige', label: 'Chybí dotazník' },
  waiting: { tone: 'grey', label: 'Čeká na sportovce' },
};

const FILTERS: { key: ClubFilter; label: string }[] = [
  { key: 'all', label: 'Všechny' },
  { key: 'active', label: 'S aktivní rezervací' },
  { key: 'none', label: 'Bez objednávky' },
];

/** What the calendar or another screen may hand over: open one club straight away. */
interface ClubsHandoff {
  clubId?: string;
}

/** One club with everything the card and the detail need worked out once. */
interface ClubRow {
  club: Club;
  orders: PartnerOrderDetail[];
  status: ClubStatus;
  order: PartnerOrderDetail | null;
  headcount: number | null;
  percent: number | null;
}

const contactLine = (club: Club): string => {
  const parts = [club.contactPerson, club.contactPhone].filter((p) => (p ?? '').trim() !== '');
  return parts.length > 0 ? parts.join(' · ') : 'Bez kontaktu';
};

export default function ClubsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const handoff = (location.state ?? null) as ClubsHandoff | null;

  const [filter, setFilter] = useState<ClubFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(handoff?.clubId ?? null);

  /* `null` closed; a club to change it; `'new'` to add one. */
  const [editing, setEditing] = useState<Club | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PayerDraft>(EMPTY_PAYER);
  const [errors, setErrors] = useState<PayerErrors>({});

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const list = await clubsApi.getAll(false);
      return Array.isArray(list) ? list : [];
    },
  });

  const calendarsQuery = useQuery({
    queryKey: ['calendars'],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );

  /* Every calendar's orders - a club may be held on any of them. */
  const ordersQueries = useQueries({
    queries: calendars.map((c) => ({
      queryKey: ['partner-orders', c.id],
      queryFn: () => partnerOrdersApi.list(c.id),
    })),
  });
  const orders = useMemo(() => ordersQueries.flatMap((q) => q.data ?? []), [ordersQueries]);
  const ordersLoading = ordersQueries.some((q) => q.isLoading);
  const ordersFailed = ordersQueries.some((q) => q.isError);

  const discountsQuery = useQuery({ queryKey: GROUP_DISCOUNTS_QUERY_KEY, queryFn: readGroupDiscounts });
  const tiers = useMemo<GroupDiscountTier[]>(
    () => discountsQuery.data?.settings.tiers ?? [],
    [discountsQuery.data],
  );

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const priceOf = (activityId: string): number | null =>
    (activitiesQuery.data?.activities ?? []).find((a) => a.id === activityId)?.priceCzk ?? null;

  const today = toDateOnly(new Date());
  const rows = useMemo<ClubRow[]>(
    () =>
      (clubsQuery.data ?? []).map((club) => {
        const own = ordersOfClub(club, orders);
        const order = primaryOrder(own, today);
        const headcount = headcountOf(order);
        return {
          club,
          orders: own,
          status: clubStatus(own, today),
          order,
          headcount,
          percent: discountPercentFor(tiers, headcount),
        };
      }),
    [clubsQuery.data, orders, tiers, today],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      none: rows.filter((r) => r.status === 'none').length,
    }),
    [rows],
  );

  const visible = rows.filter((r) => matchesFilter(r.status, filter) && matchesSearch(r.club, search));
  const selected = selectedId === null ? null : (rows.find((r) => r.club.id === selectedId) ?? null);

  /* Spend the handoff once it has done its job, so Back does not reopen it.
     Mount-only on purpose: the club id has already been read into state. */
  useEffect(() => {
    if (handoff !== null && handoff.clubId !== undefined) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, []);

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['clubs'] });
    void queryClient.invalidateQueries({ queryKey: ['partner-orders'] });
  };

  /* ── The payer record (unchanged behaviour, the board's look) ── */

  const openFor = (club: Club | 'new') => {
    setForm(club === 'new' ? EMPTY_PAYER : draftFromClub(club));
    setErrors({});
    setEditing(club);
  };

  const set = (field: keyof PayerDraft, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    /* Clear this field's complaint as it is being fixed; leave the others, so
       correcting one does not hide the rest. */
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const save = async () => {
    const found = validatePayer(form);
    if (hasPayerErrors(found)) {
      setErrors(found);
      return;
    }

    setSaving(true);
    try {
      const body = toPayerRequest(form);
      if (editing === 'new') await clubsApi.create(body);
      else if (editing !== null) await clubsApi.update(editing.id, body);
      toast.success(editing === 'new' ? 'Klub založen' : 'Změny uloženy');
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Deaktivovat klub ${name}?`)) return;
    try {
      await clubsApi.deactivate(id);
      toast.success('Klub deaktivován');
      if (selectedId === id) setSelectedId(null);
      reload();
    } catch {
      toast.error('Akce selhala');
    }
  };

  const field = (
    key: keyof PayerDraft,
    label: string,
    extra: { help?: string; width?: number } = {},
  ) => (
    <Grid size={{ xs: 12, sm: extra.width ?? 6 }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        error={errors[key] !== undefined}
        helperText={errors[key] ?? extra.help}
      />
    </Grid>
  );

  const payerDialog = (
    <Dialog open={editing !== null} onClose={saving ? undefined : () => setEditing(null)}
      maxWidth="md" fullWidth>
      <DialogTitle>{editing === 'new' ? 'Nový klub' : 'Upravit klub'}</DialogTitle>
      <DialogContent>
        <SectionLabel sx={{ mt: 1 }}>Identifikace</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('name', 'Název', { width: 12 })}
          {field('ico', 'IČO', { help: 'Osm číslic' })}
          {field('dic', 'DIČ', { help: 'Nepovinné — CZ a 8 až 10 číslic' })}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Fakturační adresa</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('address', 'Ulice a číslo', { width: 12 })}
          {field('city', 'Město')}
          {field('postalCode', 'PSČ')}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Bankovní spojení a splatnost</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('bankAccount', 'Číslo účtu')}
          {field('bankCode', 'Kód banky', { help: 'Čtyři číslice' })}
          {field('iban', 'IBAN', { help: 'Nepovinné, pokud je vyplněn účet' })}
          {field('paymentTermsDays', 'Splatnost (dní)')}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Kontakt</SectionLabel>
        <Grid container spacing={2}>
          {field('contactPerson', 'Kontaktní osoba')}
          {field('contactEmail', 'E-mail')}
          {field('contactPhone', 'Telefon')}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setEditing(null)} disabled={saving}>
          Zrušit
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  /* ── Loading and failure ── */

  if (clubsQuery.isLoading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2.5, maxWidth: 420 }} />
        <Skeleton variant="rounded" height={44} sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}
        </Box>
      </Box>
    );
  }

  if (clubsQuery.isError) {
    return (
      <Box>
        <PageHeader title="Kluby a týmy" subtitle="Hromadné objednávky a registrační odkazy" />
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => void clubsQuery.refetch()}>Zkusit znovu</Button>}
        >
          Kluby se nepodařilo načíst.
        </Alert>
      </Box>
    );
  }

  /* ── Detail: design-17 ── */

  if (selected !== null) {
    return (
      <Box>
        <ClubDetail
          row={selected}
          tiers={tiers}
          priceOf={priceOf}
          pricesReady={activitiesQuery.isSuccess || activitiesQuery.isError}
          onBack={() => setSelectedId(null)}
          onEdit={() => openFor(selected.club)}
          onDeactivate={() => void remove(selected.club.id, selected.club.name)}
          onReload={reload}
          onInvoice={() =>
            navigate('/billing', { state: { clubId: selected.club.id, partnerOrderId: selected.order?.id ?? null } })
          }
          onNewReservation={() =>
            navigate('/vyhrazeni', {
              state: { clubId: selected.club.id, calendarId: selected.order?.calendarId ?? calendars[0]?.id },
            })
          }
        />
        {payerDialog}
      </Box>
    );
  }

  /* ── List: design-16 ── */

  return (
    <Box>
      <PageHeader
        title="Kluby a týmy"
        subtitle="Hromadné objednávky a registrační odkazy"
        actions={<Button variant="contained" onClick={() => openFor('new')}>Nový klub</Button>}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5, alignItems: { md: 'center' } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Název klubu nebo kontaktní osoba"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Hledat klub' },
          }}
        />
        <FilterChips
          ariaLabel="Filtr klubů"
          options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
          value={filter}
          onChange={setFilter}
        />
      </Stack>

      {ordersFailed ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => ordersQueries.forEach((q) => void q.refetch())}>
              Zkusit znovu
            </Button>
          }
        >
          Rezervace některých kalendářů se nepodařilo načíst — stav klubů může být neúplný.
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <SoftCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Zatím tu žádný klub není.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Přidejte klub nebo organizaci, která objednává prohlídky pro své sportovce.
          </Typography>
          <Button variant="contained" onClick={() => openFor('new')}>Nový klub</Button>
        </SoftCard>
      ) : visible.length === 0 ? (
        <SoftCard sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tomuto filtru neodpovídá žádný klub.
          </Typography>
        </SoftCard>
      ) : (
        <Box
          role="list"
          aria-label="Kluby"
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}
        >
          {visible.map((row) => (
            <ClubCard
              key={row.club.id}
              row={row}
              ordersLoading={ordersLoading}
              onOpen={() => setSelectedId(row.club.id)}
            />
          ))}
        </Box>
      )}

      {payerDialog}
    </Box>
  );
}

/* ── One card of the grid ── */

function ClubCard({ row, ordersLoading, onOpen }: { row: ClubRow; ordersLoading: boolean; onOpen: () => void }) {
  const chip = STATUS_CHIP[row.status];
  return (
    <SoftCard
      role="listitem"
      sx={{
        p: 2.5,
        cursor: 'pointer',
        transition: 'border-color 120ms',
        '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 'none' },
        ...(row.club.isActive ? {} : { opacity: 0.6 }),
      }}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, minWidth: 0 }} noWrap>
          {row.club.name}
        </Typography>
        {ordersLoading && row.status === 'none' ? (
          <Skeleton variant="rounded" width={96} height={22} sx={{ borderRadius: 999 }} />
        ) : (
          <StatusChip tone={chip.tone}>{row.club.isActive ? chip.label : 'Neaktivní'}</StatusChip>
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
        {contactLine(row.club)}
      </Typography>
      <Divider sx={{ my: 1.75 }} />
      <Stack direction="row" spacing={4}>
        <Figure value={row.headcount === null ? '—' : String(row.headcount)} label="sportovců" />
        <Figure value={formatDiscount(row.percent)} label="sleva" />
      </Stack>
    </SoftCard>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

/** A small-caps label over its value, the board's way of listing facts. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <SectionLabel sx={{ mb: 0 }}>{label}</SectionLabel>
      <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{children}</Typography>
    </Box>
  );
}

/* ── The detail ── */

function ClubDetail({
  row, tiers, priceOf, pricesReady, onBack, onEdit, onDeactivate, onReload, onInvoice, onNewReservation,
}: {
  row: ClubRow;
  tiers: GroupDiscountTier[];
  priceOf: (activityId: string) => number | null;
  pricesReady: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReload: () => void;
  onInvoice: () => void;
  onNewReservation: () => void;
}) {
  const { club, order, headcount } = row;
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

  const money = order === null ? null : orderTotal(order, priceOf, tiers);

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

  return (
    <Box>
      <PageHeader
        title={club.name}
        subtitle={
          order === null
            ? 'Zatím bez hromadné rezervace'
            : range === null
              ? 'Hromadná rezervace — termíny zatím nejsou vyhrazené'
              : `Hromadná rezervace ${formatDateRange(range.from, range.to)}`
        }
        actions={<Button variant="outlined" onClick={onBack}>Zpět na kluby</Button>}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, gap: 2.5, alignItems: 'start' }}>
        <Stack spacing={2.5}>
          {order === null ? (
            <SoftCard sx={{ textAlign: 'center', py: 5 }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Tento klub zatím nemá hromadnou rezervaci.</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Vyhraďte klubu termíny a pošlete mu odkaz, přes který se sportovci sami registrují.
              </Typography>
              <Button variant="contained" onClick={onNewReservation}>Vytvořit rezervaci</Button>
            </SoftCard>
          ) : (
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
                  >
                    Kopírovat
                  </Button>
                  <Button
                    variant="outlined"
                    component="a"
                    href={mailto ?? undefined}
                    disabled={mailto === null || order.isRevoked}
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
          )}
        </Stack>

        <Stack spacing={2.5}>
          <SoftCard>
            <SectionLabel>Klub</SectionLabel>
            <Stack spacing={1.5}>
              <Fact label="Název">{club.name}</Fact>
              <Fact label="Kontakt">{club.contactPerson || '—'}</Fact>
              <Fact label="Telefon">{club.contactPhone || '—'}</Fact>
              <Fact label="E-mail">{club.contactEmail || order?.contactEmail || '—'}</Fact>
              <Fact label="Sportovců">{headcount ?? '—'}</Fact>
              <Fact label="Cenová hladina">{describeTier(tiers, headcount)}</Fact>
              <Fact label="Fakturace">
                {canBeInvoiced(club) ? 'Na klub' : (
                  <Box component="span" sx={{ color: 'warning.main' }}>Chybí fakturační údaje</Box>
                )}
              </Fact>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={onEdit}>Upravit klub</Button>
              {club.isActive ? (
                <Tooltip title="Deaktivovat klub">
                  <IconButton size="small" color="error" aria-label={`Deaktivovat klub ${club.name}`} onClick={onDeactivate}>
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
                <Button variant="contained" onClick={() => setAddingSeats(true)} disabled={order.isRevoked}>
                  Přidat místa
                </Button>
                <Button variant="outlined" onClick={onInvoice}>Vystavit fakturu</Button>
                <Button variant="text" size="small" onClick={() => setReportOpen(true)}>Rozpis / tisk</Button>
              </Stack>
              <ClubScheduleReport order={order} open={reportOpen} onClose={() => setReportOpen(false)} />
              {addingSeats ? (
                <AddSeatsDialog order={order} onClose={() => setAddingSeats(false)} onSaved={onReload} />
              ) : null}
            </SoftCard>
          ) : null}
        </Stack>
      </Box>
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
