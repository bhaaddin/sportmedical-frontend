/* ══════════════════════════════════════════════════════════════
   A1 — VEŘEJNÝ ONLINE DOTAZNÍK  (route: /dotaznik)

   Anonymous, no account, mobile-first, Czech. ONE page, then the A3
   confirmation screen. Every field carries an example and a
   human-readable error; no technical codes ever reach the patient.

   It was a five-step wizard until 18. 9. 2026. The owner stopped it
   looking at his own screen: "this must be in one page no clickss",
   and before that "vsechno dat dohromady misto toho aby to bylo
   rozdelene na 5 fazi tak na jedno fazy ... potrebujem aby
   registrace trvala pod minutou".

   ── Why this page does not look like the rest of the app ──

   Everything behind the login is the staff application and wears the
   teal in theme.ts. This is the ONE screen a patient ever sees, and
   the clinic they think they are dealing with is the one at
   sportmedical-diagnostics.cz: near-black, a single orange accent,
   Inter. So the brand here is taken from that site and scoped to
   this page by a local ThemeProvider. The staff theme is untouched.

   Measured off the live site on 18. 9. 2026 rather than guessed:
   accent rgb(255,157,0), ink rgb(17,17,17), Inter throughout, pill
   and 20px radii. If the site is redesigned, BRAND below is the one
   place that has to move.

   Validation is delegated to services/publicIntake/validation, which
   mirrors the backend domain rules 1:1.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { Collapse } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  AutoAwesomeOutlined,
  CheckCircleOutlined,
  ExpandLessOutlined,
  ExpandMoreOutlined,
  GavelOutlined,
  OpenInNewOutlined,
  LockOutlined,
  ScheduleOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
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
import type { FieldError, ParsedBirthNumber } from '../../services/publicIntake/validation';
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
import HealthQuestionnaire from '../../components/public/HealthQuestionnaire';
import type { AddressPoint } from '../../api/addressLookup';

/* ── Brand, taken from sportmedical-diagnostics.cz ── */

const BRAND = {
  ink: '#0B0B0C',
  inkSoft: '#17171A',
  accent: '#FF9D00',
  accentDark: '#E08A00',
  accentWash: 'rgba(255, 157, 0, 0.09)',
  accentEdge: 'rgba(255, 157, 0, 0.32)',
  page: '#F4F4F6',
  line: '#E5E5E9',
  muted: 'rgba(17, 17, 17, 0.58)',
};

const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/*
 * Scoped to this page. The orange is the accent of a brand, not a semantic
 * colour, so it is `primary` here only — an error is still red and a success
 * is still green, because a patient reading a refusal must not have to learn
 * a palette first.
 */
const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: BRAND.muted },
    divider: BRAND.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: INTER,
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 800, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          '& fieldset': { borderColor: BRAND.line },
          '&:hover fieldset': { borderColor: 'rgba(17,17,17,0.28)' },
          '&.Mui-focused fieldset': { borderWidth: 2, borderColor: BRAND.accent },
        },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginTop: 6 } } },
  },
});

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
  consentReportEmail: boolean;
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
  consentReportEmail: false,
  websiteUrl: '',
};

/*
 * Which fields the birth number filled in.
 *
 * It exists so the smart fill can CORRECT itself — somebody mistypes a digit,
 * fixes it, and the date moves with it — without ever overwriting something
 * the patient typed by hand. A field the patient owns stays theirs, and a
 * disagreement between it and the birth number is then a real contradiction
 * worth reporting rather than something this code quietly papered over.
 */
interface Derived {
  dateOfBirth: boolean;
  sex: boolean;
  insuranceNumber: boolean;
}

const NOTHING_DERIVED: Derived = {
  dateOfBirth: false,
  sex: false,
  insuranceNumber: false,
};

/* `address` is not in FormState - the picker holds the whole chosen point in
   its own state, not a string - but it still needs somewhere to report. */
type Errors = Partial<Record<keyof FormState | 'address', string>>;

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

const czechDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return year === undefined || month === undefined || day === undefined
    ? iso
    : `${Number(day)}. ${Number(month)}. ${year}`;
};

/* ══════════════════════════════════════════════════════════════ */

export default function IntakeQuestionnaire() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [derived, setDerived] = useState<Derived>(NOTHING_DERIVED);
  /* The health questionnaire starts closed. It is ~76 questions and it is
     optional today; opening it by default would turn a one-minute
     registration into a page nobody scrolls to the bottom of. */
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
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
     * `nevím` in the telephone box walked straight through. The server reads
     * that as `parses: false`; it only had to be asked.
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

  /* ── The smart fill ── */

  /*
   * A Czech birth number already contains the date of birth and the sex, and
   * for a Czech insuree it is also what the insurance card carries. The parser
   * next door has returned all three the whole time; nothing ever read them
   * except to complain that what the patient typed disagreed.
   *
   * So this is not new knowledge, it is knowledge that was being thrown away:
   * three fields the patient no longer types, including the date picker, which
   * is the slowest control on the page.
   *
   * Hand-typed values are never overwritten — see `Derived`. The number stays
   * OPTIONAL: leave it empty and the three fields are yours to fill as before.
   */
  const fillFromBirthNumber = (raw: string): void => {
    const parsed = parseBirthNumber(raw);

    setForm((previous) => {
      const next: FormState = { ...previous, birthNumber: raw };
      if (!parsed.ok) return next;

      const found: ParsedBirthNumber = parsed.value;

      if (previous.dateOfBirth === '' || derived.dateOfBirth) {
        next.dateOfBirth = found.dateOfBirth;
      }
      if (previous.sex === '' || derived.sex) {
        next.sex = found.sex;
      }
      /* Only for a Czech insuree, and only into an empty or previously
         derived box: the card number and the birth number coincide by rule,
         not by definition, and somebody whose card says otherwise must win. */
      if (previous.hasCzechInsurance
        && (previous.insuranceNumber === '' || derived.insuranceNumber)) {
        next.insuranceNumber = found.canonicalValue;
      }

      return next;
    });

    if (parsed.ok) {
      setDerived((previous) => ({
        dateOfBirth: previous.dateOfBirth || form.dateOfBirth === '',
        sex: previous.sex || form.sex === '',
        insuranceNumber: previous.insuranceNumber || form.insuranceNumber === '',
      }));
      setErrors((previous) => ({
        ...previous,
        birthNumber: undefined,
        dateOfBirth: undefined,
        sex: undefined,
      }));
    } else {
      setErrors((previous) => ({ ...previous, birthNumber: undefined }));
    }
  };

  /* What the number said, for the line under the field. Recomputed rather than
     stored, so it can never describe a number that is no longer in the box. */
  const birthNumberSays = useMemo(() => {
    if (form.birthNumber.trim().length === 0) return null;
    const parsed = parseBirthNumber(form.birthNumber);
    return parsed.ok ? parsed.value : null;
  }, [form.birthNumber]);

  /*
   * Under 18 on the day they read this.
   *
   * Only ever used to OFFER a document, never to refuse anything, so an empty or
   * half-typed date simply means the row stays hidden. It is deliberately not
   * measured against an appointment date: there is no appointment yet, and a
   * child who turns 18 next week still needs the form if they come tomorrow.
   */
  const isMinor = useMemo(() => {
    if (form.dateOfBirth === '') return false;
    const born = new Date(form.dateOfBirth);
    if (Number.isNaN(born.getTime())) return false;
    const eighteenth = new Date(born.getFullYear() + 18, born.getMonth(), born.getDate());
    return eighteenth > new Date();
  }, [form.dateOfBirth]);

  /* ── Validation ── */

  /*
   * One page means one validation. It used to run per step, which is why a
   * birth number contradicting the date of birth was reported on a step the
   * patient had already left.
   */
  const validateEverything = (): Errors => {
    const next: Errors = {};

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

    collect(next, 'email', validateEmail(form.email));
    collect(next, 'phone', validatePhone({ regionCode: form.phoneRegion, number: form.phone }));
    /* The API refuses the whole submission without it. */
    if (addressPoint === null) {
      next.address = 'Vyberte prosím adresu ze seznamu.';
    }

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

    if (!form.consentTreatment) {
      next.consentTreatment = 'Bez souhlasu s poskytnutím zdravotních služeb nelze dotazník odeslat.';
    }

    return next;
  };

  /*
   * Why a number was refused, and never an empty sentence.
   *
   * `phoneComplaint` deliberately says nothing while somebody is mid-number —
   * that is its job beside the keystrokes. Here it is the reason the form will
   * not send, and refusing to send while saying nothing is worse than
   * complaining: the patient has no idea what to change.
   */
  const phoneRefusal = (state: string, regionCode: string): string => {
    const said = phoneComplaint(
      state === 'typing' || state === 'idle' ? 'wrong-region' : (state as 'unreadable' | 'wrong-region'),
      regionCode,
    );
    return said !== '' ? said : 'Telefonní číslo nevypadá správně. Například 601 234 567.';
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
    const all = validateEverything();
    if (Object.keys(all).length > 0) {
      setErrors(all);
      setSubmitError('Některé údaje je potřeba opravit. Jsou označené níže.');
      return;
    }

    /*
     * The e-mail is put to the server here as well as on blur.
     *
     * The wizard asked it when leaving the contact step, and somebody can
     * paste into the box and press Odeslat without ever leaving it — the
     * exact path that must not go through unasked.
     */
    const emailVerdict = await askAboutEmail(form.email);
    if (emailVerdict !== null && !emailVerdict.parses) {
      setErrors((previous) => ({ ...previous, email: emailComplaint(emailVerdict) }));
      setSubmitError('Některé údaje je potřeba opravit. Jsou označené níže.');
      return;
    }

    /*
     * The number that is SENT is the server's `e164`, never one assembled
     * here. The old code built it by string concatenation — `777777777` + CZ
     * became `+420777777777` — which is a fourth definition of a telephone
     * number in a codebase that spent that day deleting three.
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
      setSubmitError('Některé údaje je potřeba opravit. Jsou označené níže.');
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
          /* New on 18. 9. 2026. The server requires only `treatment` and
             stores whatever else it is handed, so this records a real
             choice today and does not wait on a contract change. */
          { policyCode: 'report_email', granted: form.consentReportEmail },
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

  if (result !== null) {
    return (
      <ThemeProvider theme={publicTheme}>
        <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page }}>
          <Hero compact />
          <Container maxWidth="sm" sx={{ mt: -7, pb: 8 }}>
            <Card sx={{ textAlign: 'center' }}>
              <CheckCircleOutlined sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
              <Typography variant="h5" sx={{ mb: 1 }}>
                Dotazník jsme přijali
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted, mb: 3 }}>
                Číslo vaší žádosti
              </Typography>
              <Box
                sx={{
                  display: 'inline-block',
                  px: 3,
                  py: 1.5,
                  borderRadius: 999,
                  bgcolor: BRAND.accentWash,
                  border: `1px solid ${BRAND.accentEdge}`,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: 800,
                  fontSize: 24,
                  letterSpacing: 1,
                  mb: 3,
                }}
              >
                {result.referenceNumber}
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Co bude dál
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2 }}>
                  {result.outcome === IntakeOutcome.CandidateReviewRequired
                    ? 'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát. Ozveme se vám na uvedený e-mail.'
                    : 'Vaše údaje máme uložené. Na uvedený e-mail vám pošleme potvrzení.'}
                </Typography>

                {result.manageToken !== null && (
                  <Button
                    fullWidth
                    variant="outlined"
                    href={`/book/manage/${result.manageToken}`}
                    sx={{ mt: 1, borderRadius: 999, py: 1.25 }}
                  >
                    Správa rezervace — změna nebo zrušení termínu
                  </Button>
                )}
              </Box>
            </Card>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  /* ── The page ── */

  /*
   * Two columns on a wide screen, one on a narrow one.
   *
   * It was a single 600px column down the middle of a 1920px monitor until
   * 18. 9. 2026 — "dont make it centrel make it for the whole page". The
   * column was not only wasteful, it was the reason the form looked long: four
   * sections stacked into one strip means the patient scrolls past three of
   * them to reach the end, and a form you cannot see the end of feels like one
   * that has no end.
   *
   * Side by side, the whole thing is visible at once on a laptop, which is the
   * same argument that killed the wizard.
   */
  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page, pb: { xs: 6, md: 10 } }}>
        {/*
          Printing gives you the questionnaire and nothing else.

          The clinic's flow today is "fill it in at home and bring it", so the
          print has to be the document, not a screenshot of a web page with a
          registration form and a hero banner around it. Everything outside
          `.smd-questionnaire` is hidden, the block is pulled to the top of the
          sheet, and colours are forced through so the answered rows are still
          distinguishable on paper.
        */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .smd-questionnaire, .smd-questionnaire * { visibility: visible !important; }
            .smd-questionnaire { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
            .smd-no-print, .smd-no-print * { display: none !important; }
            .smd-questionnaire { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
        <Hero />

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
          hardening stands on its own merits, not on that incident.
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

        <Container maxWidth="lg" sx={{ mt: { xs: -7, md: -8 } }}>
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
            }}
          >
            {/* ── Left column ── */}
            <Box sx={{ display: 'grid', gap: 3 }}>
              <Card>
                <Section number={1} title="Kdo jste" />

                <Box sx={{ display: 'grid', gap: 2 }}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField
                      label="Jméno"
                      placeholder="Jan"
                      autoComplete="given-name"
                      value={form.givenName}
                      onChange={(event) => set('givenName', event.target.value)}
                      error={errors.givenName !== undefined}
                      helperText={errors.givenName ?? ' '}
                    />
                    <TextField
                      label="Příjmení"
                      placeholder="Novák"
                      autoComplete="family-name"
                      value={form.familyName}
                      onChange={(event) => set('familyName', event.target.value)}
                      error={errors.familyName !== undefined}
                      helperText={errors.familyName ?? ' '}
                    />
                  </Box>

                  {/*
                    The accelerator, and it is drawn like one.

                    A Czech birth number fills in the three fields below it, so
                    it belongs above them and it belongs looking different from
                    them — a patient who does not read the helper text should
                    still be able to tell that this box is the one that saves
                    them work. It sat at the BOTTOM of step 1 until 18. 9. 2026,
                    under the word "nepovinné", where it read like an
                    afterthought.

                    `autoComplete="off"` here is on purpose and not an
                    oversight: this is the one value on the page no browser
                    should keep, and unlike the honeypot there is nothing
                    cleverer to be done about it than asking.
                  */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: BRAND.accentWash,
                      border: `1px solid ${BRAND.accentEdge}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <AutoAwesomeOutlined sx={{ fontSize: 18, color: BRAND.accentDark }} />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, letterSpacing: 0.8, color: BRAND.accentDark }}
                      >
                        VYPLNÍ TŘI POLE ZA VÁS
                      </Typography>
                    </Box>

                    <TextField
                      label="Rodné číslo"
                      placeholder="990101/1234"
                      autoComplete="off"
                      inputMode="numeric"
                      value={form.birthNumber}
                      onChange={(event) => fillFromBirthNumber(event.target.value)}
                      error={errors.birthNumber !== undefined}
                      helperText={
                        errors.birthNumber
                        ?? 'Nepovinné. Doplní datum narození, pohlaví i číslo pojištěnce.'
                      }
                    />

                    {birthNumberSays !== null && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={czechDate(birthNumberSays.dateOfBirth)}
                          sx={{ fontWeight: 700, bgcolor: '#FFFFFF', border: `1px solid ${BRAND.accentEdge}` }}
                        />
                        <Chip
                          size="small"
                          label={birthNumberSays.sex === Sex.Female ? 'žena' : 'muž'}
                          sx={{ fontWeight: 700, bgcolor: '#FFFFFF', border: `1px solid ${BRAND.accentEdge}` }}
                        />
                        <Typography variant="caption" sx={{ color: BRAND.muted }}>
                          doplněno — níže můžete přepsat
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField
                      type="date"
                      label="Datum narození"
                      autoComplete="bday"
                      value={form.dateOfBirth}
                      onChange={(event) => {
                        set('dateOfBirth', event.target.value);
                        /* Typed by hand from here on, so the birth number
                           stops moving it. */
                        setDerived((previous) => ({ ...previous, dateOfBirth: false }));
                      }}
                      error={errors.dateOfBirth !== undefined}
                      helperText={errors.dateOfBirth ?? ' '}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <FormControl error={errors.sex !== undefined}>
                      <FormLabel sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Pohlaví</FormLabel>
                      <RadioGroup
                        row
                        value={form.sex}
                        onChange={(event) => {
                          set('sex', event.target.value as Sex);
                          setDerived((previous) => ({ ...previous, sex: false }));
                        }}
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
                  </Box>
                </Box>
              </Card>

              <Card>
                <Section number={2} title="Kontakt" />

                <Box sx={{ display: 'grid', gap: 2 }}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 170px 1fr' } }}>
                    <TextField
                      type="email"
                      label="E-mail"
                      placeholder="jan.novak@email.cz"
                      autoComplete="email"
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
                      label="Země"
                      value={form.phoneRegion}
                      onChange={(event) => set('phoneRegion', event.target.value)}
                      helperText=" "
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
                      label="Telefon"
                      placeholder="601 234 567"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(event) => set('phone', event.target.value)}
                      error={errors.phone !== undefined || phoneState === 'unreadable'}
                      /* Grouped as it is typed, complained about only once it
                         is long enough to be finished and still does not fit. */
                      helperText={
                        errors.phone
                        ?? (phoneSays !== '' ? phoneSays : undefined)
                        ?? (phoneGrouped !== '' ? phoneGrouped : 'Například 601 234 567')
                      }
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
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
              </Card>
              <Card>
                <Section number={3} title="Dokumenty před návštěvou" />

                {/*
                  What the clinic actually asks people to bring, read off its own
                  page on 18. 9. 2026 rather than from anyone's memory of it.

                  Filling them in here is not built yet — the questionnaire alone
                  is 76 answers and the model cannot yet carry its sections,
                  its "show only if" rules or its family table. Until it can, the
                  honest thing is to say plainly which documents exist, when each
                  is wanted, and to hand over the real file. A patient who reads
                  this before they travel is better off than one who finds out at
                  reception, which is the whole point of the page.

                  Each row says WHEN it applies, because the clinic's rules differ
                  per document and getting that wrong is what wastes the visit.
                */}
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  <DocumentRow
                    title="Výpis ze zdravotní dokumentace"
                    when="Přineste s sebou — pokaždé"
                    detail="Od praktického lékaře nebo pediatra. Bez něj nelze vystavit posudek o zdravotní způsobilosti. Při opakované návštěvě stačí, když lékař potvrdí, že se váš stav nezměnil."
                    href="https://sportmedical-diagnostics.cz/pages/dokumenty-ke-stazeni"
                    linkLabel="Podrobnosti"
                    emphasis
                  />
                  {/*
                    The one document that is filled in HERE rather than linked.

                    It opens in place, which is what the owner asked for in as
                    many words: "on clinken na to on se mu otevre cely". Closed
                    to begin with, because it is long and optional, and because
                    a page that opens with 76 questions on it is a page whose
                    first section nobody reads.
                  */}
                  <Box
                    sx={{
                      p: 1.75,
                      borderRadius: 3,
                      border: `1px solid ${questionnaireOpen ? BRAND.accentEdge : BRAND.line}`,
                      bgcolor: questionnaireOpen ? BRAND.accentWash : 'transparent',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>
                        Zdravotní dotazník
                      </Typography>
                      <Chip
                        size="small"
                        label="Vyplňte před každým vyšetřením"
                        sx={{
                          height: 19,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: 'transparent',
                          color: BRAND.muted,
                          border: `1px solid ${BRAND.line}`,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: BRAND.muted }}>
                      Vyplňte ho rovnou tady. Zrychlíte tím průběh vyšetření
                      a nemusíte nic tisknout předem.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      <Button
                        size="small"
                        variant={questionnaireOpen ? 'text' : 'contained'}
                        disableElevation
                        onClick={() => setQuestionnaireOpen((open) => !open)}
                        endIcon={questionnaireOpen
                          ? <ExpandLessOutlined sx={{ fontSize: 16 }} />
                          : <ExpandMoreOutlined sx={{ fontSize: 16 }} />}
                        sx={{
                          borderRadius: 999,
                          px: 2,
                          color: questionnaireOpen ? BRAND.accentDark : BRAND.ink,
                        }}
                      >
                        {questionnaireOpen ? 'Sbalit dotazník' : 'Vyplnit dotazník'}
                      </Button>
                      <Button
                        href="https://cdn.shopify.com/s/files/1/0913/0799/9614/files/zdravotni_dotaznik.pdf?v=1780561779"
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        endIcon={<OpenInNewOutlined sx={{ fontSize: 14 }} />}
                        sx={{ color: BRAND.muted }}
                      >
                        Radši papírově
                      </Button>
                    </Box>

                    <Collapse in={questionnaireOpen} unmountOnExit={false} mountOnEnter>
                      <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${BRAND.accentEdge}` }}>
                        {/* `female` comes from the registration form above — from
                            the birth number, usually — so the gynaecological
                            section appears or does not without anybody being
                            asked a second time. */}
                        <HealthQuestionnaire
                          female={form.sex === Sex.Female}
                          palette={{
                            ink: BRAND.ink,
                            accent: BRAND.accent,
                            accentDark: BRAND.accentDark,
                            accentWash: BRAND.accentWash,
                            accentEdge: BRAND.accentEdge,
                            line: BRAND.line,
                            muted: BRAND.muted,
                          }}
                        />
                      </Box>
                    </Collapse>
                  </Box>
                  <DocumentRow
                    title="Souhlas se zpracováním údajů (GDPR)"
                    when="Jen při první návštěvě"
                    detail="Při dalších vyšetřeních už jej znovu vyplňovat nemusíte, pokud se nezmění údaje ani účel zpracování."
                    href="https://cdn.shopify.com/s/files/1/0913/0799/9614/files/GDPR_final.pdf?v=1780561628"
                    linkLabel="Otevřít formulář"
                  />
                  {/* Only for a minor. The age comes from the date of birth, which
                      the birth number has usually already filled in — so this row
                      appears by itself, without anybody being asked their age. */}
                  {isMinor && (
                    <DocumentRow
                      title="Souhlas zákonného zástupce"
                      when="Jen když nezletilý přijde bez doprovodu"
                      detail="Podle data narození je klient mladší 18 let. Pokud přijde v doprovodu zákonného zástupce, tento formulář nepotřebujete."
                      href="https://cdn.shopify.com/s/files/1/0913/0799/9614/files/Souhlas_zakonneho_zastupce_3ff9ec9a-fe46-4e0f-8fd0-2fae5adce636.pdf?v=1780561681"
                      linkLabel="Otevřít formulář"
                    />
                  )}
                </Box>

                <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2 }}>
                  Souhlasy zatím vyplňujete na papíru a nosíte s sebou.
                  Připravujeme, aby se daly vyplnit rovnou tady.
                </Typography>
              </Card>
            </Box>

            {/* ── Right column ── */}
            <Box sx={{ display: 'grid', gap: 3, position: { md: 'sticky' }, top: { md: 24 } }}>
              <Card>
                <Section number={4} title="Pojištění" />

                <Box sx={{ display: 'grid', gap: 2 }}>
                  <FormControl>
                    <RadioGroup
                      row
                      value={form.hasCzechInsurance ? 'cz' : 'foreign'}
                      onChange={(event) => set('hasCzechInsurance', event.target.value === 'cz')}
                    >
                      <FormControlLabel value="cz" control={<Radio />} label="Mám české pojištění" />
                      <FormControlLabel value="foreign" control={<Radio />} label="Nemám české pojištění" />
                    </RadioGroup>
                  </FormControl>

                  {form.hasCzechInsurance ? (
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                      <TextField
                        label="Číslo pojištěnce"
                        placeholder="9901011234"
                        autoComplete="off"
                        inputMode="numeric"
                        value={form.insuranceNumber}
                        onChange={(event) => {
                          set('insuranceNumber', event.target.value);
                          setDerived((previous) => ({ ...previous, insuranceNumber: false }));
                        }}
                        error={errors.insuranceNumber !== undefined}
                        helperText={
                          errors.insuranceNumber
                          ?? (derived.insuranceNumber && form.insuranceNumber !== ''
                            ? 'Doplněno z rodného čísla.'
                            : '9 nebo 10 číslic z kartičky.')
                        }
                      />
                      <TextField
                        select
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
                    </Box>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        <TextField
                          select
                          label="Typ dokladu"
                          value={form.documentType}
                          onChange={(event) =>
                            set('documentType', event.target.value as 'IdentityCard' | 'Passport')
                          }
                          helperText=" "
                        >
                          <MenuItem value="IdentityCard">Občanský průkaz</MenuItem>
                          <MenuItem value="Passport">Cestovní pas</MenuItem>
                        </TextField>
                        <TextField
                          label="Stát, který doklad vydal"
                          placeholder="SK"
                          value={form.issuingCountry}
                          onChange={(event) => set('issuingCountry', event.target.value.toUpperCase())}
                          error={errors.issuingCountry !== undefined}
                          helperText={errors.issuingCountry ?? 'Například SK nebo DE.'}
                        />
                      </Box>
                      <TextField
                        label="Číslo dokladu"
                        autoComplete="off"
                        value={form.documentNumber}
                        onChange={(event) => set('documentNumber', event.target.value)}
                        error={errors.documentNumber !== undefined}
                        helperText={errors.documentNumber ?? ' '}
                      />
                    </Box>
                  )}
                </Box>
              </Card>

              <Card>
                <Section number={5} title="Souhlasy" />

                {/*
                  Three consents, drawn as three separate things to agree to
                  rather than a stack of ticks, because that is what they are:
                  each one is stored with its own timestamp, its own policy text
                  version and its own purpose, and each can be withdrawn on its
                  own. A row that looks like a row is a row somebody can point
                  at later and say which one they gave.
                */}
                {/*
                  Split on legal basis, 18. 9. 2026.

                  The clinic's own GDPR document asks the patient to consent to
                  five purposes, three of which are things the clinic must do by
                  law: keeping the medical record, evaluating the results, and
                  archiving for ten years (zákon č. 372/2011 Sb., GDPR čl. 9(2)(h)).
                  A tick implies it can be unticked, and none of those three can.
                  Asking for consent where a statute already applies produces a
                  consent that cannot be withdrawn, which is not a valid consent
                  and is a promise the clinic cannot keep.

                  So the statutory purposes are shown and not asked; what is asked
                  is only what the patient can genuinely refuse without changing
                  what care they get.

                  The owner has this in writing and it is pending his lawyer's
                  sign-off. The wording may move; the split should not.
                */}
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 3,
                    bgcolor: 'rgba(17,17,17,0.03)',
                    border: `1px solid ${BRAND.line}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <GavelOutlined sx={{ fontSize: 16, color: BRAND.muted }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6 }}>
                      CO DĚLÁME ZE ZÁKONA — NEPTÁME SE NA TO
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Vedeme zdravotnickou dokumentaci, vyhodnocujeme výsledky a
                    archivujeme je 10 let od poslední služby. Vyplývá to ze zákona
                    č. 372/2011 Sb. a z nařízení GDPR, čl. 9(2)(h) — nejde
                    o volbu, kterou bychom vám mohli nabídnout.
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 1 }}>
                    Máte právo na přístup, opravu i výmaz svých údajů a na stížnost
                    u ÚOOÚ. Souhlasy níže můžete kdykoli odvolat na
                    recepce@sportmedical-diagnostics.cz.
                  </Typography>
                </Box>

                {/*
                  Four consents, drawn as four separate things to agree to rather
                  than a stack of ticks, because that is what they are: each is
                  stored with its own timestamp, its own policy text version and
                  its own purpose, and each can be withdrawn on its own. A row that
                  looks like a row is a row somebody can point at later and say
                  which one they gave.
                */}
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  <ConsentRow
                    required
                    checked={form.consentTreatment}
                    onChange={(value) => set('consentTreatment', value)}
                    error={errors.consentTreatment}
                    title="Provedení prohlídky"
                    detail="Souhlasím s provedením sportovní lékařské prohlídky a se zpracováním údajů o zdravotním stavu, které si vyžádá."
                  />
                  <ConsentRow
                    checked={form.consentReportEmail}
                    onChange={(value) => set('consentReportEmail', value)}
                    title="Lékařská zpráva e-mailem"
                    detail="Souhlasím, aby mi byla lékařská zpráva zaslána elektronicky na uvedený e-mail. Bez souhlasu si ji vyzvednete na recepci."
                  />
                  <ConsentRow
                    checked={form.consentCommunication}
                    onChange={(value) => set('consentCommunication', value)}
                    title="Novinky a nabídky"
                    detail="Souhlasím se zasíláním novinek a nabídek. Netýká se potvrzení a připomínek k vašemu termínu — ty vám pošleme tak jako tak."
                  />
                  <ConsentRow
                    checked={form.consentClub}
                    onChange={(value) => set('consentClub', value)}
                    title="Sdílení výsledků s klubem"
                    detail="Souhlasím se sdílením výsledků s mým sportovním klubem. Jde o předání údajů někomu mimo ordinaci, takže bez vašeho souhlasu je nesdílíme."
                  />
                </Box>

                {submitError !== null && (
                  <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
                    {submitError}
                  </Alert>
                )}

                {/*
                  One button, because there is one page. There is no Zpět any
                  more: everything the patient might want to go back to is
                  already on the screen beside this one.
                */}
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disableElevation
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  sx={{
                    mt: 3,
                    py: 1.6,
                    fontSize: 16,
                    borderRadius: 999,
                    color: BRAND.ink,
                    boxShadow: `0 8px 20px ${BRAND.accentEdge}`,
                    '&:hover': { boxShadow: `0 10px 24px ${BRAND.accentEdge}` },
                  }}
                >
                  {submitting ? 'Odesílám…' : 'Odeslat dotazník'}
                </Button>

                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    color: BRAND.muted,
                  }}
                >
                  <LockOutlined sx={{ fontSize: 15 }} />
                  <Typography variant="caption">
                    Údaje putují šifrovaně a vidí je jen naše ordinace.
                  </Typography>
                </Box>
              </Card>
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

/* ══════════════════════════════════════════════════════════════
   Presentation
   ══════════════════════════════════════════════════════════════ */

function Hero({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      sx={{
        bgcolor: BRAND.ink,
        backgroundImage: `radial-gradient(1100px 340px at 72% -30%, ${BRAND.accentWash}, transparent 70%)`,
        color: '#FFFFFF',
        pt: { xs: 4, sm: 6 },
        pb: { xs: 10, sm: 13 },
        px: 2,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: '0 !important', md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: compact ? 2 : 3 }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
            SportMedical
          </Typography>
          <Typography
            component="span"
            sx={{ fontWeight: 500, fontSize: 17, letterSpacing: 2, color: BRAND.accent }}
          >
            DIAGNOSTICS
          </Typography>
        </Box>

        {!compact && (
          <>
            <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 38 }, mb: 1.25, lineHeight: 1.12 }}>
              Dotazník před návštěvou
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.68)', mb: 3, maxWidth: 520 }}>
              Vyplňte jednou a máte hotovo. Nemusíte se nikam registrovat ani si
              nic pamatovat.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Trust icon={<ScheduleOutlined sx={{ fontSize: 15 }} />} label="Zhruba minuta" />
              <Trust icon={<VerifiedUserOutlined sx={{ fontSize: 15 }} />} label="Bez registrace" />
              <Trust icon={<LockOutlined sx={{ fontSize: 15 }} />} label="Šifrovaný přenos" />
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}

function Trust({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.65,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.16)',
        bgcolor: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

function Card({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#FFFFFF',
        borderRadius: 4,
        border: `1px solid ${BRAND.line}`,
        boxShadow: '0 18px 50px rgba(11, 11, 12, 0.10)',
        p: { xs: 2.5, sm: 3.5 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function Section({ number, title }: { number: number; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: 1.5,
          bgcolor: BRAND.ink,
          color: BRAND.accent,
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BRAND.line }} />
    </Box>
  );
}

function ConsentRow({
  checked,
  onChange,
  title,
  detail,
  required = false,
  error,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        gap: 1.25,
        p: 1.75,
        borderRadius: 3,
        cursor: 'pointer',
        bgcolor: checked ? BRAND.accentWash : 'transparent',
        border: `1px solid ${error !== undefined
          ? '#D32F2F'
          : checked ? BRAND.accentEdge : BRAND.line}`,
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&:hover': { borderColor: checked ? BRAND.accentEdge : 'rgba(17,17,17,0.24)' },
      }}
    >
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        sx={{ p: 0, mt: '1px' }}
      />
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{title}</Typography>
          <Chip
            size="small"
            label={required ? 'povinné' : 'nepovinné'}
            sx={{
              height: 19,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: required ? BRAND.ink : 'transparent',
              color: required ? BRAND.accent : BRAND.muted,
              border: required ? 'none' : `1px solid ${BRAND.line}`,
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.25 }}>
          {detail}
        </Typography>
        {error !== undefined && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/*
 * One document the patient has to deal with before they arrive. A link, not a
 * form — see the comment where these are rendered.
 */
function DocumentRow({
  title,
  when,
  detail,
  href,
  linkLabel,
  emphasis = false,
}: {
  title: string;
  when: string;
  detail: string;
  href: string;
  linkLabel: string;
  emphasis?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 3,
        border: `1px solid ${emphasis ? BRAND.accentEdge : BRAND.line}`,
        bgcolor: emphasis ? BRAND.accentWash : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{title}</Typography>
        <Chip
          size="small"
          label={when}
          sx={{
            height: 19,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: emphasis ? BRAND.ink : 'transparent',
            color: emphasis ? BRAND.accent : BRAND.muted,
            border: emphasis ? 'none' : `1px solid ${BRAND.line}`,
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ color: BRAND.muted }}>
        {detail}
      </Typography>
      <Button
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        endIcon={<OpenInNewOutlined sx={{ fontSize: 14 }} />}
        sx={{ mt: 0.75, ml: -1, color: BRAND.accentDark }}
      >
        {linkLabel}
      </Button>
    </Box>
  );
}
