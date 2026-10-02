/*
 * Which doctor wrote this report.
 *
 * A suggester rather than a dropdown, because the register has a hundred and
 * seventy-eight entries and nobody scrolls that - the owner said outright he
 * would sooner retype it by hand than read a list that long.
 *
 * Every search goes to the server. Matching, ordering and the synonyms live
 * there, and keeping a copy here would let the two drift apart - a suggester
 * offering a specialty the server will not accept is worse than none at all.
 * That drift is the exact shape that has cost this project several rounds
 * already: two lists for one thing, and half of it working.
 *
 * Typing nothing is a real state, not an empty one: the server answers with
 * what a clinic actually uses, so the common case needs no typing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete, Box, Chip, CircularProgress, TextField, Typography,
} from '@mui/material';
import { documentsApi, type Specialty } from '../../api/documents';

export interface SpecialtyValue {
  specialtyCode: string | null;
  specialtyOther: string | null;
}

export interface SpecialtyPickerProps {
  value: SpecialtyValue;
  onChange: (value: SpecialtyValue) => void;
  /** What the patient said it was. Shown as a hint, never chosen for anybody. */
  suggestion?: string | null;
  label?: string;
  disabled?: boolean;
}

/** Long enough that a keystroke does not become a request, short enough to feel live. */
const DEBOUNCE_MS = 180;

export default function SpecialtyPicker({
  value, onChange, suggestion, label = 'Odbornost', disabled = false,
}: SpecialtyPickerProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Rising number, so a slow answer to an old query cannot overwrite a fast
     answer to a new one - the list would flicker back to what was typed two
     letters ago. */
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      documentsApi
        .specialties(input.trim(), 10)
        .then((found) => {
          if (id !== requestId.current) return;
          setOptions(found);
          setFailed(false);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setFailed(true);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [input]);

  /*
   * The name of whatever is chosen, remembered rather than looked up.
   *
   * It used to be derived from `options`, and `options` is refetched on every
   * keystroke - including the one the selection itself causes. So a moment
   * after picking Kardiologie the list no longer held it, the lookup fell
   * through to a placeholder built from the code, and the box read "107 107":
   * the code twice, once as the code and once standing in for the missing
   * name. On screen it appeared, flickered, and turned into that.
   *
   * Remembering the name at the moment of choosing cannot flicker, because
   * nothing else can change it.
   */
  const [chosenName, setChosenName] = useState<string | null>(null);

  useEffect(() => {
    if (value.specialtyCode === null) {
      setChosenName(null);
      return;
    }
    const known = options.find((o) => o.code === value.specialtyCode);
    if (known !== undefined) setChosenName(known.name);
  }, [value.specialtyCode, options]);

  const selected = useMemo<Specialty | string | null>(() => {
    if (value.specialtyCode !== null) {
      return {
        code: value.specialtyCode,
        name: chosenName ?? '',
        isCommon: false,
      };
    }
    return value.specialtyOther;
  }, [value, chosenName]);

  return (
    <Box>
      <Autocomplete
        freeSolo
        disabled={disabled}
        options={options}
        value={selected}
        loading={loading}
        filterOptions={(x) => x}
        /*
         * The name alone. The code belongs in the dropdown, where it helps
         * somebody recognise the right row and lets them search by it - in the
         * box afterwards it is clutter nobody reads, and when the name was
         * missing it printed twice.
         */
        getOptionLabel={(option) =>
          typeof option === 'string' ? option : option.name === '' ? option.code : option.name
        }
        isOptionEqualToValue={(option, current) =>
          typeof option !== 'string' &&
          typeof current !== 'string' &&
          option.code === current.code
        }
        onInputChange={(_, next, reason) => {
          setInput(next);
          /* Typing releases any chosen code: it would otherwise stay attached
             to text that no longer describes it, and the record would be filed
             under a specialty nobody on screen could see. Only real typing -
             `reason` is also fired when a selection fills the box. */
          if (reason === 'input') {
            onChange({ specialtyCode: null, specialtyOther: next === '' ? null : next });
          }
        }}
        onChange={(_, next) => {
          if (next === null) {
            setChosenName(null);
            onChange({ specialtyCode: null, specialtyOther: null });
          } else if (typeof next === 'string') {
            setChosenName(null);
            onChange({ specialtyCode: null, specialtyOther: next });
          } else {
            /* Remembered here, where the name is certainly known. */
            setChosenName(next.name);
            onChange({ specialtyCode: next.code, specialtyOther: null });
          }
        }}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.code}>
            <Typography component="span" sx={{ color: 'text.secondary', mr: 1, minWidth: 36 }}>
              {option.code}
            </Typography>
            <Typography component="span">{option.name}</Typography>
            {option.isCommon && (
              <Chip size="small" variant="outlined" label="časté" sx={{ ml: 'auto' }} />
            )}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Napište obor, kód nebo běžné slovo — třeba srdce"
            helperText={
              failed
                ? 'Seznam oborů se nepodařilo načíst. Můžete obor prostě napsat.'
                : 'Nenajdete-li obor, napište ho vlastními slovy.'
            }
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />

      {/*
        The patient's own words, offered and never applied. They wrote it into
        a phone; the person filing the record decides what it was.
      */}
      {suggestion !== null && suggestion !== undefined && suggestion !== '' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Pacient uvedl: „{suggestion}"
        </Typography>
      )}
    </Box>
  );
}
