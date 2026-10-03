/*
 * The payer record - IČO, fakturační adresa, bankovní spojení, kontakt and the
 * administrator's own discount for the club. Unchanged behaviour since the
 * clubs screen was built; moved out of the page so the page can stay a page.
 * Full screen on a phone, with the buttons at the bottom.
 */
import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, TextField } from '@mui/material';
import toast from 'react-hot-toast';
import { clubsApi } from '../../api/clubs';
import type { Club } from '../../api/clubs';
import { useIsPhone } from '../../layout/useDevice';
import { SectionLabel } from '../../components/ui';
import { EMPTY_PAYER, hasPayerErrors, toPayerRequest, validatePayer } from './payerForm';
import type { PayerDraft, PayerErrors } from './payerForm';

export const draftFromClub = (club: Club): PayerDraft => ({
  name: club.name ?? '',
  ico: club.ico ?? '',
  dic: club.dic ?? '',
  address: club.address ?? '',
  city: club.city ?? '',
  postalCode: club.postalCode ?? '',
  contactPerson: club.contactPerson ?? '',
  contactEmail: club.contactEmail ?? '',
  contactPhone: club.contactPhone ?? '',
  bankAccount: club.bankAccount ?? '',
  bankCode: club.bankCode ?? '',
  iban: club.iban ?? '',
  paymentTermsDays: String(club.paymentTermsDays ?? 14),
  discountPercent:
    typeof club.discountPercent === 'number' ? club.discountPercent.toLocaleString('cs-CZ') : '',
});

/** `'new'` adds a club; a club edits it. */
export function PayerDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: Club | 'new';
  onClose: () => void;
  onSaved: () => void;
}) {
  const phone = useIsPhone();
  const [form, setForm] = useState<PayerDraft>(editing === 'new' ? EMPTY_PAYER : draftFromClub(editing));
  const [errors, setErrors] = useState<PayerErrors>({});
  const [saving, setSaving] = useState(false);

  const set = (field: keyof PayerDraft, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    /* Clear this field's complaint as it is being fixed; leave the others, so
       correcting one does not hide the rest. */
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const save = async () => {
    const found = validatePayer(form);
    if (hasPayerErrors(found)) {
      setErrors(found);
      return;
    }

    setSaving(true);
    try {
      const body = toPayerRequest(form);
      if (editing === 'new') await clubsApi.create(body);
      else await clubsApi.update(editing.id, body);
      toast.success(editing === 'new' ? 'Klub založen' : 'Změny uloženy');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof PayerDraft, label: string, extra: { help?: string; width?: number } = {}) => (
    <Grid size={{ xs: 12, sm: extra.width ?? 6 }}>
      <TextField
        fullWidth
        size={phone ? 'medium' : 'small'}
        label={label}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        error={errors[key] !== undefined}
        helperText={errors[key] ?? extra.help}
      />
    </Grid>
  );

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth fullScreen={phone}>
      <DialogTitle>{editing === 'new' ? 'Nový klub' : 'Upravit klub'}</DialogTitle>
      <DialogContent>
        <SectionLabel sx={{ mt: 1 }}>Identifikace</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('name', 'Název', { width: 12 })}
          {field('ico', 'IČO', { help: 'Osm číslic' })}
          {field('dic', 'DIČ', { help: 'Nepovinné — CZ a 8 až 10 číslic' })}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Fakturační adresa</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('address', 'Ulice a číslo', { width: 12 })}
          {field('city', 'Město')}
          {field('postalCode', 'PSČ')}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Bankovní spojení a splatnost</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('bankAccount', 'Číslo účtu')}
          {field('bankCode', 'Kód banky', { help: 'Čtyři číslice' })}
          {field('iban', 'IBAN', { help: 'Nepovinné, pokud je vyplněn účet' })}
          {field('paymentTermsDays', 'Splatnost (dní)')}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Kontakt</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('contactPerson', 'Kontaktní osoba')}
          {field('contactEmail', 'E-mail')}
          {field('contactPhone', 'Telefon')}
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Sleva</SectionLabel>
        <Grid container spacing={2}>
          {field('discountPercent', 'Sleva klubu (%)', { help: 'Prázdné = bez slevy. Platí pro každou objednávku klubu.' })}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ minHeight: 44, flex: phone ? 1 : undefined }}>
          Zrušit
        </Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ minHeight: 44, flex: phone ? 2 : undefined }}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PayerDialog;
