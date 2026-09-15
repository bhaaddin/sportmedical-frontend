/*
 * Picking one address out of 3 021 203.
 *
 * Registration stores a residence as a single RÚIAN address-point code — the
 * Domain refuses anything but a positive one — so this control never lets
 * anybody invent an address, and that makes the catalogue load-bearing. Every
 * behaviour below answers something measured against the live catalogue on
 * 15. 9. 2026 rather than something imagined:
 *
 *   the catalogue can be empty      and then registration cannot finish at
 *                                   all, which has to be said BEFORE thirty
 *                                   fields are typed, not after
 *   a village has no street         `Bohuslavice — Bohuslavice` arrives with
 *                                   a null street; a required street step
 *                                   hides every address outside a town
 *   the answer is capped at 25      `limit=100` comes back with 25, so a full
 *                                   page is a slice and silence about it
 *                                   teaches people their street is missing
 *   names repeat                    three different Bohuslavice share one
 *                                   display value and differ only by a code;
 *                                   their postal codes differ, and the
 *                                   locality answer does not carry one, so
 *                                   this fetches a sample building for each
 *
 * It reads the anonymous `/api/address-lookup/*` pair rather than the
 * authenticated `/api/v1/addresses/*` one, so that the status it checks and
 * the catalogue it searches are the same service. They were two before, and a
 * "catalogue is loaded" from one says nothing about the other.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, CircularProgress, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import {
  catalogueStatus, searchLocalities, searchPoints,
} from '../../api/addressLookup';
import type {
  AddressCatalogueStatus, AddressLocality, AddressPoint,
} from '../../api/addressLookup';
import {
  CAPPED_HINT, CATALOGUE_EMPTY_TEXT, NO_STREET_HINT, RESULT_LIMIT,
  ambiguousDisplayValues, canSearchPoints, catalogueBlocksRegistration,
  catalogueState, catalogueSummary, formatPostalCode, hasNoStreet,
  houseNumberLabel, isAmbiguous, resultsAreCapped,
} from '../../services/patientRegistration/addressPicking';

interface Props {
  selectedPoint: AddressPoint | null;
  onSelect: (point: AddressPoint | null) => void;
  error?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 250;

export default function RuianAddressPicker({
  selectedPoint, onSelect, error, disabled,
}: Props) {
  const [status, setStatus] = useState<AddressCatalogueStatus | null>(null);

  const [localityQuery, setLocalityQuery] = useState('');
  const [localities, setLocalities] = useState<AddressLocality[]>([]);
  const [locality, setLocality] = useState<AddressLocality | null>(null);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);

  /*
   * A sample building per ambiguous locality, keyed by municipality part.
   * Only the postal code is wanted, and only when two rows cannot be told
   * apart — three extra calls in a rare case, against the cost of putting a
   * patient in the wrong village.
   */
  const [postalByPart, setPostalByPart] = useState<Record<number, string>>({});

  const [houseNumber, setHouseNumber] = useState('');
  const [points, setPoints] = useState<AddressPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const localityTicket = useRef(0);
  const pointTicket = useRef(0);

  /* ── Is there a catalogue at all? ── */
  useEffect(() => {
    catalogueStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const state = catalogueState(status);
  const blocked = catalogueBlocksRegistration(state);

  /* ── Localities ── */
  useEffect(() => {
    const query = localityQuery.trim();
    if (query.length < 2) {
      setLocalities([]);
      return;
    }

    const ticket = ++localityTicket.current;
    setLocalitiesLoading(true);

    const timer = setTimeout(() => {
      searchLocalities(query, RESULT_LIMIT)
        .then((rows) => {
          /* Out-of-order answers: only the newest question may draw. */
          if (ticket !== localityTicket.current) return;
          setLocalities(rows);
          setLookupError('');
        })
        .catch(() => {
          if (ticket !== localityTicket.current) return;
          setLocalities([]);
          setLookupError('Hledání adres se nepodařilo. Zkuste to prosím znovu.');
        })
        .finally(() => {
          if (ticket === localityTicket.current) setLocalitiesLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localityQuery]);

  /* ── Telling identical rows apart ── */
  const ambiguous = useMemo(() => ambiguousDisplayValues(localities), [localities]);

  useEffect(() => {
    if (ambiguous.length === 0) return;

    const needed = localities.filter(
      (row) => isAmbiguous(row, ambiguous) && postalByPart[row.municipalityPartCode] === undefined,
    );
    if (needed.length === 0) return;

    let cancelled = false;
    Promise.all(
      needed.map((row) =>
        /* One building is enough — the postal code is the same for the part. */
        searchPoints(row.streetCode, row.municipalityPartCode, '1', 1)
          .then((found) => ({ part: row.municipalityPartCode, postal: found[0]?.postalCode ?? '' }))
          .catch(() => ({ part: row.municipalityPartCode, postal: '' })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setPostalByPart((previous) => {
        const next = { ...previous };
        for (const r of results) next[r.part] = r.postal;
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [ambiguous, localities, postalByPart]);

  /* ── Buildings ── */
  useEffect(() => {
    if (!canSearchPoints(locality, houseNumber)) {
      setPoints([]);
      return;
    }

    const ticket = ++pointTicket.current;
    setPointsLoading(true);

    const timer = setTimeout(() => {
      searchPoints(
        locality!.streetCode,
        locality!.municipalityPartCode,
        houseNumber.trim(),
        RESULT_LIMIT,
      )
        .then((rows) => {
          if (ticket !== pointTicket.current) return;
          setPoints(rows);
          setLookupError('');
        })
        .catch(() => {
          if (ticket !== pointTicket.current) return;
          setPoints([]);
          setLookupError('Hledání čísel popisných se nepodařilo. Zkuste to prosím znovu.');
        })
        .finally(() => {
          if (ticket === pointTicket.current) setPointsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [locality, houseNumber]);

  const chooseLocality = (next: AddressLocality | null) => {
    setLocality(next);
    setHouseNumber('');
    setPoints([]);
    onSelect(null);
  };

  /* ── Chosen ── */
  if (selectedPoint !== null) {
    return (
      <Box
        sx={{
          border: '1px solid', borderColor: 'success.main', borderRadius: 2,
          bgcolor: 'rgba(46,125,50,0.05)', p: 2,
          display: 'flex', gap: 1.5, alignItems: 'flex-start',
        }}
      >
        <CheckCircleIcon sx={{ color: 'success.main', mt: 0.25 }} fontSize="small" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{selectedPoint.formattedAddress}</Typography>
          <Typography variant="caption" color="text.secondary">
            {formatPostalCode(selectedPoint.postalCode)} {selectedPoint.municipalityName}
            {' · kód RÚIAN '}
            {selectedPoint.addressPointCode}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => { if (disabled !== true) { onSelect(null); chooseLocality(null); } }}
        >
          Změnit
        </Typography>
      </Box>
    );
  }

  /*
   * Nothing to search. Said before anything is typed, because the address is
   * not optional and no amount of filling in the rest will make the save work.
   */
  if (blocked) {
    return <Alert severity="error">{CATALOGUE_EMPTY_TEXT}</Alert>;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Autocomplete
          sx={{ flex: 1, width: '100%' }}
          options={localities}
          value={locality}
          onChange={(_, next) => chooseLocality(next)}
          onInputChange={(_, value) => setLocalityQuery(value)}
          loading={localitiesLoading}
          disabled={disabled}
          filterOptions={(options) => options}
          getOptionLabel={(option) => option.displayValue}
          isOptionEqualToValue={(a, b) =>
            a.municipalityPartCode === b.municipalityPartCode && a.streetCode === b.streetCode}
          noOptionsText={
            localityQuery.trim().length < 2
              ? 'Začněte psát ulici nebo obec…'
              : 'Nic takového v registru není.'
          }
          renderOption={(props, option) => {
            const { key, ...rest } = props as { key: string } & Record<string, unknown>;
            const postal = postalByPart[option.municipalityPartCode];
            return (
              <Box component="li" key={key} {...rest} sx={{ display: 'block !important', py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {option.displayValue}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.25 }}>
                  {/* Only where two rows are otherwise identical — the postal
                      code is the one thing that tells three Bohuslavice apart. */}
                  {isAmbiguous(option, ambiguous) && (
                    <Chip
                      size="small"
                      label={postal === undefined || postal === ''
                        ? 'rozlišuje se…'
                        : `PSČ ${formatPostalCode(postal)}`}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                  {hasNoStreet(option) && (
                    <Typography variant="caption" color="text.secondary">
                      {NO_STREET_HINT}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Ulice nebo obec"
              placeholder="Americká Vinohrady"
              error={error !== undefined && locality === null}
              helperText={
                resultsAreCapped(localities.length)
                  ? CAPPED_HINT
                  : 'Můžete připsat i obec — zúží to hledání.'
              }
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {localitiesLoading ? <CircularProgress size={18} /> : null}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />

        <TextField
          sx={{ width: { xs: '100%', md: 220 } }}
          label={houseNumberLabel(locality)}
          value={houseNumber}
          onChange={(e) => setHouseNumber(e.target.value)}
          disabled={disabled === true || locality === null}
          helperText={locality === null ? 'Nejdřív vyberte ulici nebo obec.' : ' '}
        />
      </Stack>

      {lookupError !== '' && <Alert severity="warning">{lookupError}</Alert>}

      {pointsLoading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 0.5 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">Hledám čísla…</Typography>
        </Stack>
      )}

      {points.length > 0 && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {points.map((point) => (
            <Box
              key={point.addressPointCode}
              onClick={() => onSelect(point)}
              sx={{
                display: 'flex', gap: 1.5, alignItems: 'center', px: 2, py: 1.25,
                cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                '&:last-of-type': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <PlaceIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2">{point.formattedAddress}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {formatPostalCode(point.postalCode)}
              </Typography>
            </Box>
          ))}
          {resultsAreCapped(points.length) && (
            <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">
                Zobrazeno prvních {RESULT_LIMIT} — upřesněte číslo.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {canSearchPoints(locality, houseNumber) && !pointsLoading && points.length === 0
        && lookupError === '' && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          Na téhle adrese takové číslo není.
        </Typography>
      )}

      {error !== undefined && <Alert severity="error">{error}</Alert>}

      {/* Where the catalogue came from and how old it is. A registry that
          silently ages is a registry nobody notices has aged. */}
      {status !== null && state === 'ready' && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          Registr RÚIAN · {catalogueSummary(status)}
        </Typography>
      )}
    </Stack>
  );
}
