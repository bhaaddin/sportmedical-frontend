import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  InputAdornment,
  ListSubheader,
  Menu,
  MenuItem,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import {
  composePhone,
  countryByCode,
  defaultCountry,
  digitsOf,
  formatNational,
  parsePhoneValue,
  searchCountries,
  type CountryCode,
} from './countryCodes';

/**
 * A telephone, typed the way the desk says it.
 *
 * One box for the number - plain text, digits and spaces, shown as
 * `773 539 001` - with a compact country button in front of it (flag and
 * `+420`, Česko by default). The button opens a menu searchable by digits or
 * by name: `421` finds Slovensko, `slov` finds Slovensko and Slovinsko. Under
 * the field a small muted line names the country chosen - a note, not a
 * warning ("421 = Slovensko jen jako poznámka").
 *
 * The value contract is one string: `onChange('+420773539001')`. Whatever is
 * stored comes back in - a `+421…` lands in the picker as Slovensko, a bare
 * national number is read as the default country, an unknown dialling code is
 * shown as typed and sent as typed. A `+` typed into the number box is
 * honoured too: `+421 908…` switches the picker as the code is typed.
 *
 * Nothing here decides whether the number is valid - the server does, where
 * it stores it. This field only makes sure the server always receives a
 * dialling code, which is the one thing it refuses to do without.
 */

export const PHONE_FIELD_TEXT = {
  countryPicker: 'Předvolba',
  search: 'Hledat zemi nebo předvolbu',
  nothingFound: 'Žádná země neodpovídá.',
  otherCountry: 'Jiná země — číslo se uloží tak, jak je zapsáno.',
};

export interface PhoneFieldProps {
  /** The stored number, `+420773539001`, or anything older code saved. */
  value: string;
  onChange: (value: string, country: CountryCode | null) => void;
  /** The input's id, so an outside `<label htmlFor>` reaches it. */
  id?: string;
  /** The input's accessible name when there is no outside label. */
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: React.ReactNode;
  /** `success` paints the helper green - the registration's "this grouping is valid". */
  helperTone?: 'default' | 'success';
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  /** ISO code read into the picker when `value` carries no dialling code. */
  defaultCountryCode?: string;
  /** The muted country name under the field. On unless the caller says otherwise. */
  showCountryNote?: boolean;
  sx?: SxProps<Theme>;
}

export function PhoneField({
  value,
  onChange,
  id,
  label,
  placeholder = '773 539 001',
  error = false,
  helperText,
  helperTone = 'default',
  disabled = false,
  autoFocus = false,
  onBlur,
  size = 'medium',
  fullWidth = true,
  defaultCountryCode,
  showCountryNote = true,
  sx,
}: PhoneFieldProps) {
  const fallback = useMemo(
    () => countryByCode(defaultCountryCode) ?? defaultCountry(),
    [defaultCountryCode],
  );

  const initial = useMemo(() => parsePhoneValue(value, fallback), [value, fallback]);
  const [country, setCountry] = useState<CountryCode>(initial.country ?? fallback);
  /** What is in the box: grouped digits, or the raw `+…` text while a code is being typed. */
  const [text, setText] = useState<string>(() =>
    initial.country === null ? value.trim() : formatNational(initial.national),
  );
  /** True while the box holds a `+…` nobody on the list owns. */
  const [foreign, setForeign] = useState(initial.country === null && value.trim() !== '');

  const lastEmitted = useRef<string>(value);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');

  /* A value set from outside (a reset, a loaded record) is read back into the parts. */
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const parsed = parsePhoneValue(value, fallback);
    if (parsed.country === null) {
      setForeign(true);
      setText(value.trim());
      return;
    }
    setForeign(false);
    setCountry(parsed.country);
    setText(formatNational(parsed.national));
  }, [value, fallback]);

  const emit = (next: string, forCountry: CountryCode | null) => {
    lastEmitted.current = next;
    onChange(next, forCountry);
  };

  const handleText = (raw: string) => {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
      /* A dialling code typed into the box: the picker follows it as it is typed. */
      const parsed = parsePhoneValue(trimmed, fallback);
      setText(raw);
      if (parsed.country !== null) {
        setForeign(false);
        setCountry(parsed.country);
        emit(composePhone(parsed.country, parsed.national), parsed.country);
      } else {
        setForeign(true);
        const digits = digitsOf(trimmed).replace(/^00/, '');
        emit(digits === '' ? '' : `+${digits}`, null);
      }
      return;
    }
    const digits = digitsOf(raw);
    setForeign(false);
    setText(formatNational(digits));
    emit(composePhone(country, digits), country);
  };

  /* Leaving the box tidies a typed `+421 908 123 456` into the picker plus `908 123 456`. */
  const handleBlur = () => {
    if (!foreign && (text.trimStart().startsWith('+') || text.trimStart().startsWith('00'))) {
      const parsed = parsePhoneValue(text, fallback);
      if (parsed.country !== null) setText(formatNational(parsed.national));
    }
    onBlur?.();
  };

  const pickCountry = (next: CountryCode) => {
    setMenuAnchor(null);
    setQuery('');
    const parsed = parsePhoneValue(text, country);
    const national = parsed.international ? parsed.national : digitsOf(text);
    setForeign(false);
    setCountry(next);
    setText(formatNational(national));
    emit(composePhone(next, national), next);
  };

  const rows = useMemo(() => searchCountries(query), [query]);
  const noteId = id ? `${id}-country` : undefined;

  return (
    <Box sx={sx}>
      <TextField
        fullWidth={fullWidth}
        size={size}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        helperText={helperText}
        autoFocus={autoFocus}
        onChange={(e) => handleText(e.target.value)}
        onBlur={handleBlur}
        slotProps={{
          htmlInput: {
            id,
            'aria-label': label,
            'aria-describedby': noteId,
            inputMode: 'tel',
            autoComplete: 'tel-national',
          },
          formHelperText:
            helperTone === 'success' ? { sx: { color: 'success.main', fontWeight: 500 } } : undefined,
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0.5 }}>
                <ButtonBase
                  type="button"
                  disabled={disabled}
                  aria-label={`${PHONE_FIELD_TEXT.countryPicker} ${country.dial} ${country.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuAnchor !== null}
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.75,
                    py: 0.5,
                    mr: 0.25,
                    borderRadius: 1.5,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'text.primary',
                    bgcolor: 'action.hover',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: 'action.selected' },
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
                  }}
                >
                  <Box component="span" aria-hidden sx={{ fontSize: 16, lineHeight: 1 }}>
                    {foreign ? '🌐' : country.flag}
                  </Box>
                  <Box component="span">{foreign ? '+' : country.dial}</Box>
                  <ArrowDropDown fontSize="small" sx={{ ml: -0.5, color: 'text.secondary' }} />
                </ButtonBase>
              </InputAdornment>
            ),
          },
        }}
      />
      {showCountryNote ? (
        <Typography
          id={noteId}
          data-testid="phone-country-note"
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
        >
          {foreign ? PHONE_FIELD_TEXT.otherCountry : country.name}
        </Typography>
      ) : null}

      <Menu
        open={menuAnchor !== null}
        anchorEl={menuAnchor}
        onClose={() => {
          setMenuAnchor(null);
          setQuery('');
        }}
        slotProps={{
          list: { 'aria-label': PHONE_FIELD_TEXT.countryPicker, autoFocusItem: false, dense: true },
          paper: { sx: { minWidth: 280, maxHeight: 360 } },
        }}
      >
        <ListSubheader disableSticky sx={{ px: 1.5, pt: 1, pb: 0.5, bgcolor: 'transparent', lineHeight: 1 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder={PHONE_FIELD_TEXT.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            /* The menu listens for letters to jump between items; the search box keeps them. */
            onKeyDown={(e) => {
              if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
            }}
            slotProps={{ htmlInput: { 'aria-label': PHONE_FIELD_TEXT.search, autoComplete: 'off' } }}
          />
        </ListSubheader>
        {rows.length === 0 ? (
          <MenuItem disabled>{PHONE_FIELD_TEXT.nothingFound}</MenuItem>
        ) : (
          rows.map((row) => (
            <MenuItem
              key={row.code}
              selected={!foreign && row.code === country.code}
              onClick={() => pickCountry(row)}
              sx={{ gap: 1.25 }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: 18, lineHeight: 1 }}>
                {row.flag}
              </Box>
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                {row.name}
              </Box>
              <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {row.dial}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}

export default PhoneField;
