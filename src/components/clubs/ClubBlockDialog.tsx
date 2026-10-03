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
 * Opened from the router (`/clubs` + `state.newBlock`) the dialog may start with
 * a head start: the calendars and days the operator dragged, a club on file, or
 * a club that does not exist yet - then the "Nový klub" fields are open and
 * filled, and the club is created together with the block.
 *
 * Editing changes only what `PUT` accepts (days, headcount, note, daily
 * window); the club, the calendars and the činnosti are shown and locked.
 * A change that would hit registered athletes comes back `409`; the dialog
 * lists them and the operator confirms once more.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../api/calendars';
import { clubSettingsApi, clubsApi, CLUB_SETTINGS_QUERY_KEY } from '../../api/clubs';
import type { Club } from '../../api/clubs';
import { clubBlocksApi, ClubBlockError, fetchBlockableActivities } from '../../api/clubBlocks';
import type { ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { useDevice } from '../../layout/useDevice';
import { EMPTY_PAYER, isValidIco, toPayerRequest } from '../../pages/clubs/payerForm';
import { DESIGN, SectionLabel, SoftCard } from '../ui';
import { BlockCalculator } from './BlockCalculator';
import { ConflictList } from './ConflictList';
import {
  blockRange, clubColorOf, formatPlayers, hasBlockErrors, inkOn, parsePlayerCount, validateBlockDraft,
} from './blockLogic';
import type { BlockDraft, BlockErrors } from './blockLogic';

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
}

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
  const settingsQuery = useQuery({ queryKey: CLUB_SETTINGS_QUERY_KEY, queryFn: clubSettingsApi.get, staleTime: 5 * 60 * 1000, retry: false });

  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const activities = activitiesQuery.data ?? [];
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
    fromDate: block?.fromDate ?? prefill?.fromDate ?? '',
    toDate: block?.toDate ?? prefill?.toDate ?? '',
    dailyFrom: block?.dailyFrom ?? prefill?.dailyFrom ?? '',
    dailyTo: block?.dailyTo ?? prefill?.dailyTo ?? '',
    playerCount: block !== null ? String(block.playerCount) : headcountHint,
    note: block?.note ?? '',
  });
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<ClubBlockError | null>(null);
  const [conflicts, setConflicts] = useState<{ message: string; list: ClubBlockConflict[] } | null>(null);
  /* `createdClub` (above) survives a failed block save, so a retry does not create the club twice. */

  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setConflicts(null);
  };

  const toggle = (key: 'calendarIds' | 'activityIds', id: string) => {
    setDraft((d) => {
      const has = d[key].includes(id);
      const next = has ? d[key].filter((x) => x !== id) : [...d[key], id];
      const patch: Partial<BlockDraft> = { [key]: next };
      /* First calendar ticked and no činnost yet: offer that calendar's own činnosti. */
      if (key === 'calendarIds' && !has && d.activityIds.length === 0) {
        const service = calendars.find((c) => c.id === id)?.clinicServiceId ?? null;
        if (service !== null) {
          const own = activities.filter((a) => a.clinicServiceId === service).map((a) => a.id);
          if (own.length > 0) patch.activityIds = own;
        }
      }
      return { ...d, ...patch };
    });
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
  const errors: BlockErrors = validateBlockDraft({ ...draft, clubId: createdClub?.id ?? clubId }, clubReady, editing);
  const playerCount = parsePlayerCount(draft.playerCount);

  const save = useMutation({
    mutationFn: async (confirmed: boolean): Promise<ClubBlockView> => {
      const count = playerCount as number;
      const dailyFrom = draft.dailyFrom.trim() === '' ? null : draft.dailyFrom.trim();
      const dailyTo = draft.dailyTo.trim() === '' ? null : draft.dailyTo.trim();
      const note = draft.note.trim() === '' ? null : draft.note.trim();

      if (block !== null) {
        return clubBlocksApi.update(
          block.id,
          { fromDate: draft.fromDate, toDate: draft.toDate, playerCount: count, note, dailyFrom, dailyTo },
          { cancelAthletes: confirmed },
        );
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
      return clubBlocksApi.create({
        clubId: targetClubId,
        name: draft.name.trim() === '' ? null : draft.name.trim(),
        calendarIds: draft.calendarIds,
        activityIds: draft.activityIds,
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        dailyFrom,
        dailyTo,
        playerCount: count,
        note,
      });
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Blok uložen' : 'Blok vytvořen');
      void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
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
    let ok = !hasBlockErrors(errors);
    if (!editing && clubMode === 'new' && createdClub === null) {
      const found = validateNewClub(newClub);
      setNewClubErrors(found);
      if (Object.keys(found).length > 0) ok = false;
    }
    if (!ok) return;
    save.mutate(conflicts !== null && editing);
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
            onToggle={(id) => toggle('calendarIds', id)}
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
          <CheckList
            ariaLabel="Činnosti"
            loading={activitiesQuery.isLoading}
            disabled={editing}
            items={activities.map((a) => ({ id: a.id, label: a.name, hint: `${a.durationMinutes} min`, color: a.colorHex }))}
            checked={draft.activityIds}
            onToggle={(id) => toggle('activityIds', id)}
            error={shown('activityIds')}
          />
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Zbytek vybraných kalendářů zůstává volný pro ostatní objednávky.
        </Typography>
      </Box>
    </>
  );

  const fields = (
    <Stack spacing={2.5}>
      {clubSection}

      <TextField
        size={fieldSize}
        label="Počet hráčů"
        value={draft.playerCount}
        onChange={(e) => set('playerCount', e.target.value)}
        error={shown('playerCount') !== undefined}
        helperText={shown('playerCount') ?? 'Kolik sportovců klub přivede. Strop nemáme — může jich být 20 i 2 000.'}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        fullWidth
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          type="date"
          size={fieldSize}
          label="Od"
          value={draft.fromDate}
          onChange={(e) => set('fromDate', e.target.value)}
          error={shown('fromDate') !== undefined}
          helperText={shown('fromDate')}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
        <TextField
          type="date"
          size={fieldSize}
          label="Do"
          value={draft.toDate}
          onChange={(e) => set('toDate', e.target.value)}
          error={shown('toDate') !== undefined}
          helperText={shown('toDate')}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
      </Stack>

      {listSection}

      <Box>
        <SectionLabel>Denní okno (nepovinné)</SectionLabel>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            type="time"
            size={fieldSize}
            label="Denně od"
            value={draft.dailyFrom}
            onChange={(e) => set('dailyFrom', e.target.value)}
            error={shown('dailyFrom') !== undefined}
            helperText={shown('dailyFrom')}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            type="time"
            size={fieldSize}
            label="Denně do"
            value={draft.dailyTo}
            onChange={(e) => set('dailyTo', e.target.value)}
            error={shown('dailyTo') !== undefined}
            helperText={shown('dailyTo')}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Prázdné = blok drží celé otevírací hodiny.
        </Typography>
      </Box>

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

  const side = (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <BlockCalculator
        playerCount={playerCount}
        activityIds={draft.activityIds}
        calendarIds={draft.calendarIds}
        fromDate={draft.fromDate}
        minimumPlayers={settingsQuery.data?.minimumPlayers ?? null}
        onApply={(from, to) => {
          setDraft((d) => ({ ...d, fromDate: from, toDate: to }));
          setConflicts(null);
        }}
      />
      <BlockPreview
        clubName={previewClubName}
        color={previewColor}
        range={draft.fromDate !== '' && draft.toDate !== '' && draft.toDate >= draft.fromDate ? blockRange({ fromDate: draft.fromDate, toDate: draft.toDate }) : null}
        players={playerCount}
      />
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
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {editing ? 'Upravit blok' : 'Nový blok pro klub'}
          </Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
            {editing ? `${block?.clubName} · ${blockRange(block as ClubBlockView)}` : 'Vyhrazené časy s odkazem, přes který se sportovci sami registrují'}
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
          {save.isPending ? 'Ukládám…' : confirming ? 'Potvrdit a zrušit rezervace' : editing ? 'Uložit změny' : 'Vytvořit blok'}
        </Button>
      </DialogActions>
    </Dialog>
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
