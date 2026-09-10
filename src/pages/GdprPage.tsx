import { useState } from 'react';
import {
  Box, Typography, TextField, Autocomplete, Card, CardContent, Alert,
} from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';
import { ConsentManager } from '../components/ConsentManager';
import { patientsApi, type Patient } from '../api/patients';

export default function GdprPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patient = patients.find((p) => p.id === selectedPatientId) || null;

  const searchPatients = (q: string) => {
    if (q.trim().length < 2) return;
    patientsApi.search(q).then(setPatients).catch(() => setPatients([]));
  };

  return (
    <Box sx={{ mx: 'auto', maxWidth: 'lg' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>GDPR a Souhlasy</Typography>
          <Typography variant="body2" color="text.secondary">
            Správa souhlasů se zpracováním osobních údajů
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Vyberte pacienta pro zobrazení a správu jeho GDPR souhlasů.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Autocomplete
            options={patients}
            getOptionLabel={(o) => o.fullName || `${o.firstName} ${o.lastName}`}
            value={patient}
            onInputChange={(_, v) => searchPatients(v)}
            onChange={(_, newValue) => setSelectedPatientId(newValue?.id || null)}
            renderInput={(params) => (
              <TextField {...params} label="Vyberte pacienta" placeholder="Začněte psát jméno..." />
            )}
            fullWidth
          />
        </CardContent>
      </Card>

      {selectedPatientId && (
        <ConsentManager patientId={selectedPatientId} />
      )}
    </Box>
  );
}
