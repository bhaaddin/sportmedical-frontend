/*
 * Nový blok pro klub / Upravit blok - contract C4.
 *
 * One dialog, three layouts. It asks for the club (picked, or created on the
 * spot), the days, which calendars and which činnosti the block takes - the
 * rest of those calendars stays bookable - an optional daily window, the
 * headcount and a note. Beside the form the calculator says how many days that
 * headcount needs, and a preview shows the block in the club's colour the way
 * the calendar will draw it.
 *
 *   phone (≤767)   full screen, one column, the buttons pinned at the bottom
 *   tablet         two columns - the form, then the calculator and the preview
 *   desktop        the same, with a wider calculator
 *
 * The club is counted as one whole: the činnosti of the ticked calendars' services
 * are listed (nothing pre-selected), and every CHOSEN činnost gets its own seats in
 * "Místa pro klub" with the sum underneath. The analysis beside the form counts
 * the time only inside each range's daily window - a window from 09:40 counts
 * from 09:40 - and "Spočítat počet hráčů z vybraného času" fills the seats from it.
 *
 * Opened from the router (`/clubs` + `state.newBlock`) the dialog may start with
 * a head start: the calendars and days the operator dragged, a club on file, or
 * a club that does not exist yet - then the "Nový klub" fields are open and
 * filled, and the club is created together with the block.
 *
 * Several different ranges can be booked in one step ("Termíny bloku"): every row
 * becomes its own block, created one after another. A failure stops the run at
 * that row, keeps the blocks already made and lets the operator fix it and press
 * the button again - only the missing rows are sent.
 *
 * Editing changes only what `PUT` accepts (days, headcount, note, daily
 * window); the club, the calendars and the činnosti are shown and locked.
 * A change that would hit registered athletes comes back `409`; the dialog
 * lists them and the operator confirms once more.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import { Close, ContentCopy, DeleteOutlined } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../api/calendars';
import { clubsApi } from '../../api/clubs';
import type { Club } from '../../api/clubs';
import { clinicServicesApi } from '../../api/clinicServices';
import { clubBlocksApi, ClubBlockError, fetchBlockableActivities, toClubBlockError } from '../../api/clubBlocks';
import { clubRegistrationLink } from '../../api/publicClub';
import type { ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { useDevice } from '../../layout/useDevice';
import { EMPTY_PAYER, isValidIco, toPayerRequest } from '../../pages/clubs/payerForm';
import { DESIGN, SectionLabel, SoftCard } from '../ui';
import { BlockCalculator } from './BlockCalculator';
import { ActivityPicker, activityGroups } from './dialog/ActivityPicker';
import type { PickerService } from './dialog/ActivityPicker';
import { SeatsTable } from './dialog/SeatsTable';
import type { SeatRow } from './dialog/SeatsTable';
import { useBlockCalculation } from './dialog/useBlockCalculation';
import { ConflictList } from './ConflictList';
import {
  blockRange, clubColorOf, countingSentence, fillSeatsFromWindow, formatPlayers, formatShortSpan, hasBlockErrors, inkOn, nextDay,
  overlapErrors, parsePlayerCount, seatsOf, seatsPayload, sumSeats, moveToToday, sortRows, startsInPast, todayInPrague, validateBlockDraft, validateRow,
} from './blockLogic';
import type { BlockDraft, BlockErrors, RangeRow, RowErrors } from './blockLogic';

/** What `/clubs` `state.newBlock` may carry. Every field is optional. */
export interface NewBlockPrefill {
  /** A club on file. */
  clubId?: string;
  /** A club that does not exist yet (typed into the booking drawer). */
  newClub?: {
    name?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    headcount?: number;
  } | string;
  calendarIds?: string[];
  fromDate?: string;
  toDate?: string;
  dailyFrom?: string;
  dailyTo?: string;
  /**
   * Several separate ranges for one club. When present (and not empty) it wins
   * over the single `fromDate` / `toDate` / `dailyFrom` / `dailyTo` above.
   */
  ranges?: { fromDate: string; toDate: string; dailyFrom?: string; dailyTo?: string }[];
}

let rowSeq = 0;
const newRowKey = (): string => `row-${++rowSeq}`;

function initialRows(block: ClubBlockView | null, prefill: NewBlockPrefill | null | undefined): RangeRow[] {
  if (block !== null) {
    return [{ key: newRowKey(), fromDate: block.fromDate, toDate: block.toDate, dailyFrom: block.dailyFrom ?? '', dailyTo: block.dailyTo ?? '' }];
  }
  if (Array.isArray(prefill?.ranges) && prefill.ranges.length > 0) {
    return prefill.ranges.map((r) => ({
      key: newRowKey(), fromDate: r?.fromDate ?? '', toDate: r?.toDate ?? '', dailyFrom: r?.dailyFrom ?? '', dailyTo: r?.dailyTo ?? '',
    }));
  }
  return [{ key: newRowKey(), fromDate: prefill?.fromDate ?? '', toDate: prefill?.toDate ?? '', dailyFrom: prefill?.dailyFrom ?? '', dailyTo: prefill?.dailyTo ?? '' }];
}

/** A block of the run failed: which row, and what the server said. */
class RowFailure extends Error {
  readonly rowKey: string;
  readonly reason: ClubBlockError;
  constructor(rowKey: string, reason: ClubBlockError) {
    super(reason.message);
    this.rowKey = rowKey;
    this.reason = reason;
  }
}

const PAST_MESSAGE = 'Termín začíná v minulosti';

/** True when a router state's `newBlock` is a usable object. */
export function isNewBlockPrefill(value: unknown): value is NewBlockPrefill {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface NewClubDraft {
  name: string;
  ico: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newClubFromPrefill(prefill: NewBlockPrefill | null | undefined): NewClubDraft {
  const n = prefill?.newClub;
  if (typeof n === 'string') return { name: n, ico: '', contactPerson: '', contactPhone: '', contactEmail: '' };
  return {
    name: n?.name ?? '',
    ico: '',
    contactPerson: n?.contactPerson ?? '',
    contactPhone: n?.contactPhone ?? '',
    contactEmail: n?.contactEmail ?? '',
  };
}

function validateNewClub(club: NewClubDraft): Partial<Record<keyof NewClubDraft, string>> {
  const errors: Partial<Record<keyof NewClubDraft, string>> = {};
  if (club.name.trim() === '') errors.name = 'Název klubu je povinný.';
  if (club.ico.replace(/\s/g, '') === '') errors.ico = 'IČO je povinné — potřebujeme ho pro fakturu.';
  else if (!isValidIco(club.ico)) errors.ico = 'Tohle IČO neexistuje — zkontrolujte číslice.';
  if (club.contactEmail.trim() !== '' && !EMAIL.test(club.contactEmail.trim())) errors.contactEmail = 'Tohle není e-mailová adresa.';
  return errors;
}

export function ClubBlockDialog({
  clubs,
  block = null,
  prefill = null,
  blocks = [],
  onClose,
  onSaved,
}: {
  clubs: Club[];
  /** Given: edit this block. Omitted: a new block. */
  block?: ClubBlockView | null;
  prefill?: NewBlockPrefill | null;
  /** The blocks already known, for the club colours. */
  blocks?: ClubBlockView[];
  onClose: () => void;
  onSaved?: (block: ClubBlockView) => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const columns = phone ? 1 : 2;
  const queryClient = useQueryClient();
  const editing = block !== null;

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });

  /* Only the names and colours of the services; a failure just leaves the groups named after their calendars. */
  const servicesQuery = useQuery({
    queryKey: ['club-block-services'],
    queryFn: () => clinicServicesApi.list().catch(() => []),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const services = useMemo(
    () => new Map<string, PickerService>((servicesQuery.data ?? []).map((sv) => [sv.id, { name: sv.name, colorHex: sv.colorHex }])),
    [servicesQuery.data],
  );
  const [createdClub, setCreatedClub] = useState<Club | null>(null);
  const activeClubs = useMemo(
    () => [...clubs.filter((c) => c.isActive), ...(createdClub !== null && !clubs.some((c) => c.id === createdClub.id) ? [createdClub] : [])],
    [clubs, createdClub],
  );

  const startsWithNewClub = !editing && prefill?.clubId === undefined && prefill?.newClub !== undefined;
  const [clubMode, setClubMode] = useState<'existing' | 'new'>(startsWithNewClub ? 'new' : 'existing');
  const [clubId, setClubId] = useState<string>(block?.clubId ?? prefill?.clubId ?? '');
  const [newClub, setNewClub] = useState<NewClubDraft>(() => newClubFromPrefill(prefill));
  const [newClubErrors, setNewClubErrors] = useState<Partial<Record<keyof NewClubDraft, string>>>({});

  const headcountHint =
    prefill?.newClub !== undefined && typeof prefill.newClub === 'object' && prefill.newClub.headcount !== undefined
      ? String(prefill.newClub.headcount)
      : '';
  const [draft, setDraft] = useState<BlockDraft>({
    clubId: block?.clubId ?? prefill?.clubId ?? '',
    name: block?.name ?? '',
    calendarIds: block?.calendarIds ?? prefill?.calendarIds ?? [],
    activityIds: block?.activityIds ?? [],
    seats: Object.fromEntries((block?.activitySeats ?? []).map((a) => [a.activityId, String(a.seats)])),
    /* The days live in `rows`; these stay empty. */
    fromDate: '',
    toDate: '',
    dailyFrom: '',
    dailyTo: '',
    playerCount: '',
    note: block?.note ?? '',
  });
  /* The legacy single headcount; null until the operator types one (then it defaults to the sum of the seats). */
  const [legacyText, setLegacyText] = useState<string | null>(null);
  const [fillMessage, setFillMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<RangeRow[]>(() => initialRows(block, prefill));
  /* Blocks of this run that exist already, by row key - a retry never sends them again. */
  const [created, setCreated] = useState<Record<string, ClubBlockView>>({});
  const createdRef = useRef<Record<string, ClubBlockView>>({});
  const [rowFailures, setRowFailures] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ClubBlockView[] | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<ClubBlockError | null>(null);
  const [conflicts, setConflicts] = useState<{ message: string; list: ClubBlockConflict[] } | null>(null);
  /* `createdClub` (above) survives a failed block save, so a retry does not create the club twice. */

  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setConflicts(null);
  };

  const toggleCalendar = (id: string) => {
    setDraft((d) => {
      const next = d.calendarIds.includes(id) ? d.calendarIds.filter((x) => x !== id) : [...d.calendarIds, id];
      /* A činnost whose service no ticked calendar runs any more is not shown - and not kept. */
      const shown = new Set(
        activityGroups(calendars.filter((c) => next.includes(c.id)), activities, services).flatMap((g) => g.items.map((a) => a.id)),
      );
      const keep = d.activityIds.filter((a) => shown.has(a) || activities.length === 0);
      const seats = Object.fromEntries(Object.entries(d.seats ?? {}).filter(([a]) => keep.includes(a)));
      return { ...d, calendarIds: next, activityIds: keep, seats };
    });
    setConflicts(null);
  };

  const toggleActivity = (id: string) => {
    setDraft((d) => {
      if (d.activityIds.includes(id)) {
        const { [id]: _gone, ...seats } = d.seats ?? {};
        return { ...d, activityIds: d.activityIds.filter((x) => x !== id), seats };
      }
      /* The headcount of a club typed into the booking drawer is the start for its first činnost. */
      const start = d.activityIds.length === 0 ? headcountHint : '';
      return { ...d, activityIds: [...d.activityIds, id], seats: { ...(d.seats ?? {}), [id]: start } };
    });
    setFillMessage(null);
    setConflicts(null);
  };

  const changeSeats = (id: string, text: string) => {
    setDraft((d) => ({ ...d, seats: { ...(d.seats ?? {}), [id]: text } }));
    setFillMessage(null);
    setConflicts(null);
  };

  const selectedClub: Club | null = useMemo(() => {
    const id = createdClub?.id ?? clubId;
    return clubs.find((c) => c.id === id) ?? (createdClub !== null && createdClub.id === id ? createdClub : null);
  }, [clubs, clubId, createdClub]);

  const previewClubName =
    clubMode === 'new' && createdClub === null ? newClub.name.trim() : (selectedClub?.name ?? block?.clubName ?? '');
  const previewColor =
    block?.colorHex ?? (selectedClub !== null ? clubColorOf(selectedClub, blocks) : null);

  const clubReady =
    clubMode === 'new' && createdClub === null
      ? newClub.name.trim() !== ''
      : (createdClub?.id ?? clubId) !== '';
  /* Seats per činnost, the club as one whole - or the single headcount against a server without an analysis. */
  const sum = sumSeats(draft.activityIds, draft.seats ?? {});
  const legacyForced = editing && (block?.activitySeats ?? []).length === 0;
  const defaultLegacy = editing ? String(block?.playerCount ?? '') : sum > 0 ? String(sum) : '';
  const legacyValue = legacyText ?? defaultLegacy;
  const legacyCount = parsePlayerCount(legacyValue);
  const seatMap = useMemo(
    () => Object.fromEntries(draft.activityIds.map((id, i) => [id, seatsOf(draft.activityIds, draft.seats ?? {})[i]])),
    [draft.activityIds, draft.seats],
  );
  const calculation = useBlockCalculation({
    activityIds: draft.activityIds,
    seats: seatMap,
    legacyCount: legacyText !== null || legacyForced ? legacyCount : null,
    calendarIds: draft.calendarIds,
    rows,
  });
  const legacy = legacyForced || calculation.legacy;
  const analysis = calculation.calc?.analysis ?? null;

  /* The days are checked per row; the rest of the draft gets a day that always passes. */
  const errors: BlockErrors = validateBlockDraft(
    {
      ...draft, clubId: createdClub?.id ?? clubId, fromDate: '2000-01-01', toDate: '2000-01-01', dailyFrom: '', dailyTo: '',
      seats: legacy ? undefined : draft.seats ?? {},
      playerCount: legacyValue,
    },
    clubReady,
    editing,
  );
  /* Editing: a činnost cannot hold fewer seats than are registered on it already. */
  const registeredOf = (id: string): number | null => {
    const found = block?.activitySeats?.find((a) => a.activityId === id);
    return found === undefined ? null : found.registered;
  };
  const seatErrors: Record<string, string> = {};
  if (editing && !legacy) {
    for (const id of draft.activityIds) {
      const typed = parsePlayerCount(draft.seats?.[id] ?? '');
      const taken = registeredOf(id);
      if (typed !== null && taken !== null && typed < taken) seatErrors[id] = `nejméně ${taken}`;
    }
  }
  const hasSeatErrors = Object.keys(seatErrors).length > 0;
  const totalPlayers = legacy ? legacyCount : sum > 0 ? sum : null;
  const today = todayInPrague();
  const overlaps = overlapErrors(rows);
  const rowErrors: RowErrors[] = rows.map((row, i) => {
    if (created[row.key] !== undefined) return {};
    return {
      ...validateRow(row),
      overlap: overlaps[i],
      past: !editing && startsInPast(row, today) ? PAST_MESSAGE : undefined,
    };
  });
  const hasPast = rowErrors.some((e) => e.past !== undefined);
  const hasRowErrors = rowErrors.some((e) => Object.values(e).some((v) => v !== undefined));
  const pendingCount = rows.filter((r) => created[r.key] === undefined).length;

  const changeRow = (key: string, patch: Partial<RangeRow>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setRowFailures((f) => {
      if (f[key] === undefined) return f;
      const { [key]: _gone, ...rest } = f;
      return rest;
    });
    setConflicts(null);
  };
  const addRow = () =>
    setRows((list) => [...list, { key: newRowKey(), fromDate: nextDay(list[list.length - 1]?.toDate ?? ''), toDate: '', dailyFrom: '', dailyTo: '' }]);
  const removeRow = (key: string) => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : list));

  const fillFromWindow = () => {
    if (analysis === null) return;
    const fill = fillSeatsFromWindow(analysis, draft.activityIds, draft.seats ?? {});
    if (fill === null) return;
    setDraft((d) => ({
      ...d,
      seats: { ...(d.seats ?? {}), ...Object.fromEntries(Object.entries(fill.seats).map(([id, n]) => [id, n >= 1 ? String(n) : ''])) },
    }));
    setFillMessage(
      Object.values(fill.seats).some((n) => n < 1) ? `${fill.message} Do vybraného času se nevejde ani jedno místo některé z činností.` : fill.message,
    );
    setConflicts(null);
  };

  const save = useMutation({
    mutationFn: async ({ confirmed, send }: { confirmed: boolean; send: RangeRow[] }): Promise<ClubBlockView[]> => {
      /* The club's seats: per činnost, or the single headcount against a legacy server. */
      const sizing = legacy
        ? { playerCount: legacyCount as number }
        : { activitySeats: seatsPayload(draft.activityIds, draft.seats ?? {}) };
      const windowOf = (row: RangeRow) => ({
        dailyFrom: row.dailyFrom.trim() === '' ? null : row.dailyFrom.trim(),
        dailyTo: row.dailyTo.trim() === '' ? null : row.dailyTo.trim(),
      });
      const note = draft.note.trim() === '' ? null : draft.note.trim();

      if (block !== null) {
        const only = send[0];
        return [
          await clubBlocksApi.update(
            block.id,
            { fromDate: only.fromDate, toDate: only.toDate, ...sizing, note, ...windowOf(only) },
            { cancelAthletes: confirmed },
          ),
        ];
      }

      let targetClubId = createdClub?.id ?? clubId;
      if (clubMode === 'new' && createdClub === null) {
        const created = await clubsApi.create(
          toPayerRequest({
            ...EMPTY_PAYER,
            name: newClub.name,
            ico: newClub.ico,
            contactPerson: newClub.contactPerson,
            contactPhone: newClub.contactPhone,
            contactEmail: newClub.contactEmail,
          }),
        );
        setCreatedClub(created);
        targetClubId = created.id;
      }
      /* One block per row, in order; stop at the first refusal. Rows made already are skipped. */
      for (const row of send) {
        if (createdRef.current[row.key] !== undefined) continue;
        try {
          const made = await clubBlocksApi.create({
            clubId: targetClubId,
            name: draft.name.trim() === '' ? null : draft.name.trim(),
            calendarIds: draft.calendarIds,
            ...(legacy ? { activityIds: draft.activityIds } : {}),
            fromDate: row.fromDate,
            toDate: row.toDate,
            ...windowOf(row),
            ...sizing,
            note,
          });
          createdRef.current = { ...createdRef.current, [row.key]: made };
          setCreated(createdRef.current);
        } catch (error) {
          throw new RowFailure(row.key, toClubBlockError(error));
        }
      }
      return send.map((row) => createdRef.current[row.key]);
    },
    onSuccess: (saved, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      if (editing || variables.send.length === 1) {
        toast.success(editing ? 'Blok uložen' : 'Blok vytvořen');
        onSaved?.(saved[0]);
        onClose();
        return;
      }
      toast.success(`Vytvořeno ${saved.length} bloků`);
      setResults(saved);
    },
    onError: (error) => {
      if (Object.keys(createdRef.current).length > 0) {
        void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
        void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      }
      if (error instanceof RowFailure) {
        const e = error.reason;
        const extra = Object.values(e.fields).length > 0 ? ` ${Object.values(e.fields).join(' ')}` : '';
        setRowFailures((f) => ({ ...f, [error.rowKey]: `${e.message}${extra}` }));
        setConflicts(e.conflicts.length > 0 ? { message: e.message, list: e.conflicts } : null);
        setFailure(null);
        return;
      }
      const e =
        error instanceof ClubBlockError
          ? error
          : new ClubBlockError(
              (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Klub se nepodařilo založit.',
              undefined,
            );
      if (e.isConflict && editing) {
        setFailure(null);
        setConflicts({ message: e.message, list: e.conflicts });
      } else {
        setConflicts(e.conflicts.length > 0 ? { message: e.message, list: e.conflicts } : null);
        setFailure(e);
      }
    },
  });

  const submit = () => {
    setShowErrors(true);
    setFailure(null);
    setRowFailures({});
    let ok = !hasBlockErrors(errors) && !hasRowErrors && !hasSeatErrors;
    if (!editing && clubMode === 'new' && createdClub === null) {
      const found = validateNewClub(newClub);
      setNewClubErrors(found);
      if (Object.keys(found).length > 0) ok = false;
    }
    if (!ok) return;
    /* Earliest first - the order the blocks are made in and the result lists them in. */
    const send = editing ? rows : sortRows(rows);
    setRows(send);
    save.mutate({ confirmed: conflicts !== null && editing, send });
  };

  /** Closing after some blocks were made (a partial run or the result screen): hand the first one back. */
  const finish = () => {
    const made = rows.map((r) => created[r.key]).filter((b): b is ClubBlockView => b !== undefined);
    if (made.length > 0) onSaved?.(made[0]);
    onClose();
  };

  const confirming = editing && conflicts !== null;
  const fieldSize = phone ? 'medium' : 'small';
  const shown = (key: keyof BlockErrors): string | undefined => (showErrors ? errors[key] : undefined);

  const clubSection = editing ? (
    <Box>
      <SectionLabel>Klub</SectionLabel>
      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{block?.clubName}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Klub, kalendáře a činnosti hotového bloku se nemění — zrušte blok a založte nový.</Typography>
    </Box>
  ) : (
    <Box>
      <SectionLabel>Klub</SectionLabel>
      {clubMode === 'existing' || createdClub !== null ? (
        <Stack spacing={1}>
          <Autocomplete
            options={activeClubs}
            value={selectedClub}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Žádný takový klub — založte nový."
            onChange={(_e, value) => {
              setClubId(value?.id ?? '');
              set('clubId', value?.id ?? '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size={fieldSize}
                label="Klub"
                placeholder="Název klubu nebo kontaktní osoba"
                error={shown('clubId') !== undefined}
                helperText={shown('clubId')}
              />
            )}
          />
          {createdClub === null ? (
            <Button variant="text" size="small" sx={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => setClubMode('new')}>
              + Klub není v seznamu — založit nový
            </Button>
          ) : null}
        </Stack>
      ) : (
        <SoftCard sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Nový klub — není v seznamu</Typography>
            <TextField
              size={fieldSize}
              label="Název klubu"
              value={newClub.name}
              onChange={(e) => setNewClub((c) => ({ ...c, name: e.target.value }))}
              error={newClubErrors.name !== undefined}
              helperText={newClubErrors.name}
              fullWidth
            />
            <TextField
              size={fieldSize}
              label="IČO"
              value={newClub.ico}
              onChange={(e) => setNewClub((c) => ({ ...c, ico: e.target.value }))}
              error={newClubErrors.ico !== undefined}
              helperText={newClubErrors.ico ?? 'Osm číslic — ostatní fakturační údaje doplníte v kartě klubu.'}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size={fieldSize} label="Kontaktní osoba" value={newClub.contactPerson} onChange={(e) => setNewClub((c) => ({ ...c, contactPerson: e.target.value }))} fullWidth />
              <TextField size={fieldSize} label="Telefon" type="tel" value={newClub.contactPhone} onChange={(e) => setNewClub((c) => ({ ...c, contactPhone: e.target.value }))} fullWidth />
            </Stack>
            <TextField
              size={fieldSize}
              label="E-mail"
              type="email"
              value={newClub.contactEmail}
              onChange={(e) => setNewClub((c) => ({ ...c, contactEmail: e.target.value }))}
              error={newClubErrors.contactEmail !== undefined}
              helperText={newClubErrors.contactEmail}
              fullWidth
            />
            <Button variant="text" size="small" sx={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => setClubMode('existing')}>
              Vybrat klub ze seznamu
            </Button>
          </Stack>
        </SoftCard>
      )}
    </Box>
  );

  const ticked = calendars.filter((c) => draft.calendarIds.includes(c.id));
  const groups = activityGroups(ticked, activities, services);
  const chosenRows: SeatRow[] = draft.activityIds.map((id) => {
    const info = activities.find((a) => a.id === id);
    const fromServer = block?.activitySeats?.find((a) => a.activityId === id);
    return {
      id,
      name: info?.name ?? (fromServer?.activityName || id),
      durationMinutes: info?.durationMinutes ?? null,
      color: info?.colorHex ?? null,
      text: draft.seats?.[id] ?? '',
      max: analysis?.perActivity.find((a) => a.activityId === id)?.maxSeatsInWindowsAlone ?? null,
      registered: editing ? registeredOf(id) : null,
      error: seatErrors[id],
    };
  });

  const listSection = (
    <>
      <Box>
        <SectionLabel>Kalendáře, které blok zablokuje</SectionLabel>
        {calendarsQuery.isError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void calendarsQuery.refetch()}>Zkusit znovu</Button>}>
            Kalendáře se nepodařilo načíst.
          </Alert>
        ) : (
          <CheckList
            ariaLabel="Kalendáře"
            loading={calendarsQuery.isLoading}
            disabled={editing}
            items={calendars.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
            checked={draft.calendarIds}
            onToggle={toggleCalendar}
            error={shown('calendarIds')}
          />
        )}
      </Box>
      <Box>
        <SectionLabel>Činnosti, které blok zablokuje</SectionLabel>
        {activitiesQuery.isError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void activitiesQuery.refetch()}>Zkusit znovu</Button>}>
            Činnosti se nepodařilo načíst.
          </Alert>
        ) : (
          <ActivityPicker
            groups={groups}
            checked={draft.activityIds}
            onToggle={toggleActivity}
            disabled={editing}
            loading={activitiesQuery.isLoading}
            hint={ticked.length === 0 ? 'Nejdřív zaškrtněte kalendář — zobrazí se činnosti jeho služby.' : null}
            error={shown('activityIds')}
          />
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Zbytek vybraných kalendářů zůstává volný pro ostatní objednávky.
        </Typography>
      </Box>
      <SeatsTable
        rows={chosenRows}
        total={sum}
        onChange={changeSeats}
        legacy={legacy && draft.activityIds.length > 0 ? { text: legacyValue, onChange: setLegacyText, error: shown('playerCount') } : null}
        fill={legacy ? null : { onClick: fillFromWindow, disabled: analysis === null || calculation.busy || draft.activityIds.length === 0 }}
        fillMessage={fillMessage}
        fieldSize={fieldSize}
        showErrors={showErrors}
        listError={errors.playerCount}
      />
    </>
  );

  const termsSection = (
    <Box data-testid="block-terms">
      <SectionLabel>{editing ? 'Termín bloku' : 'Termíny bloku'}</SectionLabel>
      <Stack spacing={1.5}>
        {rows.map((row, i) => (
          <RangeRowEditor
            key={row.key}
            index={i}
            total={rows.length}
            row={row}
            errors={rowErrors[i]}
            showErrors={showErrors}
            made={created[row.key] ?? null}
            failure={rowFailures[row.key] ?? null}
            fieldSize={fieldSize}
            canRemove={!editing && rows.length > 1}
            disabled={save.isPending}
            onChange={(patch) => changeRow(row.key, patch)}
            onRemove={() => removeRow(row.key)}
            onMoveToToday={() => changeRow(row.key, moveToToday(row, today))}
          />
        ))}
        {!editing ? (
          <Button variant="outlined" onClick={addRow} disabled={save.isPending} sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
            + Přidat další termín
          </Button>
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
        {editing
          ? 'Prázdné denní okno = blok drží celé otevírací hodiny.'
          : 'Každý termín se uloží jako samostatný blok se svým odkazem. Prázdné denní okno = celé otevírací hodiny.'}
      </Typography>
    </Box>
  );

  const fields = (
    <Stack spacing={2.5}>
      {clubSection}

      {listSection}

      {termsSection}

      <TextField
        size={fieldSize}
        label="Název bloku"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Prázdné = název klubu"
        disabled={editing}
        fullWidth
      />
      <TextField
        size={fieldSize}
        label="Poznámka"
        value={draft.note}
        onChange={(e) => set('note', e.target.value)}
        multiline
        minRows={2}
        fullWidth
      />
    </Stack>
  );

  const firstRange = rows.find((r) => r.fromDate !== '' && r.toDate !== '' && r.toDate >= r.fromDate);
  const previewRange =
    firstRange === undefined
      ? null
      : `${blockRange(firstRange)}${rows.length > 1 ? ` + ${rows.length - 1} další` : ''}`;

  const linkOf = (b: ClubBlockView): string | null => b.registrationUrl ?? (b.registrationToken ? clubRegistrationLink(b.registrationToken) : null);
  const copyText = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error('Odkaz se nepodařilo zkopírovat');
    }
  };
  const copyAll = () => {
    const lines = (results ?? []).flatMap((b) => {
      const link = linkOf(b);
      return link === null ? [] : [`${formatShortSpan(b.fromDate, b.toDate)}: ${link}`];
    });
    void copyText(lines.join('\n'), 'Odkazy zkopírovány');
  };

  const resultView =
    results === null ? null : (
      <Stack spacing={2} data-testid="club-block-results">
        <Alert severity="success">
          Vytvořeno {results.length} bloků{results[0]?.clubName ? ` pro ${results[0].clubName}` : ''}. Každý má svůj registrační odkaz pro sportovce.
        </Alert>
        {results.map((b) => {
          const link = linkOf(b);
          return (
            <SoftCard key={b.id} sx={{ p: 2 }} data-testid="club-block-result">
              <SectionLabel>{blockRange(b)}</SectionLabel>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
                <Box
                  data-testid="block-link"
                  sx={{
                    flex: 1, minWidth: 0, px: 1.75, py: 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default',
                    fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: link === null ? 'text.secondary' : 'text.primary',
                  }}
                >
                  {link ?? 'Odkaz zatím není k dispozici — server ho nevrací.'}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                  disabled={link === null}
                  onClick={() => link !== null && void copyText(link, 'Odkaz zkopírován')}
                  aria-label={`Kopírovat odkaz ${formatShortSpan(b.fromDate, b.toDate)}`}
                  sx={{ minHeight: 44 }}
                >
                  Kopírovat
                </Button>
              </Stack>
            </SoftCard>
          );
        })}
        <Button variant="outlined" startIcon={<ContentCopy sx={{ fontSize: 16 }} />} onClick={copyAll} sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
          Kopírovat všechny odkazy
        </Button>
      </Stack>
    );

  const side = (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <BlockCalculator
        state={calculation}
        legacyPlayers={legacyCount}
        onApply={(from, to) => {
          const first = rows[0];
          if (first !== undefined) changeRow(first.key, { fromDate: from, toDate: to });
        }}
      />
      <BlockPreview
        clubName={previewClubName}
        color={previewColor}
        range={previewRange}
        players={totalPlayers}
      />
    </Stack>
  );

  return (
    <Dialog
      open
      onClose={save.isPending ? undefined : finish}
      fullWidth
      maxWidth={device === 'desktop' ? 'lg' : 'md'}
      fullScreen={phone}
      aria-labelledby="club-block-title"
    >
      <DialogTitle id="club-block-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {editing ? 'Upravit blok' : 'Nový blok pro klub'}
          </Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
            {editing
              ? `${block?.clubName} · ${blockRange(block as ClubBlockView)}`
              : results !== null
                ? 'Hotovo — odkazy pošlete klubu'
                : 'Vyhrazené časy s odkazem, přes který se sportovci sami registrují'}
          </Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={finish} disabled={save.isPending} sx={{ width: 44, height: 44, flexShrink: 0 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers data-testid="club-block-form" data-layout={device} data-columns={columns}>
        {results !== null ? (
          resultView
        ) : (
          <>
        {failure !== null ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {failure.message}
            {Object.values(failure.fields).length > 0 ? ` ${Object.values(failure.fields).join(' ')}` : ''}
          </Alert>
        ) : null}
        {conflicts !== null ? (
          <Box sx={{ mb: 2 }}>
            <ConflictList conflicts={conflicts.list} message={conflicts.message} />
            {confirming ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Pokud změnu potvrdíte, rezervace těchto sportovců se zruší a jejich časy se vrátí do nabídky.
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: columns === 1 ? 'minmax(0, 1fr)' : device === 'desktop' ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr) 300px',
            gap: 3,
            alignItems: 'start',
          }}
        >
          {fields}
          {side}
        </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: phone ? 'stretch' : 'flex-end' }}>
        {results !== null ? (
          <Button variant="contained" onClick={finish} sx={{ minHeight: 44, flex: phone ? 1 : undefined }}>
            Hotovo
          </Button>
        ) : (
          <>
            <Button variant="outlined" onClick={finish} disabled={save.isPending} sx={{ minHeight: 44, flex: phone ? 1 : undefined }}>
              Zrušit
            </Button>
            <Button
              variant="contained"
              color={confirming ? 'error' : 'primary'}
              onClick={submit}
              disabled={save.isPending || hasPast}
              sx={{ minHeight: 44, flex: phone ? 2 : undefined }}
            >
              {save.isPending
                ? 'Ukládám…'
                : confirming
                  ? 'Potvrdit a zrušit rezervace'
                  : editing
                    ? 'Uložit změny'
                    : pendingCount > 1 || pendingCount < rows.length
                      ? `Vytvořit bloky (${pendingCount})`
                      : 'Vytvořit blok'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

/* ── One row of "Termíny bloku" ── */

function RangeRowEditor({
  index, total, row, errors, showErrors, made, failure, fieldSize, canRemove, disabled, onChange, onRemove, onMoveToToday,
}: {
  index: number;
  total: number;
  row: RangeRow;
  errors: RowErrors;
  showErrors: boolean;
  /** The block this row already became. */
  made: ClubBlockView | null;
  failure: string | null;
  fieldSize: 'small' | 'medium';
  canRemove: boolean;
  disabled: boolean;
  onChange: (patch: Partial<RangeRow>) => void;
  onRemove: () => void;
  onMoveToToday: () => void;
}) {
  const locked = made !== null || disabled;
  const n = index + 1;
  /* With one row the labels stay "Od" / "Do"; with several each carries its row number. */
  const aria = (label: string): { 'aria-label'?: string } => (total > 1 ? { 'aria-label': `${label}, termín ${n}` } : {});
  const shownField = (key: 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'): string | undefined => (showErrors ? errors[key] : undefined);
  return (
    <SoftCard sx={{ p: 1.75 }} data-testid="block-term" data-row={n}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {total > 1 ? <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Termín {n}</Typography> : null}
          {made !== null ? (
            <Typography component="span" variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>
              vytvořeno ✓
            </Typography>
          ) : null}
        </Stack>
        {canRemove && made === null ? (
          <IconButton aria-label={`Odebrat termín ${n}`} onClick={onRemove} disabled={disabled} sx={{ width: 44, height: 44 }}>
            <DeleteOutlined />
          </IconButton>
        ) : null}
      </Stack>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            type="date"
            size={fieldSize}
            label="Od"
            value={row.fromDate}
            onChange={(e) => onChange({ fromDate: e.target.value })}
            error={shownField('fromDate') !== undefined || errors.past !== undefined}
            helperText={shownField('fromDate')}
            disabled={locked}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Od') }}
            fullWidth
          />
          <TextField
            type="date"
            size={fieldSize}
            label="Do"
            value={row.toDate}
            onChange={(e) => onChange({ toDate: e.target.value })}
            error={shownField('toDate') !== undefined}
            helperText={shownField('toDate')}
            disabled={locked}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Do') }}
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            type="time"
            size={fieldSize}
            label="Denně od"
            value={row.dailyFrom}
            onChange={(e) => onChange({ dailyFrom: e.target.value })}
            error={shownField('dailyFrom') !== undefined}
            helperText={shownField('dailyFrom')}
            disabled={locked}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Denně od') }}
            fullWidth
          />
          <TextField
            type="time"
            size={fieldSize}
            label="Denně do"
            value={row.dailyTo}
            onChange={(e) => onChange({ dailyTo: e.target.value })}
            error={shownField('dailyTo') !== undefined}
            helperText={shownField('dailyTo')}
            disabled={locked}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Denně do') }}
            fullWidth
          />
        </Stack>
      </Stack>
      <Typography variant="caption" data-testid="row-window" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {countingSentence(row)}
      </Typography>
      {errors.past !== undefined ? (
        <Alert
          severity="warning"
          role="alert"
          sx={{ mt: 1.25 }}
          action={
            <Button color="inherit" size="small" onClick={onMoveToToday} disabled={disabled} sx={{ minHeight: 36 }}>
              Posunout na dnešek
            </Button>
          }
        >
          {errors.past}
        </Alert>
      ) : null}
      {errors.overlap !== undefined ? (
        <Typography role="alert" variant="body2" sx={{ color: 'error.main', mt: 1 }}>
          {errors.overlap}
        </Typography>
      ) : null}
      {failure !== null ? (
        <Alert severity="error" sx={{ mt: 1.25 }}>
          {failure}
        </Alert>
      ) : null}
    </SoftCard>
  );
}

/* ── A list of checkboxes with a colour square, for calendars and činnosti ── */

interface CheckItem {
  id: string;
  label: string;
  hint?: string;
  color?: string;
}

function CheckList({
  ariaLabel, items, checked, onToggle, loading, disabled, error,
}: {
  ariaLabel: string;
  items: CheckItem[];
  checked: string[];
  onToggle: (id: string) => void;
  loading: boolean;
  disabled: boolean;
  error?: string;
}) {
  if (loading) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>;
  }
  if (items.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím tu nic není.</Typography>;
  }
  return (
    <Box>
      <Box
        role="group"
        aria-label={ariaLabel}
        sx={{ border: '1px solid', borderColor: error ? 'error.main' : 'divider', borderRadius: 2.5, maxHeight: 220, overflowY: 'auto', bgcolor: 'background.paper' }}
      >
        {items.map((item) => (
          <FormControlLabel
            key={item.id}
            disabled={disabled}
            sx={{ display: 'flex', mx: 0, pr: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
            control={<Checkbox checked={checked.includes(item.id)} onChange={() => onToggle(item.id)} />}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                {item.color ? (
                  <Box component="span" aria-hidden="true" data-swatch={item.color} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: item.color, flexShrink: 0 }} />
                ) : null}
                <Typography component="span" sx={{ fontSize: 14, fontWeight: 500 }}>{item.label}</Typography>
                {item.hint ? <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{item.hint}</Typography> : null}
              </Stack>
            }
          />
        ))}
      </Box>
      {error ? <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{error}</Typography> : null}
    </Box>
  );
}

/* ── How the block will look in the calendar ── */

function BlockPreview({
  clubName, color, range, players,
}: {
  clubName: string;
  color: string | null;
  range: string | null;
  players: number | null;
}) {
  const ink = color !== null ? inkOn(color) : DESIGN.inkSoft;
  return (
    <SoftCard sx={{ p: 2.25 }} data-testid="block-preview">
      <SectionLabel>Náhled v kalendáři</SectionLabel>
      <Box
        data-testid="block-preview-chip"
        data-color={color ?? ''}
        sx={{
          borderRadius: '4px',
          px: 1.25,
          py: 1,
          borderLeft: '3px solid',
          borderColor: color ?? DESIGN.appointment.edge,
          bgcolor: color ?? DESIGN.appointment.bg,
          color: ink,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: 'inherit' }} noWrap>
          {clubName !== '' ? clubName : 'Název klubu'}
        </Typography>
        <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: 'inherit', opacity: 0.85 }} noWrap>
          {[range ?? 'dny doplníte vlevo', players !== null ? formatPlayers(players) : null].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        {color !== null
          ? 'Barva klubu se v kalendáři drží u všech jeho bloků.'
          : 'Barvu klubu přidělí systém při vytvoření bloku a pak se drží u všech jeho bloků.'}
      </Typography>
    </SoftCard>
  );
}

export default ClubBlockDialog;
