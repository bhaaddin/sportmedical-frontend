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
import { useIsPhone } from '../layout/useDevice';
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
import { SectionLabel, SoftCard, StatusChip } from '../components/ui';
import ConsentLine from '../components/patients/ConsentLine';
import { LabelValue } from '../components/patients/LabelValue';
import { NextAppointmentCard, nextInWindow } from '../components/patients/NextAppointmentCard';
import { shownPrice } from '../components/booking/grid/appointmentPrice';
import { AlertsCard } from '../components/patients/AlertsCard';
import { VisitHistoryTable } from '../components/patients/VisitHistoryTable';
import { ALL_APPOINTMENTS_KEY, fetchAllAppointments } from '../components/patients/appointmentsSource';
import { questionnaireMissing, summariseVisits } from '../components/patients/patientActivity';
import { stillMissing, expiringSoon } from './patients/paperworkStanding';
import { formatDateOnly } from '../utils/time';
import { MetricCard, PatientRelatedShelf, Shelf, TARGET_SX, cardSurface } from '../ui/shelf';
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
  const phone = useIsPhone();
  const {
    patient, profile, requirements, upcoming, displayPhone, displayEmail, documents, documentsKnown,
  } = useOutletContext<PatientContext>();
  /* `null` until the sessions are read: a count of zero is a claim, "not yet" is not. */
  const [sessions, setSessions] = useState<DiagnosticSession[] | null>(null);
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
  /*
   * The next booking's price (Etapa 12, "ceny všude"): the price the desk
   * agreed for that visit comes first, then the list price the booking window
   * carries, then the catalogue. The card asks by činnost, so the booking it
   * is about - the patient's next one in the window - is looked up here.
   */
  const priceOf = (activityId: string | null, activityName: string): number | null => {
    const catalogue = activities.find((a) => a.id === activityId)?.priceCzk ?? priceByName(activityName);
    const next = upcoming === null ? null : nextInWindow(patient.id, upcoming);
    return next !== null && next.activityId === activityId
      ? shownPrice(next, catalogue).amountCzk
      : catalogue;
  };
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

  const handleDownloadPdf = async (sessionId: string) => {
    setLoadingPdf(sessionId);
    try { await diagnosticsApi.downloadPdf(sessionId); } catch { /* the button stays; the download did not */ }
    setLoadingPdf(null);
  };

  const sessionsKnown = sessions !== null;
  const sessionList = sessions ?? [];
  const latest = sessionList[0];
  const previous = sessionList[1];
  const alertCount = (questionnaireIsMissing ? 1 : 0)
    + (requirements === null ? 0 : stillMissing(requirements).length + expiringSoon(requirements).length);

  return (
    <Box data-shelf-overview="" sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 3.5 }, minWidth: 0 }}>
      {/* ── Související: everything this patient is connected to, one click from here ── */}
      <PatientRelatedShelf patientId={patient.id} upcoming={upcoming} documents={documentsKnown ? documents : null}>
        <Box role="listitem" data-card="related" data-related="consents" sx={(t) => ({ ...cardSurface(t, false), p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, gridColumn: '1 / -1' })}>
          <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>Souhlasy</Typography>
          <ConsentLine patientId={patient.id} />
        </Box>
      </PatientRelatedShelf>

      <Box
        data-shelf-columns=""
        sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) clamp(280px, 28vw, 360px)' }, alignItems: 'start' }}
      >
        {/* ── Left column ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 3.5 }, minWidth: 0 }}>
          <Shelf id="personal" title="Osobní údaje" layout="board" stagger={false}>
            <Box sx={{ p: 2.5 }}>
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
            </Box>
          </Shelf>

          <Shelf
            id="visits"
            title="Historie návštěv"
            count={summary.visits.length}
            layout="free"
            stagger={false}
            viewAll={{ to: `/patients/${patient.id}/historie` }}
          >
            <VisitHistoryTable
              bare
              visits={summary.visits}
              invoices={invoicesQuery.data ?? []}
              priceOf={priceByName}
            />
          </Shelf>

          {/* ── Výsledky: the latest session's numbers and every session ── */}
          <Shelf
            id="results"
            title="Výsledky"
            hint="Diagnostická sezení"
            count={sessionsKnown ? sessionList.length : undefined}
            layout="free"
            stagger={false}
            controls={(
              <Button size="small" variant="outlined" sx={{ ...TARGET_SX, minHeight: phone ? 44 : undefined }} onClick={() => navigate(`/diagnostics/new?patientId=${patient.id}`)}>
                Nové vyšetření
              </Button>
            )}
            viewAll={{ to: `/patients/${patient.id}/vysledky` }}
          >
            {latest && (
              <Box role="list" aria-label="Poslední sezení" sx={{ display: 'grid', gap: 1.5, mb: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
                <MetricCard
                  label="VO₂ max"
                  value={`${latest.vo2MaxMlMinKg.toFixed(1)}`}
                  hint={trendPct(latest.vo2MaxMlMinKg, previous?.vo2MaxMlMinKg) ?? 'ml/min/kg'}
                />
                <MetricCard
                  label="Klidový tep"
                  value={`${latest.restingHeartRateBpm}`}
                  hint={trendPct(latest.restingHeartRateBpm, previous?.restingHeartRateBpm) ?? 'úderů/min'}
                />
                <MetricCard
                  label="Krevní tlak"
                  value={`${latest.systolicBloodPressure}/${latest.diastolicBloodPressure}`}
                  hint={bpLabel(latest.systolicBloodPressure, latest.diastolicBloodPressure)}
                />
                <MetricCard
                  label="Tělesný tuk"
                  value={`${latest.bodyFatPercentage.toFixed(1)} %`}
                  hint={`Svaly ${latest.muscleMassKg} kg`}
                />
              </Box>
            )}

            <SoftCard>
              {sessionList.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Zatím žádné sezení. Vytvořte první diagnostické sezení pro {patient.firstName}.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {sessionList.map((s) => {
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
                              aria-label="Stáhnout PDF"
                              sx={{ width: 44, height: 44 }}
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
                              sx={{ mt: 2, minHeight: 44 }}
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
          </Shelf>
        </Box>

        {/* ── Right rail: what is next, and what to do before it ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 3.5 }, minWidth: 0 }}>
          <Shelf id="next" title="Příští termín" layout="free" stagger={false}>
            <NextAppointmentCard
              bare
              patientId={patient.id}
              window={upcoming}
              fallback={summary.nextAppointment}
              priceOf={priceOf}
            />
          </Shelf>
          <Shelf id="alerts" title="Upozornění" count={alertCount} countTone="red" layout="free" stagger={false}>
            <AlertsCard
              bare
              patientId={patient.id}
              questionnaireIsMissing={questionnaireIsMissing}
              requirements={requirements}
            />
          </Shelf>
        </Box>
      </Box>
    </Box>
  );
}
