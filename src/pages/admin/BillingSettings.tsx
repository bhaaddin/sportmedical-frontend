import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Save, Payment, Receipt, CreditCard } from '@mui/icons-material';

export default function BillingSettings() {
  const [settings, setSettings] = useState({
    // Payment methods
    cashEnabled: true,
    cardEnabled: true,
    transferEnabled: true,
    onlineEnabled: false,
    onlineProvider: 'stripe',
    // Invoice
    invoicePrefix: 'MED-',
    invoiceStartNumber: 1001,
    invoiceVatPayer: true,
    invoiceIco: '',
    invoiceDic: '',
    invoiceIcdph: '',
    invoiceAddress: '',
    invoiceEmail: 'faktury@medistar.cz',
    invoiceDueDays: 14,
    invoiceAutoSend: true,
    // Tax
    taxRate: 21,
    taxIncluded: true,
    // Discount
    discountMaxPercent: 30,
    discountRequiresApproval: true,
    discountCodeEnabled: true,
    // Refund
    refundEnabled: true,
    refundDaysLimit: 30,
    refundMethod: 'original',
    // Late fee
    lateFeeEnabled: true,
    lateFeePercent: 5,
    lateFeeDaysAfter: 7,
    // Insurance
    insuranceBillingEnabled: true,
    insuranceAutoVerify: true,
    // Currency
    currency: 'CZK',
    currencySymbol: 'Kč',
  });

  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Nastavení fakturace</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Payment Methods */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Payment color="primary" />
          <Typography variant="h6">Platební metody</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.cashEnabled} onChange={(e) => update('cashEnabled', e.target.checked)} />} label="Hotovost" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.cardEnabled} onChange={(e) => update('cardEnabled', e.target.checked)} />} label="Karta" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.transferEnabled} onChange={(e) => update('transferEnabled', e.target.checked)} />} label="Převod" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.onlineEnabled} onChange={(e) => update('onlineEnabled', e.target.checked)} />} label="Online platba" /></Grid>
          {settings.onlineEnabled && (
            <Grid size={{ xs: 12 }} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Poskytovatel</InputLabel>
                <Select label="Poskytovatel" value={settings.onlineProvider}
                  onChange={(e) => update('onlineProvider', e.target.value)}>
                  <MenuItem value="stripe">Stripe</MenuItem>
                  <MenuItem value="comgate">ComGate</MenuItem>
                  <MenuItem value="gopay">GoPay</MenuItem>
                  <MenuItem value="payu">PayU</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Invoice Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Receipt color="primary" />
          <Typography variant="h6">Nastavení faktur</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="Prefix faktury" value={settings.invoicePrefix} onChange={(e) => update('invoicePrefix', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Počáteční číslo" value={settings.invoiceStartNumber} onChange={(e) => update('invoiceStartNumber', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Splatnost (dní)" value={settings.invoiceDueDays} onChange={(e) => update('invoiceDueDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="E-mail pro faktury" value={settings.invoiceEmail} onChange={(e) => update('invoiceEmail', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="IČO" value={settings.invoiceIco} onChange={(e) => update('invoiceIco', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="DIČ" value={settings.invoiceDic} onChange={(e) => update('invoiceDic', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="IČ DPH" value={settings.invoiceIcdph} onChange={(e) => update('invoiceIcdph', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={3}>
            <FormControlLabel control={<Switch checked={settings.invoiceAutoSend} onChange={(e) => update('invoiceAutoSend', e.target.checked)} />} label="Automaticky odesílat" />
            <FormControlLabel control={<Switch checked={settings.invoiceVatPayer} onChange={(e) => update('invoiceVatPayer', e.target.checked)} />} label="Plátce DPH" />
          </Grid>
        </Grid>
      </Paper>

      {/* Tax & Discount */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Daň a slevy</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="DPH (%)" value={settings.taxRate} onChange={(e) => update('taxRate', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Max sleva (%)" value={settings.discountMaxPercent} onChange={(e) => update('discountMaxPercent', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.discountRequiresApproval} onChange={(e) => update('discountRequiresApproval', e.target.checked)} />} label="Sleva schválení" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.discountCodeEnabled} onChange={(e) => update('discountCodeEnabled', e.target.checked)} />} label="Slevové kódy" /></Grid>
        </Grid>
      </Paper>

      {/* Refund & Late Fee */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Vratky a sankce</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.refundEnabled} onChange={(e) => update('refundEnabled', e.target.checked)} />} label="Vratky povoleny" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Limit vratek (dní)" value={settings.refundDaysLimit} onChange={(e) => update('refundDaysLimit', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.lateFeeEnabled} onChange={(e) => update('lateFeeEnabled', e.target.checked)} />} label="Pokuta za pozdní platbu" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Pokuta (%)" value={settings.lateFeePercent} onChange={(e) => update('lateFeePercent', parseInt(e.target.value) || 0)} /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
