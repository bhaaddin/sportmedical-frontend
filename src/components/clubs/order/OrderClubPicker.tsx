/* "Klub": a searchable picker, or the fields of a new club (created together with the order). */
import { Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { Club } from '../../../api/clubs';
import { isValidIco } from '../../../pages/clubs/payerForm';
import { SectionLabel, SoftCard } from '../../ui';

export interface NewClubDraft {
  name: string;
  ico: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

export const EMPTY_NEW_CLUB: NewClubDraft = { name: '', ico: '', contactPerson: '', contactPhone: '', contactEmail: '' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewClub(club: NewClubDraft): Partial<Record<keyof NewClubDraft, string>> {
  const errors: Partial<Record<keyof NewClubDraft, string>> = {};
  if (club.name.trim() === '') errors.name = 'Název klubu je povinný.';
  if (club.ico.replace(/\s/g, '') === '') errors.ico = 'IČO je povinné — potřebujeme ho pro fakturu.';
  else if (!isValidIco(club.ico)) errors.ico = 'Tohle IČO neexistuje — zkontrolujte číslice.';
  if (club.contactEmail.trim() !== '' && !EMAIL.test(club.contactEmail.trim())) errors.contactEmail = 'Tohle není e-mailová adresa.';
  return errors;
}

export function OrderClubPicker({
  clubs, loading, mode, onModeChange, selected, onSelect, newClub, onNewClub, newClubErrors, error, fieldSize, locked, lockedName,
}: {
  clubs: Club[];
  loading: boolean;
  mode: 'existing' | 'new';
  onModeChange: (mode: 'existing' | 'new') => void;
  selected: Club | null;
  onSelect: (club: Club | null) => void;
  newClub: NewClubDraft;
  onNewClub: (club: NewClubDraft) => void;
  newClubErrors: Partial<Record<keyof NewClubDraft, string>>;
  error: string | undefined;
  fieldSize: 'small' | 'medium';
  /** Edit / process: the club is shown, not changed. */
  locked: boolean;
  lockedName: string;
}) {
  if (locked) {
    return (
      <Box data-testid="order-club">
        <SectionLabel>Klub</SectionLabel>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{lockedName}</Typography>
      </Box>
    );
  }
  return (
    <Box data-testid="order-club">
      <SectionLabel>Klub</SectionLabel>
      {mode === 'existing' ? (
        <Stack spacing={1}>
          <Autocomplete
            options={clubs}
            loading={loading}
            value={selected}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Žádný takový klub — založte nový."
            loadingText="Načítám…"
            onChange={(_e, value) => onSelect(value)}
            renderInput={(params) => (
              <TextField {...params} size={fieldSize} label="Klub" placeholder="Název klubu nebo kontaktní osoba" error={error !== undefined} helperText={error} />
            )}
          />
          <Button variant="text" size="small" sx={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => onModeChange('new')}>
            + Klub není v seznamu — založit nový
          </Button>
        </Stack>
      ) : (
        <SoftCard sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Nový klub — není v seznamu</Typography>
            <TextField size={fieldSize} label="Název klubu" value={newClub.name} onChange={(e) => onNewClub({ ...newClub, name: e.target.value })}
              error={newClubErrors.name !== undefined} helperText={newClubErrors.name} fullWidth />
            <TextField size={fieldSize} label="IČO" value={newClub.ico} onChange={(e) => onNewClub({ ...newClub, ico: e.target.value })}
              error={newClubErrors.ico !== undefined} helperText={newClubErrors.ico ?? 'Osm číslic — ostatní fakturační údaje doplníte v kartě klubu.'} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size={fieldSize} label="Kontaktní osoba" value={newClub.contactPerson} onChange={(e) => onNewClub({ ...newClub, contactPerson: e.target.value })} fullWidth />
              <TextField size={fieldSize} label="Telefon" type="tel" value={newClub.contactPhone} onChange={(e) => onNewClub({ ...newClub, contactPhone: e.target.value })} fullWidth />
            </Stack>
            <TextField size={fieldSize} label="E-mail" type="email" value={newClub.contactEmail} onChange={(e) => onNewClub({ ...newClub, contactEmail: e.target.value })}
              error={newClubErrors.contactEmail !== undefined} helperText={newClubErrors.contactEmail} fullWidth />
            <Button variant="text" size="small" sx={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => onModeChange('existing')}>
              Vybrat klub ze seznamu
            </Button>
          </Stack>
        </SoftCard>
      )}
    </Box>
  );
}
