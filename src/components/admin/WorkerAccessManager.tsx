import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Switch,
  FormControlLabel, TextField, Button, Alert
} from '@mui/material';
import { Security, AccessTime, LocationOn } from '@mui/icons-material';

interface WorkerAccessRestrictions {
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
  allowedDays: number[];
  startTime: string;
  endTime: string;
  allowedIpRanges: string[];
  allowedLocations: string[];
  maxPatientsPerDay: number;
  canAccessBilling: boolean;
  canAccessAdmin: boolean;
}

interface WorkerAccess {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  restrictions: WorkerAccessRestrictions;
  isActive: boolean;
}

interface Props {
  staffId: string;
  onUpdate: (access: WorkerAccess) => void;
}

export default function WorkerAccessManager({ staffId, onUpdate }: Props) {
  const [access, setAccess] = useState<WorkerAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadWorkerAccess();
  }, [staffId]);

  const loadWorkerAccess = async () => {
    try {
      const response = await fetch(`/api/admin/worker-access/${staffId}`);
      if (response.ok) setAccess(await response.json());
    } catch {
      setError('Nepodařilo se načíst data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!access) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/worker-access/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(access),
      });
      if (!response.ok) throw new Error('Failed to update');
      setSuccess(true);
      onUpdate(access);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  };

  const updateRestriction = (field: string, value: unknown) => {
    if (!access) return;
    setAccess({
      ...access,
      restrictions: { ...access.restrictions, [field]: value },
    });
  };

  if (loading) return <Typography>Načítání...</Typography>;
  if (!access) return <Alert severity="error">Nepodařilo se načíst data</Alert>;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Security color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h6">{access.staffName}</Typography>
          <Typography variant="body2" color="text.secondary">Nastavení přístupu zaměstnance</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Změny uloženy</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTime color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Časová omezení</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" label="Max hodin/den" type="number"
                    value={access.restrictions.maxHoursPerDay}
                    onChange={(e) => updateRestriction('maxHoursPerDay', parseInt(e.target.value))} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" label="Max hodin/týden" type="number"
                    value={access.restrictions.maxHoursPerWeek}
                    onChange={(e) => updateRestriction('maxHoursPerWeek', parseInt(e.target.value))} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" type="time" label="Začátek směny"
                    value={access.restrictions.startTime}
                    onChange={(e) => updateRestriction('startTime', e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" type="time" label="Konec směny"
                    value={access.restrictions.endTime}
                    onChange={(e) => updateRestriction('endTime', e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LocationOn color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Přístupová omezení</Typography>
              </Box>
              <TextField fullWidth size="small" label="Povolené IP rozsahy"
                value={access.restrictions.allowedIpRanges.join(', ')}
                onChange={(e) => updateRestriction('allowedIpRanges', e.target.value.split(',').map(s => s.trim()))}
                sx={{ mb: 2 }} />
              <TextField fullWidth size="small" label="Max pacientů/den" type="number"
                value={access.restrictions.maxPatientsPerDay}
                onChange={(e) => updateRestriction('maxPatientsPerDay', parseInt(e.target.value))}
                sx={{ mb: 2 }} />
              <FormControlLabel
                control={<Switch checked={access.restrictions.canAccessBilling}
                  onChange={(e) => updateRestriction('canAccessBilling', e.target.checked)} />}
                label="Přístup k fakturaci" />
              <FormControlLabel
                control={<Switch checked={access.restrictions.canAccessAdmin}
                  onChange={(e) => updateRestriction('canAccessAdmin', e.target.checked)} />}
                label="Přístup k administraci" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Ukládání...' : 'Uložit změny'}
        </Button>
      </Box>
    </Paper>
  );
}
