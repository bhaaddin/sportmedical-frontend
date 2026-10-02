/*
 * Přehled - the overview of one patient's card (design-15).
 *
 * Left: OSOBNÍ ÚDAJE as label/value pairs in the clinic's own order
 * (Nastavení -> Údaje o pacientovi), the HISTORIE NÁVŠTĚV table, and the
 * diagnostic results with their trend. Right: the next booking and what the
 * desk should do before it.
 *
 * The name, contacts, standing chips, the paperwork banners and the tab row
 * live in `patients/PatientLayout`, so they stay on screen whichever section
 * is open; what the layout loaded comes in through the outlet context rather
 * than being fetched a second time here.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Collapse, Divider, Grid, IconButton, LinearProgress, Stack, Typography,
} from '@mui/material';
import { Download, ExpandLess, ExpandMore } from '@mui/icons-material';
import { diagnosticsApi } from '../api/diagnostics';
import type { DiagnosticSession } from '../api/diagnostics';
import { activitiesApi } from '../api/activities';
import { billingApi } from '../api/billing';
import { SENSITIVE_IDENTITY, shownFields, usePatientFields } from '../api/displaySettings';
import { usePermission } from '../auth/usePermission';
import { KpiCard, SectionLabel, SoftCard, StatusChip } from '../components/ui';
import { LabelValue } from '../components/patients/LabelValue';
import { NextAppointmentCard } from '../components/patients/NextAppointmentCard';
import { AlertsCard } from '../components/patients/AlertsCard';
import { VisitHistoryTable } from '../components/patients/VisitHistoryTable';
import { ALL_APPOINTMENTS_KEY, fetchAllAppointments } from '../components/patients/appointmentsSource';
import { questionnaireMissing, summariseVisits } from '../components/patients/patientActivity';
import { formatDateOnly } from '../utils/time';
import type { PatientContext } from './patients/PatientLayout';

/* ── Helpers ── */

function trendPct(current: number, previous: number | undefined): string | null {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  /* The sign used to be decided by comparing the formatted string to zero,
     which JavaScript makes work by coercion - until the value is not finite,
     and then the patient's card reads "NaN%". */
  if (!Number.isFinite(pct)) return null;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)} % oproti minule`;
}

function bpLabel(sys: number, dia: number): string {
  if (sys < 120 && dia < 80) return 'Optimální';
  if (sys < 130 && dia < 85) return 'Normální';
  if (sys < 140 && dia < 90) return 'Zvýšené';
  return 'Vysoké';
}

const sessionDate = (iso: string) =>
  new Date(iso).toLocaleDateString('cs-CZ', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });

/* ── Main Page ── */
export default function PatientDetails() {
  const navigate = useNavigate();
  const {
    patient, profile, requirements, upcoming, displayPhone, displayEmail,
  } = useOutletContext<PatientContext>();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  /* Which rows the card shows, and in what order, is the clinic's setting
     (Nastavení -> Údaje o pacientovi). The birth number and the insurance
     number additionally need the permission, whatever the setting says. */
  const fieldVisibility = usePatientFields();
  const maySeeSensitive = usePermission(SENSITIVE_IDENTITY);
  const mayBill = usePermission('billing.manage');

  useEffect(() => {
    diagnosticsApi.getByPatient(patient.id).then(setSessions).catch(() => {});
  }, [patient.id]);

  /* The visits, the price list for their prices, and the invoices that say
     whether they were paid. None of the three blocks the card. */
  const appointmentsQuery = useQuery({
    queryKey: ALL_APPOINTMENTS_KEY,
    queryFn: fetchAllAppointments,
    staleTime: 60_000,
  });
  const activitiesQuery = useQuery({
    queryKey: ['activities', 'list'],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60_000,
  });
  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => billingApi.getInvoices(),
    enabled: mayBill,
    staleTime: 60_000,
  });

  const summary = useMemo(
    () => summariseVisits(patient.id, appointmentsQuery.data ?? []),
    [patient.id, appointmentsQuery.data],
  );
  const activities = activitiesQuery.data?.activities ?? [];
  const priceByName = (name: string): number | null =>
    activities.find((a) => a.name === name)?.priceCzk ?? null;
  const priceOf = (activityId: string | null, activityName: string): number | null =>
    activities.find((a) => a.id === activityId)?.priceCzk ?? priceByName(activityName);
  const questionnaireIsMissing = upcoming !== null && questionnaireMissing(patient.id, upcoming);

  /* How each field in the clinic's catalogue is read off this patient. */
  const personalValue: Record<string, string> = {
    recordId: patient.id.slice(0, 8) + '…',
    dateOfBirth: formatDateOnly(patient.dateOfBirth?.slice(0, 10)),
    sex: patient.sex === 'Male' ? 'Muž' : 'Žena',
    email: displayEmail || '—',
    phone: displayPhone || '—',
    registeredAt: formatDateOnly(patient.createdAtUtc?.slice(0, 10)),
    status: patient.status === 'Archived' ? 'Archivovaný' : 'Aktivní',
  };
  const str = (key: string): string | null => {
    const value = profile?.[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  };
  const registrationValue: Record<string, string | null> = {
    birthNumber: str('birthNumber'),
    insuranceNumber: str('insuranceNumber'),
    healthInsurer: str('healthInsurerCode'),
    insuredFrom: str('insuredFrom'),
    insuranceType: str('insuranceType'),
    citizenship: str('citizenship'),
    address: str('address'),
    treatingDoctors: str('treatingDoctors'),
    occupation: str('occupation'),
    employer: str('employer'),
    employmentType: str('employmentType'),
    notes: str('notes'),
  };
  const personalRows = (shownFields(fieldVisibility.data, 'card', maySeeSensitive, 'personal') ?? [])
    .map((field) => ({ key: field.key, label: field.label, value: personalValue[field.key] ?? '—' }));
  const registrationRows = (shownFields(fieldVisibility.data, 'card', maySeeSensitive, 'registration') ?? [])
    .map((field) => ({ key: field.key, label: field.label, value: registrationValue[field.key] }))
    .filter((row): row is { key: string; label: string; value: string } => row.value !== null && row.value !== undefined);
  const rows = [...registrationRows, ...personalRows];

  const latest = sessions[0];
  const previous = sessions[1];

  const handleDownloadPdf = async (sessionId: string) => {
    setLoadingPdf(sessionId);
    try { await diagnosticsApi.downloadPdf(sessionId); } catch { /* the button stays; the download did not */ }
    setLoadingPdf(null);
  };

  return (
    <Grid container spacing={2.5}>
      {/* ── Left column ── */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={2.5}>
          <SoftCard>
            <SectionLabel>Osobní údaje</SectionLabel>
            {fieldVisibility.isError && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Nastavení zobrazených údajů se nepodařilo načíst.
              </Typography>
            )}
            {rows.length === 0 && !fieldVisibility.isPending && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Žádný údaj není nastaven k zobrazení.
              </Typography>
            )}
            <Grid container spacing={2}>
              {rows.map((row) => (
                <Grid key={row.key} size={{ xs: 12, sm: 6 }}>
                  <LabelValue
                    label={row.label}
                    value={row.value}
                    mono={row.key === 'birthNumber' || row.key === 'insuranceNumber' || row.key === 'recordId'}
                  />
                </Grid>
              ))}
            </Grid>
          </SoftCard>

          <VisitHistoryTable
            visits={summary.visits}
            invoices={invoicesQuery.data ?? []}
            priceOf={priceByName}
          />

          {/* ── Výsledky: the latest session's numbers and every session ── */}
          {latest && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard
                  label="VO₂ max"
                  value={`${latest.vo2MaxMlMinKg.toFixed(1)}`}
                  hint={trendPct(latest.vo2MaxMlMinKg, previous?.vo2MaxMlMinKg) ?? 'ml/min/kg'}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard
                  label="Klidový tep"
                  value={`${latest.restingHeartRateBpm}`}
                  hint={trendPct(latest.restingHeartRateBpm, previous?.restingHeartRateBpm) ?? 'úderů/min'}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard
                  label="Krevní tlak"
                  value={`${latest.systolicBloodPressure}/${latest.diastolicBloodPressure}`}
                  hint={bpLabel(latest.systolicBloodPressure, latest.diastolicBloodPressure)}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard
                  label="Tělesný tuk"
                  value={`${latest.bodyFatPercentage.toFixed(1)} %`}
                  hint={`Svaly ${latest.muscleMassKg} kg`}
                />
              </Grid>
            </Grid>
          )}

          <SoftCard>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <SectionLabel sx={{ mb: 0 }}>Výsledky · diagnostická sezení</SectionLabel>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" onClick={() => navigate(`/diagnostics/new?patientId=${patient.id}`)}>
                Nové vyšetření
              </Button>
            </Stack>

            {sessions.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Zatím žádné sezení. Vytvořte první diagnostické sezení pro {patient.firstName}.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {sessions.map((s) => {
                  const isExpanded = expandedSession === s.id;
                  return (
                    <Box
                      key={s.id}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                    >
                      <Box
                        sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 600 }}>{sessionDate(s.sessionDate)}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {s.practitionerName}
                              {' · '}
                              {new Date(s.createdAtUtc).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                          {s.requiresDoctorReview && <StatusChip tone="beige">K posouzení</StatusChip>}
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); void handleDownloadPdf(s.id); }}
                            title="Stáhnout PDF"
                          >
                            {loadingPdf === s.id ? <LinearProgress sx={{ width: 20 }} /> : <Download sx={{ fontSize: 18 }} />}
                          </IconButton>
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </Stack>

                        <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                          {[
                            `VO₂ ${s.vo2MaxMlMinKg} ml`,
                            `Klid ${s.restingHeartRateBpm} bpm`,
                            `TK ${s.systolicBloodPressure}/${s.diastolicBloodPressure}`,
                            `Tuk ${s.bodyFatPercentage} %`,
                            `Svaly ${s.muscleMassKg} kg`,
                          ].map((text) => (
                            <StatusChip key={text} tone="grey" size="sm">{text}</StatusChip>
                          ))}
                        </Stack>
                      </Box>

                      <Collapse in={isExpanded}>
                        <Divider />
                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 3 }}>
                              <LabelValue label="Max tep" value={`${s.maxHeartRateBpm} bpm`} />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                              <LabelValue label="Anaerobní práh" value={`${s.anaerobicThresholdBpm} bpm`} />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                              <LabelValue label="VO₂ max" value={`${s.vo2MaxMlMinKg} ml/min/kg`} />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                              <LabelValue label="Tělesný tuk" value={`${s.bodyFatPercentage} %`} />
                            </Grid>
                          </Grid>

                          {s.rawPractitionerNotes && (
                            <Box sx={{ mt: 2 }}>
                              <SectionLabel>Poznámky</SectionLabel>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{s.rawPractitionerNotes}</Typography>
                            </Box>
                          )}

                          {s.detectedAnomaliesJson && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Detekované anomálie</Typography>
                              <Typography variant="body2">{s.detectedAnomaliesJson}</Typography>
                            </Alert>
                          )}

                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Download />}
                            onClick={() => void handleDownloadPdf(s.id)}
                            sx={{ mt: 2 }}
                          >
                            PDF report
                          </Button>
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </SoftCard>
        </Stack>
      </Grid>

      {/* ── Right rail ── */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={2.5}>
          <NextAppointmentCard
            patientId={patient.id}
            window={upcoming}
            fallback={summary.nextAppointment}
            priceOf={priceOf}
          />
          <AlertsCard
            patientId={patient.id}
            questionnaireIsMissing={questionnaireIsMissing}
            requirements={requirements}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
