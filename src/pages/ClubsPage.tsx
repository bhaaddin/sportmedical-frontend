/*
 * Plátci: kluby a organizace, které platí za své členy.
 *
 * The server has carried the whole payer since the beginning - IČO, DIČ,
 * fakturační adresa, bankovní účet, kód banky, IBAN and splatnost - and this
 * screen collected five fields, none of which lets anybody be invoiced. It
 * could create a club and deactivate one; it could not change one, so a bank
 * account typed wrong was permanent.
 *
 * The list says which payers can actually be billed, because "no bank account"
 * is a thing to find out now rather than on the day an invoice is due.
 */
import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, IconButton, Tooltip, Skeleton, Alert, Divider,
} from '@mui/material';
import { Add, Delete, Edit, Groups, WarningAmber } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { clubsApi } from '../services/clubsApi';
import type { Club } from '../services/clubsApi';
import {
  EMPTY_PAYER, canBeInvoiced, hasPayerErrors, toPayerRequest, validatePayer,
} from './clubs/payerForm';
import type { PayerDraft, PayerErrors } from './clubs/payerForm';

const draftFromClub = (club: Club): PayerDraft => ({
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
});

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  /* `null` closed; a club to change it; `'new'` to add one. */
  const [editing, setEditing] = useState<Club | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PayerDraft>(EMPTY_PAYER);
  const [errors, setErrors] = useState<PayerErrors>({});

  const load = async () => {
    setLoading(true);
    try {
      const list = await clubsApi.getAll(false);
      setClubs(Array.isArray(list) ? list : []);
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openFor = (club: Club | 'new') => {
    setForm(club === 'new' ? EMPTY_PAYER : draftFromClub(club));
    setErrors({});
    setEditing(club);
  };

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
      else if (editing !== null) await clubsApi.update(editing.id, body);
      toast.success(editing === 'new' ? 'Plátce vytvořen' : 'Změny uloženy');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Deaktivovat plátce ${name}?`)) return;
    try {
      await clubsApi.deactivate(id);
      toast.success('Plátce deaktivován');
      await load();
    } catch {
      toast.error('Akce selhala');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={60} sx={{ mb: 2, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  const field = (
    key: keyof PayerDraft,
    label: string,
    extra: { help?: string; width?: number } = {},
  ) => (
    <Grid size={{ xs: 12, sm: extra.width ?? 6 }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        error={errors[key] !== undefined}
        helperText={errors[key] ?? extra.help}
      />
    </Grid>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Groups color="primary" /> Plátci
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kluby a organizace, které platí za své členy — fakturační údaje a splatnost.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => openFor('new')}
          sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
          Nový plátce
        </Button>
      </Box>

      {clubs.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Zatím tu žádný plátce není. Přidejte klub nebo organizaci, která platí za své členy.
        </Alert>
      ) : (
        <Card sx={{ borderRadius: 3, mt: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>IČO / DIČ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bankovní spojení</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Splatnost</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clubs.map((c) => {
                  const billable = canBeInvoiced(c);
                  return (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {c.name}
                        {/* Found now, not on the day the invoice is due. */}
                        {!billable && (
                          <Tooltip title="Chybí bankovní spojení nebo fakturační adresa — fakturu zatím nelze vystavit">
                            <Box component="span" sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              ml: 1, color: 'warning.main', fontSize: 12, fontWeight: 500,
                            }}>
                              <WarningAmber sx={{ fontSize: 16 }} />
                              nelze fakturovat
                            </Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{c.ico || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.dic || ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {c.iban || (c.bankAccount ? `${c.bankAccount}${c.bankCode ? `/${c.bankCode}` : ''}` : '—')}
                        </Typography>
                      </TableCell>
                      <TableCell>{c.paymentTermsDays} dní</TableCell>
                      <TableCell>
                        <Chip size="small" label={c.isActive ? 'Aktivní' : 'Neaktivní'}
                          color={c.isActive ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Upravit">
                          <IconButton size="small" aria-label={`Upravit plátce ${c.name}`}
                            onClick={() => openFor(c)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {c.isActive && (
                          <Tooltip title="Deaktivovat">
                            <IconButton size="small" color="error"
                              aria-label={`Deaktivovat plátce ${c.name}`}
                              onClick={() => remove(c.id, c.name)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={editing !== null} onClose={saving ? undefined : () => setEditing(null)}
        maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing === 'new' ? 'Nový plátce' : 'Upravit plátce'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="overline" color="text.secondary">Identifikace</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {field('name', 'Název', { width: 12 })}
            {field('ico', 'IČO', { help: 'Osm číslic' })}
            {field('dic', 'DIČ', { help: 'Nepovinné — CZ a 8 až 10 číslic' })}
          </Grid>

          <Divider />
          <Typography variant="overline" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Fakturační adresa
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {field('address', 'Ulice a číslo', { width: 12 })}
            {field('city', 'Město')}
            {field('postalCode', 'PSČ')}
          </Grid>

          <Divider />
          <Typography variant="overline" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Bankovní spojení a splatnost
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {field('bankAccount', 'Číslo účtu')}
            {field('bankCode', 'Kód banky', { help: 'Čtyři číslice' })}
            {field('iban', 'IBAN', { help: 'Nepovinné, pokud je vyplněn účet' })}
            {field('paymentTermsDays', 'Splatnost (dní)')}
          </Grid>

          <Divider />
          <Typography variant="overline" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Kontakt
          </Typography>
          <Grid container spacing={2}>
            {field('contactPerson', 'Kontaktní osoba')}
            {field('contactEmail', 'E-mail')}
            {field('contactPhone', 'Telefon')}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditing(null)} disabled={saving} sx={{ borderRadius: 2 }}>
            Zrušit
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
