/*
 * The payer record - IČO, fakturační adresa, bankovní spojení, kontakt and the
 * administrator's own discount for the club. Unchanged behaviour since the
 * clubs screen was built; moved out of the page so the page can stay a page.
 * Full screen on a phone, with the buttons at the bottom.
 */
import { useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import { clubsApi, readClubManagement } from '../../api/clubs';
import type { Club, ClubManager } from '../../api/clubs';
import type { AresManager, AresSubject } from '../../api/ares';
import { useIsPhone } from '../../layout/useDevice';
import { SectionLabel } from '../../components/ui';
import { AresFillButton, AresOverrideCaption, AresStatusLine, applyAresFill, useAresFill } from '../../components/common/AresFill';
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

/** A blank row for the desk to fill by hand. */
export const EMPTY_MANAGER: ClubManager = { fullName: '', role: '', phone: null, email: null, source: 'manual' };

/**
 * Vedení klubu after an ARES lookup: the rows the registry wrote before are
 * replaced by what it lists now; a phone or e-mail the desk typed stays with
 * the person when the name matches; rows added by hand are left alone, in place.
 */
export function mergeAresManagement(current: ClubManager[], fetched: AresManager[]): ClubManager[] {
  const key = (name: string) => name.trim().toLocaleLowerCase('cs-CZ');
  const known = new Map(current.map((m) => [key(m.fullName), m]));
  const fromAres: ClubManager[] = fetched.map((p) => {
    const previous = known.get(key(p.fullName));
    return {
      ...(previous?.id !== undefined ? { id: previous.id } : {}),
      fullName: p.fullName,
      role: p.role,
      phone: previous?.phone ?? null,
      email: previous?.email ?? null,
      source: 'ares',
    };
  });
  const aresNames = new Set(fromAres.map((m) => key(m.fullName)));
  /* A hand-written row for a person ARES now lists would be the same person twice. */
  const manual = current.filter((m) => m.source === 'manual' && !aresNames.has(key(m.fullName)));
  return [...fromAres, ...manual];
}

/** Rows without a name are not people; the rest go to the server trimmed. */
export function toManagementRequest(rows: ClubManager[]): ClubManager[] {
  return rows
    .filter((m) => m.fullName.trim() !== '')
    .map((m) => ({
      ...(m.id !== undefined ? { id: m.id } : {}),
      fullName: m.fullName.trim(),
      role: m.role.trim(),
      phone: (m.phone ?? '').trim() === '' ? null : (m.phone ?? '').trim(),
      email: (m.email ?? '').trim() === '' ? null : (m.email ?? '').trim(),
      source: m.source,
    }));
}

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
  /* The previous value of every field ARES overwrote, until "Vrátit" or a manual edit. */
  const [overridden, setOverridden] = useState<Partial<Record<keyof PayerDraft, string>>>({});
  const [management, setManagement] = useState<ClubManager[]>(editing === 'new' ? [] : readClubManagement(editing.management));
  const formRef = useRef(form);
  formRef.current = form;

  const setManager = (index: number, patch: Partial<ClubManager>) =>
    setManagement((rows) => rows.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const addManager = () => setManagement((rows) => [...rows, { ...EMPTY_MANAGER }]);
  const removeManager = (index: number) => setManagement((rows) => rows.filter((_, i) => i !== index));

  const set = (field: keyof PayerDraft, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    /* Clear this field's complaint as it is being fixed; leave the others, so
       correcting one does not hide the rest. */
    setErrors((e) => ({ ...e, [field]: undefined }));
    /* Typed over by hand: it is no longer what ARES wrote. */
    setOverridden((o) => (o[field] === undefined ? o : { ...o, [field]: undefined }));
  };

  /*
   * ARES (Etapa 12): the owner's "everything" - name, DIČ and the whole address
   * come from the registry and overwrite what is there. Bank, contact and sleva
   * are not the registry's to know and stay as typed.
   */
  const ares = useAresFill({
    ico: form.ico,
    initialIco: editing === 'new' ? '' : editing.ico,
    onSubject: (s: AresSubject) => {
      const { next, overridden: changed } = applyAresFill(formRef.current, {
        name: s.name, dic: s.dic, address: s.street, city: s.city, postalCode: s.postalCode,
      });
      setForm(next);
      setOverridden(changed);
      setErrors((e) => ({ ...e, name: undefined, dic: undefined, address: undefined, city: undefined, postalCode: undefined }));
      setManagement((rows) => mergeAresManagement(rows, s.management));
    },
  });

  const restore = (field: keyof PayerDraft) => {
    const previous = overridden[field];
    if (previous === undefined) return;
    setForm((f) => ({ ...f, [field]: previous }));
    setOverridden((o) => ({ ...o, [field]: undefined }));
  };

  const save = async () => {
    const found = validatePayer(form);
    if (hasPayerErrors(found)) {
      setErrors(found);
      return;
    }

    setSaving(true);
    try {
      const body = { ...toPayerRequest(form), management: toManagementRequest(management) };
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

  const input = (key: keyof PayerDraft, label: string, extra: { help?: string; onBlur?: () => void } = {}) => (
    <TextField
      fullWidth
      size={phone ? 'medium' : 'small'}
      label={label}
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      onBlur={extra.onBlur}
      error={errors[key] !== undefined}
      helperText={errors[key] ?? extra.help}
    />
  );

  const field = (key: keyof PayerDraft, label: string, extra: { help?: string; width?: number } = {}) => (
    <Grid size={{ xs: 12, sm: extra.width ?? 6 }}>
      {input(key, label, extra)}
      {overridden[key] !== undefined && <AresOverrideCaption onRestore={() => restore(key)} />}
    </Grid>
  );

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth fullScreen={phone}>
      <DialogTitle>{editing === 'new' ? 'Nový klub' : 'Upravit klub'}</DialogTitle>
      <DialogContent>
        <SectionLabel sx={{ mt: 1 }}>Identifikace</SectionLabel>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {field('name', 'Název', { width: 12 })}
          <Grid size={{ xs: 12, sm: 6 }}>
            {/* The ARES button sits right of the IČO; on a phone it stacks under it. */}
            <Stack direction={phone ? 'column' : 'row'} spacing={1} sx={{ alignItems: phone ? 'stretch' : 'flex-start' }}>
              {input('ico', 'IČO', { help: 'Osm číslic', onBlur: ares.onIcoBlur })}
              <AresFillButton fill={ares} fullWidth={phone} />
            </Stack>
          </Grid>
          {field('dic', 'DIČ', { help: 'Nepovinné — CZ a 8 až 10 číslic' })}
          <Grid size={12} sx={{ '&:empty': { display: 'none' } }}>
            <AresStatusLine fill={ares} />
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel sx={{ mt: 2 }}>Vedení klubu</SectionLabel>
        <Stack spacing={phone ? 2 : 1.5} sx={{ mb: 2 }} data-testid="club-management">
          {management.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Zatím nikdo. Načtěte vedení z ARES podle IČO, nebo přidejte osobu ručně.
            </Typography>
          )}
          {management.map((m, index) => (
            <Box
              key={m.id ?? `row-${index}`}
              role="group"
              aria-label={`Vedení klubu ${index + 1}`}
              data-testid="club-manager-row"
              data-source={m.source}
              sx={{ display: 'grid', gap: 1, alignItems: 'start', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto' }}
            >
              <TextField fullWidth size={phone ? 'medium' : 'small'} label="Jméno" value={m.fullName} onChange={(e) => setManager(index, { fullName: e.target.value })} helperText={m.source === 'ares' ? 'z ARES' : undefined} />
              <TextField fullWidth size={phone ? 'medium' : 'small'} label="Funkce" value={m.role} onChange={(e) => setManager(index, { role: e.target.value })} />
              <TextField fullWidth size={phone ? 'medium' : 'small'} label="Telefon" value={m.phone ?? ''} onChange={(e) => setManager(index, { phone: e.target.value })} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
              <TextField fullWidth size={phone ? 'medium' : 'small'} label="E-mail" value={m.email ?? ''} onChange={(e) => setManager(index, { email: e.target.value })} slotProps={{ htmlInput: { inputMode: 'email' } }} />
              {phone ? (
                <Button variant="text" color="inherit" startIcon={<DeleteOutlineIcon />} onClick={() => removeManager(index)} sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
                  Odebrat osobu
                </Button>
              ) : (
                <IconButton aria-label={`Odebrat ${m.fullName.trim() === '' ? 'osobu' : m.fullName.trim()}`} onClick={() => removeManager(index)} sx={{ width: 44, height: 44 }}>
                  <DeleteOutlineIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Button variant="outlined" color="inherit" onClick={addManager} sx={{ minHeight: 44, alignSelf: phone ? 'stretch' : 'flex-start', fontWeight: 600 }}>
            Přidat osobu
          </Button>
        </Stack>

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
