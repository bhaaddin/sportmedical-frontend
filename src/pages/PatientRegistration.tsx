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
 *
 * Dressed on 3. 10. 2026 to the design board: PageHeader with the mode switch
 * and the live count, bordered cards with small-caps section labels, labels
 * over the inputs, a two-column grid, and a sticky footer that keeps "Uložit
 * a pokračovat" in reach. Rychlá registrace now also issues the patient's
 * completion link the moment the record exists, and shows it with Kopírovat.
 *
 * Shelf page (docs/ui-shelf-system.md, 24. 10. 2026): a PageFrame with the mode
 * switch; every block is a shelf - Základní údaje, Podobní pacienti (the live
 * duplicate check: chips with a peek, opened in a new tab so nothing typed is
 * lost), Kontakt, Činnost, Souhlasy, Pojištění, Adresa, and beside them Uloží
 * se takto and Zbývá vyplnit. After a quick registration: Zaregistrováno (the
 * link) and Co dál (karta, objednat, další pacient).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, AlertTitle, Autocomplete, Box, Button, Checkbox, CircularProgress,
  Divider, FormControlLabel, LinearProgress, MenuItem, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { EventAvailable, InfoOutlined, PersonAdd, PersonOutlined } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { activitiesApi } from '../api/activities';
import type { Activity } from '../api/bookingContracts';
import patientRegistryApi, {
  type EmailInspection,
  type IdentityInspection,
  type PhoneInspection,
  type PatientRegistrationOptions,
  type PatientSearchResult,
  type RegisterPatientRequest,
  type RegistrationCandidate,
  type RegistrationConfirmation,
} from '../api/patientRegistry';
import { patientPreRegistrationApi, type IssuedLink } from '../api/patientPreRegistration';
import type { MapySuggestion } from '../api/addressLookup';
import {
  createEmptyForm,
  digitsOnly,
  validateAll,
  validateField,
  type FieldErrors,
  type RegistrationFormState,
} from '../services/patientRegistration/validation';
import {
  emailComplaint, emailDisplayState, storedAs, worthInspectingEmail,
} from '../services/patientRegistration/emailInspection';
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
import {
  groupedDisplay, phoneComplaint, phoneDisplayState, worthInspectingPhone,
} from '../services/patientRegistration/phoneDisplay';
import {
  MODE_LABEL, progressSubtitle, requiredFieldCount,
} from '../services/patientRegistration/progress';
import { SectionLabel, SoftCard, StatusChip } from '../components/ui';
import { ActionCard, EntityChip, PageFrame, Shelf, TARGET_SX, entityTarget } from '../ui/shelf';
import { PhoneField } from '../components/ui/PhoneField';
import {
  EMPTY_ON_SITE_CONSENTS,
  OnSiteConsentsField,
  recordOnSiteConsents,
  type OnSiteConsentSelection,
} from '../components/booking/patient/OnSiteConsentsField';
import MapyAddressPicker from '../components/registration/MapyAddressPicker';
import CandidateReviewDialog from '../components/registration/CandidateReviewDialog';
import FormField from '../components/registration/FormField';
import IssuedLinkCard from '../components/registration/IssuedLinkCard';
import { FIT_FILL_SX, FIT_SCROLL_SX, FitBody } from '../components/ui/fit';
import StickyFormFooter from '../components/registration/StickyFormFooter';
import { FieldCell, FieldGrid } from '../components/registration/FieldGrid';
import { PHONE_TOUCH_TARGETS } from '../components/registration/touchTargets';
import { useDevice } from '../layout/useDevice';

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
  'activityId',
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
  activityId: 'Činnost',
};

/** The label element a select names itself after - see FormField. */
const selectLabelledBy = (id: string) => ({ select: { labelId: `${id}-label` } });

/** Brings a field into view. A test DOM has no scrolling; that is not an error. */
function scrollToField(field: string): void {
  const node = document.querySelector(`[data-field="${field}"]`);
  if (node !== null && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** What the desk sees once a quick registration has its link. */
interface IssuedRegistration {
  patientId: string;
  name: string;
  email: string;
  link: string;
  activityName: string;
  issued: IssuedLink;
  /** What became of the paper consents, when any were ticked. */
  consentNote?: { severity: 'success' | 'warning'; text: string } | null;
}

/** "Komplexní prohlídka · 45 min · 2 200 Kč" - the price from the ceník, never typed here. */
function activityLabel(activity: Activity): string {
  const parts = [activity.name, `${activity.durationMinutes} min`];
  if (activity.priceCzk !== null) {
    parts.push(`${activity.priceCzk.toLocaleString('cs-CZ')} Kč`);
  }
  return parts.join(' · ');
}

function formatExpiry(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PatientRegistration() {
  const navigate = useNavigate();
  const device = useDevice();
  const phoneLayout = device === 'phone';

  /* The sidebar's "Rychlá registrace" opens this page with ?mode=quick. */
  const [searchParams] = useSearchParams();
  const wantsQuick = searchParams.get('mode') === 'quick';
  const [form, setForm] = useState<RegistrationFormState>(() => ({ ...createEmptyForm(), ...(wantsQuick ? { mode: 'Quick' as const } : {}) }));
  useEffect(() => {
    if (wantsQuick) setForm((current) => (current.mode === 'Quick' ? current : { ...current, mode: 'Quick' }));
  }, [wantsQuick]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [options, setOptions] = useState<PatientRegistrationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [optionsAttempt, setOptionsAttempt] = useState(0);

  /* The činnosti a quick registration is for. A failed load says so and offers
     "Zkusit znovu"; it never leaves an empty select that looks like a choice. */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesState, setActivitiesState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [activitiesAttempt, setActivitiesAttempt] = useState(0);

  const [similar, setSimilar] = useState<PatientSearchResult[]>([]);
  const [addressPoint, setAddressPoint] = useState<MapySuggestion | null>(null);
  const [review, setReview] = useState<{
    candidates: RegistrationCandidate[];
    confirmation: RegistrationConfirmation;
  } | null>(null);

  /** The completion link after a quick registration — the success state. */
  const [issued, setIssued] = useState<IssuedRegistration | null>(null);
  /* Ticked by a person with the signed paper in hand; never preselected. */
  const [consents, setConsents] = useState<OnSiteConsentSelection>(EMPTY_ON_SITE_CONSENTS);

  /** What the identifier itself says, when it has been asked. */
  const [inspection, setInspection] = useState<IdentityInspection | null>(null);
  /** What the telephone number looks like, grouped by its own country. */
  const [phoneLook, setPhoneLook] = useState<PhoneInspection | null>(null);

  /* Stable for the whole attempt: a retry must replay, not duplicate. */
  const identifiers = useRef<RegistrationIdentifiers>(mintIdentifiers());

  const update = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  /*
   * Checked when somebody leaves the field, not only when they press the
   * button. The owner typed an address with no `@` in it, nothing said
   * anything, and he found out by submitting: "nikdy to nesmie ulozit ked je
   * zly musi to okno zcervenat".
   *
   * On leaving rather than on every keystroke, because a box that turns red
   * halfway through the first word is a box people learn to ignore — the same
   * reason the telephone says nothing while it is being typed.
   */
  const checkOnLeave = (field: keyof RegistrationFormState) => () => {
    const problem = validateField(field, form);
    setErrors((previous) => ({ ...previous, [field]: problem }));
  };

  /* ── Options ── */
  useEffect(() => {
    setLoadingOptions(true);
    setOptionsError('');
    patientRegistryApi
      .getOptions()
      .then(setOptions)
      .catch((error) => setOptionsError(resolveRegistrationError(error).message))
      .finally(() => setLoadingOptions(false));
  }, [optionsAttempt]);

  useEffect(() => {
    let cancelled = false;
    setActivitiesState('loading');
    activitiesApi
      .list()
      .then((result) => {
        if (cancelled) return;
        setActivities(result.activities.filter((activity) => activity.isActive));
        setActivitiesState('ready');
      })
      .catch(() => { if (!cancelled) setActivitiesState('failed'); });
    return () => { cancelled = true; };
  }, [activitiesAttempt]);

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

  /*
   * ── How the telephone number is grouped ──
   *
   * The server groups it, for all 245 regions it offers, on the same
   * libphonenumber that canonicalises a contact when it is saved — and
   * nothing here knows how any country groups anything. That division is the
   * point: app wrote a test for this and got the German grouping wrong, which
   * is what anybody grouping by hand does.
   *
   * Sent exactly as typed, spaces and all: the server cleans it, and cleaning
   * it here too would make two places decide what a telephone number is.
   */
  useEffect(() => {
    if (!worthInspectingPhone(form.phone) || form.phoneRegionCode === '') {
      setPhoneLook(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      patientRegistryApi
        .inspectPhone({ value: form.phone, regionCode: form.phoneRegionCode })
        .then((result) => { if (!cancelled) setPhoneLook(result); })
        .catch(() => { if (!cancelled) setPhoneLook(null); });
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.phone, form.phoneRegionCode]);

  /* ── The e-mail, decided by the code that stores it ── */

  /*
   * Asked when somebody LEAVES the field rather than as they type it.
   *
   * The telephone is asked on every keystroke because a half-typed number
   * still comes back grouped and useful. A half-typed address does not: `j`,
   * `ja` and `jan@` are each `parses: false`, so asking as they type would
   * mean a red border for the whole first word — and a border that is red
   * most of the time is one nobody reads by the time it means something.
   *
   * `emailAskedFor` is the value the answer belongs to. Without it a verdict
   * about an address somebody has since edited would keep the box red, or
   * worse, green.
   */
  const [emailLook, setEmailLook] = useState<EmailInspection | null>(null);
  const [emailAskedFor, setEmailAskedFor] = useState<string>('');

  const askAboutEmail = useCallback(async (value: string): Promise<EmailInspection | null> => {
    if (!worthInspectingEmail(value)) {
      setEmailLook(null);
      setEmailAskedFor('');
      return null;
    }
    try {
      const result = await patientRegistryApi.inspectEmail({ value });
      setEmailLook(result);
      setEmailAskedFor(value);
      return result;
    } catch {
      /* The save goes to the same server. If it cannot be reached to ask, it
         cannot be reached to save either, and the POST will say so — guessing
         here is what this whole change removed. */
      setEmailLook(null);
      setEmailAskedFor('');
      return null;
    }
  }, []);

  /* A verdict only counts for the value it was given. */
  const emailAnswer = form.email === emailAskedFor ? emailLook : null;
  const emailState = emailDisplayState(emailAnswer, form.email);
  const emailSays = emailComplaint(emailAnswer);

  const phoneState = phoneDisplayState(phoneLook, form.phone);
  const phoneGrouped = groupedDisplay(phoneLook);
  const phoneSays = phoneComplaint(phoneState, form.phoneRegionCode);

  /* ── Birth number drives date of birth, sex and (Czech) the insurance number ── */
  const handleBirthNumber = (raw: string) => {
    const formatted = formatRodneCislo(raw);
    const digits = digitsOnly(formatted);
    const parsed = parseBirthNumber(digits);

    setForm((previous) => ({
      ...previous,
      birthNumber: formatted,
      ...(parsed !== null ? { dateOfBirth: parsed.dateOfBirth, sex: parsed.sex } : {}),
      // For a Czech insuree the číslo pojištěnce IS the rodné číslo. Fill it only
      // into an empty box, so a number typed by hand is never overwritten and the
      // operator is not left with two values that fail the domain mismatch check.
      ...(parsed !== null
        && previous.insuranceRegistrationKind === 'CzechPublicHealthInsurance'
        && previous.healthInsuranceNumber.trim() === ''
        ? { healthInsuranceNumber: digits }
        : {}),
    }));
    setErrors((previous) => ({ ...previous, birthNumber: undefined, healthInsuranceNumber: undefined }));
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

  const handleAddressPoint = (point: MapySuggestion | null) => {
    setAddressPoint(point);
    setForm((previous) => ({
      ...previous,
      // A whole-republic Mapy.cz address has no RÚIAN code; 1 is a sentinel that
      // only tells the "address chosen" check the field is filled. The real
      // address is sent as its parts in buildRequest, with the code as 0.
      ruianAddressPointCode: point === null ? null : 1,
      addressDisplay: point?.label ?? '',
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
        /* A quick registration has no date of birth and no sex (decision 7 of
           Etapa 2): the patient gives them through the completion link. The
           contract types the date as a string; the server reads it as optional. */
        dateOfBirth: (form.mode === 'Quick' && form.dateOfBirth === ''
          ? null
          : form.dateOfBirth) as string,
        sex: form.sex === '' ? 'NotSpecified' : form.sex,
        mode: form.mode,
        source: 'ClinicOperator',
        email: {
          contactPointId: ids.emailContactPointId,
          value: form.email.trim(),
        },
        // Quick is a pre-registration: a patient with no phone/address is accepted
        // and completed later. Send null rather than an empty contact the server
        // would reject, so the fast path is genuinely fast.
        phone:
          form.mode === 'Quick' && form.phone.trim().length === 0
            ? null
            : {
                contactPointId: ids.phoneContactPointId,
                value: form.phone.trim(),
                regionCode: form.phoneRegionCode,
              },
        address:
          form.mode === 'Quick' && addressPoint === null
            ? null
            : {
                patientAddressId: ids.patientAddressId,
                residenceType: form.residenceType,
                // Whole-republic Mapy.cz address: code 0, the parts carry it.
                ruianAddressPointCode: 0,
                street: addressPoint?.street ?? null,
                number: addressPoint?.number ?? null,
                municipalityPart: addressPoint?.municipalityPart ?? null,
                municipality: addressPoint?.municipality ?? null,
                zip: addressPoint?.zip ?? null,
              },
        /* Quick: no insurance yet - the patient gives it through the link. */
        administrativeProfile: (form.mode === 'Quick' ? null : {
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
        }) as RegisterPatientRequest['administrativeProfile'],
        confirmation,
      };
    },
    [form, addressPoint],
  );

  /** Puts the screen at the first thing that is wrong. There is no step to go to. */
  const focusFirstError = (found: FieldErrors) => {
    const first = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (first === undefined) return;
    scrollToField(first);
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

        /* The patient exists now: record the consents signed on paper. A failure
           here never undoes the registration - it is a warning, repeatable. */
        const recorded = await recordOnSiteConsents(
          result.patientId,
          form.mode === 'Quick' ? form.activityId || null : null,
          consents,
        );
        const consentNote: IssuedRegistration['consentNote'] =
          recorded.status === 'recorded'
            ? { severity: 'success', text: 'Souhlasy podepsané na místě byly zapsány.' }
            : recorded.status === 'failed'
              ? { severity: 'warning', text: recorded.message }
              : null;
        if (consentNote?.severity === 'success') toast.success(consentNote.text);
        if (consentNote?.severity === 'warning') toast.error(consentNote.text);

        /*
         * Rychlá registrace is a pre-registration: the record has no address
         * yet, and the patient fills the rest in through their own link. The
         * link is issued here, the moment the record exists, so the desk can
         * hand it over at once — it is the same 24 h link the booking drawer
         * makes. If the server will not issue one (the record is complete, or
         * cannot be reached) the desk goes to the card as it always did.
         */
        if (form.mode === 'Quick' && result.outcome === 'Created') {
          try {
            const link = await patientPreRegistrationApi.issueLink(result.patientId);
            setIssued({
              patientId: result.patientId,
              name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
              email: form.email.trim(),
              link: link.url ?? `${window.location.origin}${link.path}`,
              activityName: activities.find((activity) => activity.id === form.activityId)?.name ?? '',
              issued: link,
              consentNote,
            });
            return;
          } catch {
            /* fall through to the card */
          }
        }

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
    [buildRequest, navigate, form.mode, form.firstName, form.lastName, form.email, form.activityId, activities, consents],
  );

  /*
   * The gate in front of the POST.
   *
   * "nikdy to nesmie ulozit ked je zly musi to okno zcervenat a napisat ze zly
   * tvar". The local rules run first and cost nothing; the address is then put
   * to the server before anything is written, because nothing on this screen
   * knows what an address is any more.
   *
   * It is asked again here rather than trusted from the field: somebody can
   * paste into the box and hit the button without ever leaving it, and that is
   * exactly the path that must not save.
   */
  const submit = async () => {
    const allErrors = validateAll(form);

    if (Object.keys(allErrors).length === 0) {
      const verdict = await askAboutEmail(form.email);
      /* `null` is unreachable, not invalid — the POST goes to the same server
         and will refuse it there rather than this screen inventing a reason. */
      if (verdict !== null && !verdict.parses) {
        allErrors.email = emailComplaint(verdict);
      }
    }

    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      setBanner({ severity: 'warning', text: 'Formulář obsahuje chyby. Zkontrolujte zvýrazněná pole.' });
      focusFirstError(allErrors);
      return;
    }

    void send(null);
  };

  /** "Další pacient" on the success state: a clean form in the same mode. */
  const startAnother = () => {
    setForm({ ...createEmptyForm(), mode: form.mode });
    setErrors({});
    setBanner(null);
    setSimilar([]);
    setAddressPoint(null);
    setInspection(null);
    setPhoneLook(null);
    setEmailLook(null);
    setEmailAskedFor('');
    setIssued(null);
    setConsents(EMPTY_ON_SITE_CONSENTS);
    identifiers.current = mintIdentifiers();
  };

  const czechBranch = form.insuranceRegistrationKind === 'CzechPublicHealthInsurance';
  const quick = form.mode === 'Quick';
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

  /* How many fields this mode and branch actually require — counted from the
     rules, not a fixed number, so Rychlá registrace shows its own short total
     (a pre-registration asks for far fewer than a full one). */
  const requiredCount = useMemo(
    () => requiredFieldCount({
      mode: form.mode,
      insuranceRegistrationKind: form.insuranceRegistrationKind,
      residenceType: form.residenceType,
    }),
    [form.mode, form.insuranceRegistrationKind, form.residenceType],
  );
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
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setOptionsAttempt((n) => n + 1)}>
              Zkusit znovu
            </Button>
          }
        >
          <AlertTitle>Registraci nelze otevřít</AlertTitle>
          {optionsError || 'Číselníky registrace se nepodařilo načíst.'}
        </Alert>
      </Box>
    );
  }

  /* ═══ Success: a quick registration and the link that finishes it ═══ */
  if (issued !== null) {
    const expiry = formatExpiry(issued.issued.expiresAtUtc);
    const card = entityTarget({ kind: 'patient', id: issued.patientId }).to;
    return (
      <PageFrame
        title="Nový pacient"
        purpose={`${MODE_LABEL.Quick} — hotovo`}
        entities={[{ kind: 'patient', id: issued.patientId, label: issued.name }]}
        actions={
          <Button variant="outlined" onClick={() => navigate('/patients')} sx={TARGET_SX}>
            Zpět na seznam
          </Button>
        }
      >
        <Shelf id="registered" title="Zaregistrováno" layout="board" stagger={false}>
          <Box sx={{ p: { xs: 2, sm: 2.5 }, maxWidth: 760 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Box
                sx={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  bgcolor: 'background.default', color: 'text.primary',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16,
                }}
              >
                {initials(issued.name)}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{issued.name} je zaregistrován</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {issued.activityName !== '' ? `${issued.email} · ${issued.activityName}` : issued.email}
                </Typography>
              </Box>
              <StatusChip tone="beige" sx={{ ml: 'auto' }}>Registrace není dokončena</StatusChip>
            </Stack>

            {issued.consentNote ? (
              <Alert severity={issued.consentNote.severity} sx={{ mb: 2 }}>
                {issued.consentNote.text}
              </Alert>
            ) : null}

            <IssuedLinkCard
              label="Registrační odkaz pro pacienta"
              link={issued.link}
              note={
                <>
                  {issued.issued.emailQueued
                    ? `E-mail s odkazem odešel na ${issued.issued.sentTo ?? issued.email}. `
                    : 'E-mail se neodesílá automaticky — odkaz pacientovi pošlete sami. '}
                  {expiry !== '' ? `Odkaz platí do ${expiry}. ` : ''}
                  Pacient přes něj doplní datum narození, adresu, rodné číslo a vstupní dotazník.
                </>
              }
            />
          </Box>
        </Shelf>

        {/* ── Co dál: the three things a desk does next, one press each ── */}
        <Shelf id="next" title="Co dál" layout="row" fill minCardWidth={220} stagger={false}>
          <ActionCard primary title="Otevřít kartu pacienta" icon={<PersonOutlined fontSize="small" />} onClick={() => navigate(card)} />
          {/* The calendar opens its booking drawer on `newAppointment`, for this patient. */}
          <ActionCard
            title="Objednat termín"
            icon={<EventAvailable fontSize="small" />}
            onClick={() => navigate('/planovani', { state: { newAppointment: Date.now(), patientId: issued.patientId } })}
          />
          <ActionCard title="Další pacient" icon={<PersonAdd fontSize="small" />} onClick={startAnother} />
        </Shelf>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      fit
      title="Nový pacient"
      purpose={progressSubtitle(form.mode, doneCount, requiredCount)}
      actions={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={form.mode}
          aria-label="Režim registrace"
          onChange={(_, value) => {
            if (value === null) return;
            update('mode', value);
            /* Each mode has its own rules; what the other one flagged is not this one's. */
            setErrors({});
            setBanner(null);
          }}
        >
          <ToggleButton value="Quick">Rychlá</ToggleButton>
          <ToggleButton value="Standard">Úplná</ToggleButton>
        </ToggleButtonGroup>
      }
    >
    <Box
      data-device={device}
      data-mode={quick ? 'quick' : 'standard'}
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, ...(phoneLayout ? {} : FIT_FILL_SX) },
        phoneLayout && PHONE_TOUCH_TARGETS,
      ]}
    >
      {banner !== null && (
        <Alert severity={banner.severity} sx={{ flexShrink: 0 }} onClose={() => setBanner(null)}>
          {banner.text}
        </Alert>
      )}

      {/* From 1280 the form and the card stand side by side and each scrolls by itself; below, they stack and scroll as one. */}
      <FitBody
        scroll
        sx={{
          display: 'grid',
          gap: 3,
          alignContent: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
          '@media (min-width: 1280px)': { gridTemplateColumns: 'minmax(0, 1fr) clamp(300px, 24vw, 400px)', gridTemplateRows: 'minmax(0, 1fr)', alignContent: 'stretch', overflow: 'hidden' },
        }}
      >
        {/* ═══ The form ═══ */}
        <Stack spacing={2} sx={{ minWidth: 0, '@media (min-width: 1280px)': { ...FIT_SCROLL_SX, pr: 0.5 } }}>

          {quick && (
            <SoftCard tone="muted" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', mt: '1px' }} />
              <Typography variant="body2">
                Víc teď nepotřebujeme. Datum narození, adresu, rodné číslo, pojištění
                a vstupní dotazník vyplní pacient sám přes odkaz, který mu odejde hned po registraci.
              </Typography>
            </SoftCard>
          )}

          {/* ── Základní údaje ── */}
          <FormShelf id="basic" title="Základní údaje">
            <FieldGrid>
              <FieldCell>
                <FormField label="Jméno" required name="firstName">
                  {(id) => (
                    <TextField
                      id={id} fullWidth placeholder="Filip"
                      value={form.firstName}
                      onChange={(e) => update('firstName', e.target.value)}
                      onBlur={checkOnLeave('firstName')}
                      error={errors.firstName !== undefined}
                      helperText={errors.firstName}
                    />
                  )}
                </FormField>
              </FieldCell>
              <FieldCell>
                <FormField label="Příjmení" required name="lastName">
                  {(id) => (
                    <TextField
                      id={id} fullWidth placeholder="Fehér"
                      value={form.lastName}
                      onChange={(e) => update('lastName', e.target.value)}
                      onBlur={checkOnLeave('lastName')}
                      error={errors.lastName !== undefined}
                      helperText={errors.lastName}
                    />
                  )}
                </FormField>
              </FieldCell>

              {!quick && (
              <>
              <FieldCell>
                <FormField label="Datum narození" required name="dateOfBirth">
                  {(id) => (
                    <TextField
                      id={id} fullWidth type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => update('dateOfBirth', e.target.value)}
                      onBlur={checkOnLeave('dateOfBirth')}
                      error={errors.dateOfBirth !== undefined}
                      helperText={errors.dateOfBirth}
                    />
                  )}
                </FormField>
              </FieldCell>
              <FieldCell>
                <FormField label="Pohlaví" required name="sex">
                  {(id) => (
                    <TextField
                      id={id} select fullWidth
                      value={form.sex}
                      onChange={(e) => update('sex', e.target.value as RegistrationFormState['sex'])}
                      onBlur={checkOnLeave('sex')}
                      error={errors.sex !== undefined}
                      helperText={errors.sex}
                      slotProps={selectLabelledBy(id)}
                    >
                      {SEX_OPTIONS.map((option) => (
                        <MenuItem key={option.code} value={option.code}>{option.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                </FormField>
              </FieldCell>

              <FieldCell>
                <FormField label="Oslovení" name="preferredName">
                  {(id) => (
                    <TextField
                      id={id} fullWidth placeholder="Nepovinné"
                      value={form.preferredName}
                      onChange={(e) => update('preferredName', e.target.value)}
                      onBlur={checkOnLeave('preferredName')}
                      error={errors.preferredName !== undefined}
                      helperText={errors.preferredName}
                    />
                  )}
                </FormField>
              </FieldCell>
              <FieldCell>
                <FormField label="Tituly před">
                  {(id) => (
                    <Autocomplete
                      multiple
                      id={id}
                      size="small"
                      options={titleOptions.before.map((o) => o.code)}
                      value={form.titlesBeforeName}
                      onChange={(_, value) => update('titlesBeforeName', value)}
                      getOptionLabel={(code) =>
                        titleOptions.before.find((o) => o.code === code)?.displayValue ?? code}
                      renderInput={(params) => <TextField {...params} placeholder="MUDr." />}
                    />
                  )}
                </FormField>
              </FieldCell>
              <FieldCell>
                <FormField label="Tituly za">
                  {(id) => (
                    <Autocomplete
                      multiple
                      id={id}
                      size="small"
                      options={titleOptions.after.map((o) => o.code)}
                      value={form.titlesAfterName}
                      onChange={(_, value) => update('titlesAfterName', value)}
                      getOptionLabel={(code) =>
                        titleOptions.after.find((o) => o.code === code)?.displayValue ?? code}
                      renderInput={(params) => <TextField {...params} placeholder="Ph.D." />}
                    />
                  )}
                </FormField>
              </FieldCell>
              </>
            )}
            </FieldGrid>

          </FormShelf>

          {/* ── Podobní pacienti: the live duplicate check, said where it applies, not after the save. Each one opens in a
              new tab (a peek on hover), so checking never costs what has been typed. ── */}
          {similar.length > 0 && (
            <Shelf
              id="similar"
              title="Podobní pacienti"
              hint="Ověřte, než založíte druhý záznam — rozdělil by historii vyšetření."
              count={similar.length}
              countTone="beige"
              layout="list"
              stagger={false}
            >
              {similar.slice(0, 4).map((candidate) => (
                <Box
                  key={candidate.patientId}
                  role="listitem"
                  data-similar=""
                  sx={{ px: 1.75, py: 1, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}
                >
                  <EntityChip
                    entity={{ kind: 'patient', id: candidate.patientId, label: candidate.fullName }}
                    onNavigate={(event) => {
                      event.preventDefault();
                      window.open(entityTarget({ kind: 'patient', id: candidate.patientId }).to, '_blank', 'noopener');
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {candidate.dateOfBirth} · {candidate.status}
                  </Typography>
                </Box>
              ))}
            </Shelf>
          )}

          {/* ── Kontakt ── */}
          <FormShelf id="contact" title="Kontakt">
            <FieldGrid>
              <FieldCell>
                <FormField label="E-mail" required name="email">
                  {(id) => (
                    <TextField
                      id={id} fullWidth type="email" placeholder="filip@email.cz"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      /* Two questions on the way out: is there one (ours), and is
                         it an address (the server's). */
                      onBlur={() => {
                        checkOnLeave('email')();
                        void askAboutEmail(form.email);
                      }}
                      error={errors.email !== undefined || emailState === 'invalid'}
                      helperText={errors.email ?? (emailSays !== '' ? emailSays : undefined)}
                    />
                  )}
                </FormField>
              </FieldCell>
              <FieldCell>
                {/*
                  One field, the owner's way (3. 10. 2026): the country is a compact
                  picker in front of the number, Česko by default, searchable by digits
                  or name, and named under the field as a note. What is stored is one
                  `+420773539001` - the register's canonicaliser then groups it (the
                  helper line) and the server, not this screen, says whether it is
                  valid. The region code travels with it, as it always did.
                */}
                <FormField label="Telefon" required name="phone">
                  {(id) => (
                    <PhoneField
                      id={id}
                      value={form.phone}
                      defaultCountryCode={form.phoneRegionCode || undefined}
                      onChange={(next, country) => {
                        setForm((previous) => ({
                          ...previous,
                          phone: next,
                          phoneRegionCode: country?.code ?? previous.phoneRegionCode,
                        }));
                        setErrors((previous) => ({ ...previous, phone: undefined, phoneRegionCode: undefined }));
                      }}
                      onBlur={checkOnLeave('phone')}
                      error={
                        errors.phone !== undefined
                        || errors.phoneRegionCode !== undefined
                        || phoneState === 'unreadable'
                      }
                      /* Grouped while it is being typed, and complained about only
                         when it is finished and still does not fit the country. A
                         red border on every second keystroke is a red border people
                         stop reading. */
                      helperText={
                        errors.phone
                        ?? errors.phoneRegionCode
                        ?? (phoneSays !== '' ? phoneSays : undefined)
                        ?? (phoneGrouped !== '' ? phoneGrouped : undefined)
                      }
                      helperTone={phoneState === 'valid' ? 'success' : 'default'}
                    />
                  )}
                </FormField>
              </FieldCell>
            </FieldGrid>
          </FormShelf>

          {/* ── Činnost (rychlá registrace) ── */}
          {quick && (
            <FormShelf id="activity" title="Činnost" field="activityId">
              {activitiesState === 'failed' ? (
                <Alert
                  severity="error"
                  action={
                    <Button color="inherit" size="small" onClick={() => setActivitiesAttempt((n) => n + 1)}>
                      Zkusit znovu
                    </Button>
                  }
                >
                  Činnosti se nepodařilo načíst.
                </Alert>
              ) : (
                <FieldGrid>
                  <FieldCell full>
                    <FormField label="Prohlídka, na kterou volal" required name="activityId">
                      {(id) => (
                        <TextField
                          id={id} select fullWidth
                          value={form.activityId}
                          disabled={activitiesState === 'loading'}
                          onChange={(e) => update('activityId', e.target.value)}
                          onBlur={checkOnLeave('activityId')}
                          error={errors.activityId !== undefined}
                          helperText={
                            errors.activityId
                            ?? (activitiesState === 'loading'
                              ? 'Načítám činnosti…'
                              : activities.length === 0
                                ? 'V nastavení zatím není žádná aktivní činnost.'
                                : undefined)
                          }
                          slotProps={selectLabelledBy(id)}
                        >
                          {activities.map((activity) => (
                            <MenuItem key={activity.id} value={activity.id}>
                              {activityLabel(activity)}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </FormField>
                  </FieldCell>
                </FieldGrid>
              )}
            </FormShelf>
          )}

          {/* ── Souhlasy podepsané na místě: both modes, the server's list for the činnost ── */}
          <FormShelf id="consents" title="Souhlasy" hint="Podepsané na místě (papírově)" field="onSiteConsents">
            <OnSiteConsentsField
              hideLabel
              activityId={quick ? form.activityId || null : null}
              value={consents}
              onChange={setConsents}
              disabled={submitting}
            />
          </FormShelf>

          {/* The patient gives insurance and address through the link in a quick registration. */}
          {!quick && (
            <>
          {/* ── Pojištění ── */}
          <FormShelf id="insurance" title="Pojištění">

            <ToggleButtonGroup
              exclusive
              size="small"
              value={form.insuranceRegistrationKind}
              aria-label="Způsob evidence pojištění"
              onChange={(_, value) => {
                if (value !== null) {
                  update('insuranceRegistrationKind',
                    value as RegistrationFormState['insuranceRegistrationKind']);
                }
              }}
              sx={{ mb: 2.5, flexWrap: 'wrap' }}
            >
              {options.insuranceRegistrationKinds.map((kind) => (
                <ToggleButton key={kind.code} value={kind.code}>
                  {kind.displayValue}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {czechBranch ? (
              <FieldGrid>
                <FieldCell>
                  <FormField label="Číslo pojištěnce" required name="healthInsuranceNumber">
                    {(id) => (
                      <TextField
                        id={id} fullWidth placeholder="Devět nebo deset číslic z kartičky"
                        inputMode="numeric"
                        value={form.healthInsuranceNumber}
                        onChange={(e) => handleInsuranceNumber(e.target.value)}
                        onBlur={checkOnLeave('healthInsuranceNumber')}
                        error={errors.healthInsuranceNumber !== undefined}
                        helperText={
                          errors.healthInsuranceNumber
                          ?? (form.healthInsuranceNumber.length > 0
                            ? IDENTIFIER_KIND_LABEL[identifier.kind]
                            : undefined)
                        }
                      />
                    )}
                  </FormField>
                </FieldCell>

                {/* Only an insurer-assigned number is typed twice — nothing
                    else can be checked against anything but itself. */}
                {identifier.requiresConfirmation && (
                  <FieldCell>
                    <FormField label="Číslo pojištěnce ještě jednou" required name="healthInsuranceNumberConfirmation">
                      {(id) => (
                        <TextField
                          id={id} fullWidth inputMode="numeric"
                          value={form.healthInsuranceNumberConfirmation}
                          onChange={(e) =>
                            update('healthInsuranceNumberConfirmation', digitsOnly(e.target.value))}
                          onBlur={checkOnLeave('healthInsuranceNumberConfirmation')}
                          error={errors.healthInsuranceNumberConfirmation !== undefined}
                          helperText={
                            errors.healthInsuranceNumberConfirmation
                            ?? 'Tohle číslo se nedá ověřit proti ničemu jinému.'
                          }
                        />
                      )}
                    </FormField>
                  </FieldCell>
                )}

                <FieldCell>
                  <FormField label="Zdravotní pojišťovna" required name="healthInsurerCode">
                    {(id) => (
                      <TextField
                        id={id} select fullWidth
                        value={form.healthInsurerCode}
                        onChange={(e) => update('healthInsurerCode', e.target.value)}
                        onBlur={checkOnLeave('healthInsurerCode')}
                        error={errors.healthInsurerCode !== undefined}
                        helperText={errors.healthInsurerCode}
                        slotProps={selectLabelledBy(id)}
                      >
                        {/* `displayValue` already reads "111 — Všeobecná zdravotní
                            pojišťovna"; prefixing the code as well printed the enum
                            name in front of it. */}
                        {options.czechHealthInsurers.map((insurer) => (
                          <MenuItem key={insurer.code} value={insurer.code}>
                            {insurer.displayValue}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  </FormField>
                </FieldCell>

                <FieldCell>
                  <FormField label="Rodné číslo (nepovinné)" name="birthNumber">
                    {(id) => (
                      <TextField
                        id={id} fullWidth placeholder="Doplní datum narození a pohlaví"
                        inputMode="numeric"
                        value={form.birthNumber}
                        onChange={(e) => handleBirthNumber(e.target.value)}
                        onBlur={checkOnLeave('birthNumber')}
                        error={errors.birthNumber !== undefined}
                        helperText={errors.birthNumber}
                      />
                    )}
                  </FormField>
                </FieldCell>

                <FieldCell full>
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
                </FieldCell>

                {/* What the identifier itself says — with both values in it. */}
                {verdict === 'disagrees' && inspection !== null && (
                  <FieldCell full>
                    <Alert severity="warning">
                      {disagreementText(inspection, {
                        dateOfBirth: form.dateOfBirth, sex: form.sex,
                      })}
                    </Alert>
                  </FieldCell>
                )}
                {verdict === 'agrees' && (
                  <FieldCell full>
                    <Typography variant="caption" sx={{ color: 'success.main' }}>
                      {AGREES_TEXT}
                    </Typography>
                  </FieldCell>
                )}
              </FieldGrid>
            ) : (
              <FieldGrid>
                <FieldCell>
                  <FormField label="Typ dokladu" required name="identityDocumentType">
                    {(id) => (
                      <TextField
                        id={id} select fullWidth
                        value={form.identityDocumentType}
                        onChange={(e) => update('identityDocumentType', e.target.value)}
                        onBlur={checkOnLeave('identityDocumentType')}
                        error={errors.identityDocumentType !== undefined}
                        helperText={errors.identityDocumentType}
                        slotProps={selectLabelledBy(id)}
                      >
                        {options.identityDocumentTypes.map((type) => (
                          <MenuItem key={type.code} value={type.code}>{type.displayValue}</MenuItem>
                        ))}
                      </TextField>
                    )}
                  </FormField>
                </FieldCell>
                <FieldCell>
                  <FormField label="Stát vydání" required name="identityDocumentIssuingCountryCode">
                    {(id) => (
                      <TextField
                        id={id} fullWidth placeholder="SK"
                        value={form.identityDocumentIssuingCountryCode}
                        onChange={(e) =>
                          update('identityDocumentIssuingCountryCode', e.target.value.toUpperCase())}
                        onBlur={checkOnLeave('identityDocumentIssuingCountryCode')}
                        error={errors.identityDocumentIssuingCountryCode !== undefined}
                        helperText={
                          errors.identityDocumentIssuingCountryCode ?? 'Dvě písmena, ISO 3166-1.'
                        }
                      />
                    )}
                  </FormField>
                </FieldCell>
                <FieldCell>
                  <FormField label="Číslo dokladu" required name="identityDocumentNumber">
                    {(id) => (
                      <TextField
                        id={id} fullWidth
                        value={form.identityDocumentNumber}
                        onChange={(e) => update('identityDocumentNumber', e.target.value)}
                        onBlur={checkOnLeave('identityDocumentNumber')}
                        error={errors.identityDocumentNumber !== undefined}
                        helperText={errors.identityDocumentNumber}
                      />
                    )}
                  </FormField>
                </FieldCell>
                <FieldCell full>
                  <Typography variant="caption" color="text.secondary">
                    Datum narození a pohlaví vyplňte v základních údajích ručně — ze zahraničního
                    dokladu se odvodit nedají.
                  </Typography>
                </FieldCell>
              </FieldGrid>
            )}
          </FormShelf>

          {/* ── Adresa ── */}
          <FormShelf id="address" title="Adresa" field="ruianAddressPointCode">
            <FieldGrid>
              <FieldCell>
                <FormField label="Typ pobytu" required>
                  {(id) => (
                    <TextField
                      id={id} select fullWidth
                      value={form.residenceType}
                      onChange={(e) =>
                        update('residenceType', e.target.value as RegistrationFormState['residenceType'])}
                      slotProps={selectLabelledBy(id)}
                    >
                      {RESIDENCE_TYPES.map((type) => (
                        <MenuItem key={type.code} value={type.code}>{type.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                </FormField>
              </FieldCell>
              <FieldCell full>
                <MapyAddressPicker
                  selected={addressPoint}
                  onSelect={handleAddressPoint}
                  error={errors.ruianAddressPointCode}
                  disabled={submitting}
                />
              </FieldCell>
            </FieldGrid>
          </FormShelf>
            </>
          )}
        </Stack>

        {/* ═══ The card — the former "Shrnutí" step ═══ */}
        <Stack
          spacing={2}
          sx={{ minWidth: 0, '@media (min-width: 1280px)': { ...FIT_SCROLL_SX, pr: 0.5 } }}
        >
          <FormShelf id="summary" title="Uloží se takto">
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {`${form.firstName} ${form.lastName}`.trim() || 'Nový pacient'}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
              <StatusChip tone={quick ? 'beige' : 'green'}>
                {quick ? 'Rychlá' : 'Úplná'}
              </StatusChip>
              {!quick && form.dateOfBirth !== '' && <StatusChip>{form.dateOfBirth}</StatusChip>}
              {!quick && form.sex !== '' && (
                <StatusChip>{SEX_OPTIONS.find((s) => s.code === form.sex)?.label ?? form.sex}</StatusChip>
              )}
            </Stack>

            <Stack spacing={1.5}>
              {quick && (
                <LabelValue
                  label="Činnost"
                  value={activities.find((activity) => activity.id === form.activityId)?.name ?? '—'}
                />
              )}
              {!quick && (
                <>
              <LabelValue label="Pojištění" value={
                czechBranch
                  ? (options.czechHealthInsurers.find((i) => i.code === form.healthInsurerCode)
                    ?.displayValue ?? '—')
                  : (options.identityDocumentTypes.find((t) => t.code === form.identityDocumentType)
                    ?.displayValue ?? 'Doklad ze zahraničí')
              } />
              <LabelValue
                label={czechBranch ? 'Číslo pojištěnce' : 'Číslo dokladu'}
                value={czechBranch
                  ? maskInsuranceNumber(form.healthInsuranceNumber)
                  : (form.identityDocumentNumber || '—')}
              />
              {czechBranch && (
                <LabelValue label="Rodné číslo" value={maskBirthNumber(form.birthNumber)} />
              )}
              <LabelValue label="Adresa" value={form.addressDisplay || '—'} />
                </>
              )}
              <LabelValue label="E-mail" value={storedAs(emailAnswer, form.email) || '—'} />
              {/* The card shows the grouped form — what will actually be
                  stored and shown everywhere after the save. */}
              <LabelValue label="Telefon" value={phoneGrouped || form.phone || '—'} />
            </Stack>
          </FormShelf>

          <FormShelf id="outstanding" title="Zbývá vyplnit" hint={`${doneCount} z ${requiredCount}`}>
            <LinearProgress
              variant="determinate"
              value={requiredCount === 0 ? 100 : (doneCount / requiredCount) * 100}
              sx={{ mb: 1.5 }}
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
          </FormShelf>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Rodné číslo i číslo pojištěnce se do protokolu zapisují zamaskované.
          </Typography>
        </Stack>
      </FitBody>

      <StickyFormFooter
        start={
          outstanding.length === 0
            ? 'Všechno povinné je vyplněné.'
            : `Zbývá ${outstanding.length} z ${requiredCount} povinných údajů`
        }
      >
        <Button variant="outlined" disabled={submitting} onClick={() => navigate('/patients')}>
          Zrušit
        </Button>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={() => { void submit(); }}
        >
          {submitting ? 'Ukládám…' : 'Uložit a pokračovat'}
        </Button>
      </StickyFormFooter>

      <CandidateReviewDialog
        open={review !== null}
        candidates={review?.candidates ?? []}
        submitting={submitting}
        onCancel={() => setReview(null)}
        onConfirmDistinct={() => { if (review !== null) void send(review.confirmation); }}
        onUseExisting={(candidate) => { setReview(null); navigate(entityTarget({ kind: 'patient', id: candidate.patientId }).to); }}
      />
    </Box>
    </PageFrame>
  );
}

/** One block of the form: a shelf (its title is the section's heading) holding a padded board. */
function FormShelf({
  id, title, hint, field, children,
}: { id: string; title: string; hint?: string; field?: string; children: React.ReactNode }) {
  return (
    <Shelf id={id} title={title} hint={hint} layout="board" stagger={false}>
      <Box data-field={field} sx={{ p: { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Shelf>
  );
}

/** The board's label-over-value pair (OSOBNÍ ÚDAJE on the patient card). */
function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <SectionLabel sx={{ mb: 0.25 }}>{label}</SectionLabel>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';
}
