/*
 * Upravit blok - contract C4. EDIT ONLY (Etapa 10): a club's reservation is created as a club ORDER (the calendar's
 * "výběr termínů"), never as a loose block, so this dialog no longer creates anything. It is kept for a legacy block
 * that has no order ("Starší rezervace") and changes only what `PUT` accepts: the days, the daily window, the
 * seats per činnost and the note; the club, the calendars and the činnosti are shown and locked.
 *
 *   phone (≤767)   full screen, one column, the buttons pinned at the bottom
 *   tablet         two columns - the form, then the calculator and the preview
 *   desktop        the same, with a wider calculator
 *
 * A change that would hit registered athletes comes back `409`; the dialog lists them and the operator confirms
 * once more.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../api/calendars';
import { clinicServicesApi } from '../../api/clinicServices';
import { clubBlocksApi, ClubBlockError, fetchBlockableActivities } from '../../api/clubBlocks';
import type { ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { useDevice } from '../../layout/useDevice';
import { DESIGN, SectionLabel, SoftCard } from '../ui';
import { BlockCalculator } from './BlockCalculator';
import { ActivityPicker, activityGroups } from './dialog/ActivityPicker';
import type { PickerService } from './dialog/ActivityPicker';
import { SeatsTable } from './dialog/SeatsTable';
import type { SeatRow } from './dialog/SeatsTable';
import { useBlockCalculation } from './dialog/useBlockCalculation';
import { ConflictList } from './ConflictList';
import {
  blockRange, countingSentence, fillSeatsFromWindow, formatPlayers, hasBlockErrors, inkOn,
  parsePlayerCount, seatsOf, seatsPayload, sumSeats, validateBlockDraft, validateRow,
} from './blockLogic';
import type { BlockDraft, BlockErrors, RangeRow } from './blockLogic';

let rowSeq = 0;
const newRowKey = (): string => `row-${++rowSeq}`;

const noop = (): void => undefined;

export function ClubBlockDialog({
  block,
  onClose,
  onSaved,
}: {
  /** The legacy block (no order) that is edited. */
  block: ClubBlockView;
  onClose: () => void;
  onSaved?: (block: ClubBlockView) => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const columns = phone ? 1 : 2;
  const queryClient = useQueryClient();

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

  const [draft, setDraft] = useState<BlockDraft>({
    clubId: block.clubId,
    name: block.name ?? '',
    calendarIds: block.calendarIds,
    activityIds: block.activityIds,
    seats: Object.fromEntries((block.activitySeats ?? []).map((a) => [a.activityId, String(a.seats)])),
    /* The days live in `row`; these stay empty. */
    fromDate: '',
    toDate: '',
    dailyFrom: '',
    dailyTo: '',
    playerCount: '',
    note: block.note ?? '',
  });
  /* The legacy single headcount; null until the operator types one. */
  const [legacyText, setLegacyText] = useState<string | null>(null);
  const [fillMessage, setFillMessage] = useState<string | null>(null);
  const [row, setRow] = useState<RangeRow>(() => ({
    key: newRowKey(), fromDate: block.fromDate, toDate: block.toDate, dailyFrom: block.dailyFrom ?? '', dailyTo: block.dailyTo ?? '',
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<ClubBlockError | null>(null);
  const [conflicts, setConflicts] = useState<{ message: string; list: ClubBlockConflict[] } | null>(null);

  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setConflicts(null);
  };

  const changeSeats = (id: string, text: string) => {
    setDraft((d) => ({ ...d, seats: { ...(d.seats ?? {}), [id]: text } }));
    setFillMessage(null);
    setConflicts(null);
  };

  /* Seats per činnost, the club as one whole - or the single headcount against a server without an analysis. */
  const sum = sumSeats(draft.activityIds, draft.seats ?? {});
  const legacyForced = (block.activitySeats ?? []).length === 0;
  const legacyValue = legacyText ?? String(block.playerCount);
  const legacyCount = parsePlayerCount(legacyValue);
  const seatMap = useMemo(
    () => Object.fromEntries(draft.activityIds.map((id, i) => [id, seatsOf(draft.activityIds, draft.seats ?? {})[i]])),
    [draft.activityIds, draft.seats],
  );
  const rows = useMemo(() => [row], [row]);
  const calculation = useBlockCalculation({
    activityIds: draft.activityIds,
    seats: seatMap,
    legacyCount: legacyText !== null || legacyForced ? legacyCount : null,
    calendarIds: draft.calendarIds,
    rows,
  });
  const legacy = legacyForced || calculation.legacy;
  const analysis = calculation.calc?.analysis ?? null;

  /* The days are checked on the row; the rest of the draft gets a day that always passes. */
  const errors: BlockErrors = validateBlockDraft(
    {
      ...draft, clubId: block.clubId, fromDate: '2000-01-01', toDate: '2000-01-01', dailyFrom: '', dailyTo: '',
      seats: legacy ? undefined : draft.seats ?? {},
      playerCount: legacyValue,
    },
    true,
    true,
  );
  /* A činnost cannot hold fewer seats than are registered on it already. */
  const registeredOf = (id: string): number | null => {
    const found = block.activitySeats?.find((a) => a.activityId === id);
    return found === undefined ? null : found.registered;
  };
  const seatErrors: Record<string, string> = {};
  if (!legacy) {
    for (const id of draft.activityIds) {
      const typed = parsePlayerCount(draft.seats?.[id] ?? '');
      const taken = registeredOf(id);
      if (typed !== null && taken !== null && typed < taken) seatErrors[id] = `nejméně ${taken}`;
    }
  }
  const hasSeatErrors = Object.keys(seatErrors).length > 0;
  const totalPlayers = legacy ? legacyCount : sum > 0 ? sum : null;
  const rowErrors = validateRow(row);
  const hasRowErrors = Object.values(rowErrors).some((v) => v !== undefined);

  const changeRow = (patch: Partial<RangeRow>) => {
    setRow((r) => ({ ...r, ...patch }));
    setConflicts(null);
  };

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
    mutationFn: ({ confirmed }: { confirmed: boolean }): Promise<ClubBlockView> => {
      /* The club's seats: per činnost, or the single headcount against a legacy server. */
      const sizing = legacy
        ? { playerCount: legacyCount as number }
        : { activitySeats: seatsPayload(draft.activityIds, draft.seats ?? {}) };
      return clubBlocksApi.update(
        block.id,
        {
          fromDate: row.fromDate,
          toDate: row.toDate,
          ...sizing,
          note: draft.note.trim() === '' ? null : draft.note.trim(),
          dailyFrom: row.dailyFrom.trim() === '' ? null : row.dailyFrom.trim(),
          dailyTo: row.dailyTo.trim() === '' ? null : row.dailyTo.trim(),
        },
        { cancelAthletes: confirmed },
      );
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('Blok uložen');
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      const e = error instanceof ClubBlockError
        ? error
        : new ClubBlockError((error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Blok se nepodařilo uložit.', undefined);
      if (e.isConflict) {
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
    if (hasBlockErrors(errors) || hasRowErrors || hasSeatErrors) return;
    save.mutate({ confirmed: conflicts !== null });
  };

  const confirming = conflicts !== null;
  const fieldSize = phone ? 'medium' : 'small';
  const shown = (key: keyof BlockErrors): string | undefined => (showErrors ? errors[key] : undefined);

  const ticked = calendars.filter((c) => draft.calendarIds.includes(c.id));
  const serviceOptions = [...services.entries()]
    .filter(([id]) => calendars.some((c) => c.clinicServiceId === id))
    .map(([id, sv]) => ({ id, name: sv.name }));
  const tickedServices = new Set(ticked.map((c) => c.clinicServiceId ?? ''));
  const effectiveService = serviceOptions.length === 0
    ? ''
    : tickedServices.size === 1 && serviceOptions.some((o) => o.id === [...tickedServices][0])
      ? [...tickedServices][0]
      : serviceOptions.length === 1
        ? serviceOptions[0].id
        : '';
  const groups = activityGroups(ticked, activities, services);
  const chosenRows: SeatRow[] = draft.activityIds.map((id) => {
    const info = activities.find((a) => a.id === id);
    const fromServer = block.activitySeats?.find((a) => a.activityId === id);
    return {
      id,
      name: info?.name ?? (fromServer?.activityName || id),
      durationMinutes: info?.durationMinutes ?? null,
      color: info?.colorHex ?? null,
      text: draft.seats?.[id] ?? '',
      max: analysis?.perActivity.find((a) => a.activityId === id)?.maxSeatsInWindowsAlone ?? null,
      registered: registeredOf(id),
      error: seatErrors[id],
    };
  });

  const fields = (
    <Stack spacing={2.5}>
      <Box>
        <SectionLabel>Klub</SectionLabel>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{block.clubName}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Klub, kalendáře a činnosti hotového bloku se nemění — zrušte blok a založte klubu objednávku.</Typography>
      </Box>

      {serviceOptions.length > 0 ? (
        <Box data-testid="block-service">
          <SectionLabel>Služba</SectionLabel>
          <TextField
            select
            fullWidth
            size={fieldSize}
            value={effectiveService}
            disabled
            slotProps={{ select: { displayEmpty: true, 'aria-label': 'Služba' } }}
          >
            <MenuItem value="" disabled>Vyberte službu</MenuItem>
            {serviceOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
          </TextField>
        </Box>
      ) : null}
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
            items={calendars.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
            checked={draft.calendarIds}
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
            onToggle={noop}
            disabled
            loading={activitiesQuery.isLoading}
            hint={null}
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

      <Box data-testid="block-terms">
        <SectionLabel>Termín bloku</SectionLabel>
        <RangeRowEditor row={row} errors={rowErrors} showErrors={showErrors} fieldSize={fieldSize} disabled={save.isPending} onChange={changeRow} />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Prázdné denní okno = blok drží celé otevírací hodiny.
        </Typography>
      </Box>

      <TextField
        size={fieldSize}
        label="Název bloku"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Prázdné = název klubu"
        disabled
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

  const previewRange = row.fromDate !== '' && row.toDate !== '' && row.toDate >= row.fromDate ? blockRange(row) : null;

  const side = (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <BlockCalculator
        state={calculation}
        legacyPlayers={legacyCount}
        onApply={(from, to) => changeRow({ fromDate: from, toDate: to })}
      />
      <BlockPreview clubName={block.clubName} color={block.colorHex} range={previewRange} players={totalPlayers} />
    </Stack>
  );

  return (
    <Dialog
      open
      onClose={save.isPending ? undefined : onClose}
      fullWidth
      maxWidth={device === 'desktop' ? 'lg' : 'md'}
      fullScreen={phone}
      aria-labelledby="club-block-title"
    >
      <DialogTitle id="club-block-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Upravit blok</Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
            {`${block.clubName} · ${blockRange(block)}`}
          </Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={onClose} disabled={save.isPending} sx={{ width: 44, height: 44, flexShrink: 0 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers data-testid="club-block-form" data-layout={device} data-columns={columns}>
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
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: phone ? 'stretch' : 'flex-end' }}>
        <Button variant="outlined" onClick={onClose} disabled={save.isPending} sx={{ minHeight: 44, flex: phone ? 1 : undefined }}>
          Zrušit
        </Button>
        <Button
          variant="contained"
          color={confirming ? 'error' : 'primary'}
          onClick={submit}
          disabled={save.isPending}
          sx={{ minHeight: 44, flex: phone ? 2 : undefined }}
        >
          {save.isPending ? 'Ukládám…' : confirming ? 'Potvrdit a zrušit rezervace' : 'Uložit změny'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── The one term of the block ── */

function RangeRowEditor({
  row, errors, showErrors, fieldSize, disabled, onChange,
}: {
  row: RangeRow;
  errors: ReturnType<typeof validateRow>;
  showErrors: boolean;
  fieldSize: 'small' | 'medium';
  disabled: boolean;
  onChange: (patch: Partial<RangeRow>) => void;
}) {
  const shownField = (key: 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'): string | undefined => (showErrors ? errors[key] : undefined);
  return (
    <SoftCard sx={{ p: 1.75 }} data-testid="block-term" data-row={1}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            type="date"
            size={fieldSize}
            label="Od"
            value={row.fromDate}
            onChange={(e) => onChange({ fromDate: e.target.value })}
            error={shownField('fromDate') !== undefined}
            helperText={shownField('fromDate')}
            disabled={disabled}
            slotProps={{ inputLabel: { shrink: true } }}
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
            disabled={disabled}
            slotProps={{ inputLabel: { shrink: true } }}
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
            disabled={disabled}
            slotProps={{ inputLabel: { shrink: true } }}
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
            disabled={disabled}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </Stack>
      </Stack>
      <Typography variant="caption" data-testid="row-window" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {countingSentence(row)}
      </Typography>
    </SoftCard>
  );
}

/* ── A read-only list of checkboxes with a colour square: the calendars the block holds ── */

interface CheckItem {
  id: string;
  label: string;
  color?: string;
}

function CheckList({
  ariaLabel, items, checked, loading,
}: {
  ariaLabel: string;
  items: CheckItem[];
  checked: string[];
  loading: boolean;
}) {
  if (loading) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>;
  }
  if (items.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím tu nic není.</Typography>;
  }
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, maxHeight: 220, overflowY: 'auto', bgcolor: 'background.paper' }}
    >
      {items.map((item) => (
        <FormControlLabel
          key={item.id}
          disabled
          sx={{ display: 'flex', mx: 0, pr: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
          control={<Checkbox checked={checked.includes(item.id)} />}
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              {item.color ? (
                <Box component="span" aria-hidden="true" data-swatch={item.color} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: item.color, flexShrink: 0 }} />
              ) : null}
              <Typography component="span" sx={{ fontSize: 14, fontWeight: 500 }}>{item.label}</Typography>
            </Stack>
          }
        />
      ))}
    </Box>
  );
}

/* ── How the block looks in the calendar ── */

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
          : 'Barvu klubu přidělí systém a pak se drží u všech jeho bloků.'}
      </Typography>
    </SoftCard>
  );
}

export default ClubBlockDialog;
