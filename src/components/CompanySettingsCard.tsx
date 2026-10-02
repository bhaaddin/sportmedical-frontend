import { useEffect, useState } from 'react';
import {
  Typography, TextField, Button, Grid, Box,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { companySettingsApi } from '../services/companySettingsApi';
import { SectionLabel, SoftCard } from './ui';

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
        {...extra} />
    </Grid>
  );

  return (
    <SoftCard sx={{ mb: 2 }}>
      <SectionLabel>Firemní údaje</SectionLabel>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Objeví se na fakturách. Zadejte IČO a načtěte zbytek z registru ARES.
      </Typography>
      <Grid container spacing={2}>
        {F('companyName', 'Název firmy')}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth size="small" label="IČO" value={form.ico}
              onChange={e => setForm(f => ({ ...f, ico: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }))} />
            <Button variant="outlined" size="small" startIcon={<Search />} onClick={lookup} disabled={looking}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
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
        <Button variant="outlined" onClick={save} disabled={saving}>
          Uložit firemní údaje
        </Button>
      </Box>
    </SoftCard>
  );
}
