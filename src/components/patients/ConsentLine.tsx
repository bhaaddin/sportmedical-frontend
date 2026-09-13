/*
 * One line saying whether the patient consented, and when.
 *
 * What stood here before was a card with five switches for granting and
 * revoking consent on the patient's behalf. It read a table that had never
 * held a row, so it said "Neudělen" about everybody - including the patients
 * who had consented, whose consent sits where the registration form wrote it.
 *
 * The owner's conclusion, and it is the right one: the patient gives consent
 * when they register, so the desk has nothing to manage - only something to
 * see. Hence a line, not a card, and nothing to press.
 *
 * The three states matter and are the whole reason this file exists:
 *
 *     granted        Uděleno 12. 9. 2026
 *     not granted    Neuděleno            - asked, and said no
 *     nothing at all Nebyl dotázán        - registered at the desk, where
 *                                           nobody puts the form in front of
 *                                           them
 *
 * Drawing the third as the second is the same lie the old card told, only
 * pointing the other way: it would accuse somebody of refusing a question they
 * were never asked. That distinction is the one thing here worth being careful
 * about.
 */
import { useEffect, useState } from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { CheckCircle, HelpOutlined, Block } from '@mui/icons-material';
import client from '../../api/client';
import { formatDateOnly } from '../../utils/time';

export interface PatientConsent {
  policyCode: string;
  policyVersion: string;
  purpose: string;
  granted: boolean;
  grantedAtUtc: string;
}

/** The one that permits treating the patient at all. */
const TREATMENT = 'treatment';

export function treatmentConsent(consents: PatientConsent[]): PatientConsent | null {
  return consents.find((c) => c.policyCode === TREATMENT) ?? null;
}

export type ConsentState = 'granted' | 'refused' | 'never-asked';

/**
 * Which of the three this patient is in.
 *
 * An empty list is `never-asked`, never `refused`. The list comes from the
 * registration form, and somebody registered at the desk has no entry because
 * nobody showed them the form - that is not a refusal.
 */
export function consentState(consents: PatientConsent[]): ConsentState {
  const treatment = treatmentConsent(consents);
  if (treatment === null) return 'never-asked';
  return treatment.granted ? 'granted' : 'refused';
}

export default function ConsentLine({ patientId }: { patientId: string }) {
  const [consents, setConsents] = useState<PatientConsent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get(`/api/patients/${patientId}/consents`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.value ?? res.data ?? [];
        setConsents(Array.isArray(data) ? data : []);
      })
      /* Unknown is not the same as absent, so nothing is drawn rather than
         something wrong being drawn. */
      .catch(() => {
        if (!cancelled) setConsents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (consents === null) return null;

  const state = consentState(consents);
  const treatment = treatmentConsent(consents);

  if (state === 'never-asked') {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <HelpOutlined sx={{ fontSize: 18, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary">
          Souhlas se zpracováním zdravotních údajů: <strong>nebyl dotázán</strong>
        </Typography>
        <Tooltip title="Pacienta registroval personál, formulář se souhlasem tedy nevyplňoval. Není to odmítnutí.">
          <Chip size="small" variant="outlined" label="registrace na recepci" />
        </Tooltip>
      </Stack>
    );
  }

  if (state === 'refused') {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Block sx={{ fontSize: 18, color: 'error.main' }} />
        <Typography variant="body2" color="error">
          Souhlas se zpracováním zdravotních údajů: <strong>neudělen</strong>
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
      <Typography variant="body2" color="text.secondary">
        Souhlas se zpracováním zdravotních údajů udělen{' '}
        <strong>{formatDateOnly(treatment?.grantedAtUtc?.slice(0, 10))}</strong>
      </Typography>
      {/* The policy version is what makes the record provable a year later:
          it says which wording the patient actually agreed to. */}
      <Tooltip title={treatment?.purpose ?? ''}>
        <Chip size="small" variant="outlined" label={`znění ${treatment?.policyVersion}`} />
      </Tooltip>
      <Box sx={{ flex: 1 }} />
    </Stack>
  );
}
