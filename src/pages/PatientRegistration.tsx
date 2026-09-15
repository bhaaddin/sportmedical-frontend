/*
 * Registering a patient, on one screen.
 *
 * It was a five-step wizard, and the owner sent it back: "coz ja nechcem
 * pretoze mi to zbytocne kooplikuje registraciu". He is right about who this
 * screen is for — somebody standing at a desk with a patient in front of them,
 * reading off a card. A wizard makes that person hold five screens in their
 * head and click through four of them to fix a digit on the first.
 *
 * NOTHING WAS DROPPED IN THE MOVE. Every field, every catalogue and every live
 * behaviour the wizard had is here: the same `RegistrationFormState`, the same
 * `validateAll`, the same `buildRequest`, the same candidate review. The fifth
 * step — "Shrnutí" — is the one thing that stopped being a step: it is the
 * card on the right, which fills in as the form is typed, so the summary is
 * never a page you arrive at and always a thing you can see.
 *
 * Two things the wizard could not do at all:
 *
 *   the identifier is INSPECTED against what was typed, so a disagreement
 *   names both values while both are on screen, instead of arriving as one
 *   refusal after the save that names neither
 *
 *   an error puts the screen at the field rather than at a step, because on
 *   one screen there is nowhere else to put it
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, AlertTitle, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel, Grid, LinearProgress, MenuItem, Paper, Radio,
  RadioGroup, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { HowToReg, PersonAdd, Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import patientRegistryApi, {
  type IdentityInspection,
  type PatientRegistrationOptions,
  type PatientSearchResult,
  type RegisterPatientRequest,
  type RegistrationCandidate,
  type RegistrationConfirmation,
} from '../api/patientRegistry';
import type { AddressPoint } from '../api/addressLookup';
import {
  createEmptyForm,
  digitsOnly,
  validateAll,
  type FieldErrors,
  type RegistrationFormState,
} from '../services/patientRegistration/validation';
import { resolveRegistrationError } from '../services/patientRegistration/registrationErrors';
import { formatRodneCislo } from '../utils/rodneCislo';
import {
  classifyInsuranceNumber,
  IDENTIFIER_KIND_LABEL,
  parseBirthNumber,
} from '../services/patientRegistration/insuranceIdentifier';
import {
  AGREES_TEXT, disagreementText, verdictOf, worthInspecting,
} from '../services/patientRegistration/identityInspection';
import RuianAddressPicker from '../components/registration/RuianAddressPicker';
import CandidateReviewDialog from '../components/registration/CandidateReviewDialog';

interface RegistrationIdentifiers {
  patientId: string;
  emailContactPointId: string;
  phoneContactPointId: string;
  patientAddressId: string;
  administrativeProfileId: string;
}

function mintIdentifiers(): RegistrationIdentifiers {
  return {
    patientId: crypto.randomUUID(),
    emailContactPointId: crypto.randomUUID(),
    phoneContactPointId: crypto.randomUUID(),
    patientAddressId: crypto.randomUUID(),
    administrativeProfileId: crypto.randomUUID(),
  };
}

/* The summary shows what will be saved; the identifiers are shown masked,
   because a card left open on a reception desk is a card anybody walks past. */
function maskBirthNumber(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 0) return '—';
  return digits.length === 9 ? '******/***' : '******/****';
}

function maskInsuranceNumber(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length < 4) return '—';
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

const RESIDENCE_TYPES = [
  { code: 'PermanentResidenceInCzechia', label: 'Trvalý pobyt v ČR' },
  { code: 'ReportedResidenceInCzechia', label: 'Hlášený pobyt v ČR' },
] as const;

/* Registration accepts male or female only; the registry refuses the rest. */
const SEX_OPTIONS = [
  { code: 'Male', label: 'Muž' },
  { code: 'Female', label: 'Žena' },
] as const;

/** The order errors are walked in, so the screen jumps to the FIRST problem. */
const FIELD_ORDER: (keyof RegistrationFormState)[] = [
  'firstName', 'lastName', 'preferredName', 'dateOfBirth', 'sex',
  'healthInsuranceNumber', 'healthInsuranceNumberConfirmation', 'healthInsurerCode',
  'birthNumber', 'identityDocumentType', 'identityDocumentIssuingCountryCode',
  'identityDocumentNumber', 'ruianAddressPointCode', 'email', 'phoneRegionCode', 'phone',
];

/** What is still missing, in the words of the field rather than its name. */
const FIELD_LABEL: Partial<Record<keyof RegistrationFormState, string>> = {
  firstName: 'Jméno', lastName: 'Příjmení', dateOfBirth: 'Datum narození',
  sex: 'Pohlaví', healthInsuranceNumber: 'Číslo pojištěnce',
  healthInsuranceNumberConfirmation: 'Druhé zadání čísla pojištěnce',
  healthInsurerCode: 'Zdravotní pojišťovna', birthNumber: 'Rodné číslo',
  identityDocumentType: 'Typ dokladu',
  identityDocumentIssuingCountryCode: 'Stát vydání dokladu',
  identityDocumentNumber: 'Číslo dokladu',
  ruianAddressPointCode: 'Adresa z registru RÚIAN',
  email: 'E-mail', phone: 'Telefon', phoneRegionCode: 'Předvolba',
};

export default function PatientRegistration() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegistrationFormState>(createEmptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [options, setOptions] = useState<PatientRegistrationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');

  const [similar, setSimilar] = useState<PatientSearchResult[]>([]);
  const [addressPoint, setAddressPoint] = useState<AddressPoint | null>(null);
  const [review, setReview] = useState<{
    candidates: RegistrationCandidate[];
    confirmation: RegistrationConfirmation;
  } | null>(null);

  /** What the identifier itself says, when it has been asked. */
  const [inspection, setInspection] = useState<IdentityInspection | null>(null);

  /* Stable for the whole attempt: a retry must replay, not duplicate. */
  const identifiers = useRef<RegistrationIdentifiers>(mintIdentifiers());

  const update = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  /* ── Options ── */
  useEffect(() => {
    patientRegistryApi
      .getOptions()
      .then(setOptions)
      .catch((error) => setOptionsError(resolveRegistrationError(error).message))
      .finally(() => setLoadingOptions(false));
  }, []);

  /* ── Advisory duplicate check while the operator types ── */
  useEffect(() => {
    const lastName = form.lastName.trim();
    if (lastName.length < 2 || form.dateOfBirth.length === 0) {
      setSimilar([]);
      return;
    }

    const timer = setTimeout(() => {
      patientRegistryApi
        .searchPatients({
          firstName: form.firstName.trim() || undefined,
          lastName,
          dateOfBirth: form.dateOfBirth,
        })
        .then(setSimilar)
        .catch(() => setSimilar([]));
    }, 400);

    return () => clearTimeout(timer);
  }, [form.firstName, form.lastName, form.dateOfBirth]);

  /*
   * ── What the identifier says about what was typed ──
   *
   * Asked, never applied. The form fills an EMPTY date or sex from an
   * identifier it can read; a full one it only queries, because an identifier
   * that disagrees with a hand-typed date is a question and answering it by
   * overwriting is how somebody ends up with a birthday nobody chose.
   */
  const identifierDigits = digitsOnly(
    form.healthInsuranceNumber.length > 0 ? form.healthInsuranceNumber : form.birthNumber,
  );

  useEffect(() => {
    if (form.insuranceRegistrationKind !== 'CzechPublicHealthInsurance'
      || !worthInspecting(identifierDigits)) {
      setInspection(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      patientRegistryApi
        .inspectIdentity({
          identifier: identifierDigits,
          dateOfBirth: form.dateOfBirth || null,
          sex: form.sex || null,
        })
        .then((result) => { if (!cancelled) setInspection(result); })
        .catch(() => { if (!cancelled) setInspection(null); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [identifierDigits, form.dateOfBirth, form.sex, form.insuranceRegistrationKind]);

  const verdict = verdictOf(inspection, { dateOfBirth: form.dateOfBirth, sex: form.sex });

  /* ── Birth number drives date of birth and sex ── */
  const handleBirthNumber = (raw: string) => {
    const formatted = formatRodneCislo(raw);
    const parsed = parseBirthNumber(digitsOnly(formatted));

    setForm((previous) => ({
      ...previous,
      birthNumber: formatted,
      ...(parsed !== null ? { dateOfBirth: parsed.dateOfBirth, sex: parsed.sex } : {}),
    }));
    setErrors((previous) => ({ ...previous, birthNumber: undefined }));
  };

  /**
   * A birth-number-shaped insurance number IS the birth number as far as the
   * Domain is concerned, so mirror it instead of letting the operator type
   * two values that then fail BirthNumberInsuranceNumberMismatch.
   */
  const handleInsuranceNumber = (raw: string) => {
    const digits = digitsOnly(raw).slice(0, 10);
    const classification = classifyInsuranceNumber(digits);

    setForm((previous) => ({
      ...previous,
      healthInsuranceNumber: digits,
      // A birth-number-shaped identifier IS the birth number; an evidence
      // number only carries the demographics, never a birth number.
      ...(classification.kind === 'CzechBirthNumber' ? { birthNumber: formatRodneCislo(digits) } : {}),
      ...(classification.dateOfBirth !== null ? { dateOfBirth: classification.dateOfBirth } : {}),
      ...(classification.sex !== null ? { sex: classification.sex } : {}),
    }));
    setErrors((previous) => ({
      ...previous,
      healthInsuranceNumber: undefined,
      birthNumber: undefined,
    }));
  };

  const handleAddressPoint = (point: AddressPoint | null) => {
    setAddressPoint(point);
    setForm((previous) => ({
      ...previous,
      ruianAddressPointCode: point?.addressPointCode ?? null,
      addressDisplay: point?.formattedAddress ?? '',
    }));
    setErrors((previous) => ({ ...previous, ruianAddressPointCode: undefined }));
  };

  /* ── Command ── */
  const buildRequest = useCallback(
    (confirmation: RegistrationConfirmation | null): RegisterPatientRequest => {
      const czech = form.insuranceRegistrationKind === 'CzechPublicHealthInsurance';
      const ids = identifiers.current;
      const birthNumber = digitsOnly(form.birthNumber);

      return {
        patientId: ids.patientId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || null,
        titlesBeforeName: form.titlesBeforeName,
        titlesAfterName: form.titlesAfterName,
        dateOfBirth: form.dateOfBirth,
        sex: form.sex === '' ? 'NotSpecified' : form.sex,
        mode: form.mode,
        source: 'ClinicOperator',
        email: {
          contactPointId: ids.emailContactPointId,
          value: form.email.trim(),
        },
        phone: {
          contactPointId: ids.phoneContactPointId,
          value: form.phone.trim(),
          regionCode: form.phoneRegionCode,
        },
        address: {
          patientAddressId: ids.patientAddressId,
          residenceType: form.residenceType,
          ruianAddressPointCode: form.ruianAddressPointCode ?? 0,
        },
        administrativeProfile: {
          profileId: ids.administrativeProfileId,
          insuranceRegistrationKind: form.insuranceRegistrationKind,
          // The two branches are exclusive: the Domain refuses facts from
          // the branch that was not chosen, so send nulls, not leftovers.
          birthNumber: czech && birthNumber.length > 0 ? birthNumber : null,
          healthInsuranceNumber: czech ? digitsOnly(form.healthInsuranceNumber) : null,
          healthInsuranceNumberConfirmation: czech
            ? digitsOnly(form.healthInsuranceNumberConfirmation)
            : null,
          healthInsurerCode: czech ? form.healthInsurerCode : null,
          insuranceEvidenceSource: czech && form.insuranceCardInspected ? 'InsuranceCardInspected' : null,
          identityDocumentType: czech ? null : form.identityDocumentType,
          identityDocumentIssuingCountryCode: czech
            ? null
            : form.identityDocumentIssuingCountryCode.trim().toUpperCase(),
          identityDocumentNumber: czech ? null : form.identityDocumentNumber.trim(),
        },
        confirmation,
      };
    },
    [form],
  );

  /** Puts the screen at the first thing that is wrong. There is no step to go to. */
  const focusFirstError = (found: FieldErrors) => {
    const first = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (first === undefined) return;
    const node = document.querySelector(`[data-field="${first}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const send = useCallback(
    async (confirmation: RegistrationConfirmation | null) => {
      setSubmitting(true);
      setBanner(null);

      try {
        const result = await patientRegistryApi.register(buildRequest(confirmation));

        if (result.outcome === 'CandidateReviewRequired') {
          setReview({
            candidates: result.candidates,
            confirmation: {
              registrationFingerprint: result.registrationFingerprint,
              authorizationScopeFingerprint: result.authorizationScopeFingerprint ?? '',
              /* Sent back as it came: the registry refuses a confirmation of a
                 candidate list that has changed since — `candidate_review_stale`
                 — which is the guard against confirming a list nobody saw. */
              candidateSetFingerprint: result.candidateSetFingerprint ?? '',
              candidates: result.candidates,
            },
          });
          return;
        }

        setReview(null);
        toast.success(
          result.outcome === 'Created'
            ? 'Pacient byl zaregistrován.'
            : 'Pacient s totožnými údaji už byl zaregistrován.',
        );
        identifiers.current = mintIdentifiers();
        navigate(`/patients/${result.patientId}`);
      } catch (error) {
        const resolved = resolveRegistrationError(error);
        setReview(null);
        setBanner({
          severity: resolved.requiresRestart ? 'error' : 'warning',
          text: resolved.message,
        });

        if (resolved.field !== null) {
          const field = resolved.field as keyof RegistrationFormState;
          setErrors((previous) => ({ ...previous, [field]: resolved.message }));
          focusFirstError({ [field]: resolved.message } as FieldErrors);
        }
        if (resolved.requiresRestart) {
          // The identifiers are burnt: the registry already knows them with
          // other facts, so a retry under the same ids can only conflict again.
          identifiers.current = mintIdentifiers();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [buildRequest, navigate],
  );

  const submit = () => {
    const allErrors = validateAll(form);
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      setBanner({ severity: 'warning', text: 'Formulář obsahuje chyby. Zkontrolujte zvýrazněná pole.' });
      focusFirstError(allErrors);
      return;
    }

    void send(null);
  };

  const czechBranch = form.insuranceRegistrationKind === 'CzechPublicHealthInsurance';
  const identifier = classifyInsuranceNumber(form.healthInsuranceNumber);

  const titleOptions = useMemo(
    () => ({
      before: options?.titlesBeforeName ?? [],
      after: options?.titlesAfterName ?? [],
    }),
    [options],
  );

  /* What the card on the right counts down. The former "Shrnutí" step. */
  const outstanding = useMemo(() => {
    const found = validateAll(form);
    return FIELD_ORDER
      .filter((field) => found[field] !== undefined)
      .map((field) => FIELD_LABEL[field] ?? field);
  }, [form]);

  const requiredCount = czechBranch ? 11 : 12;
  const doneCount = Math.max(0, requiredCount - outstanding.length);

  if (loadingOptions) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (options === null) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Registraci nelze otevřít</AlertTitle>
          {optionsError || 'Číselníky registrace se nepodařilo načíst.'}
        </Alert>
      </Box>
    );
  }

  const section = (num: number, title: string, note?: string) => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
      <Box
        sx={{
          width: 24, height: 24, borderRadius: 1.5, bgcolor: 'primary.main',
          color: 'primary.contrastText', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}
      >
        {num}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
      {note !== undefined && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {note}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* ── Header ── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'flex-end' }, mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexGrow: 1 }}>
          <HowToReg color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Registrace pacienta</Typography>
            <Typography variant="body2" color="text.secondary">
              Všechno na jedné obrazovce. Vpravo se průběžně skládá to, co se uloží.
            </Typography>
          </Box>
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Režim zápisu
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={form.mode}
            onChange={(_, value) => value !== null && update('mode', value)}
          >
            <ToggleButton value="Standard">Standardní</ToggleButton>
            <ToggleButton value="Quick">Rychlá registrace</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>

      {banner !== null && (
        <Alert severity={banner.severity} sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner.text}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
        {/* ═══ The form ═══ */}
        <Stack spacing={2} sx={{ flexGrow: 1, width: '100%', minWidth: 0 }}>

          {/* 1 · Totožnost */}
          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            {section(1, 'Totožnost')}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 2 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={titleOptions.before.map((o) => o.code)}
                  value={form.titlesBeforeName}
                  onChange={(_, value) => update('titlesBeforeName', value)}
                  getOptionLabel={(code) =>
                    titleOptions.before.find((o) => o.code === code)?.displayValue ?? code}
                  renderInput={(params) => <TextField {...params} label="Tituly před" />}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-field="firstName">
                <TextField
                  fullWidth size="small" label="Jméno *"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  error={errors.firstName !== undefined}
                  helperText={errors.firstName}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-field="lastName">
                <TextField
                  fullWidth size="small" label="Příjmení *"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  error={errors.lastName !== undefined}
                  helperText={errors.lastName}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={titleOptions.after.map((o) => o.code)}
                  value={form.titlesAfterName}
                  onChange={(_, value) => update('titlesAfterName', value)}
                  getOptionLabel={(code) =>
                    titleOptions.after.find((o) => o.code === code)?.displayValue ?? code}
                  renderInput={(params) => <TextField {...params} label="Tituly za" />}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }} data-field="preferredName">
                <TextField
                  fullWidth size="small" label="Oslovení"
                  value={form.preferredName}
                  onChange={(e) => update('preferredName', e.target.value)}
                  error={errors.preferredName !== undefined}
                  helperText={errors.preferredName ?? 'Nepovinné.'}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-field="dateOfBirth">
                <TextField
                  fullWidth size="small" type="date" label="Datum narození *"
                  value={form.dateOfBirth}
                  onChange={(e) => update('dateOfBirth', e.target.value)}
                  error={errors.dateOfBirth !== undefined}
                  helperText={errors.dateOfBirth}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-field="sex">
                <Typography variant="caption" color="text.secondary">Pohlaví *</Typography>
                <RadioGroup
                  row
                  value={form.sex}
                  onChange={(e) => update('sex', e.target.value as RegistrationFormState['sex'])}
                >
                  {SEX_OPTIONS.map((option) => (
                    <FormControlLabel
                      key={option.code}
                      value={option.code}
                      control={<Radio size="small" />}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
                {errors.sex !== undefined && (
                  <Typography variant="caption" color="error">{errors.sex}</Typography>
                )}
              </Grid>
            </Grid>

            {/* Live duplicate check — said where it applies, not after the save. */}
            {similar.length > 0 && (
              <Alert severity="warning" icon={<Search fontSize="small" />} sx={{ mt: 2 }}>
                <AlertTitle sx={{ fontSize: 14 }}>
                  {similar.length === 1
                    ? 'V registru je někdo podobný'
                    : `V registru je ${similar.length} podobných záznamů`}
                </AlertTitle>
                <Stack spacing={0.5}>
                  {similar.slice(0, 4).map((candidate) => (
                    <Typography key={candidate.patientId} variant="body2">
                      {candidate.fullName} · {candidate.dateOfBirth} · {candidate.status}
                    </Typography>
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  Ověřte, než založíte druhý záznam — rozdělil by historii vyšetření.
                </Typography>
              </Alert>
            )}
          </Paper>

          {/* 2 · Pojištění */}
          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            {section(2, 'Pojištění a identifikace')}

            <RadioGroup
              value={form.insuranceRegistrationKind}
              onChange={(e) =>
                update('insuranceRegistrationKind',
                  e.target.value as RegistrationFormState['insuranceRegistrationKind'])}
              sx={{ mb: 2 }}
            >
              {options.insuranceRegistrationKinds.map((kind) => (
                <FormControlLabel
                  key={kind.code}
                  value={kind.code}
                  control={<Radio size="small" />}
                  label={kind.displayValue}
                />
              ))}
            </RadioGroup>

            <Divider sx={{ mb: 2 }} />

            {czechBranch ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }} data-field="healthInsuranceNumber">
                  <TextField
                    fullWidth size="small" label="Číslo pojištěnce *"
                    value={form.healthInsuranceNumber}
                    onChange={(e) => handleInsuranceNumber(e.target.value)}
                    error={errors.healthInsuranceNumber !== undefined}
                    helperText={
                      errors.healthInsuranceNumber
                      ?? (form.healthInsuranceNumber.length > 0
                        ? IDENTIFIER_KIND_LABEL[identifier.kind]
                        : 'Devět nebo deset číslic z kartičky.')
                    }
                  />
                </Grid>

                {/* Only an insurer-assigned number is typed twice — nothing
                    else can be checked against anything but itself. */}
                {identifier.requiresConfirmation && (
                  <Grid size={{ xs: 12, md: 4 }} data-field="healthInsuranceNumberConfirmation">
                    <TextField
                      fullWidth size="small" label="Číslo pojištěnce ještě jednou *"
                      value={form.healthInsuranceNumberConfirmation}
                      onChange={(e) =>
                        update('healthInsuranceNumberConfirmation', digitsOnly(e.target.value))}
                      error={errors.healthInsuranceNumberConfirmation !== undefined}
                      helperText={
                        errors.healthInsuranceNumberConfirmation
                        ?? 'Tohle číslo se nedá ověřit proti ničemu jinému.'
                      }
                    />
                  </Grid>
                )}

                <Grid size={{ xs: 12, md: 4 }} data-field="healthInsurerCode">
                  <TextField
                    select fullWidth size="small" label="Zdravotní pojišťovna *"
                    value={form.healthInsurerCode}
                    onChange={(e) => update('healthInsurerCode', e.target.value)}
                    error={errors.healthInsurerCode !== undefined}
                    helperText={errors.healthInsurerCode}
                  >
                    {options.czechHealthInsurers.map((insurer) => (
                      <MenuItem key={insurer.code} value={insurer.code}>
                        {insurer.code} — {insurer.displayValue}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }} data-field="birthNumber">
                  <TextField
                    fullWidth size="small" label="Rodné číslo"
                    value={form.birthNumber}
                    onChange={(e) => handleBirthNumber(e.target.value)}
                    error={errors.birthNumber !== undefined}
                    helperText={errors.birthNumber ?? 'Nepovinné — registr ho nevyžaduje.'}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={form.insuranceCardInspected}
                        onChange={(e) => update('insuranceCardInspected', e.target.checked)}
                      />
                    }
                    label="Kartička pojištěnce ověřena"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Zaškrtněte, když jste průkaz viděli. Zapíše se jako zdroj evidence.
                  </Typography>
                </Grid>

                {/* What the identifier itself says — with both values in it. */}
                {verdict === 'disagrees' && inspection !== null && (
                  <Grid size={12}>
                    <Alert severity="warning">
                      {disagreementText(inspection, {
                        dateOfBirth: form.dateOfBirth, sex: form.sex,
                      })}
                    </Alert>
                  </Grid>
                )}
                {verdict === 'agrees' && (
                  <Grid size={12}>
                    <Typography variant="caption" sx={{ color: 'success.main' }}>
                      {AGREES_TEXT}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }} data-field="identityDocumentType">
                  <TextField
                    select fullWidth size="small" label="Typ dokladu *"
                    value={form.identityDocumentType}
                    onChange={(e) => update('identityDocumentType', e.target.value)}
                    error={errors.identityDocumentType !== undefined}
                    helperText={errors.identityDocumentType}
                  >
                    {options.identityDocumentTypes.map((type) => (
                      <MenuItem key={type.code} value={type.code}>{type.displayValue}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }} data-field="identityDocumentIssuingCountryCode">
                  <TextField
                    fullWidth size="small" label="Stát vydání *"
                    value={form.identityDocumentIssuingCountryCode}
                    onChange={(e) =>
                      update('identityDocumentIssuingCountryCode', e.target.value.toUpperCase())}
                    error={errors.identityDocumentIssuingCountryCode !== undefined}
                    helperText={
                      errors.identityDocumentIssuingCountryCode ?? 'Dvě písmena, ISO 3166-1.'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }} data-field="identityDocumentNumber">
                  <TextField
                    fullWidth size="small" label="Číslo dokladu *"
                    value={form.identityDocumentNumber}
                    onChange={(e) => update('identityDocumentNumber', e.target.value)}
                    error={errors.identityDocumentNumber !== undefined}
                    helperText={errors.identityDocumentNumber}
                  />
                </Grid>
                <Grid size={12}>
                  <Typography variant="caption" color="text.secondary">
                    Datum narození a pohlaví vyplňte v prvním oddílu ručně — ze zahraničního
                    dokladu se odvodit nedají.
                  </Typography>
                </Grid>
              </Grid>
            )}
          </Paper>

          {/* 3 · Bydliště */}
          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }} data-field="ruianAddressPointCode">
            {section(3, 'Bydliště')}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select fullWidth size="small" label="Typ pobytu *"
                  value={form.residenceType}
                  onChange={(e) =>
                    update('residenceType', e.target.value as RegistrationFormState['residenceType'])}
                >
                  {RESIDENCE_TYPES.map((type) => (
                    <MenuItem key={type.code} value={type.code}>{type.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={12}>
                <RuianAddressPicker
                  selectedPoint={addressPoint}
                  onSelect={handleAddressPoint}
                  error={errors.ruianAddressPointCode}
                  disabled={submitting}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 4 · Kontakt */}
          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            {section(4, 'Kontakt')}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }} data-field="email">
                <TextField
                  fullWidth size="small" label="E-mail *"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  error={errors.email !== undefined}
                  helperText={errors.email}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }} data-field="phoneRegionCode">
                <TextField
                  select fullWidth size="small" label="Předvolba *"
                  value={form.phoneRegionCode}
                  onChange={(e) => update('phoneRegionCode', e.target.value)}
                  error={errors.phoneRegionCode !== undefined}
                  helperText={errors.phoneRegionCode}
                >
                  {options.phoneRegions.map((region) => (
                    <MenuItem key={region.code} value={region.code}>{region.displayValue}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-field="phone">
                <TextField
                  fullWidth size="small" label="Telefon *"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  error={errors.phone !== undefined}
                  helperText={errors.phone}
                />
              </Grid>
            </Grid>
          </Paper>
        </Stack>

        {/* ═══ The card — the former "Shrnutí" step ═══ */}
        <Stack
          spacing={2}
          sx={{
            width: { xs: '100%', lg: 380 }, flexShrink: 0,
            position: { lg: 'sticky' }, top: { lg: 16 },
          }}
        >
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', p: 2.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.75, letterSpacing: '.08em' }}>
                ULOŽÍ SE TAKTO
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {`${form.firstName} ${form.lastName}`.trim() || 'Nový pacient'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {form.dateOfBirth !== '' && (
                  <Chip size="small" label={form.dateOfBirth}
                    sx={{ bgcolor: 'rgba(255,255,255,.18)', color: 'inherit' }} />
                )}
                {form.sex !== '' && (
                  <Chip size="small"
                    label={SEX_OPTIONS.find((s) => s.code === form.sex)?.label ?? form.sex}
                    sx={{ bgcolor: 'rgba(255,255,255,.18)', color: 'inherit' }} />
                )}
                <Chip size="small"
                  label={form.mode === 'Standard' ? 'Standardní' : 'Rychlá'}
                  sx={{ bgcolor: 'rgba(255,255,255,.18)', color: 'inherit' }} />
              </Stack>
            </Box>

            <Stack sx={{ px: 2.5, py: 1 }} divider={<Divider />}>
              <SummaryRow label="Pojištění" value={
                czechBranch
                  ? (options.czechHealthInsurers.find((i) => i.code === form.healthInsurerCode)
                    ?.displayValue ?? '—')
                  : (options.identityDocumentTypes.find((t) => t.code === form.identityDocumentType)
                    ?.displayValue ?? 'Doklad ze zahraničí')
              } />
              <SummaryRow
                label={czechBranch ? 'Číslo pojištěnce' : 'Číslo dokladu'}
                value={czechBranch
                  ? maskInsuranceNumber(form.healthInsuranceNumber)
                  : (form.identityDocumentNumber || '—')}
              />
              {czechBranch && (
                <SummaryRow label="Rodné číslo" value={maskBirthNumber(form.birthNumber)} />
              )}
              <SummaryRow label="Bydliště" value={form.addressDisplay || '—'} />
              <SummaryRow label="E-mail" value={form.email || '—'} />
              <SummaryRow label="Telefon" value={form.phone || '—'} />
            </Stack>
          </Paper>

          <Paper sx={{ borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'baseline', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Zbývá vyplnit</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {doneCount} z {requiredCount} hotovo
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(doneCount / requiredCount) * 100}
              sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
            />
            {outstanding.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'success.main' }}>
                Všechno povinné je vyplněné.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {outstanding.map((label) => (
                  <Typography key={label} variant="body2" color="text.secondary">
                    · {label}
                  </Typography>
                ))}
              </Stack>
            )}
          </Paper>

          <Button
            variant="contained"
            size="large"
            startIcon={<PersonAdd />}
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? 'Registruji…' : 'Zaregistrovat pacienta'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Rodné číslo i číslo pojištěnce se do protokolu zapisují zamaskované.
          </Typography>
        </Stack>
      </Stack>

      <CandidateReviewDialog
        open={review !== null}
        candidates={review?.candidates ?? []}
        submitting={submitting}
        onCancel={() => setReview(null)}
        onConfirmDistinct={() => { if (review !== null) void send(review.confirmation); }}
        onUseExisting={(patientId) => { setReview(null); navigate(`/patients/${patientId}`); }}
      />
    </Box>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 1.25, alignItems: 'baseline' }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ ml: 'auto', textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Stack>
  );
}
