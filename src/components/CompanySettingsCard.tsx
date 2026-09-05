import { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Grid, Box, Alert,
} from '@mui/material';
import { Search, Save } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { companySettingsApi } from '../services/companySettingsApi';

export default function CompanySettingsCard() {
  const [form, setForm] = useState({
    companyName: '', ico: '', dic: '', address: '', city: '', postalCode: '',
    bankAccount: '', bankCode: '', iban: '', phone: '', email: '', website: '',
  });
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    companySettingsApi.get().then(s => {
      if (s) setForm({
        companyName: s.companyName ?? '', ico: s.ico ?? '', dic: s.dic ?? '',
        address: s.address ?? '', city: s.city ?? '', postalCode: s.postalCode ?? '',
        bankAccount: s.bankAccount ?? '', bankCode: s.bankCode ?? '', iban: s.iban ?? '',
        phone: s.phone ?? '', email: s.email ?? '', website: s.website ?? '',
      });
    }).catch(() => {});
  }, []);

  const lookup = async () => {
    if (!/^\d{8}$/.test(form.ico)) {
      toast.error('IČO musí mít 8 číslic');
      return;
    }
    setLooking(true);
    try {
      const r = await companySettingsApi.lookupAres(form.ico);
      setForm(f => ({
        ...f,
        companyName: r.companyName || f.companyName,
        dic: r.dic || f.dic,
        address: r.address || f.address,
        city: r.city || f.city,
        postalCode: r.postalCode || f.postalCode,
      }));
      toast.success('Načteno z ARES');
    } catch {
      toast.error('ARES nenašel firmu (zkontrolujte připojení)');
    } finally {
      setLooking(false);
    }
  };

  const save = async () => {
    if (!form.companyName.trim() || !/^\d{8}$/.test(form.ico)) {
      toast.error('Vyplňte název a platné IČO');
      return;
    }
    setSaving(true);
    try {
      await companySettingsApi.update(form);
      toast.success('Údaje firmy uloženy');
    } catch {
      toast.error('Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const F = (key: keyof typeof form, label: string, extra: any = {}) => (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <TextField fullWidth size="small" label={label} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} {...extra} />
    </Grid>
  );

  return (
    <Card sx={{ borderRadius: 3, mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Firemní údaje + ARES</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Objeví se na fakturách. IČO → načíst z registru.
        </Typography>
        <Grid container spacing={2}>
          {F('companyName', 'Název firmy')}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth size="small" label="IČO" value={form.ico}
                onChange={e => setForm(f => ({ ...f, ico: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <Button variant="outlined" startIcon={<Search />} onClick={lookup} disabled={looking}
                sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>
                ARES
              </Button>
            </Box>
          </Grid>
          {F('dic', 'DIČ')}
          {F('address', 'Ulice a číslo')}
          {F('city', 'Město')}
          {F('postalCode', 'PSČ')}
          {F('bankAccount', 'Číslo účtu')}
          {F('bankCode', 'Kód banky')}
          {F('iban', 'IBAN')}
          {F('phone', 'Telefon')}
          {F('email', 'Email')}
          {F('website', 'Web')}
        </Grid>
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
            Uložit
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
