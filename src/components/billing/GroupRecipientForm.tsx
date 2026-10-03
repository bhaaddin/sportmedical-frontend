/*
 * The recipient of a "Skupina" document: a free group or a firm. No patient -
 * a name, the IČO and DIČ when it is a firm, an address, who to talk to and how
 * many people there are (the headcount decides the tier discount).
 */
import { Box, TextField } from '@mui/material';
import type { GroupDraft } from '../../pages/billing/invoiceDraft';
import { groupErrors } from '../../pages/billing/invoiceDraft';

export default function GroupRecipientForm({
  group,
  headcount,
  onGroupChange,
  onHeadcountChange,
}: {
  group: GroupDraft;
  headcount: string;
  onGroupChange: (next: GroupDraft) => void;
  onHeadcountChange: (next: string) => void;
}) {
  const errors = groupErrors(group);
  const set = (key: keyof GroupDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onGroupChange({ ...group, [key]: e.target.value });
  /* An error shows only after something was typed: an empty form is not "wrong". */
  const shown = (key: keyof GroupDraft) => (group[key].trim() !== '' ? errors[key] : undefined);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      <TextField
        required
        label="Název skupiny nebo firmy"
        value={group.name}
        onChange={set('name')}
        sx={{ gridColumn: { md: '1 / -1' } }}
        fullWidth
      />
      <TextField
        label="IČO"
        value={group.ico}
        onChange={set('ico')}
        error={shown('ico') !== undefined}
        helperText={shown('ico')}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        fullWidth
      />
      <TextField label="DIČ" value={group.dic} onChange={set('dic')} fullWidth />
      <TextField
        label="Adresa"
        value={group.address}
        onChange={set('address')}
        sx={{ gridColumn: { md: '1 / -1' } }}
        fullWidth
      />
      <TextField label="Kontaktní osoba" value={group.contactPerson} onChange={set('contactPerson')} fullWidth />
      <TextField
        label="Telefon"
        type="tel"
        value={group.contactPhone}
        onChange={set('contactPhone')}
        fullWidth
      />
      <TextField
        label="E-mail"
        type="email"
        value={group.contactEmail}
        onChange={set('contactEmail')}
        error={shown('contactEmail') !== undefined}
        helperText={shown('contactEmail')}
        fullWidth
      />
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
