/* ══════════════════════════════════════════════════════════════
   PATIENT RECORDS — PLAN-01 Feature C221-C230
   - Patient overview with tabs
   - Appointments, diagnoses, documents, billing
   - Print functionality
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, Avatar, List,
  ListItem, ListItemIcon, ListItemText, Grid, Card, CardContent, Skeleton, Alert
} from '@mui/material';
import {
  Person as PersonIcon, Event as EventIcon, Description as DocIcon,
  LocalHospital as DiagnosisIcon, AttachMoney as BillingIcon,
  Print as PrintIcon, Edit as EditIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  insuranceCompany: string;
}

export default function PatientRecords() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  /*
   * "Could not ask" is not "does not exist". The load used to swallow every
   * failure into `catch {}` and the screen then said "Pacient nenalezen" - so
   * a backend blip, a dropped connection or a 502 all read as a claim about
   * the patient. Caught live: the API restarted for a moment, one request came
   * back `502`, and this screen told me Anna Černá was not there.
   */
  const [failed, setFailed] = useState(false);

  const patientId = window.location.pathname.split('/').pop();

  useEffect(() => {
    if (patientId) loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await client.get(`/api/patients/${patientId}`);
      setPatient(res.data);
    } catch (err: any) {
      /* A 404 is the register answering; anything else is it not answering. */
      if (err?.response?.status !== 404) setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton variant="rounded" height={400} />;

  if (failed) {
    return (
      <Alert
        severity="error"
        action={<Button size="small" color="inherit" onClick={loadPatient}>Zkusit znovu</Button>}
      >
        Kartu pacienta se nepodařilo načíst. Neznamená to, že pacient neexistuje
        — server neodpověděl.
      </Alert>
    );
  }

  if (!patient) return <Typography>Pacient nenalezen</Typography>;

  return (
    <Box>
      {/* Patient Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar sx={{ width: 80, height: 80, bgcolor: '#0D7377', fontSize: 32 }}>
            {patient.firstName[0]}{patient.lastName[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{patient.firstName} {patient.lastName}</Typography>
            {/*
              These three used to be printed whatever they held. With no
              contact on file the line rendered as a lone bullet, and with no
              insurer the chip read "Pojišťovna: undefined" - the word
              `undefined` shown to a person about a patient. An absent value is
              said in words now, or the chip is not drawn at all.
            */}
            <Typography color="text.secondary">
              {[patient.email, patient.phone].filter(Boolean).join(' • ') ||
                'Kontakt neuveden'}
            </Typography>
            {patient.insuranceCompany ? (
              <Chip
                label={`Pojišťovna: ${patient.insuranceCompany}`}
                size="small"
                sx={{ mt: 1 }}
              />
            ) : (
              <Chip
                label="Pojišťovna neuvedena"
                size="small"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <Button variant="outlined" startIcon={<PrintIcon />}>Tisknout</Button>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab icon={<PersonIcon />} label="Přehled" />
          <Tab icon={<EventIcon />} label="Termíny" />
          <Tab icon={<DiagnosisIcon />} label="Diagnózy" />
          <Tab icon={<DocIcon />} label="Dokumenty" />
          <Tab icon={<BillingIcon />} label="Fakturace" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Kontaktní údaje</Typography>
            <Typography>Adresa: {patient.email}</Typography>
            <Typography>Telefon: {patient.phone}</Typography>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Termíny</Typography>
            <Typography color="text.secondary">Žádné termíny k zobrazení</Typography>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Diagnózy</Typography>
            <Typography color="text.secondary">Žádné diagnózy k zobrazení</Typography>
          </CardContent>
        </Card>
      )}

      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Dokumenty</Typography>
            <Typography color="text.secondary">Žádné dokumenty k zobrazení</Typography>
          </CardContent>
        </Card>
      )}

      {activeTab === 4 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Fakturace</Typography>
            <Typography color="text.secondary">Žádné faktury k zobrazení</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
