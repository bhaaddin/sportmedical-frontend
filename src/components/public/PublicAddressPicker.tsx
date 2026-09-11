import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import {
  searchLocalities,
  searchPoints,
  type AddressLocality,
  type AddressPoint,
} from '../../api/addressLookup';

/**
 * Street first, then house number - the two steps the API itself is built in.
 *
 * The questionnaire cannot be submitted without a `ruianAddressPointCode`, and
 * that code only exists at the end of this pair of lookups. So the patient
 * picks from the register rather than typing an address, and there is nothing
 * to mistype: the code goes up, the words come back down.
 *
 * Nothing here validates an address. The register decides what exists, this
 * only shows what it answered - the same rule as never computing availability
 * on the client, for the same reason.
 */

interface Props {
  value: AddressPoint | null;
  onChange: (point: AddressPoint | null) => void;
  error?: string;
}

export default function PublicAddressPicker({ value, onChange, error }: Props) {
  const [localityInput, setLocalityInput] = useState('');
  const [localities, setLocalities] = useState<AddressLocality[]>([]);
  const [locality, setLocality] = useState<AddressLocality | null>(null);
  const [loadingLocalities, setLoadingLocalities] = useState(false);

  const [numberInput, setNumberInput] = useState('');
  const [points, setPoints] = useState<AddressPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  /* Only the latest answer may land: typing outruns the network, and an
     earlier reply arriving late would replace a newer list with a staler one. */
  const localitySeq = useRef(0);
  const pointSeq = useRef(0);

  useEffect(() => {
    const seq = (localitySeq.current += 1);
    if (localityInput.trim().length < 2) {
      setLocalities([]);
      return;
    }
    setLoadingLocalities(true);
    const timer = setTimeout(() => {
      searchLocalities(localityInput)
        .then((rows) => {
          if (seq === localitySeq.current) {
            setLocalities(rows);
            setLookupFailed(false);
          }
        })
        .catch(() => {
          if (seq === localitySeq.current) setLookupFailed(true);
        })
        .finally(() => {
          if (seq === localitySeq.current) setLoadingLocalities(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [localityInput]);

  useEffect(() => {
    const seq = (pointSeq.current += 1);
    /* The house number is required by /points; an empty box asks nothing
       rather than asking wrongly and collecting a 400. */
    if (locality === null || numberInput.trim().length === 0) {
      setPoints([]);
      return;
    }
    setLoadingPoints(true);
    const timer = setTimeout(() => {
      searchPoints(locality.streetCode, locality.municipalityPartCode, numberInput)
        .then((rows) => {
          if (seq === pointSeq.current) {
            setPoints(rows);
            setLookupFailed(false);
          }
        })
        .catch(() => {
          if (seq === pointSeq.current) setLookupFailed(true);
        })
        .finally(() => {
          if (seq === pointSeq.current) setLoadingPoints(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [locality, numberInput]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Autocomplete
        options={localities}
        value={locality}
        loading={loadingLocalities}
        getOptionLabel={(option) => option.displayValue}
        isOptionEqualToValue={(a, b) =>
          a.streetCode === b.streetCode &&
          a.municipalityPartCode === b.municipalityPartCode
        }
        filterOptions={(options) => options} /* the server already filtered */
        onInputChange={(_, next) => setLocalityInput(next)}
        onChange={(_, next) => {
          setLocality(next);
          setNumberInput('');
          setPoints([]);
          onChange(null);
        }}
        noOptionsText={
          localityInput.trim().length < 2
            ? 'Začněte psát název ulice a obce'
            : 'Nic takového jsme v registru nenašli. Zkuste přidat obec.'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Ulice a obec"
            placeholder="Například Americká Vinohrady"
            helperText="Napište ulici i obec — ulic stejného jména je v republice mnoho."
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {loadingLocalities ? <CircularProgress size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />

      <Autocomplete
        options={points}
        value={value}
        loading={loadingPoints}
        disabled={locality === null}
        getOptionLabel={(option) => option.formattedAddress}
        isOptionEqualToValue={(a, b) => a.addressPointCode === b.addressPointCode}
        filterOptions={(options) => options}
        onInputChange={(_, next) => setNumberInput(next)}
        onChange={(_, next) => onChange(next)}
        noOptionsText={
          numberInput.trim().length === 0
            ? 'Zadejte číslo domu'
            : 'Toto číslo na vybrané ulici nenajdeme'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Číslo domu"
            placeholder="118"
            error={error !== undefined}
            helperText={
              error ??
              (locality === null
                ? 'Nejprve vyberte ulici a obec.'
                : 'Vyberte adresu ze seznamu — ověřujeme ji v registru RÚIAN.')
            }
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {loadingPoints ? <CircularProgress size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />

      {/*
        A failed lookup is not an empty register. Without this the box would say
        "nic takového jsme nenašli" when the truth is that nobody was asked -
        and the patient would go looking for a different address for an hour.
      */}
      {lookupFailed && (
        <Typography variant="caption" sx={{ color: 'warning.main' }}>
          Registr adres se teď nepodařilo dotázat. Zkuste to prosím za chvíli —
          neznamená to, že vaše adresa neexistuje.
        </Typography>
      )}

      {value !== null && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vybráno: <strong>{value.formattedAddress}</strong>
        </Typography>
      )}
    </Box>
  );
}
