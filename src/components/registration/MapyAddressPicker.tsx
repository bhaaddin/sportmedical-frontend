import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import { suggestMapyAddress } from '../../api/addressLookup';
import type { MapySuggestion } from '../../api/addressLookup';

/**
 * Whole-Czechia address autocomplete backed by Mapy.cz (through our own proxy).
 * Unlike the RUIAN picker it needs no catalogue in our database, so it finds
 * addresses anywhere in the republic. The chosen suggestion is handed up whole;
 * the form sends its parts to the server, which builds the stored address.
 */
export default function MapyAddressPicker({
  selected,
  onSelect,
  error,
  disabled = false,
}: {
  selected: MapySuggestion | null;
  onSelect: (value: MapySuggestion | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<MapySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const mine = ++ticket.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      suggestMapyAddress(q)
        .then((results) => {
          if (mine === ticket.current) {
            setItems(results);
            setLoading(false);
          }
        })
        .catch(() => {
          if (mine === ticket.current) {
            setItems([]);
            setLoading(false);
          }
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  if (selected) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{selected.label}</Typography>
          <Button
            size="small"
            disabled={disabled}
            onClick={() => {
              onSelect(null);
              setText('');
            }}
          >
            Změnit
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      <TextField
        fullWidth
        size="small"
        disabled={disabled}
        label="Adresa trvalého pobytu (celá ČR)"
        placeholder="např. Kladno Václavská 2409"
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={Boolean(error)}
        helperText={error}
        autoComplete="off"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={16} aria-label="Hledám" />
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      {text.trim().length >= 2 && !loading && items.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Nic nenalezeno — zkuste jiný tvar, třeba „obec ulice číslo".
        </Typography>
      ) : null}
      {items.length > 0 ? (
        <Box role="list" aria-label="Nalezené adresy" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          {items.map((item, index) => (
            <Box
              key={`${item.label}-${index}`}
              component="button"
              type="button"
              onClick={() => onSelect(item)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                font: 'inherit',
                color: 'inherit',
                cursor: 'pointer',
                px: 1.5,
                py: 1,
                borderTop: index > 0 ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': { backgroundColor: 'action.hover' },
                '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
              }}
            >
              <Typography variant="body2">{item.label}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}
