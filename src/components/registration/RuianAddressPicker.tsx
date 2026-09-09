/* ══════════════════════════════════════════════════════════════
   RÚIAN ADDRESS PICKER

   Registration stores a residence as one RÚIAN address-point code, not
   as typed street text — so this control never lets the operator invent
   an address. It walks the two catalogue endpoints the API exposes:
   localities (street / municipality part) and then address points
   within that locality for a house number.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, CircularProgress, Grid, TextField, Typography } from '@mui/material';
import { CheckCircle, LocationOn } from '@mui/icons-material';
import patientRegistryApi, {
  type AddressLocality,
  type AddressPoint,
} from '../../api/patientRegistry';

interface Props {
  selectedPoint: AddressPoint | null;
  onSelect: (point: AddressPoint | null) => void;
  error?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 250;

export default function RuianAddressPicker({ selectedPoint, onSelect, error, disabled }: Props) {
  const [localityQuery, setLocalityQuery] = useState('');
  const [localities, setLocalities] = useState<AddressLocality[]>([]);
  const [locality, setLocality] = useState<AddressLocality | null>(null);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);

  const [houseNumber, setHouseNumber] = useState('');
  const [points, setPoints] = useState<AddressPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [datasetLoaded, setDatasetLoaded] = useState<boolean | null>(null);

  const localityRequest = useRef(0);
  const pointRequest = useRef(0);

  /* ── Is the catalogue there at all? ── */
  useEffect(() => {
    patientRegistryApi
      .getAddressDatasetStatus()
      .then((status) => setDatasetLoaded(status.loaded && status.addressPointCount > 0))
      .catch(() => setDatasetLoaded(null)); // unknown — let the search speak for itself
  }, []);

  /* ── Locality suggestions ── */
  useEffect(() => {
    const query = localityQuery.trim();
    if (query.length < 2) {
      setLocalities([]);
      return;
    }

    const ticket = ++localityRequest.current;
    setLocalitiesLoading(true);

    const timer = setTimeout(() => {
      patientRegistryApi
        .searchLocalities(query)
        .then((result) => {
          if (ticket !== localityRequest.current) return; // a newer keystroke won
          setLocalities(result);
          setLookupError('');
        })
        .catch(() => {
          if (ticket !== localityRequest.current) return;
          setLocalities([]);
          setLookupError('Registr adres se nepodařilo načíst.');
        })
        .finally(() => {
          if (ticket === localityRequest.current) setLocalitiesLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localityQuery]);

  /* ── Address points inside the chosen locality ── */
  useEffect(() => {
    const number = houseNumber.trim();
    if (locality === null || number.length === 0) {
      setPoints([]);
      return;
    }

    const ticket = ++pointRequest.current;
    setPointsLoading(true);

    const timer = setTimeout(() => {
      patientRegistryApi
        .searchAddressPoints({
          streetCode: locality.streetCode,
          municipalityPartCode: locality.municipalityPartCode,
          number,
        })
        .then((result) => {
          if (ticket !== pointRequest.current) return;
          setPoints(result);
          setLookupError(result.length === 0 ? 'Pro toto číslo nebyla adresa nalezena.' : '');
        })
        .catch(() => {
          if (ticket !== pointRequest.current) return;
          setPoints([]);
          setLookupError('Adresní body se nepodařilo načíst.');
        })
        .finally(() => {
          if (ticket === pointRequest.current) setPointsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [locality, houseNumber]);

  const pointOptions = useMemo(() => points, [points]);

  return (
    <Box>
      {datasetLoaded === false && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Adresní registr RÚIAN není v této instalaci nahraný. Bez adresního bodu nelze registraci
          dokončit — dataset musí nejdřív naimportovat správce.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Autocomplete
            disabled={disabled}
            options={localities}
            value={locality}
            loading={localitiesLoading}
            filterOptions={(options) => options} // the server already filtered
            getOptionLabel={(option) => option.displayValue}
            isOptionEqualToValue={(a, b) =>
              a.municipalityPartCode === b.municipalityPartCode && a.streetCode === b.streetCode
            }
            onInputChange={(_, value, reason) => {
              if (reason === 'input') setLocalityQuery(value);
            }}
            onChange={(_, value) => {
              setLocality(value);
              setPoints([]);
              onSelect(null);
            }}
            noOptionsText={
              localityQuery.trim().length < 2 ? 'Zadejte alespoň dva znaky' : 'Nic nenalezeno'
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ulice nebo obec"
                placeholder="např. Vinohradská, Praha"
                required
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {localitiesLoading ? <CircularProgress size={16} /> : null}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            required
            label="Číslo popisné / orientační"
            placeholder="např. 1234/5"
            value={houseNumber}
            disabled={disabled || locality === null}
            onChange={(event) => {
              setHouseNumber(event.target.value);
              onSelect(null);
            }}
            helperText={locality === null ? 'Nejprve vyberte ulici nebo obec' : ' '}
          />
        </Grid>

        {pointOptions.length > 0 && (
          <Grid size={12}>
            <Autocomplete
              disabled={disabled}
              options={pointOptions}
              value={selectedPoint}
              loading={pointsLoading}
              getOptionLabel={(option) => option.formattedAddress}
              isOptionEqualToValue={(a, b) => a.addressPointCode === b.addressPointCode}
              onChange={(_, value) => onSelect(value)}
              renderInput={(params) => (
                <TextField {...params} label="Adresní bod (RÚIAN)" required />
              )}
            />
          </Grid>
        )}
      </Grid>

      {selectedPoint !== null && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'success.light',
            color: 'success.contrastText',
          }}
        >
          <CheckCircle fontSize="small" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selectedPoint.formattedAddress}
            </Typography>
            <Typography variant="caption">
              {selectedPoint.postalCode} {selectedPoint.municipalityName} · kód RÚIAN{' '}
              {selectedPoint.addressPointCode}
            </Typography>
          </Box>
        </Box>
      )}

      {(error || lookupError) && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <LocationOn fontSize="inherit" /> {error || lookupError}
        </Typography>
      )}
    </Box>
  );
}
