/*
 * Klubová objednávka - "chytrá zkratka" - Etapa 4, contract C-O (docs/etapa4/BRIEF.md).
 *
 * One dialog, three modes by props:
 *   new           nothing given (or `initial`): create an order as a request or straight as a confirmed reservation
 *   edit          `order`: add or remove players, another činnost, move/extend/shorten/add windows
 *   process       `processOrder`: a Requested order from the club's form - fill from its request, adjust, confirm
 *
 * The workflow is Klub -> služba -> činnosti a počty -> způsob platby -> termíny -> poznámka. One service per
 * order: choosing it clears the činnosti and offers only its činnosti and its calendars. The terms start as rows
 * the worker types, or as the server's automatic proposal - which only REPLACES the rows; every row stays
 * editable and counting starts exactly at "Denně od". The analysis beside the form never blocks a save.
 *
 *   desktop  two columns: form left, live analysis right
 *   tablet / phone  full screen; the analysis is a collapsible card pinned above the footer
 *
 * Nothing here knows a service, a price or a number of days: they come from the server.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import { Close, ExpandLess, ExpandMore } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../../api/calendars';
import { clubsApi } from '../../../api/clubs';
import type { Club } from '../../../api/clubs';
import { clinicServicesApi } from '../../../api/clinicServices';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { ClubOrderError, clubOrdersApi, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView, OrderAnalysis, OrderRange, PaymentMethod } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { EMPTY_PAYER, toPayerRequest } from '../../../pages/clubs/payerForm';
import { SectionLabel, SoftCard } from '../../ui';
import { moveToToday, nextDay, parsePlayerCount, plural, sortRows, startsInPast, todayInPrague, validateRow } from '../blockLogic';
import type { RangeRow, RowErrors } from '../blockLogic';
import { useBlockCalculation } from '../dialog/useBlockCalculation';
import { OrderAnalysisCard } from './OrderAnalysisCard';
import type { AnalysisLike } from './OrderAnalysisCard';
import { EMPTY_NEW_CLUB, OrderClubPicker, validateNewClub } from './OrderClubPicker';
import type { NewClubDraft } from './OrderClubPicker';
import { OrderSeatsSection } from './OrderSeatsSection';
import type { OrderActivityItem } from './OrderSeatsSection';
import { OrderSuccess } from './OrderSuccess';
import { OrderTermsSection } from './OrderTermsSection';
import { rangeLine } from './orderFormat';
import {
  emptyRow, fieldMessage, hasIssues, isBlankRow, orderCalendarIds, orderOverlapErrors, orderRanges, rangeFromRow, repeatNextWeek,
  rowFromRange, rowHasError, rowIndexForError, seatPayload, stepSeats, totalSeatsOf, validateOrder,
} from './orderLogic';
import type { SeatsText } from './orderLogic';

export interface ClubOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefill for a new order (from the calendar selection or a club page). */
  initial?: { clubId?: string; serviceId?: string; ranges?: OrderRange[]; calendarIds?: string[] };
  /** Present = edit this order (add/remove players, another činnost, move/extend/add windows). */
  order?: ClubOrderView;
  /** Present = process this Requested order: fill from its request and confirm. */
  processOrder?: ClubOrderView;
  onSaved?: (order: ClubOrderView) => void;
}

type Mode = 'new' | 'edit' | 'process';
type SaveKind = 'Requested' | 'Confirmed' | 'save' | 'confirm';

const PAST_MESSAGE = 'Termín začíná v minulosti';
const STALE = 5 * 60 * 1000;

export function ClubOrderDialog(props: ClubOrderDialogProps) {
  if (!props.open) return null;
  return <OrderDialogBody {...props} />;
}

function OrderDialogBody({ onClose, initial, order, processOrder, onSaved }: ClubOrderDialogProps) {
  const device = useDevice();
  const desktop = device === 'desktop';
  const fieldSize = desktop ? 'small' : 'medium';
  const queryClient = useQueryClient();
  const mode: Mode = processOrder !== undefined ? 'process' : order !== undefined ? 'edit' : 'new';
  const src: ClubOrderView | null = processOrder ?? order ?? null;

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: STALE });
  const servicesQuery = useQuery({ queryKey: ['club-order-services'], queryFn: () => clinicServicesApi.list(), staleTime: STALE, retry: false });
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: STALE });
  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const list = await clubsApi.getAll(false);
      return Array.isArray(list) ? list : [];
    },
    enabled: mode === 'new',
  });

  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const services = useMemo(() => {
    const list = (servicesQuery.data ?? []).filter((s) => s.isActive || s.id === src?.serviceId);
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
  }, [servicesQuery.data, src?.serviceId]);
  const allActivities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);

  /* ── Club ── */
  const [clubMode, setClubMode] = useState<'existing' | 'new'>('existing');
  const [clubId, setClubId] = useState<string>(src?.clubId ?? initial?.clubId ?? '');
  const [newClub, setNewClub] = useState<NewClubDraft>(EMPTY_NEW_CLUB);
  const [newClubErrors, setNewClubErrors] = useState<Partial<Record<keyof NewClubDraft, string>>>({});
  const [createdClub, setCreatedClub] = useState<Club | null>(null);
  const createdClubRef = useRef<Club | null>(null);
  const clubs = useMemo(() => (clubsQuery.data ?? []).filter((c) => c.isActive), [clubsQuery.data]);
  const selectedClub = clubs.find((c) => c.id === (createdClub?.id ?? clubId)) ?? createdClub;
  const clubReady = clubMode === 'new' && createdClub === null ? newClub.name.trim() !== '' : (createdClub?.id ?? clubId) !== '';

  /* ── Service, činnosti, calendars ── */
  const [serviceState, setServiceState] = useState<string | null>(src?.serviceId ?? initial?.serviceId ?? null);
  /* A calendar selection that lies in one service starts that service (the worker still sees and can change it). */
  const inferredService = useMemo(() => {
    const ids = initial?.calendarIds ?? [];
    if (ids.length === 0 || calendars.length === 0) return null;
    const set = new Set(ids.map((id) => calendars.find((c) => c.id === id)?.clinicServiceId ?? null));
    return set.size === 1 ? ([...set][0] ?? null) : null;
  }, [initial?.calendarIds, calendars]);
  const serviceId = serviceState ?? inferredService ?? '';

  const [activityIds, setActivityIds] = useState<string[]>(src?.activitySeats.map((a) => a.activityId) ?? []);
  const [seatsText, setSeatsText] = useState<SeatsText>(Object.fromEntries((src?.activitySeats ?? []).map((a) => [a.activityId, String(a.seats)])));
  const [calendarPick, setCalendarPick] = useState<string[] | null>(null);
  const serviceCalendars = useMemo(() => calendars.filter((c) => c.clinicServiceId === serviceId), [calendars, serviceId]);
  const calendarIds = useMemo(() => {
    const allowed = new Set(serviceCalendars.map((c) => c.id));
    if (calendarPick !== null) return calendarPick.filter((id) => allowed.has(id));
    const wanted = src !== null ? orderCalendarIds(src) : (initial?.calendarIds ?? []);
    const kept = wanted.filter((id) => allowed.has(id));
    return kept.length > 0 ? kept : serviceCalendars.map((c) => c.id);
  }, [calendarPick, serviceCalendars, src, initial?.calendarIds]);

  const activityItems: OrderActivityItem[] = useMemo(() => {
    const fromService = allActivities.filter((a) => a.clinicServiceId === serviceId && serviceId !== '');
    const items: OrderActivityItem[] = fromService.map((a) => {
      const own = src?.activitySeats.find((s) => s.activityId === a.id);
      return { id: a.id, name: a.name, durationMinutes: a.durationMinutes, color: a.colorHex, unitPriceCzk: own?.unitPriceCzk ?? null, registered: src !== null && own !== undefined ? own.registered : null };
    });
    /* A činnost of the order that the list no longer offers (archived) stays visible so it can be kept or unticked. */
    for (const s of src?.activitySeats ?? []) {
      if (serviceId === (src?.serviceId ?? '') && !items.some((i) => i.id === s.activityId)) {
        items.push({ id: s.activityId, name: s.activityName, durationMinutes: s.durationMinutes, color: null, unitPriceCzk: s.unitPriceCzk, registered: s.registered });
      }
    }
    return items;
  }, [allActivities, serviceId, src]);

  const changeService = (id: string) => {
    if (id === serviceId) return;
    setServiceState(id);
    setActivityIds([]);
    setSeatsText({});
    setCalendarPick(null);
    setProposalAnalysis(null);
    setProposalMessage(null);
  };
  const toggleActivity = (id: string) => {
    setActivityIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setSeatsText((t) => (id in t ? t : { ...t, [id]: '' }));
  };
  const toggleCalendar = (id: string) => setCalendarPick(calendarIds.includes(id) ? calendarIds.filter((x) => x !== id) : [...calendarIds, id]);

  /* ── Payment, note, terms ── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(src?.paymentMethod ?? null);
  const [note, setNote] = useState<string>(src?.note ?? '');
  const [rows, setRows] = useState<RangeRow[]>(() => {
    const fromSrc = src !== null ? orderRanges(src, mode === 'process' || src.status !== 'Confirmed') : (initial?.ranges ?? []);
    return fromSrc.length > 0 ? fromSrc.map(rowFromRange) : [emptyRow()];
  });
  const today = todayInPrague();

  /* ── Proposal ── */
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(1);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const [proposalFailure, setProposalFailure] = useState<string | null>(null);
  const [proposalAnalysis, setProposalAnalysis] = useState<OrderAnalysis | null>(null);

  /* ── Save state ── */
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<ClubOrderError | null>(null);
  const [rowFailures, setRowFailures] = useState<Record<string, string>>({});
  const [affected, setAffected] = useState<{ message: string; list: ClubOrderError['affectedAthletes'] } | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  /* What the last press asked for - the errors shown are the ones that action needs. */
  const [lastKind, setLastKind] = useState<SaveKind>(mode === 'process' ? 'confirm' : mode === 'edit' ? 'save' : 'Requested');

  const clearFailures = () => {
    setFailure(null);
    setAffected(null);
  };

  /* ── Derived validation ── */
  const seatNumbers = Object.fromEntries(activityIds.map((id) => [id, parsePlayerCount(seatsText[id] ?? '')]));
  const totalSeats = totalSeatsOf(activityIds, seatsText);
  const seatErrors: Record<string, string> = {};
  if (mode === 'edit') {
    for (const item of activityItems) {
      if (!activityIds.includes(item.id) || item.registered === null) continue;
      const typed = seatNumbers[item.id];
      if (typed !== null && typed !== undefined && typed < item.registered) seatErrors[item.id] = `nejméně ${item.registered}`;
    }
  }
  const hasSeatErrors = Object.keys(seatErrors).length > 0;
  const overlaps = orderOverlapErrors(rows);
  const rowErrors: RowErrors[] = rows.map((row, i) => {
    if (isBlankRow(row)) return {};
    return {
      ...validateRow(row),
      overlap: overlaps[i],
      past: mode !== 'edit' && startsInPast(row, today) ? PAST_MESSAGE : undefined,
    };
  });
  const hasPast = rowErrors.some((e) => e.past !== undefined);
  /* A past row only blocks what creates calendar time; a request may still carry it. */
  const hasRowErrors = rowErrors.some((e, i) => rowHasError({ ...e, past: undefined }) && !isBlankRow(rows[i]));
  const confirmingFor = (kind: SaveKind): boolean => kind === 'Confirmed' || kind === 'confirm' || (kind === 'save' && src?.status === 'Confirmed');
  const validationFor = (kind: SaveKind) =>
    validateOrder({
      mode, confirming: confirmingFor(kind), clubReady, serviceId, activityIds, seatsText, paymentMethod, calendarIds, rows, rowErrors,
    });

  /* ── The live analysis ── */
  const calculation = useBlockCalculation({ activityIds, seats: seatNumbers, legacyCount: null, calendarIds, rows });
  const liveAnalysis: AnalysisLike | null = calculation.exact ? (calculation.calc?.analysis ?? proposalAnalysis ?? null) : null;

  /* ── Proposal ── */
  const first = rows[0];
  const startTime = first !== undefined && /^([01]\d|2[0-3]):[0-5]\d$/.test(first.dailyFrom.trim()) ? first.dailyFrom.trim() : undefined;
  const proposalBlocked: string | null =
    serviceId === '' ? 'Nejdřív vyberte službu.'
      : activityIds.length === 0 || activityIds.some((id) => seatNumbers[id] === null) ? 'Zadejte počty hráčů u všech vybraných činností.'
        : calendarIds.length === 0 ? 'Vyberte aspoň jeden kalendář.'
          : first === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(first.fromDate) ? 'V prvním termínu zadejte první den (a případně Denně od).'
            : null;

  const propose = async () => {
    if (proposalBlocked !== null || first === undefined) return;
    setProposalBusy(true);
    setProposalFailure(null);
    setProposalMessage(null);
    try {
      const body = await clubOrdersApi.proposal({
        serviceId,
        activitySeats: seatPayload(activityIds, seatsText),
        calendarIds,
        startDate: first.fromDate,
        ...(startTime !== undefined ? { startTime } : {}),
        ...(weekdays.length > 0 ? { daysOfWeek: weekdays } : {}),
        ...(weeks > 1 || weekdays.length > 0 ? { weeks } : {}),
      });
      if (body.ranges.length === 0) {
        setProposalMessage('Server nenavrhl žádný termín — upravte začátek nebo kalendáře.');
      } else {
        setRows(body.ranges.map(rowFromRange));
        setRowFailures({});
        setProposalMessage(`Navrženo ${body.ranges.length} ${plural(body.ranges.length, ['termín', 'termíny', 'termínů'])} — upravte je podle potřeby.`);
      }
      setProposalAnalysis(body.analysis);
    } catch (error) {
      setProposalFailure(error instanceof Error ? error.message : 'Návrh se nepodařilo spočítat.');
    } finally {
      setProposalBusy(false);
    }
  };

  /* ── Rows ── */
  const changeRow = (key: string, patch: Partial<RangeRow>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setRowFailures((f) => {
      if (f[key] === undefined) return f;
      const { [key]: _gone, ...rest } = f;
      return rest;
    });
    clearFailures();
  };
  const addRow = () =>
    setRows((list) => {
      const last = list[list.length - 1];
      return [...list, emptyRow({ fromDate: nextDay(last?.toDate ?? ''), toDate: nextDay(last?.toDate ?? ''), dailyFrom: last?.dailyFrom ?? '', dailyTo: last?.dailyTo ?? '' })];
    });
  const removeRow = (key: string) => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : list));
  const repeatRow = (key: string) =>
    setRows((list) => {
      const at = list.findIndex((r) => r.key === key);
      return at === -1 ? list : [...list.slice(0, at + 1), repeatNextWeek(list[at]), ...list.slice(at + 1)];
    });

  /* ── Save ── */
  const save = useMutation({
    mutationFn: async ({ kind, cancelAffected, send }: { kind: SaveKind; cancelAffected: boolean; send: RangeRow[] }): Promise<ClubOrderView> => {
      const activitySeats = seatPayload(activityIds, seatsText);
      const ranges = send.filter((r) => !isBlankRow(r)).map(rangeFromRow);
      const trimmedNote = note.trim();
      if (mode === 'edit' && src !== null) {
        return clubOrdersApi.update(
          src.id,
          { activitySeats, paymentMethod, ranges, ...(calendarIds.length > 0 ? { calendarIds } : {}), note: trimmedNote },
          cancelAffected,
        );
      }
      if (mode === 'process' && src !== null) {
        const changed =
          paymentMethod !== src.paymentMethod || trimmedNote !== src.note.trim()
          || JSON.stringify(activitySeats) !== JSON.stringify(src.activitySeats.map((a) => ({ activityId: a.activityId, seats: a.seats })));
        if (changed) await clubOrdersApi.update(src.id, { activitySeats, paymentMethod, note: trimmedNote });
        return clubOrdersApi.confirm(src.id, { calendarIds, ranges });
      }
      let targetClub = createdClubRef.current?.id ?? clubId;
      if (clubMode === 'new' && createdClubRef.current === null) {
        const made = await clubsApi.create(
          toPayerRequest({ ...EMPTY_PAYER, name: newClub.name, ico: newClub.ico, contactPerson: newClub.contactPerson, contactPhone: newClub.contactPhone, contactEmail: newClub.contactEmail }),
        );
        createdClubRef.current = made;
        setCreatedClub(made);
        targetClub = made.id;
      }
      return clubOrdersApi.createStaff({
        clubId: targetClub,
        serviceId,
        activitySeats,
        paymentMethod,
        ranges,
        calendarIds,
        status: kind === 'Confirmed' ? 'Confirmed' : 'Requested',
        ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
      });
    },
    onSuccess: (saved) => {
      for (const key of ['clubs', 'club-orders', 'club-blocks', 'club-summary', 'blocks', 'day-range', 'grid-preview']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(mode === 'edit' ? 'Objednávka uložena' : saved.status === 'Confirmed' ? 'Rezervace vytvořena' : 'Objednávka uložena');
      onSaved?.(saved);
      if (mode === 'edit') {
        onClose();
        return;
      }
      setResult(saved);
    },
    onError: (error, variables) => {
      const e = error instanceof ClubOrderError
        ? error
        : new ClubOrderError((error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Objednávku se nepodařilo uložit.');
      if (mode === 'edit' && e.status === 409 && e.affectedAthletes.length > 0) {
        setFailure(null);
        setAffected({ message: e.message, list: e.affectedAthletes });
        return;
      }
      setAffected(null);
      const at = e.status === 409 || e.status === 400 ? rowIndexForError(e, variables.send) : null;
      if (at !== null) {
        setRowFailures((f) => ({ ...f, [variables.send[at].key]: e.message }));
        setFailure(null);
        return;
      }
      setFailure(e);
    },
  });

  const submit = (kind: SaveKind) => {
    setShowErrors(true);
    setLastKind(kind);
    clearFailures();
    setRowFailures({});
    const found = validationFor(kind);
    let ok = !hasIssues(found) && !hasRowErrors && !hasSeatErrors;
    if (confirmingFor(kind) && hasPast) ok = false;
    if (mode === 'new' && clubMode === 'new' && createdClub === null) {
      const clubErrors = validateNewClub(newClub);
      setNewClubErrors(clubErrors);
      if (Object.keys(clubErrors).length > 0) ok = false;
    }
    if (!ok) return;
    const send = sortRows(rows);
    setRows(send);
    save.mutate({ kind, cancelAffected: affected !== null, send });
  };

  const finish = () => onClose();

  /* ── Sections ── */
  const v = showErrors ? validationFor(lastKind) : {};
  const confirmV = v;
  const serverField = (...keys: string[]) => fieldMessage(failure, ...keys);

  const requestCard =
    mode === 'process' && src !== null ? (
      <SoftCard sx={{ p: 1.75 }} data-testid="order-request">
        <SectionLabel>Požadavek klubu</SectionLabel>
        <Stack spacing={0.5}>
          {src.contact !== null ? (
            <Typography variant="body2" data-testid="request-contact">
              {[src.contact.name, src.contact.phone, src.contact.email].filter((x) => x !== '').join(' · ')}
            </Typography>
          ) : null}
          <Typography variant="body2">{`Počet míst: ${src.totalSeats}`}</Typography>
          <Typography variant="body2">{`Platba: ${src.paymentMethod === null ? 'neuvedeno' : PAYMENT_METHOD_LABEL[src.paymentMethod]}`}</Typography>
          {src.requestedRanges.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2.25 }} aria-label="Požadované termíny">
              {src.requestedRanges.map((r, i) => (
                <li key={i}><Typography variant="body2">{rangeLine(r)}</Typography></li>
              ))}
            </Box>
          ) : null}
          {src.note !== '' ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>{`Poznámka klubu: ${src.note}`}</Typography> : null}
        </Stack>
      </SoftCard>
    ) : null;

  const serviceSection = (
    <Box data-testid="order-service">
      <SectionLabel>Služba</SectionLabel>
      {servicesQuery.isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void servicesQuery.refetch()}>Zkusit znovu</Button>}>
          Služby se nepodařilo načíst.
        </Alert>
      ) : servicesQuery.isLoading ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>
      ) : (
        <>
          <RadioGroup aria-label="Služba" value={serviceId} onChange={(_e, value) => changeService(value)}>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {services.map((s) => (
                <FormControlLabel
                  key={s.id}
                  value={s.id}
                  disabled={mode === 'edit' || save.isPending}
                  control={<Radio />}
                  label={s.name}
                  sx={{ border: '1px solid', borderColor: s.id === serviceId ? 'primary.main' : 'divider', borderRadius: 2.5, mx: 0, pr: 1.5, minHeight: 44 }}
                />
              ))}
            </Stack>
          </RadioGroup>
          {mode === 'edit' ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>Služba hotové objednávky se nemění — jedna objednávka patří jedné službě.</Typography> : null}
        </>
      )}
      {(v.service ?? serverField('serviceId')) !== undefined ? (
        <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{v.service ?? serverField('serviceId')}</Typography>
      ) : null}
      {serviceId !== '' ? (
        <Box sx={{ mt: 1.5 }} data-testid="order-calendars">
          <SectionLabel>Kalendáře služby</SectionLabel>
          {serviceCalendars.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tato služba zatím nemá žádný kalendář.</Typography>
          ) : (
            <Stack direction="row" role="group" aria-label="Kalendáře" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {serviceCalendars.map((c) => (
                <FormControlLabel
                  key={c.id}
                  disabled={save.isPending}
                  control={<Checkbox checked={calendarIds.includes(c.id)} onChange={() => toggleCalendar(c.id)} />}
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box component="span" aria-hidden="true" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: c.color, flexShrink: 0 }} />
                      <Typography component="span" sx={{ fontSize: 14 }}>{c.name}</Typography>
                    </Stack>
                  }
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, mx: 0, pr: 1.5, minHeight: 44 }}
                />
              ))}
            </Stack>
          )}
          {(confirmV.calendars ?? serverField('calendarIds')) !== undefined ? (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{confirmV.calendars ?? serverField('calendarIds')}</Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );

  const paymentSection = (
    <Box data-testid="order-payment">
      <SectionLabel>Způsob platby</SectionLabel>
      <RadioGroup aria-label="Způsob platby" value={paymentMethod ?? ''} onChange={(_e, value) => setPaymentMethod(value as PaymentMethod)}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}>
          {(['ClubInvoice', 'PerPerson'] as const).map((m) => (
            <FormControlLabel
              key={m}
              value={m}
              disabled={save.isPending}
              control={<Radio />}
              label={PAYMENT_METHOD_LABEL[m]}
              sx={{ flex: 1, border: '1px solid', borderColor: paymentMethod === m ? 'primary.main' : 'divider', borderRadius: 2.5, mx: 0, pr: 1.5, minHeight: 52, bgcolor: paymentMethod === m ? 'action.selected' : 'transparent' }}
            />
          ))}
        </Stack>
      </RadioGroup>
      <Typography variant="caption" sx={{ color: (confirmV.payment ?? serverField('paymentMethod')) !== undefined ? 'error.main' : 'text.secondary', display: 'block', mt: 0.5 }}>
        {confirmV.payment ?? serverField('paymentMethod') ?? 'Pro rezervaci v kalendáři je způsob platby povinný; poptávku lze uložit i bez něj.'}
      </Typography>
    </Box>
  );

  const fields = (
    <Stack spacing={2.5}>
      {requestCard}
      <OrderClubPicker
        clubs={clubs}
        loading={clubsQuery.isLoading}
        mode={clubMode}
        onModeChange={setClubMode}
        selected={selectedClub}
        onSelect={(c) => setClubId(c?.id ?? '')}
        newClub={newClub}
        onNewClub={setNewClub}
        newClubErrors={newClubErrors}
        error={v.club ?? serverField('clubId')}
        fieldSize={fieldSize}
        locked={mode !== 'new'}
        lockedName={src?.clubName ?? ''}
      />
      {serviceSection}
      <OrderSeatsSection
        serviceChosen={serviceId !== ''}
        items={activityItems}
        checked={activityIds}
        text={seatsText}
        errors={seatErrors}
        total={totalSeats}
        listError={v.seats ?? serverField('activitySeats', 'seats')}
        showErrors={showErrors}
        fieldSize={fieldSize}
        disabled={save.isPending}
        onToggle={toggleActivity}
        onChange={(id, value) => setSeatsText((t) => ({ ...t, [id]: value }))}
        onStep={(id, delta) => setSeatsText((t) => ({ ...t, [id]: stepSeats(t[id] ?? '', delta) }))}
      />
      {paymentSection}
      <OrderTermsSection
        rows={rows}
        rowErrors={rowErrors}
        failures={rowFailures}
        showErrors={showErrors}
        fieldSize={fieldSize}
        disabled={save.isPending}
        termsError={confirmV.terms ?? serverField('ranges')}
        proposal={{
          weekdays,
          weeks,
          onToggleWeekday: (d) => setWeekdays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d])),
          onWeeks: (n) => setWeeks(Math.min(52, Math.max(1, n))),
          onPropose: () => void propose(),
          blockedReason: proposalBlocked,
          busy: proposalBusy,
          message: proposalMessage,
          failure: proposalFailure,
        }}
        onChange={changeRow}
        onRemove={removeRow}
        onAdd={addRow}
        onRepeat={repeatRow}
        onMoveToToday={(key) => setRows((list) => list.map((r) => (r.key === key ? moveToToday(r, today) : r)))}
      />
      <TextField
        size={fieldSize}
        label="Poznámka"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={serverField('note') !== undefined}
        helperText={serverField('note')}
        multiline
        minRows={2}
        fullWidth
      />
    </Stack>
  );

  const analysisCard = (
    <OrderAnalysisCard
      totalSeats={totalSeats}
      analysis={liveAnalysis}
      busy={calculation.busy}
      failed={calculation.isError}
      onRetry={calculation.retry}
      quote={src?.priceQuote ?? null}
      paymentMethod={paymentMethod}
      waiting={!calculation.ready || !calculation.exact}
    />
  );

  const title = mode === 'edit' ? 'Upravit objednávku' : mode === 'process' ? 'Zpracovat požadavek klubu' : 'Klubová objednávka';
  const subtitle =
    result !== null
      ? 'Hotovo — odkaz pošlete klubu'
      : mode === 'new'
        ? 'Klub → služba → činnosti → počet → termín → potvrdit'
        : `${src?.clubName ?? ''} · ${src?.serviceName ?? ''}`;

  const confirmingAthletes = affected !== null;
  const pending = save.isPending;

  return (
    <Dialog open onClose={pending ? undefined : finish} fullWidth maxWidth="lg" fullScreen={!desktop} aria-labelledby="club-order-title">
      <DialogTitle id="club-order-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>{subtitle}</Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={finish} disabled={pending} sx={{ width: 44, height: 44, flexShrink: 0 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers data-testid="club-order-form" data-layout={device} data-mode={mode}>
        {result !== null ? (
          <OrderSuccess order={result} />
        ) : (
          <>
            {failure !== null ? (
              <Alert severity="error" sx={{ mb: 2 }} data-testid="order-failure">
                {failure.message}
              </Alert>
            ) : null}
            {affected !== null ? (
              <Alert severity="warning" role="alert" data-testid="order-affected" sx={{ mb: 2, alignItems: 'flex-start' }}>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{affected.message}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>{`Dotčení sportovci (${affected.list.length}):`}</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
                  {affected.list.map((a, i) => (
                    <li key={`${a.name}-${i}`}>
                      <Typography variant="body2">{[a.name, a.activityName].filter(Boolean).join(' — ')}</Typography>
                    </li>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>Pokud změnu potvrdíte, rezervace těchto sportovců se zruší a jejich časy se vrátí do nabídky.</Typography>
              </Alert>
            ) : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: desktop ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr)',
                gap: 3,
                alignItems: 'start',
              }}
            >
              {fields}
              {desktop ? <Box sx={{ position: 'sticky', top: 0 }}>{analysisCard}</Box> : null}
            </Box>
          </>
        )}
      </DialogContent>

      {!desktop && result === null ? (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }} data-testid="analysis-dock">
          <Button
            fullWidth
            onClick={() => setAnalysisOpen((o) => !o)}
            aria-expanded={analysisOpen}
            aria-controls="order-analysis-panel"
            endIcon={analysisOpen ? <ExpandMore /> : <ExpandLess />}
            sx={{ minHeight: 48, justifyContent: 'space-between', px: 2, color: 'text.primary', fontWeight: 700 }}
          >
            {`Analýza kapacity · Klub celkem: ${totalSeats.toLocaleString('cs-CZ')} ${plural(totalSeats, ['místo', 'místa', 'míst'])}`}
          </Button>
          <Collapse in={analysisOpen} unmountOnExit>
            <Box id="order-analysis-panel" sx={{ px: 2, pb: 1.5, maxHeight: '40vh', overflowY: 'auto' }}>{analysisCard}</Box>
          </Collapse>
        </Box>
      ) : null}

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: desktop ? 'flex-end' : 'stretch' }}>
        {result !== null ? (
          <Button variant="contained" onClick={finish} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Hotovo</Button>
        ) : (
          <>
            <Button variant="outlined" onClick={finish} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Zrušit</Button>
            {mode === 'new' ? (
              <>
                <Button variant="outlined" onClick={() => submit('Requested')} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>
                  Uložit jako poptávku
                </Button>
                <Button variant="contained" onClick={() => submit('Confirmed')} disabled={pending || hasPast} sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}>
                  {pending ? 'Ukládám…' : 'Vytvořit rezervaci v kalendáři'}
                </Button>
              </>
            ) : mode === 'process' ? (
              <Button variant="contained" onClick={() => submit('confirm')} disabled={pending || hasPast} sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}>
                {pending ? 'Potvrzuji…' : 'Potvrdit objednávku'}
              </Button>
            ) : (
              <Button variant="contained" color={confirmingAthletes ? 'error' : 'primary'} onClick={() => submit('save')} disabled={pending || hasSeatErrors} sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}>
                {pending ? 'Ukládám…' : confirmingAthletes ? 'Potvrdit a zrušit rezervace' : 'Uložit změny'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ClubOrderDialog;
