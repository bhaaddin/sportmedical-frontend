/*
 * The recipient of a "Tým" document: a club from the register of clubs. The
 * club's own discount is shown the moment it is chosen (the quote then says
 * whether it or the headcount tier is the higher one), and so is the headcount.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { clubsApi } from '../../api/clubs';
import type { Club } from '../../api/clubs';
import type { ClubChoice } from '../../pages/billing/invoiceDraft';
import { formatPercent } from '../../pages/billing/invoiceView';

const toChoice = (c: Club): ClubChoice => ({ id: c.id, name: c.name, discountPercent: c.discountPercent ?? null });

export default function ClubRecipientPicker({
  club,
  headcount,
  onClubChange,
  onHeadcountChange,
}: {
  club: ClubChoice | null;
  headcount: string;
  onClubChange: (next: ClubChoice | null) => void;
  onHeadcountChange: (next: string) => void;
}) {
  const [clubs, setClubs] = useState<ClubChoice[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => clubsApi.getAll(true))
      .then((rows) => { if (!cancelled) setClubs(rows.map(toChoice)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  /* A club that came in from another screen is offered even if the list lacks it. */
  const options = useMemo(
    () => (club !== null && !clubs.some((c) => c.id === club.id) ? [club, ...clubs] : clubs),
    [clubs, club],
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Autocomplete
          options={options}
          value={club}
          onChange={(_, next) => onClubChange(next)}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText={failed ? 'Kluby se nepodařilo načíst.' : 'Žádný klub nenalezen.'}
          renderOption={(props, option) => {
            const { key, ...rest } = props as typeof props & { key: string };
            return (
              <Box component="li" key={key} {...rest} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <span>{option.name}</span>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {option.discountPercent ? `sleva ${formatPercent(option.discountPercent)}` : 'bez vlastní slevy'}
                </Typography>
              </Box>
            );
          }}
          renderInput={(params) => <TextField {...params} required label="Klub" />}
        />
        {club !== null && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Chip color="primary" label={`Klub: ${club.name}`} onDelete={() => onClubChange(null)} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {club.discountPercent
                ? `Vlastní sleva klubu ${formatPercent(club.discountPercent)}`
                : 'Klub nemá vlastní slevu'}
            </Typography>
          </Box>
        )}
      </Box>
      <TextField
        required
        label="Počet osob"
        type="number"
        value={headcount}
        onChange={(e) => onHeadcountChange(e.target.value)}
        slotProps={{ htmlInput: { min: 1, step: 1, inputMode: 'numeric' } }}
        fullWidth
      />
    </Box>
  );
}
