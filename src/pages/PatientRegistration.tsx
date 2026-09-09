/* ══════════════════════════════════════════════════════════════
   PATIENT REGISTRATION (staff window)

   Front end for the governed registry: POST /api/v1/patients, backed by
   Application/Patients/Registration/PatientRegistrationService.

   Three things make this window different from the legacy patient form:

   1. The identifiers are minted here. patientId, both contact-point ids,
      the address id and the administrative-profile id are generated once
      per attempt and kept stable across retries, so a re-send is a replay
      the server recognises ("Existing") rather than a second patient.
   2. Duplicates are the server's call. When it answers
      CandidateReviewRequired the operator decides, and the decision is
      sent back with the fingerprints it came with.
   3. Insurance is a branch, not a set of optional fields. Czech public
      insurance and "no Czech insurance number" accept mutually exclusive
      facts — the Domain refuses a mixture, so the form never offers one.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ArrowBack, ArrowForward, HowToReg, PersonAdd } from '@mui/icons-material';
import toast from 'react-hot-toast';
import patientRegistryApi, {
  type AddressPoint,
  type PatientRegistrationOptions,
  type PatientSearchResult,
  type RegisterPatientRequest,
  type RegistrationCandidate,
  type RegistrationConfirmation,
} from '../api/patientRegistry';
import {
  createEmptyForm,
  digitsOnly,
  REGISTRATION_STEPS,
  validateAll,
  validateStep,
  type FieldErrors,
  type RegistrationFormState,
  type RegistrationStep,
} from '../services/patientRegistration/validation';
import { resolveRegistrationError } from '../services/patientRegistration/registrationErrors';
import { formatRodneCislo } from '../utils/rodneCislo';
import {
  classifyInsuranceNumber,
  IDENTIFIER_KIND_LABEL,
  parseBirthNumber,
} from '../services/patientRegistration/insuranceIdentifier';
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

export default function PatientRegistration() {
  const navigate = useNavigate();

  const [options, setOptions] = useState<PatientRegistrationOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [form, setForm] = useState<RegistrationFormState>(createEmptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState<RegistrationStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning'; text: string } | null>(null);

  const [addressPoint, setAddressPoint] = useState<AddressPoint | null>(null);
  const [similar, setSimilar] = useState<PatientSearchResult[]>([]);

  const [review, setReview] = useState<{
    candidates: RegistrationCandidate[];
    confirmation: RegistrationConfirmation;
  } | null>(null);

  /* Stable for the whole attempt: a retry must replay, not duplicate. */
  const identifiers = useRef<RegistrationIdentifiers>(mintIdentifiers());

  const update = useCallback(<K extends keyof RegistrationFormState>(
    field: K,
    value: RegistrationFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }, []);

  /* ── Options ── */
  useEffect(() => {
    patientRegistryApi
      .getOptions()
      .then((result) => {
        setOptions(result);
        const czechRegion = result.phoneRegions.find((region) => region.code === 'CZ');
        if (czechRegion !== undefined) {
          setForm((previous) => ({ ...previous, phoneRegionCode: czechRegion.code }));
        }
      })
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

  const goNext = () => {
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setStep((previous) => Math.min(previous + 1, REGISTRATION_STEPS.length - 1) as RegistrationStep);
  };

  const goBack = () => setStep((previous) => Math.max(previous - 1, 0) as RegistrationStep);

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
          setErrors((previous) => ({ ...previous, [resolved.field as string]: resolved.message }));
        }
        if (resolved.step !== null) {
          setStep(resolved.step as RegistrationStep);
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1080, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <HowToReg color="primary" />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Registrace pacienta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Řízená registrace do registru pacientů — údaje ověřuje server.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {REGISTRATION_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {banner !== null && (
          <Alert severity={banner.severity} sx={{ mb: 3 }} onClose={() => setBanner(null)}>
            {banner.text}
          </Alert>
        )}

        {/* ── 0 — Identity ── */}
        {step === 0 && (
          <Grid container spacing={2}>
            <Grid size={12}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={form.mode}
                onChange={(_, value) => value !== null && update('mode', value)}
              >
                <ToggleButton value="Standard">Standardní registrace</ToggleButton>
                <ToggleButton value="Quick">Rychlá registrace</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Režim se zaznamenává do auditu registrace. Povinné údaje jsou v obou režimech stejné.
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Autocomplete
                multiple
                options={titleOptions.before}
                getOptionLabel={(option) => option.displayValue}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                value={titleOptions.before.filter((option) =>
                  form.titlesBeforeName.includes(option.code),
                )}
                onChange={(_, value) =>
                  update('titlesBeforeName', value.map((option) => option.code))
                }
                renderInput={(params) => <TextField {...params} label="Tituly před jménem" />}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                required
                label="Jméno"
                value={form.firstName}
                onChange={(event) => update('firstName', event.target.value)}
                error={errors.firstName !== undefined}
                helperText={errors.firstName ?? ' '}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                required
                label="Příjmení"
                value={form.lastName}
                onChange={(event) => update('lastName', event.target.value)}
                error={errors.lastName !== undefined}
                helperText={errors.lastName ?? ' '}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Autocomplete
                multiple
                options={titleOptions.after}
                getOptionLabel={(option) => option.displayValue}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                value={titleOptions.after.filter((option) =>
                  form.titlesAfterName.includes(option.code),
                )}
                onChange={(_, value) => update('titlesAfterName', value.map((option) => option.code))}
                renderInput={(params) => <TextField {...params} label="Tituly za jménem" />}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Oslovení"
                value={form.preferredName}
                onChange={(event) => update('preferredName', event.target.value)}
                error={errors.preferredName !== undefined}
                helperText={errors.preferredName ?? ' '}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField
                fullWidth
                required
                type="date"
                label="Datum narození"
                value={form.dateOfBirth}
                onChange={(event) => update('dateOfBirth', event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                error={errors.dateOfBirth !== undefined}
                helperText={errors.dateOfBirth ?? ' '}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField
                fullWidth
                select
                required
                label="Pohlaví"
                value={form.sex}
                onChange={(event) => update('sex', event.target.value as RegistrationFormState['sex'])}
                error={errors.sex !== undefined}
                helperText={errors.sex ?? ' '}
              >
                {SEX_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {similar.length > 0 && (
              <Grid size={12}>
                <Alert severity="info">
                  <AlertTitle>Podobní pacienti už v registru jsou</AlertTitle>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {similar.map((patient) => (
                      <Chip
                        key={patient.patientId}
                        label={`${patient.fullName} · ${new Date(
                          patient.dateOfBirth,
                        ).toLocaleDateString('cs-CZ')}`}
                        onClick={() => navigate(`/patients/${patient.patientId}`)}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        {/* ── 1 — Insurance ── */}
        {step === 1 && (
          <Grid container spacing={2}>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Způsob evidence pojištění
              </Typography>
              <RadioGroup
                value={form.insuranceRegistrationKind}
                onChange={(event) =>
                  update(
                    'insuranceRegistrationKind',
                    event.target.value as RegistrationFormState['insuranceRegistrationKind'],
                  )
                }
              >
                {options.insuranceRegistrationKinds.map((option) => (
                  <FormControlLabel
                    key={option.code}
                    value={option.code}
                    control={<Radio />}
                    label={option.displayValue}
                  />
                ))}
              </RadioGroup>
            </Grid>

            {czechBranch ? (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    required
                    label="Číslo pojištěnce"
                    value={form.healthInsuranceNumber}
                    onChange={(event) => handleInsuranceNumber(event.target.value)}
                    error={errors.healthInsuranceNumber !== undefined}
                    helperText={
                      errors.healthInsuranceNumber ??
                      (IDENTIFIER_KIND_LABEL[identifier.kind] || 'Devět nebo deset číslic z průkazu')
                    }
                    slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 10 } }}
                  />
                </Grid>

                {/* Only an insurer-assigned number is typed twice — the other
                    two kinds are checked against their own structure. */}
                {identifier.requiresConfirmation && (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      required
                      label="Číslo pojištěnce znovu"
                      value={form.healthInsuranceNumberConfirmation}
                      onChange={(event) =>
                        update('healthInsuranceNumberConfirmation', digitsOnly(event.target.value).slice(0, 10))
                      }
                      onPaste={(event) => event.preventDefault()}
                      error={errors.healthInsuranceNumberConfirmation !== undefined}
                      helperText={
                        errors.healthInsuranceNumberConfirmation ?? 'Kontrolní opis, vkládání je vypnuté'
                      }
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 10 } }}
                    />
                  </Grid>
                )}

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    required
                    label="Zdravotní pojišťovna"
                    value={form.healthInsurerCode}
                    onChange={(event) => update('healthInsurerCode', event.target.value)}
                    error={errors.healthInsurerCode !== undefined}
                    helperText={errors.healthInsurerCode ?? ' '}
                  >
                    {options.czechHealthInsurers.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.displayValue}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Rodné číslo"
                    value={form.birthNumber}
                    onChange={(event) => handleBirthNumber(event.target.value)}
                    error={errors.birthNumber !== undefined}
                    helperText={
                      errors.birthNumber ??
                      (identifier.kind === 'CzechBirthNumber'
                        ? 'Doplněno z čísla pojištěnce'
                        : 'Nepovinné; doplní datum narození a pohlaví')
                    }
                    slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 11 } }}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.insuranceCardInspected}
                        onChange={(event) => update('insuranceCardInspected', event.target.checked)}
                      />
                    }
                    label="Průkaz pojištěnce byl fyzicky zkontrolován"
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    required
                    label="Typ dokladu"
                    value={form.identityDocumentType}
                    onChange={(event) => update('identityDocumentType', event.target.value)}
                    error={errors.identityDocumentType !== undefined}
                    helperText={errors.identityDocumentType ?? ' '}
                  >
                    {options.identityDocumentTypes.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.displayValue}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    required
                    label="Stát vydání"
                    placeholder="SK"
                    value={form.identityDocumentIssuingCountryCode}
                    onChange={(event) =>
                      update(
                        'identityDocumentIssuingCountryCode',
                        event.target.value.toUpperCase().slice(0, 2),
                      )
                    }
                    error={errors.identityDocumentIssuingCountryCode !== undefined}
                    helperText={errors.identityDocumentIssuingCountryCode ?? 'ISO 3166-1, dvě písmena'}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    fullWidth
                    required
                    label="Číslo dokladu"
                    value={form.identityDocumentNumber}
                    onChange={(event) => update('identityDocumentNumber', event.target.value)}
                    error={errors.identityDocumentNumber !== undefined}
                    helperText={errors.identityDocumentNumber ?? ' '}
                  />
                </Grid>

                <Grid size={12}>
                  <Alert severity="info">
                    Bez českého čísla pojištěnce se rodné číslo ani číslo pojištěnce neevidují.
                  </Alert>
                </Grid>
              </>
            )}
          </Grid>
        )}

        {/* ── 2 — Residence ── */}
        {step === 2 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                select
                required
                label="Typ pobytu"
                value={form.residenceType}
                onChange={(event) =>
                  update('residenceType', event.target.value as RegistrationFormState['residenceType'])
                }
              >
                {RESIDENCE_TYPES.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.label}
                  </MenuItem>
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
        )}

        {/* ── 3 — Contact ── */}
        {step === 3 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                type="email"
                label="E-mail"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                error={errors.email !== undefined}
                helperText={errors.email ?? ' '}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                select
                required
                label="Země"
                value={form.phoneRegionCode}
                onChange={(event) => update('phoneRegionCode', event.target.value)}
                error={errors.phoneRegionCode !== undefined}
                helperText={errors.phoneRegionCode ?? ' '}
              >
                {options.phoneRegions.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.displayValue}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                required
                label="Telefon"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                error={errors.phone !== undefined}
                helperText={errors.phone ?? ' '}
              />
            </Grid>
          </Grid>
        )}

        {/* ── 4 — Summary ── */}
        {step === 4 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryBlock
                title="Totožnost"
                rows={[
                  ['Jméno', `${form.firstName} ${form.lastName}`.trim()],
                  ['Oslovení', form.preferredName || '—'],
                  [
                    'Tituly',
                    [...form.titlesBeforeName, ...form.titlesAfterName].join(', ') || '—',
                  ],
                  ['Datum narození', form.dateOfBirth || '—'],
                  [
                    'Pohlaví',
                    SEX_OPTIONS.find((option) => option.code === form.sex)?.label ?? '—',
                  ],
                  ['Režim', form.mode === 'Standard' ? 'Standardní' : 'Rychlá'],
                ]}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryBlock
                title="Pojištění"
                rows={
                  czechBranch
                    ? [
                        ['Evidence', 'České veřejné zdravotní pojištění'],
                        ['Číslo pojištěnce', maskInsuranceNumber(form.healthInsuranceNumber)],
                        [
                          'Pojišťovna',
                          options.czechHealthInsurers.find(
                            (option) => option.code === form.healthInsurerCode,
                          )?.displayValue ?? '—',
                        ],
                        ['Rodné číslo', maskBirthNumber(form.birthNumber)],
                        ['Průkaz zkontrolován', form.insuranceCardInspected ? 'ano' : 'ne'],
                      ]
                    : [
                        ['Evidence', 'Bez českého čísla pojištěnce'],
                        [
                          'Doklad',
                          options.identityDocumentTypes.find(
                            (option) => option.code === form.identityDocumentType,
                          )?.displayValue ?? '—',
                        ],
                        ['Stát vydání', form.identityDocumentIssuingCountryCode || '—'],
                        ['Číslo dokladu', form.identityDocumentNumber || '—'],
                      ]
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryBlock
                title="Bydliště"
                rows={[
                  [
                    'Typ pobytu',
                    RESIDENCE_TYPES.find((option) => option.code === form.residenceType)?.label ?? '—',
                  ],
                  ['Adresa', form.addressDisplay || '—'],
                  ['Kód RÚIAN', form.ruianAddressPointCode?.toString() ?? '—'],
                ]}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryBlock
                title="Kontakt"
                rows={[
                  ['E-mail', form.email || '—'],
                  ['Telefon', `${form.phone || '—'} (${form.phoneRegionCode})`],
                ]}
              />
            </Grid>

            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">
                Identifikátory jsou generovány pro tento pokus. Opakované odeslání stejných údajů
                registr rozpozná jako opakování, nezaloží druhého pacienta.
              </Typography>
            </Grid>
          </Grid>
        )}

        {/* ── Navigation ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={step === 0 ? () => navigate('/patients') : goBack}
            disabled={submitting}
          >
            {step === 0 ? 'Zpět na seznam' : 'Zpět'}
          </Button>

          {step < REGISTRATION_STEPS.length - 1 ? (
            <Button variant="contained" endIcon={<ArrowForward />} onClick={goNext}>
              Pokračovat
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
              onClick={submit}
              disabled={submitting}
            >
              Zaregistrovat pacienta
            </Button>
          )}
        </Box>
      </Paper>

      <CandidateReviewDialog
        open={review !== null}
        candidates={review?.candidates ?? []}
        submitting={submitting}
        onConfirmDistinct={() => review !== null && void send(review.confirmation)}
        onUseExisting={(candidate) => {
          setReview(null);
          navigate(`/patients/${candidate.patientId}`);
        }}
        onCancel={() => setReview(null)}
      />
    </Box>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}
