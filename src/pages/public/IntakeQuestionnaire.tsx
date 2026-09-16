/* ══════════════════════════════════════════════════════════════
   A1 — VEŘEJNÝ ONLINE DOTAZNÍK  (route: /dotaznik)

   Anonymous, no account, mobile-first, Czech. Five steps, then the
   A3 confirmation screen. Every field carries an example and a
   human-readable error; no technical codes ever reach the patient.

   Validation is delegated to services/publicIntake/validation, which
   mirrors the backend domain rules 1:1.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
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
import {
  checkPublicEmail, checkPublicPhone, publicPhoneRegions,
} from '../../api/publicContactCheck';
import type { PublicPhoneRegion } from '../../api/publicContactCheck';
import {
  preferredCount, withPreferredFirst,
} from '../../services/patientRegistration/phoneRegions';
import type { EmailInspection, PhoneInspection } from '../../api/patientRegistry';
import {
  emailComplaint, worthInspectingEmail,
} from '../../services/patientRegistration/emailInspection';
import {
  groupedDisplay, phoneComplaint, phoneDisplayState, worthInspectingPhone,
} from '../../services/patientRegistration/phoneDisplay';
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

/*
 * The five countries this form used to offer, kept ONLY as what to fall back
 * on when the list cannot be fetched.
 *
 * They were the whole list until 16. 9. 2026, and a Hungarian could not
 * describe his number at all — he gave up and the clinic never heard about it.
 * The list now comes from `GET /api/public/contact-check/phone-regions`: 245
 * entries, the same source the desk uses, with the dialling code generated
 * from the numbering plan rather than typed here.
 *
 * These five stay because a form that cannot reach that endpoint must still be
 * fillable by the people who fill it most. They are a fallback, not the offer.
 */
const FALLBACK_PHONE_REGIONS: PublicPhoneRegion[] = [
  { code: 'CZ', displayValue: 'CZ (+420)' },
  { code: 'SK', displayValue: 'SK (+421)' },
  { code: 'PL', displayValue: 'PL (+48)' },
  { code: 'DE', displayValue: 'DE (+49)' },
  { code: 'AT', displayValue: 'AT (+43)' },
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

  /*
   * The e-mail, decided by the code that stores it.
   *
   * Asked when the field is LEFT, not while it is typed: `j`, `ja` and `jan@`
   * are each `parses: false`, and a box that is red through the whole first
   * word is one nobody reads by the time it means something.
   *
   * `emailAskedFor` is the value the answer belongs to — without it a verdict
   * about an address somebody has since corrected would keep the box red, or
   * worse, let a bad one through.
   */
  const [emailLook, setEmailLook] = useState<EmailInspection | null>(null);
  const [emailAskedFor, setEmailAskedFor] = useState('');

  const askAboutEmail = async (value: string): Promise<EmailInspection | null> => {
    if (!worthInspectingEmail(value)) {
      setEmailLook(null);
      setEmailAskedFor('');
      return null;
    }
    try {
      const verdict = await checkPublicEmail(value);
      setEmailLook(verdict);
      setEmailAskedFor(value);
      return verdict;
    } catch {
      /* The submission goes to the same server. If it cannot be reached to
         ask, it cannot be reached to book either, and it will say so — a
         guess here is what this change removed. */
      setEmailLook(null);
      setEmailAskedFor('');
      return null;
    }
  };

  const emailAnswer = form.email === emailAskedFor ? emailLook : null;
  const emailSays = emailComplaint(emailAnswer);

  /*
   * The telephone, on the same libphonenumber the desk uses.
   *
   * Asked WHILE it is typed, unlike the e-mail: a half-typed number still
   * comes back grouped and useful, so the patient sees `777 777 777` forming
   * as they go. The complaint waits until it is long enough to be finished —
   * a red border on every second keystroke is one nobody reads by the time it
   * means something.
   */
  /* CZ and SK first with a line under them, then the server's own order —
     the same arrangement as the desk, which is what the owner asked for. */
  const [regions, setRegions] = useState<PublicPhoneRegion[]>(FALLBACK_PHONE_REGIONS);

  useEffect(() => {
    let cancelled = false;
    publicPhoneRegions()
      .then((list) => { if (!cancelled && list.length > 0) setRegions(list); })
      .catch(() => { /* the five stay */ });
    return () => { cancelled = true; };
  }, []);

  const phoneRegions = useMemo(() => withPreferredFirst(regions), [regions]);
  const preferredRegions = useMemo(() => preferredCount(regions), [regions]);

  const [phoneLook, setPhoneLook] = useState<PhoneInspection | null>(null);

  useEffect(() => {
    if (!worthInspectingPhone(form.phone) || form.phoneRegion === '') {
      setPhoneLook(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      checkPublicPhone(form.phone, form.phoneRegion)
        .then((result) => { if (!cancelled) setPhoneLook(result); })
        .catch(() => { if (!cancelled) setPhoneLook(null); });
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.phone, form.phoneRegion]);

  const phoneState = phoneDisplayState(phoneLook, form.phone);
  const phoneGrouped = groupedDisplay(phoneLook);
  const phoneSays = phoneComplaint(phoneState, form.phoneRegion);

  /* The number as the registry will store it — the server's `e164`, never one
     assembled here. Asked again at the moment of sending. */
  const askAboutPhone = async (): Promise<PhoneInspection | null> => {
    /*
     * Always asked, unlike the version beside the keystrokes.
     *
     * This used to return `null` without asking when the box held fewer than
     * three digits, and `null` also means "could not reach the server" — so
     * `nevím` in the telephone box walked straight through the step. The
     * server reads that as `parses: false`; it only had to be asked.
     */
    try {
      const verdict = await checkPublicPhone(form.phone, form.phoneRegion);
      setPhoneLook(verdict);
      return verdict;
    } catch {
      return null;
    }
  };

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

  /*
   * Why a number was refused, and never an empty sentence.
   *
   * `phoneComplaint` deliberately says nothing while somebody is mid-number —
   * that is its job beside the keystrokes. Here it is the reason a step will
   * not advance, and a step that refuses to advance while saying nothing is
   * worse than one that complains: the patient has no idea what to change.
   */
  const phoneRefusal = (state: string, regionCode: string): string => {
    const said = phoneComplaint(
      state === 'typing' || state === 'idle' ? 'wrong-region' : (state as 'unreadable' | 'wrong-region'),
      regionCode,
    );
    return said !== '' ? said : 'Telefonní číslo nevypadá správně. Například 601 234 567.';
  };

  /*
   * Moving on from the contact step puts the address to the server first.
   *
   * It is asked again here rather than trusted from the field, because
   * somebody can paste into the box and press the button without ever leaving
   * it — and that is the path that must not go through.
   */
  const goNext = async (): Promise<void> => {
    const found = validateStep(step);

    if (step === 1 && found.phone === undefined) {
      const verdict = await askAboutPhone();
      /* `null` is unreachable, not invalid: the submission goes to the same
         server and will refuse it there rather than this form guessing. */
      if (verdict !== null) {
        const state = phoneDisplayState(verdict, form.phone);
        if (state !== 'valid') found.phone = phoneRefusal(state, form.phoneRegion);
      }
    }

    if (step === 1 && found.email === undefined) {
      const verdict = await askAboutEmail(form.email);
      /* `null` means unreachable, not invalid: the booking goes to the same
         server and will refuse it there rather than this form inventing a
         reason. */
      if (verdict !== null && !verdict.parses) {
        found.email = emailComplaint(verdict);
      }
    }

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

    /*
     * The number that is SENT is the server's `e164`, never one assembled
     * here. The old code built it by string concatenation — `777777777` + CZ
     * became `+420777777777` — which is a fourth definition of a telephone
     * number in a codebase that spent today deleting three.
     */
    const inspected = await askAboutPhone();
    const phoneVerdict = inspected === null
      ? 'unreadable'
      : phoneDisplayState(inspected, form.phone);

    if (inspected === null || phoneVerdict !== 'valid' || inspected.e164 === '') {
      setErrors((previous) => ({
        ...previous,
        phone: phoneRefusal(phoneVerdict, form.phoneRegion),
      }));
      setSubmitError('Některé údaje je potřeba opravit. Vraťte se prosím zpět a zkontrolujte je.');
      return;
    }
    const phone = { value: inspected.e164 };

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
        {/*
          The bot trap. A non-empty value makes the server discard the
          submission - and hand back a plausible-looking reference number - so
          anything that fills this field silently loses a real patient who
          believes they registered.
 
          Given that cost, the field is named for nothing a browser autofills.
          `website`, `url`, `company` and the rest are exactly what heuristic
          autofill reaches for; `hp-leave-blank` is not a field any browser has
          a value for. `autoComplete="off"` alone is advisory and browsers
          ignore it when they think they know better.
 
          Positioned off-screen rather than `display: none`, because a trap a
          bot can detect is a trap that catches nothing.
 
          Worth recording how this was investigated, since it nearly became the
          wrong fix: a submission really was discarded here, and the first
          explanation offered was browser autofill. It was not. This field is
          the FIRST input in the DOM, and a test harness had written into
          `document.querySelectorAll('input')[0]` - the trap - believing it was
          the given-name box. The cause was the measuring, not the browser. The
          hardening below stands on its own merits, not on that incident.
        */}
        <Box
          aria-hidden
          sx={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        >
          <input
            name="hp-leave-blank"
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
              onBlur={() => { void askAboutEmail(form.email); }}
              error={errors.email !== undefined || emailSays !== ''}
              helperText={
                errors.email
                ?? (emailSays !== '' ? emailSays : 'Pošleme na něj potvrzení rezervace.')
              }
            />
            <TextField
              select
              fullWidth
              label="Země telefonního čísla"
              value={form.phoneRegion}
              onChange={(event) => set('phoneRegion', event.target.value)}
            >
              {phoneRegions.map((region, index) => [
                /* A line under the common ones, never above the first row. */
                index === preferredRegions && preferredRegions > 0
                  ? <Divider key="preferred-divider" />
                  : null,
                <MenuItem key={region.code} value={region.code}>
                  {region.displayValue}
                </MenuItem>,
              ])}
            </TextField>
            <TextField
              fullWidth
              label="Telefon"
              placeholder="601 234 567"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              error={errors.phone !== undefined || phoneState === 'unreadable'}
              /* Grouped as it is typed, complained about only once it is long
                 enough to be finished and still does not fit the country. */
              helperText={
                errors.phone
                ?? (phoneSays !== '' ? phoneSays : undefined)
                ?? (phoneGrouped !== '' ? phoneGrouped : 'Například 601 234 567')
              }
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
            <SummaryRow label="Telefon" value={phoneGrouped !== '' ? phoneGrouped : form.phone} />
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
            <Button fullWidth variant="contained" onClick={() => { void goNext(); }}>
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
