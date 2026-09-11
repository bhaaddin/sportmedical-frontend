/* ══════════════════════════════════════════════════════════════
   A1 — VEŘEJNÝ ONLINE DOTAZNÍK  (route: /dotaznik)

   Anonymous, no account, mobile-first, Czech. Five steps, then the
   A3 confirmation screen. Every field carries an example and a
   human-readable error; no technical codes ever reach the patient.

   Validation is delegated to services/publicIntake/validation, which
   mirrors the backend domain rules 1:1.
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import {
  CZECH_INSURERS,
  Sex,
  crossCheckBirthNumber,
  parseBirthNumber,
  validateDateOfBirth,
  validateEmail,
  validateInsuranceNumber,
  validateInsurerCode,
  validateName,
  validatePhone,
} from '../../services/publicIntake/validation';
import type { FieldError } from '../../services/publicIntake/validation';
import {
  IntakeError,
  IntakeOutcome,
  clearIdempotencyKey,
  submitIntake,
} from '../../api/publicIntake';
import type { IntakeInsurance, IntakeResponse } from '../../api/publicIntake';
import PublicAddressPicker from '../../components/public/PublicAddressPicker';
import type { AddressPoint } from '../../api/addressLookup';

/* ── Form state ── */

interface FormState {
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  sex: Sex | '';
  birthNumber: string;
  email: string;
  phoneRegion: string;
  phone: string;
  hasCzechInsurance: boolean;
  insuranceNumber: string;
  insurerCode: string;
  documentType: 'IdentityCard' | 'Passport';
  issuingCountry: string;
  documentNumber: string;
  consentTreatment: boolean;
  consentCommunication: boolean;
  consentClub: boolean;
  /** Honeypot — must stay empty. */
  websiteUrl: string;
}

const EMPTY_FORM: FormState = {
  givenName: '',
  familyName: '',
  dateOfBirth: '',
  sex: '',
  birthNumber: '',
  email: '',
  phoneRegion: 'CZ',
  phone: '',
  hasCzechInsurance: true,
  insuranceNumber: '',
  insurerCode: '',
  documentType: 'IdentityCard',
  issuingCountry: 'SK',
  documentNumber: '',
  consentTreatment: false,
  consentCommunication: false,
  consentClub: false,
  websiteUrl: '',
};

/* `address` is not in FormState - the picker holds the whole chosen point in
   its own state, not a string - but it still needs somewhere to report. */
type Errors = Partial<Record<keyof FormState | 'address', string>>;

const STEPS = ['Kdo jste', 'Kontakt', 'Pojištění', 'Souhlasy', 'Rekapitulace'];

const PHONE_REGIONS = [
  { code: 'CZ', label: 'Česko (+420)' },
  { code: 'SK', label: 'Slovensko (+421)' },
  { code: 'PL', label: 'Polsko (+48)' },
  { code: 'DE', label: 'Německo (+49)' },
  { code: 'AT', label: 'Rakousko (+43)' },
];

const collect = (errors: Errors, field: keyof FormState, result: { ok: boolean; error?: FieldError }): void => {
  if (!result.ok && result.error) errors[field] = result.error.message;
};

/* ══════════════════════════════════════════════════════════════ */

export default function IntakeQuestionnaire() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /*
   * Kept whole rather than as a bare code: the submission needs only
   * `addressPointCode`, but the screen has to show the patient which address
   * they picked, and re-deriving that from the number would mean asking the
   * register again for something it already said.
   */
  const [addressPoint, setAddressPoint] = useState<AddressPoint | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResponse | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  /* ── Per-step validation ── */

  const validateStep = (index: number): Errors => {
    const next: Errors = {};

    if (index === 0) {
      collect(next, 'givenName', validateName(form.givenName, 'given'));
      collect(next, 'familyName', validateName(form.familyName, 'family'));
      collect(next, 'dateOfBirth', validateDateOfBirth(form.dateOfBirth));
      if (form.sex === '') next.sex = 'Vyberte prosím pohlaví.';

      // Birth number is optional, but if supplied it must be valid and agree
      // with the declared date of birth and sex.
      if (form.birthNumber.trim().length > 0) {
        const parsed = parseBirthNumber(form.birthNumber);
        if (!parsed.ok) {
          next.birthNumber = parsed.error.message;
        } else if (next.dateOfBirth === undefined && form.sex !== '') {
          const cross = crossCheckBirthNumber(parsed.value, form.dateOfBirth, form.sex);
          if (!cross.ok) next.birthNumber = cross.error.message;
        }
      }
    }

    if (index === 1) {
      collect(next, 'email', validateEmail(form.email));
      collect(next, 'phone', validatePhone({ regionCode: form.phoneRegion, number: form.phone }));
      /* The API refuses the whole submission without it, so stop here rather
         than at the end with four steps to walk back through. */
      if (addressPoint === null) {
        next.address = 'Vyberte prosím adresu ze seznamu.';
      }
    }

    if (index === 2) {
      if (form.hasCzechInsurance) {
        collect(next, 'insuranceNumber', validateInsuranceNumber(form.insuranceNumber));
        collect(
          next,
          'insurerCode',
          validateInsurerCode(form.insurerCode === '' ? null : Number(form.insurerCode)),
        );
      } else {
        if (form.issuingCountry.trim().length !== 2) {
          next.issuingCountry = 'Vyberte prosím stát, který doklad vydal.';
        }
        if (form.documentNumber.trim().length < 4) {
          next.documentNumber = 'Zadejte prosím číslo dokladu.';
        }
      }
    }

    if (index === 3 && !form.consentTreatment) {
      next.consentTreatment = 'Bez souhlasu s poskytnutím zdravotních služeb nelze dotazník odeslat.';
    }

    return next;
  };

  const goNext = (): void => {
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((current) => current + 1);
  };

  const goBack = (): void => {
    setSubmitError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  /* ── Submit ── */

  const buildInsurance = (): IntakeInsurance =>
    form.hasCzechInsurance
      ? {
          kind: 'czech',
          insuranceNumber: validateInsuranceNumber(form.insuranceNumber).ok
            ? form.insuranceNumber.trim().replace(/\s|\//g, '')
            : form.insuranceNumber,
          insurerCode: Number(form.insurerCode),
        }
      : {
          kind: 'foreign',
          documentType: form.documentType,
          issuingCountry: form.issuingCountry.trim().toUpperCase(),
          documentNumber: form.documentNumber.trim(),
        };

  const handleSubmit = async (): Promise<void> => {
    // Re-run every step: the patient may have edited earlier answers.
    const all: Errors = {};
    for (let index = 0; index < 4; index += 1) Object.assign(all, validateStep(index));
    if (Object.keys(all).length > 0) {
      setErrors(all);
      setSubmitError('Některé údaje je potřeba opravit. Vraťte se prosím zpět a zkontrolujte je.');
      return;
    }

    const phone = validatePhone({ regionCode: form.phoneRegion, number: form.phone });
    if (!phone.ok) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await submitIntake({
        identity: {
          givenName: form.givenName.trim(),
          familyName: form.familyName.trim(),
          dateOfBirth: form.dateOfBirth,
          sex: form.sex === '' ? Sex.Male : form.sex,
          birthNumber:
            form.birthNumber.trim().length > 0
              ? form.birthNumber.trim().replace('/', '')
              : null,
        },
        contact: { email: form.email.trim(), phone: phone.value },
        address: { ruianAddressPointCode: addressPoint!.addressPointCode },
        insurance: buildInsurance(),
        consents: [
          { policyCode: 'treatment', granted: form.consentTreatment },
          { policyCode: 'communication', granted: form.consentCommunication },
          { policyCode: 'club', granted: form.consentClub },
        ],
        websiteUrl: form.websiteUrl,
      });

      clearIdempotencyKey();
      setResult(response);
    } catch (error) {
      if (error instanceof IntakeError) {
        const mapped: Errors = {};
        for (const fieldError of error.fieldErrors) {
          mapped[fieldError.field as keyof FormState] = fieldError.message;
        }
        if (Object.keys(mapped).length > 0) setErrors(mapped);
        setSubmitError(error.message);
      } else {
        setSubmitError('Odeslání se nezdařilo. Zkuste to prosím znovu.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── A3: confirmation ── */

  const insurerLabel = useMemo(
    () => CZECH_INSURERS.find((i) => i.code === Number(form.insurerCode)),
    [form.insurerCode],
  );

  if (result !== null) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
        <Paper sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, textAlign: 'center' }}>
          <CheckCircleOutlined sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Dotazník jsme přijali
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Číslo vaší žádosti
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1, mb: 3 }}
          >
            {result.referenceNumber}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Co bude dál
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {result.outcome === IntakeOutcome.CandidateReviewRequired
                ? 'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát. Ozveme se vám na uvedený e-mail.'
                : 'Vaše údaje máme uložené. Na uvedený e-mail vám pošleme potvrzení.'}
            </Typography>

            {result.manageToken !== null && (
              <Button
                fullWidth
                variant="outlined"
                href={`/book/manage/${result.manageToken}`}
                sx={{ mt: 1 }}
              >
                Správa rezervace — změna nebo zrušení termínu
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    );
  }

  /* ── Wizard ── */

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 5 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Dotazník před návštěvou
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vyplnění zabere přibližně 3 minuty. Nemusíte se nikam registrovat.
      </Typography>

      <Stepper
        activeStep={step}
        alternativeLabel
        sx={{ mb: 3, display: { xs: 'none', sm: 'flex' } }}
      >
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Krok {step + 1} z {STEPS.length} — {STEPS[step]}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={((step + 1) / STEPS.length) * 100}
          sx={{ mt: 0.5, borderRadius: 1 }}
        />
      </Box>

      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        {/* Honeypot — visually hidden, never focusable. */}
        <Box
          aria-hidden
          sx={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        >
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.websiteUrl}
            onChange={(event) => set('websiteUrl', event.target.value)}
          />
        </Box>

        {step === 0 && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              fullWidth
              label="Jméno"
              placeholder="Jan"
              value={form.givenName}
              onChange={(event) => set('givenName', event.target.value)}
              error={errors.givenName !== undefined}
              helperText={errors.givenName ?? 'Například Jan'}
            />
            <TextField
              fullWidth
              label="Příjmení"
              placeholder="Novák"
              value={form.familyName}
              onChange={(event) => set('familyName', event.target.value)}
              error={errors.familyName !== undefined}
              helperText={errors.familyName ?? 'Například Novák'}
            />
            <TextField
              fullWidth
              type="date"
              label="Datum narození"
              value={form.dateOfBirth}
              onChange={(event) => set('dateOfBirth', event.target.value)}
              error={errors.dateOfBirth !== undefined}
              helperText={errors.dateOfBirth ?? ' '}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl error={errors.sex !== undefined}>
              <FormLabel sx={{ fontSize: 14, mb: 0.5 }}>Pohlaví</FormLabel>
              <RadioGroup
                row
                value={form.sex}
                onChange={(event) => set('sex', event.target.value as Sex)}
              >
                <FormControlLabel value={Sex.Male} control={<Radio />} label="Muž" />
                <FormControlLabel value={Sex.Female} control={<Radio />} label="Žena" />
              </RadioGroup>
              {errors.sex !== undefined && (
                <Typography variant="caption" color="error">
                  {errors.sex}
                </Typography>
              )}
            </FormControl>
            <TextField
              fullWidth
              label="Rodné číslo (nepovinné)"
              placeholder="990101/1234"
              value={form.birthNumber}
              onChange={(event) => set('birthNumber', event.target.value)}
              error={errors.birthNumber !== undefined}
              helperText={
                errors.birthNumber ??
                'Nepovinné. Pomůže nám vás spolehlivě najít, pokud jste u nás už byli.'
              }
            />
          </Box>
        )}

        {step === 1 && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              fullWidth
              type="email"
              label="E-mail"
              placeholder="jan.novak@email.cz"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              error={errors.email !== undefined}
              helperText={errors.email ?? 'Pošleme na něj potvrzení rezervace.'}
            />
            <TextField
              select
              fullWidth
              label="Země telefonního čísla"
              value={form.phoneRegion}
              onChange={(event) => set('phoneRegion', event.target.value)}
            >
              {PHONE_REGIONS.map((region) => (
                <MenuItem key={region.code} value={region.code}>
                  {region.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Telefon"
              placeholder="601 234 567"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              error={errors.phone !== undefined}
              helperText={errors.phone ?? 'Například 601 234 567'}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Adresa trvalého pobytu
              </Typography>
              <PublicAddressPicker
                value={addressPoint}
                onChange={(point) => {
                  setAddressPoint(point);
                  if (point !== null) {
                    setErrors((previous) => ({ ...previous, address: undefined }));
                  }
                }}
                error={errors.address}
              />
            </Box>
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <FormControl>
              <FormLabel sx={{ fontSize: 14, mb: 0.5 }}>Zdravotní pojištění</FormLabel>
              <RadioGroup
                value={form.hasCzechInsurance ? 'cz' : 'foreign'}
                onChange={(event) => set('hasCzechInsurance', event.target.value === 'cz')}
              >
                <FormControlLabel
                  value="cz"
                  control={<Radio />}
                  label="Mám české číslo pojištěnce"
                />
                <FormControlLabel
                  value="foreign"
                  control={<Radio />}
                  label="Nemám české pojištění"
                />
              </RadioGroup>
            </FormControl>

            {form.hasCzechInsurance ? (
              <>
                <TextField
                  fullWidth
                  label="Číslo pojištěnce"
                  placeholder="9901011234"
                  value={form.insuranceNumber}
                  onChange={(event) => set('insuranceNumber', event.target.value)}
                  error={errors.insuranceNumber !== undefined}
                  helperText={errors.insuranceNumber ?? '9 nebo 10 číslic z kartičky pojištěnce.'}
                />
                <TextField
                  select
                  fullWidth
                  label="Zdravotní pojišťovna"
                  value={form.insurerCode}
                  onChange={(event) => set('insurerCode', event.target.value)}
                  error={errors.insurerCode !== undefined}
                  helperText={errors.insurerCode ?? ' '}
                >
                  {CZECH_INSURERS.map((insurer) => (
                    <MenuItem key={insurer.code} value={String(insurer.code)}>
                      {insurer.code} — {insurer.short} ({insurer.name})
                    </MenuItem>
                  ))}
                </TextField>
              </>
            ) : (
              <>
                <TextField
                  select
                  fullWidth
                  label="Typ dokladu"
                  value={form.documentType}
                  onChange={(event) =>
                    set('documentType', event.target.value as 'IdentityCard' | 'Passport')
                  }
                >
                  <MenuItem value="IdentityCard">Občanský průkaz</MenuItem>
                  <MenuItem value="Passport">Cestovní pas</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  label="Stát, který doklad vydal"
                  placeholder="SK"
                  value={form.issuingCountry}
                  onChange={(event) => set('issuingCountry', event.target.value.toUpperCase())}
                  error={errors.issuingCountry !== undefined}
                  helperText={errors.issuingCountry ?? 'Dvoupísmenný kód, například SK nebo DE.'}
                />
                <TextField
                  fullWidth
                  label="Číslo dokladu"
                  value={form.documentNumber}
                  onChange={(event) => set('documentNumber', event.target.value)}
                  error={errors.documentNumber !== undefined}
                  helperText={errors.documentNumber ?? ' '}
                />
              </>
            )}
          </Box>
        )}

        {step === 3 && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.consentTreatment}
                  onChange={(event) => set('consentTreatment', event.target.checked)}
                />
              }
              label="Souhlasím se zpracováním údajů o zdravotním stavu pro poskytnutí zdravotních služeb. (povinné)"
            />
            {errors.consentTreatment !== undefined && (
              <Typography variant="caption" color="error" sx={{ ml: 4 }}>
                {errors.consentTreatment}
              </Typography>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.consentCommunication}
                  onChange={(event) => set('consentCommunication', event.target.checked)}
                />
              }
              label="Souhlasím se zasíláním informací o termínech a novinkách. (nepovinné)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.consentClub}
                  onChange={(event) => set('consentClub', event.target.checked)}
                />
              }
              label="Souhlasím se sdílením výsledků s mým sportovním klubem. (nepovinné)"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Souhlas můžete kdykoli odvolat. Ukládáme u něj čas, verzi textu a účel.
            </Typography>
          </Box>
        )}

        {step === 4 && (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <SummaryRow label="Jméno" value={`${form.givenName} ${form.familyName}`} />
            <SummaryRow label="Datum narození" value={form.dateOfBirth} />
            <SummaryRow label="Pohlaví" value={form.sex === Sex.Female ? 'Žena' : 'Muž'} />
            {form.birthNumber.trim().length > 0 && (
              <SummaryRow label="Rodné číslo" value={form.birthNumber} />
            )}
            <SummaryRow label="E-mail" value={form.email} />
            <SummaryRow label="Telefon" value={form.phone} />
            {/* The one value the patient picked from a list rather than typed,
                so the recap is the only place they can check it was the right
                building before it becomes their registered address. */}
            {addressPoint !== null && (
              <SummaryRow label="Adresa" value={addressPoint.formattedAddress} />
            )}
            {form.hasCzechInsurance ? (
              <SummaryRow
                label="Pojištění"
                value={`${form.insuranceNumber} — ${insurerLabel?.short ?? form.insurerCode}`}
              />
            ) : (
              <SummaryRow
                label="Doklad"
                value={`${form.documentType === 'Passport' ? 'Pas' : 'OP'} ${form.documentNumber} (${form.issuingCountry})`}
              />
            )}
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Zkontrolujte prosím údaje. Zpět se můžete kdykoli vrátit tlačítkem níže.
            </Typography>
          </Box>
        )}

        {submitError !== null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
          {step > 0 && (
            <Button fullWidth variant="outlined" onClick={goBack} disabled={submitting}>
              Zpět
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button fullWidth variant="contained" onClick={goNext}>
              Pokračovat
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? 'Odesílám…' : 'Odeslat'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}
