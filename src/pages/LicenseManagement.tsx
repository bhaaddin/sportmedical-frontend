/* ══════════════════════════════════════════════════════════════
   LICENSE MANAGEMENT — PLAN-01 Feature A71-A75
   - License activation
   - License status display
   - Expiration warnings
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert,
  Grid, Chip, Divider
} from '@mui/material';
import {
  VpnKey as LicenseIcon, CheckCircle as CheckIcon, Warning as WarningIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

interface LicenseInfo {
  key: string;
  type: string;
  expiresAt: string;
  maxUsers: number;
  features: string[];
  isValid: boolean;
}

export default function LicenseManagement() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLicense(); }, []);

  const loadLicense = async () => {
    try {
      const res = await client.get('/api/admin/license');
      setLicense(res.data);
    } catch { setLicense(null); }
    finally { setLoading(false); }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    try {
      await client.post('/api/admin/license', { key: licenseKey });
      loadLicense();
    } catch { /* handle error */ }
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LicenseIcon color="primary" /> Správa licencí
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Aktivní licence</Typography>
              {license ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {license.isValid ? <CheckIcon color="success" /> : <WarningIcon color="error" />}
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{license.type}</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">Klíč: {license.key.slice(0, 8)}...{license.key.slice(-4)}</Typography>
                  <Typography variant="body2" color="text.secondary">Vyprší: {new Date(license.expiresAt).toLocaleDateString('cs-CZ')}</Typography>
                  <Typography variant="body2" color="text.secondary">Max uživatelů: {license.maxUsers}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Funkce:</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {license.features.map((f) => <Chip key={f} label={f} size="small" />)}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">Žádná aktivní licence</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Aktivovat licenci</Typography>
              <TextField fullWidth label="Licenční klíč" value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)} sx={{ mb: 2 }} />
              <Button variant="contained" onClick={handleActivate} disabled={!licenseKey.trim()}
                sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
                Aktivovat
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
