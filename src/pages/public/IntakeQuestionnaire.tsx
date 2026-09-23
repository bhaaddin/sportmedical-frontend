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
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  AutoAwesomeOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EventAvailableOutlined,
  GavelOutlined,
  OpenInFullOutlined,
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
import { answersForSubmission, readDraft } from '../../services/publicIntake/healthQuestionnaire';
import { forgetHeld, readHeld } from '../../api/publicBooking';
import { questionnaireStance } from '../../services/publicIntake/questionnaireRequirement';
import { calendarFileUrl } from '../../api/publicManage';
import type { HeldBooking } from '../../api/publicBooking';
import type { AddressPoint } from '../../api/addressLookup';
import { readPublicClinic } from '../../api/clinicSettings';

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
          fontSize: 15.5,
          '& fieldset': { borderColor: BRAND.line },
          '&:hover fieldset': { borderColor: 'rgba(17,17,17,0.28)' },
          '&.Mui-focused fieldset': { borderWidth: 2, borderColor: BRAND.accent },
        },
        // A patient's box, not a spreadsheet cell. 15.5/56 reads at arm's
        // length and is a target a thumb can hit; the default 14/40 is what
        // "it looks small" was about.
        input: { paddingTop: 15, paddingBottom: 15 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 15 } } },
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
  /**
   * The same number typed again — asked for ONLY when it is not shaped like a
   * birth number. See `needsSecondTyping`.
   */
  insuranceNumberConfirmation: string;
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
  insuranceNumberConfirmation: '',
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
type Errors = Partial<Record<keyof FormState | 'address' | 'healthQuestionnaire', string>>;

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

/**
 * A moment as the clinic reads it.
 *
 * The server answers in UTC and the browser may be anywhere. Somebody
 * confirming on a phone set to another zone must still be told the Prague time
 * they are expected at.
 */
function clinicMoment(utc: string): string {
  return new Date(utc).toLocaleString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });
}

/**
 * Whether this insurance number has to be typed a second time.
 *
 * A number shaped like a birth number checks itself: the last four digits make
 * the whole thing divisible by eleven, so a typo is caught without asking
 * anybody anything. An insurer-assigned number has no such check — there is
 * nothing to compare it against, and one wrong digit becomes a patient the
 * clinic cannot bill for.
 *
 * The rule belongs to the domain and is enforced there. This is the form
 * knowing which question to ask, not a second copy of the rule: the server
 * still refuses a mismatch, and still refuses a missing confirmation.
 *
 * Until 21. 9. 2026 the form never asked. Every patient with an
 * insurer-assigned number was registered and then refused an appointment,
 * with the reason only in a log.
 */
function needsSecondTyping(insuranceNumber: string): boolean {
  const digits = insuranceNumber.trim().replace(/\s|\//g, '');

  // Too short to judge yet. Asking for a confirmation of half a number would
  // make the field appear and disappear while somebody is still typing.
  if (digits.length < 9) return false;

  return !parseBirthNumber(digits).ok;
}

export default function IntakeQuestionnaire() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [derived, setDerived] = useState<Derived>(NOTHING_DERIVED);
  /* The health questionnaire starts closed. It is ~76 questions and it is
     optional today; opening it by default would turn a one-minute
     registration into a page nobody scrolls to the bottom of. */
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  /* Only so the button can say "pokračovat" to somebody who already started.
     Read once on mount: the dialog owns the draft while it is open, and two
     copies of the same answers kept in step would be a bug waiting to happen. */
  const [questionnaireProgress, setQuestionnaireProgress] = useState(0);

  /*
   * The slot the booking page is holding, if the patient came that way.
   *
   * Read once on mount and not watched: a hold lasts fifteen minutes and this
   * form takes one, so re-reading it on every render would only add a way for
   * the banner to vanish mid-sentence. If it has lapsed by the time they send,
   * the server says so — see the note on `heldToken` where it is submitted.
   */
  const [held] = useState<HeldBooking | null>(readHeld);

  /*
   * What this činnost asks of the questionnaire.
   *
   * Somebody who came straight to the form has no činnost and is offered it as
   * before: optional. Nothing here decides the rule — the clinic set it per
   * činnost and the server checks it again.
   */
  const { asked: questionnaireAskedFor, required: questionnaireRequired } =
    questionnaireStance(held?.questionnaireRequirement);

  useEffect(() => {
    if (questionnaireOpen) return;
    try {
      const raw = window.localStorage.getItem('smd.health-questionnaire.draft.v1');
      setQuestionnaireProgress(raw === null ? 0 : Object.keys(JSON.parse(raw) as object).length);
    } catch {
      /* No storage, or nothing readable in it. Zero is the honest answer and
         the button simply says "vyplnit". */
      setQuestionnaireProgress(0);
    }
  }, [questionnaireOpen]);
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

  /* Where consent is withdrawn: the address the clinic set under Veřejný web
     a kontakty. Left out of the sentence while it is blank rather than
     replaced by one the clinic never chose. */
  const [clinicEmail, setClinicEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Never throws -- see readPublicClinic.
    void readPublicClinic().then((details) => { if (!cancelled) setClinicEmail(details.email.trim()); });
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

      /*
       * The second typing, checked here so the patient is told now rather than
       * after their slot has been claimed.
       *
       * The server checks it again — this is the form asking the question, not
       * the rule.
       */
      if (needsSecondTyping(form.insuranceNumber)) {
        const typedAgain = form.insuranceNumberConfirmation.trim().replace(/\s|\//g, '');
        const typedFirst = form.insuranceNumber.trim().replace(/\s|\//g, '');

        if (typedAgain === '') {
          next.insuranceNumberConfirmation = 'Opište prosím číslo ještě jednou.';
        } else if (typedAgain !== typedFirst) {
          next.insuranceNumberConfirmation = 'Čísla se neshodují. Zkontrolujte je prosím.';
        }
      }
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

    /*
     * The questionnaire, when this činnost insists on it.
     *
     * Told here rather than after the slot has been claimed. The server checks
     * the same thing off the held token, because a rule only the form knows is
     * one that anything which is not the form can skip.
     */
    if (questionnaireRequired && questionnaireProgress === 0) {
      next.healthQuestionnaire =
        'U této činnosti je zdravotní dotazník povinný. Vyplňte ho prosím.';
    }

    if (!form.consentTreatment) {
      next.consentTreatment = 'Bez souhlasu s poskytnutím zdravotních služeb nelze dotazník odeslat.';
    }

    /*
     * The two the clinic may insist on, per činnost.
     *
     * Nothing here decides which: the admin ticks them in the činnost's own
     * settings and the answer travels with the held slot. Somebody who came
     * straight to the form without booking has no činnost, so neither applies —
     * and that is right, because there is nothing to refuse them.
     */
    if (held?.requiresReportByEmail === true && !form.consentReportEmail) {
      next.consentReportEmail =
        'U této činnosti posíláme lékařskou zprávu e-mailem, bez tohoto souhlasu ji nelze objednat.';
    }

    if (held?.requiresClubSharing === true && !form.consentClub) {
      next.consentClub =
        'Tuto činnost objednáváme se sdílením výsledků s klubem, bez tohoto souhlasu ji nelze objednat.';
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
          // Sent only when it was asked for. An echo of the first value would
          // turn the server's check into a formality that always passes.
          insuranceNumberConfirmation: needsSecondTyping(form.insuranceNumber)
            ? form.insuranceNumberConfirmation.trim().replace(/\s|\//g, '')
            : null,
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

        /*
         * Read at the moment of sending, from the same draft the dialog writes.
         *
         * Not held in this component's state: the dialog owns the answers while
         * it is open, and two copies kept in step is a bug waiting for the day
         * somebody edits one of them. `undefined` when nothing was answered, so
         * the field is left off the request entirely rather than sent empty.
         */
        healthQuestionnaire: answersForSubmission(readDraft()),

        /*
         * The slot being claimed, when this registration is finishing a booking.
         *
         * Undefined for somebody who came straight to /dotaznik, and the field is
         * then left off the request entirely. The server treats it as optional and
         * keeps the registration either way: if the hold lapsed while the form was
         * being filled in, the patient is still real and telling them to choose
         * another time is better than losing everything they typed.
         */
        holdToken: held?.token,
      });

      clearIdempotencyKey();

      // The slot is no longer being held -- it either became an appointment or
      // it did not, and either way this tab must not offer it again.
      forgetHeld();
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

              {/*
                What happened, in the words of what actually happened.

                "Dotazník jsme přijali" was shown to everybody, including somebody
                who had just booked a time — who was then given a reference
                number and never told the time they had booked. The server has
                returned the appointment all along; nothing read it.
              */}
              <Typography variant="h5" sx={{ mb: 1 }}>
                {result.appointmentStartUtc !== null
                  ? 'Termín je váš'
                  : result.bookingFailed
                    ? 'Registraci máme, termín zatím ne'
                    : 'Dotazník jsme přijali'}
              </Typography>

              {/*
                Said plainly, because the alternative is somebody arriving on a
                day nobody expects them.

                The registration IS saved -- they do not fill it in again. What
                is missing is the appointment, and for three days this screen
                showed the ordinary confirmation to a patient who had just lost
                one without being told.
              */}
              {result.bookingFailed && (
                <Alert severity="warning" sx={{ mb: 2, textAlign: 'left', borderRadius: 2 }}>
                  Vaše údaje máme uložené, ale vybraný termín se nám nepodařilo
                  potvrdit. Vyberte si prosím termín znovu — už nebudete nic vyplňovat.
                </Alert>
              )}

              {result.appointmentStartUtc !== null && (
                <Typography sx={{ fontWeight: 800, fontSize: 19, mb: 2 }}>
                  {clinicMoment(result.appointmentStartUtc)}
                </Typography>
              )}

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
                  {/*
                    What is promised depends on what will really happen.

                    Both sentences used to end "na uvedený e-mail" whatever the
                    server could do, and for a fortnight the server could do
                    nothing: no sender was configured and every confirmation sat
                    in the queue. A patient told to watch their inbox watched it
                    for nothing. The server now says whether a message is
                    actually coming, and only then is one promised.
                  */}
                  {result.outcome === IntakeOutcome.CandidateReviewRequired
                    ? (result.confirmationEmailExpected
                      ? 'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát. Ozveme se vám na uvedený e-mail.'
                      : 'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát, a pak se vám ozveme. Poznamenejte si prosím číslo žádosti.')
                    : (result.confirmationEmailExpected
                      ? 'Vaše údaje máme uložené a potvrzení jsme vám poslali e-mailem.'
                      : 'Vaše údaje máme uložené. Potvrzení máte na této obrazovce — poznamenejte si prosím číslo žádosti.')}
                </Typography>

                {result.bookingFailed && (
                  <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    href="/objednat"
                    sx={{ mt: 1, borderRadius: 999, py: 1.25, color: BRAND.ink }}
                  >
                    Vybrat termín znovu
                  </Button>
                )}

                {result.manageToken !== null && (
                  <>
                    {/*
                      The calendar file, offered here and not only one page
                      further in. The owner asked for a confirmation the patient
                      "can download like a calendar reminder and lock into
                      Google or Apple" — making them follow a link first was a
                      step between them and the thing they were promised.
                    */}
                    {result.appointmentStartUtc !== null && (
                      <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        href={calendarFileUrl(result.manageToken)}
                        startIcon={<DownloadOutlined />}
                        sx={{ mt: 1, borderRadius: 999, py: 1.25, color: BRAND.ink }}
                      >
                        Přidat do kalendáře
                      </Button>
                    )}

                    <Button
                      fullWidth
                      variant="outlined"
                      color="inherit"
                      href={`/rezervace/${result.manageToken}`}
                      sx={{ mt: 1.25, borderRadius: 999, py: 1.25, borderColor: BRAND.line }}
                    >
                      Správa rezervace — změna nebo zrušení termínu
                    </Button>
                  </>
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
        <Hero booked={held !== null} />

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

        {/* Full screen, so it is mounted at the page root rather than inside
            a column that would constrain it. `female` comes from the
            registration form — from the birth number, usually — so the
            gynaecological section appears or does not without anybody being
            asked a second time. */}
        <HealthQuestionnaire
          open={questionnaireOpen}
          onClose={() => setQuestionnaireOpen(false)}
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

        <Container maxWidth="lg" sx={{ mt: { xs: -7, md: -9 } }}>
          {/* What they are finishing, if they came from the booking page. It is
              above the form rather than in the rail because it is the reason
              they are here, and a reason belongs before the work. */}
          {held !== null && (
            <Box
              sx={{
                mb: 3,
                p: 2.5,
                borderRadius: 4,
                bgcolor: BRAND.ink,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <EventAvailableOutlined sx={{ color: BRAND.accent }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>
                  Držíme vám {heldWhen(held)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)' }}>
                  {held.activityName} — {held.serviceName}. Dokončete prosím
                  registraci a termín je váš.
                </Typography>
              </Box>
            </Box>
          )}

          {/*
            One form down the page, one rail beside it.

            It was two columns of form cards until 18. 9. 2026, side by side and
            of different heights, so nothing lined up with anything and the eye
            had no order to follow -- "its not orgenized ... not combatebul".
            A form is read top to bottom; splitting it in half sideways means
            deciding, at every card, which side to read next.

            So the form is one column now, and what sits beside it is a
            different KIND of thing: what to bring, what is left to do, and the
            button that sends it. That rail is sticky, which is the other half
            of the answer -- the thing you are working towards stays on screen
            instead of being eight sections below you.
          */}
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
            }}
          >
            {/* ---- The form ---- */}
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
                <Section number={3} title="Pojištění" />

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
                      {/*
                        Appears only for a number that cannot check itself, and
                        spans both columns so it reads as a follow-up question
                        rather than a field somebody missed.
                      */}
                      {needsSecondTyping(form.insuranceNumber) && (
                        <TextField
                          label="Číslo pojištěnce znovu"
                          placeholder="Opište stejné číslo"
                          autoComplete="off"
                          inputMode="numeric"
                          value={form.insuranceNumberConfirmation}
                          onChange={(event) => set('insuranceNumberConfirmation', event.target.value)}
                          error={errors.insuranceNumberConfirmation !== undefined}
                          helperText={
                            errors.insuranceNumberConfirmation
                            ?? 'Toto číslo nejde ověřit výpočtem, takže ho prosím opište dvakrát.'
                          }
                          sx={{ gridColumn: { sm: '1 / -1' } }}
                        />
                      )}

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
                <Section number={4} title="Souhlasy" />

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
                    u ÚOOÚ. Souhlasy níže můžete kdykoli odvolat
                    {clinicEmail !== '' ? ` na ${clinicEmail}` : ''}.
                  </Typography>
                </Box>

                {/*
                  Four consents, drawn as four separate things to agree to rather
                  than a stack of ticks, because that is what they are: each is
                  stored with its own timestamp, its own policy text version and
                  its own purpose, and each can be withdrawn on its own. A row that
                  looks like a row is a row somebody can point at later and say
                  which one they gave.

                  Which of them say "povinné" is the clinic's setting, not this
                  file's: the admin ticks them on the činnost and the answer
                  arrives with the held slot. Two are never settable — the
                  examination is required by zákon 372/2011 whatever anybody
                  ticks, and a marketing consent that has to be given to get an
                  appointment is not freely given, so it stays voluntary.
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
                    required={held?.requiresReportByEmail === true}
                    checked={form.consentReportEmail}
                    onChange={(value) => set('consentReportEmail', value)}
                    error={errors.consentReportEmail}
                    title="Lékařská zpráva e-mailem"
                    detail={held?.requiresReportByEmail === true
                      ? `Zprávu z činnosti ${held.activityName} předáváme elektronicky na uvedený e-mail. Bez tohoto souhlasu ji nelze objednat.`
                      : 'Souhlasím, aby mi byla lékařská zpráva zaslána elektronicky na uvedený e-mail. Bez souhlasu si ji vyzvednete na recepci.'}
                  />
                  <ConsentRow
                    checked={form.consentCommunication}
                    onChange={(value) => set('consentCommunication', value)}
                    title="Novinky a nabídky"
                    detail="Souhlasím se zasíláním novinek a nabídek. Netýká se potvrzení a připomínek k vašemu termínu — ty vám pošleme tak jako tak."
                  />
                  <ConsentRow
                    required={held?.requiresClubSharing === true}
                    checked={form.consentClub}
                    onChange={(value) => set('consentClub', value)}
                    error={errors.consentClub}
                    title="Sdílení výsledků s klubem"
                    detail={held?.requiresClubSharing === true
                      ? `Činnost ${held.activityName} objednáváme se sdílením výsledků s vaším klubem. Bez tohoto souhlasu ji nelze objednat.`
                      : 'Souhlasím se sdílením výsledků s mým sportovním klubem. Jde o předání údajů někomu mimo ordinaci, takže bez vašeho souhlasu je nesdílíme.'}
                  />
                </Box>
              </Card>
            </Box>

            {/* ---- The rail ---- */}
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                position: { md: 'sticky' },
                top: { md: 24 },
              }}
            >
              <Card>
                <RailTitle>Než přijdete</RailTitle>

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
                    emphasis
                  />
                  {/*
                    The one document filled in HERE rather than carried in on
                    paper. The button opens it over the whole screen — see the
                    header of HealthQuestionnaire.tsx for why it stopped being
                    an accordion inside this column.
                  */}
                  {/*
                    Not shown at all when the činnost does not ask for it.
                    Offering seventy-six questions to somebody booking a
                    ten-minute re-examination is how a form gets abandoned.
                  */}
                  {questionnaireAskedFor && (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: `1px solid ${questionnaireRequired && questionnaireProgress === 0
                        ? '#D32F2F'
                        : BRAND.accentEdge}`,
                      bgcolor: BRAND.accentWash,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>
                        Zdravotní dotazník
                      </Typography>
                      <Chip
                        size="small"
                        label={questionnaireRequired ? 'Povinný' : 'Nepovinný'}
                        sx={{
                          height: 19,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: BRAND.ink,
                          color: BRAND.accent,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5 }}>
                      Vyplňte ho rovnou tady — otevře se celý přes obrazovku.
                      {questionnaireProgress > 0 && ` Rozepsáno: ${questionnaireProgress} odpovědí.`}
                    </Typography>

                    <Button
                      fullWidth
                      variant="contained"
                      disableElevation
                      onClick={() => setQuestionnaireOpen(true)}
                      endIcon={<OpenInFullOutlined sx={{ fontSize: 16 }} />}
                      sx={{ borderRadius: 999, py: 1.1, color: BRAND.ink }}
                    >
                      {questionnaireProgress > 0 ? 'Pokračovat ve vyplňování' : 'Vyplnit dotazník'}
                    </Button>

                    {questionnaireRequired && questionnaireProgress === 0 && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                        Bez vyplněného dotazníku nelze objednávku dokončit.
                      </Typography>
                    )}
                  </Box>
                  )}

                  <DocumentRow
                    title="Souhlas se zpracováním údajů (GDPR)"
                    when="Jen při první návštěvě"
                    detail="Při dalších vyšetřeních už jej znovu vyplňovat nemusíte, pokud se nezmění údaje ani účel zpracování."
                  />
                  {/* Only for a minor. The age comes from the date of birth, which
                      the birth number has usually already filled in — so this row
                      appears by itself, without anybody being asked their age. */}
                  {isMinor && (
                    <DocumentRow
                      title="Souhlas zákonného zástupce"
                      when="Jen když nezletilý přijde bez doprovodu"
                      detail="Podle data narození je klient mladší 18 let. Pokud přijde v doprovodu zákonného zástupce, tento formulář nepotřebujete."
                    />
                  )}
                </Box>

                <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2 }}>
                  Souhlasy pro vás připravíme na recepci.
                </Typography>
              </Card>

              <Card>
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

/**
 * @param booked
 * Whether the reader already holds a slot. It decides which three steps the
 * hero lists, and it is a prop rather than something read here: this is a
 * separate component, and an earlier version referenced the page's own `held`
 * from inside it — an identifier that does not exist in this scope, which threw
 * on render and left the whole page blank. Caught on 19. 9. 2026 by running the
 * type check that actually checks something.
 */
function Hero({ compact = false, booked = false }: { compact?: boolean; booked?: boolean }) {
  return (
    <Box
      sx={{
        bgcolor: BRAND.ink,
        backgroundImage: `radial-gradient(1200px 420px at 78% -20%, rgba(255,157,0,0.16), transparent 68%)`,
        color: '#FFFFFF',
        pt: { xs: 3.5, md: 5 },
        pb: { xs: 11, md: 15 },
        px: 2,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: '0 !important', md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: compact ? 2 : 4 }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: { xs: 18, md: 22 }, letterSpacing: '-0.01em' }}>
            SportMedical
          </Typography>
          <Typography
            component="span"
            sx={{ fontWeight: 500, fontSize: { xs: 18, md: 22 }, letterSpacing: 2.5, color: BRAND.accent }}
          >
            DIAGNOSTICS
          </Typography>
        </Box>

        {!compact && (
          /*
            Two columns, because one left the right half of a 1440 px banner
            empty and the page opened on a lot of nothing. What fills it is the
            three steps -- the shortest honest answer to "how long is this
            going to take me", which is the question somebody about to close
            the tab is actually asking.
          */
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 3, md: 6 },
              alignItems: 'end',
              gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' },
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontSize: { xs: 32, sm: 44, md: 52 }, mb: 1.5, lineHeight: 1.08 }}
              >
                Dotazník před návštěvou
              </Typography>
              <Typography
                sx={{ color: 'rgba(255,255,255,0.68)', mb: 3, maxWidth: 520, fontSize: { xs: 15, md: 17 } }}
              >
                Vyplňte jednou a máte hotovo. Nemusíte se nikam registrovat ani
                si nic pamatovat.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Trust icon={<ScheduleOutlined sx={{ fontSize: 15 }} />} label="Zhruba minuta" />
                <Trust icon={<VerifiedUserOutlined sx={{ fontSize: 15 }} />} label="Bez registrace" />
                <Trust icon={<LockOutlined sx={{ fontSize: 15 }} />} label="Šifrovaný přenos" />
              </Box>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gap: 1.75,
                p: 3,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.14)',
                bgcolor: 'rgba(255,255,255,0.04)',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1, color: BRAND.accent }}>
                JAK TO PROBĚHNE
              </Typography>
              {/*
                Two different truths, and the page must not tell the wrong one.

                Somebody who booked a slot already has a time; telling them "we
                will call you and arrange one" contradicts the banner directly
                above, which names the day and the hour we are holding for them.
                Somebody who came straight here has no time yet, and for them
                the original three steps are exactly right.
              */}
              {booked ? (
                <>
                  <HeroStep n="1" text="Vyplníte tento formulář — stačí minuta." />
                  <HeroStep n="2" text="Termín je hned váš — potvrzení uvidíte na obrazovce." />
                  <HeroStep n="3" text="Přijdete s výpisem od praktického lékaře." />
                </>
              ) : (
                <>
                  <HeroStep n="1" text="Vyplníte tento formulář — stačí minuta." />
                  <HeroStep n="2" text="Ozveme se vám a domluvíme termín." />
                  <HeroStep n="3" text="Přijdete s výpisem od praktického lékaře." />
                </>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}

function HeroStep({ n, text }: { n: string; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          mt: '1px',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 800,
          bgcolor: 'rgba(255,255,255,0.12)',
          color: '#FFFFFF',
        }}
      >
        {n}
      </Box>
      <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: 14.5, lineHeight: 1.4 }}>
        {text}
      </Typography>
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

/** A heading in the rail. No number: the rail is not a step of the form. */
function RailTitle({ children }: { children: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
        {children}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BRAND.line }} />
    </Box>
  );
}

function Section({ number, title }: { number: number; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.75,
          bgcolor: BRAND.ink,
          color: BRAND.accent,
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>
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
  emphasis = false,
}: {
  title: string;
  when: string;
  detail: string;
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
    </Box>
  );
}

/**
 * The held slot in one line, in the clinic's own time zone.
 *
 * Named rather than left to the device: somebody booking from a phone that
 * thinks it is in London must still read the Prague time they are expected at.
 */
function heldWhen(held: HeldBooking): string {
  const when = new Date(held.startUtc);

  const day = when.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Prague',
  });

  const time = when.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

  return `${day} v ${time}`;
}
