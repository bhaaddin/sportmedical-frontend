import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, List, ListItem,
  ListItemText, Divider, Switch, TextField, Button, Snackbar, Alert,
} from '@mui/material';
import {
  Public, Email, Save, ContactPhone, LocationOn, EventAvailable,
} from '@mui/icons-material';
import CompanySettingsCard from '../components/CompanySettingsCard';
import { motion } from 'framer-motion';
import { PUBLIC_CLINIC_KEYS, readSettings, saveSettings } from '../api/clinicSettings';

const sectionAnim = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.35 } }),
};

/* ─────────────────────────────────────────── */
/*  TOGGLE COMPONENT                           */
/* ─────────────────────────────────────────── */
function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <>
      <ListItem sx={{ px: 0 }}>
        <ListItemText primary={label} secondary={description} />
        <Switch
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }}
        />
      </ListItem>
      <Divider />
    </>
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
   * "GreenLine, 5. patro, Praha" and an e-mail nobody had chosen -- and since
   * nothing was ever loaded or saved, those invented values were what the
   * owner saw every time he opened it. A blank field asks to be filled in; a
   * plausible one gets left alone.
   */
  const [pub, setPub] = useState({
    siteName: '',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
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

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Public color="primary" /> Veřejný web a kontakty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Údaje o firmě a to, co z nich vidí pacienti při online objednání
          </Typography>
        </Box>
      </motion.div>

      <CompanySettingsCard />

      {loadFailed && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Uložené kontakty se nepodařilo načíst. Obnovte stránku — dokud se nenačtou,
          nelze je uložit, aby se uložené údaje nepřepsaly prázdnými.
        </Alert>
      )}

      {/* — Section: Contact — */}
      <motion.div custom={0} variants={sectionAnim} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <ContactPhone sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Kontaktní údaje</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Název webu" value={pub.siteName}
                  onChange={e => updatePub('siteName', e.target.value)}
                  sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email" value={pub.contactEmail}
                  onChange={e => updatePub('contactEmail', e.target.value)} sx={fieldSx}
                  slotProps={{ input: { startAdornment: <Email sx={{ mr: 1, color: '#999' }} /> } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Telefon" value={pub.contactPhone}
                  onChange={e => updatePub('contactPhone', e.target.value)} sx={fieldSx}
                  slotProps={{ input: { startAdornment: <ContactPhone sx={{ mr: 1, color: '#999' }} /> } }} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Adresa" value={pub.contactAddress}
                  onChange={e => updatePub('contactAddress', e.target.value)} sx={fieldSx}
                  slotProps={{ input: { startAdornment: <LocationOn sx={{ mr: 1, color: '#999' }} /> } }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </motion.div>

      {/* — Section: Online booking — */}
      <motion.div custom={1} variants={sectionAnim} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <EventAvailable sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Online rezervace</Typography>
            </Box>
            <List sx={{ p: 0 }}>
              <Toggle checked={pub.enableBooking} onChange={v => updatePub('enableBooking', v)}
                label="Rezervace online" description="Klienti mohou rezervovat termíny online" />
            </List>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save button */}
      <motion.div custom={2} variants={sectionAnim} initial="hidden" animate="visible">
        <Button variant="contained" startIcon={<Save />} onClick={() => { void handleSave(); }} disabled={saving || !loaded}
          sx={{ mb: 4, bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
          Uložit kontakty a rezervace
        </Button>
      </motion.div>

      {/* Snackbar */}
      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>Nastavení uloženo!</Alert>
      </Snackbar>

      {/* The other half of the same truth. A screen that can say "uloženo" has
          to be able to say the opposite, or the green message means nothing. */}
      <Snackbar open={saveFailed !== null} autoHideDuration={6000} onClose={() => setSaveFailed(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{saveFailed}</Alert>
      </Snackbar>
    </Box>
  );
}

// Shared field style
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };
