/*
 * Choosing one patient out of the whole register.
 *
 * `GET /api/patients` answers one page - twenty rows unless asked for more,
 * never more than a hundred - so a picker filled from it offered the first
 * twenty surnames alphabetically and nobody after them. This asks the server
 * instead: what is typed goes to the search route, which matches first and
 * last names over the whole register, diacritics ignored.
 */
import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { patientsApi } from '../../api/patients';
import type { Patient } from '../../api/patients';

interface Props {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
  /** A patient never to offer - the one a document is being moved away from. */
  excludeId?: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

const patientLabel = (p: Patient): string => `${p.firstName} ${p.lastName}`;

export default function PatientPicker({
  value, onChange, label = 'Pacient', required, disabled, size, excludeId,
}: Props) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const ticket = useRef(0);

  useEffect(() => {
    const text = query.trim();
    const mine = ++ticket.current;
    if (text.length < MIN_QUERY) return;

    const timer = setTimeout(() => {
      setLoading(true);
      patientsApi.search(text)
        .then((rows) => {
          /* Typing outruns the network: only the newest question may answer. */
          if (mine !== ticket.current) return;
          setOptions(rows);
          setFailed(false);
        })
        .catch(() => {
          if (mine !== ticket.current) return;
          setOptions([]);
          setFailed(true);
        })
        .finally(() => {
          if (mine === ticket.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const tooShort = query.trim().length < MIN_QUERY;
  const searching = loading && !tooShort;

  return (
    <Autocomplete
      options={tooShort ? [] : options.filter((p) => p.id !== excludeId)}
      value={value}
      onChange={(_, next) => onChange(next)}
      onInputChange={(_, text) => setQuery(text)}
      filterOptions={(all) => all}
      getOptionLabel={patientLabel}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={searching}
      disabled={disabled}
      size={size}
      noOptionsText={
        tooShort
          ? 'Začněte psát jméno nebo příjmení…'
          : failed
            ? 'Hledání se nepodařilo. Zkuste to znovu.'
            : 'Žádný pacient tomu neodpovídá.'
      }
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key: string } & Record<string, unknown>;
        return (
          <Box component="li" key={key} {...rest}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{patientLabel(option)}</Typography>
              {option.dateOfBirth && (
                <Typography variant="caption" color="text.secondary">
                  nar. {new Date(option.dateOfBirth).toLocaleDateString('cs-CZ')}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder="Jméno nebo příjmení"
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {searching ? <CircularProgress size={18} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
