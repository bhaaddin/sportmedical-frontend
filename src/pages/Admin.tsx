/*
 * Údaje ordinace a veřejný web (route: /admin) - who the clinic is, and what
 * of it the public sees on the booking pages. The company details (IČO, bank
 * account) sit in their own card above the contacts, because they go on the
 * invoices and the contacts go on the web.
 */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Switch, TextField, Button, Snackbar, Alert, Stack,
} from '@mui/material';
import { Email, ContactPhone, LocationOn } from '@mui/icons-material';
import CompanySettingsCard from '../components/CompanySettingsCard';
import { OPENING_HOURS_MAX_LENGTH, PUBLIC_CLINIC_KEYS, readSettings, saveSettings } from '../api/clinicSettings';
import { SectionLabel, SoftCard } from '../components/ui';
import { SettingsScreen } from './settings/SettingsFrame';

/* ─────────────────────────────────────────── */
/*  TOGGLE COMPONENT                           */
/* ─────────────────────────────────────────── */
function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Box>
        <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
        {description && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{description}</Typography>
        )}
      </Box>
      <Switch checked={checked} onChange={e => onChange(e.target.checked)} />
    </Stack>
  );
}

/* ─────────────────────────────────────────── */
/*  PUBLIC DETAILS PAGE                        */
/* ─────────────────────────────────────────── */
export default function Admin() {
  const [saved, setSaved] = useState(false);

  /*
   * Empty, not plausible.
   *
   * This screen used to open with "+420 XXX XXX XXX", an address of
   * a made-up street address and an e-mail nobody had chosen -- and since
   * nothing was ever loaded or saved, those invented values were what the
   * owner saw every time he opened it. A blank field asks to be filled in; a
   * plausible one gets left alone.
   */
  const [pub, setPub] = useState({
    siteName: '',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
    openingHours: '',
    enableBooking: true,
  });

  const updatePub = <K extends keyof typeof pub>(key: K, val: (typeof pub)[K]) =>
    setPub(p => ({ ...p, [key]: val }));

  /*
   * Whether what is stored has been read. Until it has, the fields hold the
   * blanks above, and saving them would write '' over the clinic's name and
   * contacts - and switch online booking back on - on the public booking pages.
   */
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  /*
   * What is actually stored, read on open.
   *
   * Until 21. 9. 2026 this screen read nothing and wrote nothing: every field
   * came from the state above and `handleSave` set a flag that showed a green
   * "Uloženo". The owner configured his clinic, was told it had worked, and
   * nothing had been saved. That is worse than a screen that does not exist.
   */
  useEffect(() => {
    let abandoned = false;

    readSettings(Object.values(PUBLIC_CLINIC_KEYS))
      .then((stored) => {
        if (abandoned) return;

        setPub((previous) => ({
          ...previous,
          siteName: stored[PUBLIC_CLINIC_KEYS.name] ?? previous.siteName,
          contactEmail: stored[PUBLIC_CLINIC_KEYS.email] ?? previous.contactEmail,
          contactPhone: stored[PUBLIC_CLINIC_KEYS.phone] ?? previous.contactPhone,
          contactAddress: stored[PUBLIC_CLINIC_KEYS.address] ?? previous.contactAddress,
          openingHours: stored[PUBLIC_CLINIC_KEYS.openingHours] ?? previous.openingHours,
          enableBooking: (stored[PUBLIC_CLINIC_KEYS.bookingEnabled] ?? 'true') !== 'false',
        }));
        setLoaded(true);
      })
      .catch(() => {
        if (!abandoned) setLoadFailed(true);
      });

    return () => { abandoned = true; };
  }, []);

  const [saveFailed, setSaveFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveFailed(null);

    try {
      await saveSettings({
        [PUBLIC_CLINIC_KEYS.name]: pub.siteName.trim(),
        [PUBLIC_CLINIC_KEYS.email]: pub.contactEmail.trim(),
        [PUBLIC_CLINIC_KEYS.phone]: pub.contactPhone.trim(),
        [PUBLIC_CLINIC_KEYS.address]: pub.contactAddress.trim(),
        [PUBLIC_CLINIC_KEYS.openingHours]: pub.openingHours.trim(),
        [PUBLIC_CLINIC_KEYS.bookingEnabled]: pub.enableBooking ? 'true' : 'false',
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Said out loud. The whole fault this replaces was a success message for
      // something that never happened.
      setSaveFailed('Nastavení se nepodařilo uložit. Zkuste to prosím znovu.');
    } finally {
      setSaving(false);
    }
  };

  const adornment = (icon: React.ReactNode) => (
    <Box sx={{ mr: 1, color: 'text.disabled', display: 'flex' }}>{icon}</Box>
  );

  return (
    <SettingsScreen
      title="Údaje ordinace"
      subtitle="Údaje o firmě a to, co z nich vidí pacienti při online objednání"
      aside={
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>{pub.siteName.trim() || '—'}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.primary' }}>{pub.contactAddress.trim() || 'Adresa není vyplněná'}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.primary' }}>
            {[pub.contactPhone.trim(), pub.contactEmail.trim()].filter(Boolean).join(' · ') || 'Kontakt není vyplněný'}
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.primary' }}>{pub.openingHours.trim() || 'Otevírací doba není vyplněná'}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: pub.enableBooking ? 'success.main' : 'text.primary' }}>
            {pub.enableBooking ? 'Online rezervace zapnuté' : 'Online rezervace vypnuté'}
          </Typography>
        </Box>
      }
      asideTitle="Tak to uvidí pacient"
      actions={
        <Button
          variant="contained"
          onClick={() => { void handleSave(); }}
          disabled={saving || !loaded}
          sx={{ minHeight: 44 }}
        >
          Uložit kontakty a rezervace
        </Button>
      }
    >
      <CompanySettingsCard />

      {loadFailed && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Uložené kontakty se nepodařilo načíst. Obnovte stránku — dokud se nenačtou,
          nelze je uložit, aby se uložené údaje nepřepsaly prázdnými.
        </Alert>
      )}

      {/* — Section: Contact — */}
      <SoftCard sx={{ mb: 2 }}>
        <SectionLabel>Kontaktní údaje</SectionLabel>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          Co pacient vidí na veřejných stránkách objednání.
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Název webu" value={pub.siteName}
              onChange={e => updatePub('siteName', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Email" value={pub.contactEmail}
              onChange={e => updatePub('contactEmail', e.target.value)}
              slotProps={{ input: { startAdornment: adornment(<Email fontSize="small" />) } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Telefon" value={pub.contactPhone}
              onChange={e => updatePub('contactPhone', e.target.value)}
              slotProps={{ input: { startAdornment: adornment(<ContactPhone fontSize="small" />) } }} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Adresa" value={pub.contactAddress}
              onChange={e => updatePub('contactAddress', e.target.value)}
              slotProps={{ input: { startAdornment: adornment(<LocationOn fontSize="small" />) } }} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Otevírací doba (text pro web)" value={pub.openingHours}
              onChange={e => updatePub('openingHours', e.target.value)}
              placeholder="Po–Pá 8:00–18:00 · So 8:00–12:00"
              helperText={`Zobrazí se v patičce a na stránkách objednání. ${pub.openingHours.length}/${OPENING_HOURS_MAX_LENGTH}`}
              slotProps={{ htmlInput: { maxLength: OPENING_HOURS_MAX_LENGTH } }} />
          </Grid>
        </Grid>
      </SoftCard>

      {/* — Section: Online booking — */}
      <SoftCard sx={{ mb: 2 }}>
        <SectionLabel>Online rezervace</SectionLabel>
        <Toggle checked={pub.enableBooking} onChange={v => updatePub('enableBooking', v)}
          label="Rezervace online" description="Klienti mohou rezervovat termíny online" />
      </SoftCard>

      {/* Snackbar */}
      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled">Nastavení uloženo!</Alert>
      </Snackbar>

      {/* The other half of the same truth. A screen that can say "uloženo" has
          to be able to say the opposite, or the green message means nothing. */}
      <Snackbar open={saveFailed !== null} autoHideDuration={6000} onClose={() => setSaveFailed(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="error" variant="filled">{saveFailed}</Alert>
      </Snackbar>
    </SettingsScreen>
  );
}
