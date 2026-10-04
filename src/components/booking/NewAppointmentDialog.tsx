import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlineOutlined";
import ContentCopy from "@mui/icons-material/ContentCopy";
import EventBusyOutlined from "@mui/icons-material/EventBusyOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { activitiesApi } from "../../api/activities";
import { clinicServicesApi } from "../../api/clinicServices";
import { workingHoursApi } from "../../api/workingHours";
import { calendarsApi } from "../../api/calendars";
import { patientPreRegistrationApi } from "../../api/patientPreRegistration";
import { useDevice } from "../../layout/useDevice";
import { BookingApiError } from "../../api/apiError";
import { isKnownPaperworkReason } from "../../api/bookingContracts";
import { usePermission } from "../../auth/usePermission";
import { DESIGN, SectionLabel, SoftCard } from "../ui";
import {
  addDaysToDateOnly,
  formatDateOnly,
  formatPragueDateTime,
  toDateOnly,
} from "../../utils/time";
import { dayState, dayStateLabelKey } from "../../pages/booking/dayState";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";
import { ActivityCards } from "./drawer/ActivityCards";
import { DrawerFrame } from "./drawer/DrawerFrame";
import { ModeCards } from "./drawer/ModeCards";
import { PatientSearch } from "./patient/PatientSearch";
import { PatientFilled } from "./patient/PatientFilled";
import { QuickPatientForm } from "./patient/QuickPatientForm";
import { EMPTY_ON_SITE_CONSENTS, recordOnSiteConsents, type OnSiteConsentSelection } from "./patient/OnSiteConsentsField";
import toast from "react-hot-toast";
import {
  QuickRegisterError,
  isQuickConflict,
  quickConflictText,
  toQuickRegisterError,
} from "./patient/quickRegisterErrors";
import { QuickBookedPanel, type QuickBookedView } from "./quick/QuickBookedPanel";
import { completionUrl, formatDeadline } from "./quick/quickBooking";
import { usePatientCard } from "./patient/patientCard";
import { toHit, type PatientHit } from "./patient/patientTypeahead";
import { patientsApi } from "../../api/patients";
import {
  EMPTY_QUICK_DRAFT,
  drawerTitle,
  endClock,
  formatCzk,
  isCompleteMoment,
  isDateOnly,
  isQuickDraftComplete,
  isStartOffered,
  normalizePhone,
  normalizeTime,
  parseLocalDateTime,
  pragueClock,
  selectionMinutes,
  slotSubtitle,
  slotTitle,
  splitFullName,
  stepSubtitle,
  toStartUtc,
  type DrawerMode,
  type DrawerStep,
  type LocalMoment,
  type QuickPatientDraft,
} from "./NewAppointmentDialog.logic";

/**
 * Booking an appointment by hand - contract 5.9, drawn as the board's
 * right-hand drawer (design 2026-10-03, screens 8–11) in two steps: **who
 * comes**, then **what is done**. Opened from the calendar grid with a time
 * already chosen (a click or a drag), it starts at the patient: the slot is
 * already there in the summary card, one "Změnit" away if it was wrong.
 *
 * This is the only screen in the application that creates an appointment.
 *
 * Step 1 - "kdo přijde" - has two cards and one small link (clubs are not booked here, Etapa 4 D8):
 *   - **Z databáze**: search the register, pick the row.
 *   - **Rychlá registrace** (Etapa 2, decision 7, contract C2): the caller is
 *     new, the slot is already chosen, so four things are typed - name and
 *     surname, telephone, e-mail, činnost - and ONE call books the slot,
 *     creates the provisional patient and issues the completion link. No date
 *     of birth, ever; no second step. The panel that follows shows the
 *     deadline the server set, the link to copy, and what is prefilled.
 *     Nothing is sent: there is no mail or SMS provider yet.
 *   - *Jen zablokovat čas bez pacienta*: the old "Událost bez vazby" - a
 *     slot with nobody behind it, for training or a service visit.
 *
 * Step 2 - "co se bude dělat" - is the činnost, the time, the note and the
 * two checkboxes, with the price in the footer.
 *
 * Three rules hold the flow together:
 *
 *   - **6.1** - whether a time is free is the server's answer. The chosen start
 *     is checked against `availability` for the chosen činnost, and the only
 *     times offered instead are the ones that answer returned. The činnosti on
 *     offer are the ones the server says the day offers
 *     (`preview.offeredActivityIds`); the rest are reachable behind "Zobrazit
 *     všechny činnosti z ceníku" and book only through the override.
 *   - **6.4** - a time outside the offer is reachable only as an override: only
 *     for `bookings.edit`, set apart, and never without a typed reason.
 *   - **6.3** - after the server confirms, nothing is drawn optimistically; the
 *     caller reloads. A `409` is somebody else having been faster: the offer
 *     reloads, the form stays, and the server's sentence is shown calmly.
 *
 * Where it lives is `DrawerFrame`'s business (Etapa 2, decision 13): the 580 px side
 * panel on a desktop or a tablet held sideways, a half-height bottom panel that grows
 * with the keyboard on an upright tablet, the whole screen on a phone. This file
 * only decides what goes in and switches a few layouts (one field per row, the
 * mode cards as rows) on `useDevice()`.
 *
 * The Czech wording lives in `TEXT` below rather than in `cs.json`, which
 * several teams edit at the same time; the keys that were already there are
 * still read through `t()`.
 */

/** 4.5: `source` 0 is the desk. Online is 1, a club is 2; neither books here. */
const SOURCE_STAFF = 0;

const TEXT = {
  who: "Kdo se objednává",
  findPatient: "Najít pacienta",
  newPatient: "Nový pacient — čtyři údaje",
  eventLink: "Jen zablokovat čas bez pacienta",
  eventTitle: "Čas bez pacienta",
  eventExplain: "Termín bez vazby na pacienta — např. školení nebo servis přístroje.",
  eventName: "Název události (nepovinné)",
  backToPatient: "Zpět na výběr pacienta",
  activity: "Činnost",
  note: "Poznámka",
  notePlaceholder: "Nepovinné — co má lékař vědět předem",
  date: "Datum",
  time: "Čas od",
  duration: "Trvání",
  until: "Čas do",
  change: "Změnit",
  changeMenu: "Změnit termín",
  nextFree: "Příští volný termín",
  tomorrow: "Zítra",
  nextWeek: "Příští týden",
  otherWhen: "Jiné datum a čas",
  pickInGrid: "Vybrat v kalendáři",
  noneFree: "V příštích 31 dnech kalendář nenabízí žádný volný termín.",
  seeking: "Hledám volný termín…",
  continue: "Pokračovat",
  createQuick: "Vytvořit rezervaci",
  creating: "Vytvářím…",
  quickBookedTitle: "Rezervace vytvořena",
  book: "Objednat termín",
  total: "Celkem k úhradě",
  pickWhenFirst: "Nejprve vyberte kalendář, datum a čas.",
  dayOffersNothing: "V tento den kalendář nenabízí žádnou činnost",
  free: "Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.",
  notOffered: (time: string) =>
    `V ${time} tuto činnost nabídnout nelze — čas je obsazený nebo mimo pracovní dobu.`,
  pickOffered: "Volné začátky v tento den:",
  chained: "po předchozí rezervaci",
  chainedNow: "Začíná hned po předchozí rezervaci (s pauzou, kterou ordinace nastavila).",
  freeTime: "Jiný čas",
  freeTimeHelp: "Napište přesný začátek (HH:mm). Rezervace se uloží, pokud se do něj vejde celá délka činnosti; jinak vám server napíše proč.",
  freeTimeUse: "Použít tento čas",
  freeTimeBad: "Zadejte čas ve tvaru HH:mm, například 09:40.",
  freeTimeActive: (time: string) =>
    `Čas ${time} je mimo nabídku. Rezervace se přesto pokusí uložit — server ověří, že se vejde celá délka činnosti.`,
  noneThatDay: "V tento den už pro tuto činnost není volný čas. Zkuste jiné datum.",
  overrideTimeIs: (when: string) => `Objedná se na ${when}, mimo nabídku.`,
  sms: (phone: string | null) => `Poslat SMS s potvrzením${phone ? ` na ${phone}` : ""}`,
  smsUnavailable: "SMS zatím nejsou aktivní (připravujeme).",
  sendLink: "Poslat odkaz na vyplnění vstupního dotazníku",
  sendLinkNobody: "Bez registrovaného pacienta není komu odkaz poslat.",
  linkTitle: "Odkaz pro pacienta (pošlete e-mailem):",
  linkSent: "E-mail s odkazem je ve frontě k odeslání.",
  linkValidUntil: (when: string) =>
    `Platí do ${when}. Když pacient do té doby registraci nedokončí, rezervace se uvolní.`,
  linkFailed: "Odkaz se nepodařilo vygenerovat.",
  linkRetry: "Zkusit znovu",
};

/** A slot the calendar found: clinic local date, `HH:mm` start and `HH:mm` end. */
export interface FoundSlot {
  date: string;
  time: string;
  end: string;
}

interface NewAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whatever list the dialog was opened from reloads itself (6.3). */
  onBooked: () => void;
  /**
   * "Příští volný termín" on the slot card: the calendar screen knows what is
   * booked, blocked and closed, so it answers; the drawer only asks. From the
   * moment given (exclusive), on the calendar given.
   */
  onFindNextFree?: (after: LocalMoment, calendarId: string) => Promise<FoundSlot | null>;
  /** The day the caller was looking at, when no time was chosen. */
  initialDate?: string;
  /** The calendar the caller was looking at, or the column clicked. */
  initialCalendarId?: string;
  /** Start chosen in the grid, local clinic time `yyyy-MM-ddTHH:mm`. */
  initialStart?: string;
  /** End of the dragged range, local clinic time `yyyy-MM-ddTHH:mm`. */
  initialEnd?: string;
  /**
   * Opened from a patient's card: the drawer starts in "Z databáze" with this
   * patient already chosen, so the desk goes straight to the činnost.
   */
  initialPatientId?: string;
  /**
   * Opened from "Nová objednávka → Rychlá registrace": the drawer starts in the
   * quick-registration mode, with the činnost already chosen when one is given.
   */
  initialQuick?: boolean;
  initialActivityId?: string;
}

interface IssuedLinkView {
  url: string;
  emailQueued: boolean;
  /** When the link stops working - the server's setting, never a number written here. */
  expiresAtUtc: string | null;
}

interface BookedView {
  startUtc: string;
  warnings: { code: string; message: string }[];
  /** The completion link issued after booking, when it was asked for. */
  link: IssuedLinkView | null;
  linkFailed: boolean;
  patientId: string | null;
}

export function NewAppointmentDialog({
  open,
  onClose,
  onBooked,
  initialDate,
  initialCalendarId,
  initialStart,
  initialEnd,
  initialPatientId,
  initialQuick = false,
  initialActivityId,
  onFindNextFree,
}: NewAppointmentDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /*
   * Booking past the offer: the person who may change an appointment is the
   * person who may book one outside what the server offered.
   */
  const mayOverride = usePermission("bookings.edit");
  /* The working-hours screen is where activities are assigned; it needs this. */
  const mayAssign = usePermission("settings.clinic.manage");
  const mayRegister = usePermission("patients.register");

  /* ── Where and when. From the grid this arrives chosen. ── */
  const startProp = parseLocalDateTime(initialStart);
  const fromGrid = startProp !== null && Boolean(initialCalendarId);

  const [calendarId, setCalendarId] = useState(initialCalendarId ?? "");
  const [date, setDate] = useState(
    startProp?.date ?? initialDate ?? toDateOnly(new Date()),
  );
  const [time, setTime] = useState(startProp?.time ?? "");
  /* The end of the dragged range - it describes the time only until the time changes. */
  const [selectionEnd, setSelectionEnd] = useState<string | null>(() => {
    const endProp = parseLocalDateTime(initialEnd);
    return startProp && selectionMinutes(startProp, endProp) !== null
      ? (endProp?.time ?? null)
      : null;
  });
  const [editingWhen, setEditingWhen] = useState(!fromGrid);
  /* "Změnit" on the slot card opens a small menu rather than only closing. */
  const [changeAnchor, setChangeAnchor] = useState<HTMLElement | null>(null);
  const [seekingFree, setSeekingFree] = useState(false);
  const [whenNote, setWhenNote] = useState<string | null>(null);

  /* ── The two steps and who the slot is for ── */
  const [step, setStep] = useState<DrawerStep>(1);
  const [mode, setMode] = useState<DrawerMode>(initialQuick ? "quick" : "database");
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [onSiteConsents, setOnSiteConsents] = useState<OnSiteConsentSelection>(EMPTY_ON_SITE_CONSENTS);
  const [quick, setQuick] = useState<QuickPatientDraft>(() => ({
    ...EMPTY_QUICK_DRAFT,
    activityId: initialActivityId ?? "",
  }));
  const [eventName, setEventName] = useState("");
  /* What the desk sees once a quick registration went through. */
  const [quickBooked, setQuickBooked] = useState<QuickBookedView | null>(null);
  /* The server's refusal of the four facts, pinned to the box it named. */
  const [quickRefusal, setQuickRefusal] = useState<QuickRegisterError | null>(null);

  /* A patient handed over by their card is looked up once and put in place. */
  useEffect(() => {
    if (!initialPatientId) return undefined;
    let alive = true;
    patientsApi
      .getById(initialPatientId)
      .then((row) => {
        if (!alive) return;
        const hit = toHit(row);
        if (hit) {
          setMode("database");
          setPatient(hit);
        }
      })
      .catch(() => {
        /* Unknown id or no permission: the drawer simply starts with nobody chosen. */
      });
    return () => {
      alive = false;
    };
  }, [initialPatientId]);

  /* ── What, a note, and the two checkboxes ── */
  const [activityId, setActivityId] = useState("");
  const [note, setNote] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [sendLink, setSendLink] = useState(false);

  /* 6.4: a time outside the offer, and never without a reason. */
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [conflict, setConflict] = useState<unknown>(null);
  const [booked, setBooked] = useState<BookedView | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: activitiesApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  /* 6.5: a calendar the user may not see is simply not in the answer. */
  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );
  const activities = useMemo(
    () => (activitiesQuery.data?.activities ?? []).filter((a) => a.isActive),
    [activitiesQuery.data],
  );

  /* One calendar needs no choosing; one the list does not hold is no choice. */
  const effectiveCalendarId = calendars.some((c) => c.id === calendarId)
    ? calendarId
    : calendars.length === 1
      ? calendars[0].id
      : "";
  const calendar = calendars.find((c) => c.id === effectiveCalendarId) ?? null;

  const moment = { date, time };
  const whenComplete = effectiveCalendarId !== "" && isCompleteMoment(moment);
  const startUtc = whenComplete ? toStartUtc(moment) : null;

  /*
   * What the day offers, asked of the server: which činnosti it has and, if
   * none, why (holiday, closed, nothing assigned). Rule 6.1 again - this reads
   * the answer, it does not compute one.
   */
  const previewQuery = useQuery({
    queryKey: ["preview", effectiveCalendarId, date, date],
    queryFn: () => workingHoursApi.preview(effectiveCalendarId, date, date),
    enabled: open && effectiveCalendarId !== "" && isDateOnly(date),
  });
  /*
   * Služba first, then činnost: the činnosti offered are those of the chosen service only. A clinic whose činnosti
   * carry no service (or whose services did not load) is not gated.
   */
  const [serviceId, setServiceId] = useState("");
  const serviceOptions = useMemo(
    () =>
      (servicesQuery.data ?? [])
        .filter((sv) => sv.isActive && activities.some((a) => a.clinicServiceId === sv.id))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "cs")),
    [servicesQuery.data, activities],
  );
  const serviceGate = serviceOptions.length > 0;
  const pickedActivityId = mode === "quick" ? quick.activityId : activityId;
  const effectiveServiceId = !serviceGate
    ? ""
    : serviceOptions.some((sv) => sv.id === serviceId)
      ? serviceId
      : serviceOptions.length === 1
        ? serviceOptions[0].id
        : (activities.find((a) => a.id === pickedActivityId)?.clinicServiceId ?? "");
  const scopedActivities = useMemo(
    () => (!serviceGate ? activities : activities.filter((a) => a.clinicServiceId === effectiveServiceId)),
    [serviceGate, activities, effectiveServiceId],
  );
  const offeredActivities = useMemo(() => {
    const ids = new Set((previewQuery.data ?? []).flatMap((p) => p.offeredActivityIds ?? []));
    return scopedActivities.filter((a) => ids.has(a.id));
  }, [previewQuery.data, scopedActivities]);
  const otherActivities = useMemo(() => {
    const offered = new Set(offeredActivities.map((a) => a.id));
    return scopedActivities.filter((a) => !offered.has(a.id));
  }, [scopedActivities, offeredActivities]);
  const changeService = (id: string) => {
    setServiceId(id);
    setActivityId("");
    setQuick((q) => (activities.find((a) => a.id === q.activityId)?.clinicServiceId === id ? q : { ...q, activityId: "" }));
    setOverriding(false);
    setConflict(null);
  };
  const day = dayState(previewQuery.data ?? []);
  const dayWordKey = dayStateLabelKey(day);
  /* In "Rychlá registrace" the činnost is chosen with the four facts; elsewhere on step 2. */
  const chosenActivityId = mode === "quick" ? quick.activityId : activityId;
  const activity = scopedActivities.find((a) => a.id === chosenActivityId) ?? null;

  /* Is the chosen start offered for this činnost? Only the server knows. */
  const availabilityQuery = useQuery({
    queryKey: ["availability", effectiveCalendarId, activity?.id ?? "", date, date, "staff"],
    queryFn: () =>
      appointmentsApi.getAvailability(effectiveCalendarId, activity?.id ?? "", date, date, { staffStarts: true }),
    enabled: open && startUtc !== null && activity !== null,
  });
  /* "Jiný čas": the desk typed a minute that is not on the list; the server decides whether the whole length fits. */
  const [freeStart, setFreeStart] = useState(false);
  const [freeDraft, setFreeDraft] = useState("");
  const listed = isStartOffered(availabilityQuery.data, startUtc);
  const offered = listed || (freeStart && startUtc !== null);
  const currentSlot = (availabilityQuery.data ?? []).find(
    (s) => startUtc !== null && Date.parse(s.startUtc) === Date.parse(startUtc),
  );
  const alternatives = (availabilityQuery.data ?? []).filter(
    (s) => !isStartOffered([s], startUtc),
  );

  /* The picked patient's contacts, for the SMS line; the same query the card reads. */
  const patientCard = usePatientCard(patient?.id ?? null, patient !== null);
  const quickPhone = normalizePhone(quick.phone);
  const contactPhone = patient !== null ? (patientCard.data?.phone ?? patient.phone ?? null) : null;

  const issueLink = async (patientId: string): Promise<IssuedLinkView> => {
    const issued = await patientPreRegistrationApi.issueLink(patientId);
    return {
      url: issued.url ?? `${window.location.origin}${issued.path}`,
      emailQueued: Boolean(issued.emailQueued || issued.emailWillSend),
      expiresAtUtc: issued.expiresAtUtc ?? null,
    };
  };

  const book = useMutation({
    mutationFn: async (input: { overrideReason?: string }): Promise<BookedView> => {
      const noteOrNull = note.trim() === "" ? null : note.trim();

      /* A registered patient goes through the ordinary booking, with its patient
         checks and its warnings. An event with nobody behind it goes through
         the unregistered path. (A new caller is "Rychlá registrace" - `bookQuick`.) */
      let view: BookedView;
      if (patient !== null) {
        const result = await appointmentsApi.create({
          patientId: patient.id,
          calendarId: effectiveCalendarId,
          activityId: activity?.id ?? "",
          startUtc: startUtc ?? "",
          source: SOURCE_STAFF,
          note: noteOrNull,
          overrideReason: input.overrideReason,
        });
        view = {
          startUtc: result.appointment.startUtc,
          warnings: result.warnings ?? [],
          link: null,
          linkFailed: false,
          patientId: patient.id,
        };
      } else {
        const name = eventName.trim();
        const appointment = await appointmentsApi.createUnregistered({
          calendarId: effectiveCalendarId,
          activityId: activity?.id ?? "",
          startUtc: startUtc ?? "",
          name: name === "" ? null : name,
          phone: null,
          note: noteOrNull,
          overrideReason: input.overrideReason,
        });
        view = { startUtc: appointment.startUtc, warnings: [], link: null, linkFailed: false, patientId: null };
      }

      /* The link is asked for after the booking, so the e-mail can name the
         appointment. A link that fails must not unbook anybody: it is retried
         from the booked screen instead. */
      if (sendLink && view.patientId) {
        try {
          view.link = await issueLink(view.patientId);
        } catch {
          view.linkFailed = true;
        }
      }
      return view;
    },
    onSuccess: (result) => {
      setConflict(null);
      setBooked(result);
      onBooked();
    },
    onError: (error) => {
      if (error instanceof BookingApiError && error.isConflict) {
        /* 6.3: the offer is stale, so fetch it again and keep the form. */
        setConflict(error);
        void queryClient.invalidateQueries({
          queryKey: ["availability", effectiveCalendarId, activity?.id ?? ""],
        });
      }
      if (error instanceof BookingApiError && error.kind === "notFound") {
        /* 4.5/5.9: the lists are older than the server. */
        void queryClient.invalidateQueries({ queryKey: ["calendars"] });
        void queryClient.invalidateQueries({ queryKey: ["activities"] });
      }
    },
  });

  /*
   * "Rychlá registrace": one call books the chosen slot, creates the
   * provisional patient and issues the completion link (C2). A taken slot is a
   * calm outcome (409): the offer reloads and the form stays. Any other
   * refusal is shown at the box the server named.
   */
  const bookQuick = useMutation({
    mutationFn: async (input: { overrideReason?: string }): Promise<QuickBookedView> => {
      const name = splitFullName(quick.name);
      const phone = normalizePhone(quick.phone);
      if (!name || !phone || !activity || !startUtc) {
        throw new QuickRegisterError("Vyplňte všechny čtyři údaje.");
      }
      const result = await appointmentsApi.createQuick(effectiveCalendarId, {
        activityId: activity.id,
        startUtc,
        firstName: name.firstName,
        lastName: name.lastName,
        phone,
        email: quick.email.trim(),
        overrideReason: input.overrideReason,
      });
      /* The patient exists now: record the consents signed on paper. A failure never
         undoes the booking; it is a warning the desk can repeat from the registration. */
      const recorded = await recordOnSiteConsents(result.patientId, activity.id, onSiteConsents);
      if (recorded.status === "recorded") toast.success("Souhlasy podepsané na místě byly zapsány.");
      if (recorded.status === "failed") toast.error(recorded.message);
      return {
        startUtc: result.appointment.startUtc,
        endUtc: result.appointment.endUtc ?? null,
        activityName: result.appointment.activityName || activity.name,
        calendarName: calendar?.name,
        deadlineUtc:
          result.registrationDeadlineUtc ??
          result.appointment.registrationDeadlineUtc ??
          result.completionLink.expiresAtUtc,
        linkUrl: completionUrl(result.completionLink, window.location.origin),
        prefilled: {
          name: `${name.firstName} ${name.lastName}`,
          phone,
          email: quick.email.trim(),
          activity: `${activity.name} — ${formatCzk(activity.priceCzk)} · ${activity.durationMinutes} min`,
        },
      };
    },
    onSuccess: (view) => {
      setConflict(null);
      setQuickRefusal(null);
      setQuickBooked(view);
      onBooked();
    },
    onError: (error) => {
      if (isQuickConflict(error)) {
        /* 6.3: somebody was faster. Reload the offer, keep what was typed. */
        setConflict(new BookingApiError("conflict", 409, quickConflictText(error)));
        setQuickRefusal(null);
        void queryClient.invalidateQueries({
          queryKey: ["availability", effectiveCalendarId, activity?.id ?? ""],
        });
        return;
      }
      setConflict(null);
      setQuickRefusal(toQuickRegisterError(error));
    },
  });

  const submitBooking = (overrideReason?: string) =>
    mode === "quick" ? bookQuick.mutate({ overrideReason }) : book.mutate({ overrideReason });
  const booking = book.isPending || bookQuick.isPending;
  const serviceField = serviceGate ? (
    <Box component="section" data-testid="service-first">
      <SectionLabel component="label" sx={{ mb: 0.5 }}>Služba</SectionLabel>
      <TextField
        select
        fullWidth
        size="small"
        value={effectiveServiceId}
        onChange={(e) => changeService(e.target.value)}
        disabled={booking}
        slotProps={{ select: { displayEmpty: true, "aria-label": "Služba" } }}
        helperText={effectiveServiceId === "" ? "Nejdřív vyberte službu — nabídnou se její činnosti." : undefined}
      >
        <MenuItem value="" disabled>Vyberte službu</MenuItem>
        {serviceOptions.map((sv) => (
          <MenuItem key={sv.id} value={sv.id} sx={{ minHeight: 44 }}>{sv.name}</MenuItem>
        ))}
      </TextField>
    </Box>
  ) : null;

  /* The link, asked for again from the booked screen when the first try failed. */
  const retryLink = useMutation({
    mutationFn: (patientId: string) => issueLink(patientId),
    onSuccess: (link) =>
      setBooked((b) => (b ? { ...b, link, linkFailed: false } : b)),
    onError: () => setBooked((b) => (b ? { ...b, linkFailed: true } : b)),
  });

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard blocked; the address is on screen to copy by hand */
    }
  };

  /* Any change to the time drops the dragged end: it no longer describes it. */
  const changeTime = (next: string) => {
    setFreeStart(false);
    setTime(next);
    setSelectionEnd(null);
    setOverriding(false);
    setConflict(null);
  };

  const changeDate = (next: string) => {
    if (!next) return;
    setFreeStart(false);
    setDate(next);
    setSelectionEnd(null);
    setOverriding(false);
    setConflict(null);
  };

  const resetBooking = () => {
    setFreeStart(false);
    setFreeDraft('');
    setStep(1);
    setMode("database");
    setPatient(null);
    setQuick(EMPTY_QUICK_DRAFT);
    setOnSiteConsents(EMPTY_ON_SITE_CONSENTS);
    setEventName("");
    setQuickBooked(null);
    setQuickRefusal(null);
    setActivityId("");
    setServiceId("");
    setNote("");
    setSendSms(false);
    setSendLink(false);
    setOverriding(false);
    setOverrideReason("");
    setConflict(null);
    setBooked(null);
    setLinkCopied(false);
    book.reset();
    bookQuick.reset();
    retryLink.reset();
  };

  /* Switching mode clears who the last mode named, so a walk-in's name cannot ride
     along onto a registered booking, or the other way round. */
  const changeMode = (next: DrawerMode) => {
    if (next === mode) return;
    setMode(next);
    setPatient(null);
    setEventName("");
    setSendLink(false);
    setConflict(null);
    setQuickRefusal(null);
  };

  /* From the empty search result straight to the new-patient card, name carried over. */
  const quickRegisterFromSearch = (typed: string) => {
    changeMode("quick");
    setQuick((q) => ({ ...q, name: typed }));
  };

  const close = () => {
    resetBooking();
    onClose();
  };

  /*
   * The time on the slot card was wrong. "Změnit" offers the quick ways out -
   * the next free slot, tomorrow, next week - before the date and time fields
   * or, from the grid, picking again there.
   */
  const moveTo = (next: { date: string; time?: string; end?: string | null }) => {
    setDate(next.date);
    if (next.time !== undefined) setTime(next.time);
    if (next.end !== undefined) setSelectionEnd(next.end);
    setOverriding(false);
    setConflict(null);
    setWhenNote(null);
    setEditingWhen(false);
  };

  const shiftDays = (days: number) => {
    setChangeAnchor(null);
    if (!isDateOnly(date)) return;
    moveTo({ date: addDaysToDateOnly(date, days) });
  };

  const findNextFree = async () => {
    setChangeAnchor(null);
    if (!onFindNextFree || effectiveCalendarId === "") return;
    setSeekingFree(true);
    setWhenNote(null);
    try {
      const from: LocalMoment = {
        date: isDateOnly(date) ? date : toDateOnly(new Date()),
        time: normalizeTime(time) || "00:00",
      };
      const found = await onFindNextFree(from, effectiveCalendarId);
      if (found) {
        moveTo({ date: found.date, time: found.time, end: found.end });
      } else {
        setWhenNote(TEXT.noneFree);
      }
    } catch {
      setWhenNote(TEXT.noneFree);
    } finally {
      setSeekingFree(false);
    }
  };

  const editWhen = () => {
    setChangeAnchor(null);
    setEditingWhen(true);
  };

  const pickInGrid = () => {
    setChangeAnchor(null);
    close();
  };

  const goToStep2 = () => setStep(2);

  /* Who the slot is for is ready when a patient is picked or nothing is needed
     (event). A new caller (quick) never continues to step 2 - the four facts book
     the slot straight away. */
  const whoReady = patient !== null || mode === "event";

  const canContinue = whoReady && whenComplete;

  const continueStep1 = () => {
    if (!canContinue) return;
    goToStep2();
  };

  const ready = whoReady && activity !== null && startUtc !== null && !booking;
  const canBook = ready && availabilityQuery.isSuccess && offered;
  const canBookOverride =
    ready && availabilityQuery.isSuccess && !offered && overrideReason.trim().length > 0;

  /* The same, for the four facts: no "who" to pick, but all four boxes and the činnost. */
  const quickReady =
    mode === "quick" &&
    isQuickDraftComplete(quick) &&
    activity !== null &&
    startUtc !== null &&
    !booking;
  const canBookQuick = quickReady && availabilityQuery.isSuccess && offered;
  const canOverrideQuick =
    quickReady && availabilityQuery.isSuccess && !offered && overrideReason.trim().length > 0;

  const labelId = "new-appointment-title";
  const device = useDevice();
  /* Buttons in the pinned footer: 46 px as drawn, and every one a full touch target on a phone. */
  const footerButton = { minHeight: device === "phone" ? 48 : 46, px: 3 } as const;

  /* ── Rychlá registrace went through: the deadline, the link, what is prefilled ── */
  if (quickBooked) {
    return (
      <DrawerFrame
        open={open}
        onClose={close}
        labelId={labelId}
        title={TEXT.quickBookedTitle}
        subtitle={formatPragueDateTime(quickBooked.startUtc)}
        footer={
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={resetBooking} sx={{ ...footerButton, flex: device === "phone" ? 1 : "none" }}>
              {t("booking.new.another")}
            </Button>
            <Button variant="contained" onClick={close} sx={{ ...footerButton, flex: device === "phone" ? 1 : "none" }}>
              {t("booking.detail.close")}
            </Button>
          </Stack>
        }
      >
        <QuickBookedPanel view={quickBooked} />
      </DrawerFrame>
    );
  }

  /* ── What the drawer looks like once the booking went through ── */
  if (booked) {
    return (
      <DrawerFrame
        open={open}
        onClose={close}
        labelId={labelId}
        title={t("booking.new.bookedTitle")}
        subtitle={formatPragueDateTime(booked.startUtc)}
        footer={
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={resetBooking}>
              {t("booking.new.another")}
            </Button>
            <Button variant="contained" onClick={close}>
              {t("booking.detail.close")}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2}>
          <Alert severity="success">
            {t("booking.new.bookedAt", { when: formatPragueDateTime(booked.startUtc) })}
          </Alert>
          {/*
            4.5: warnings are shown and do not block. The patient is on the
            phone; refusing the booking over a missing questionnaire would
            send them away over paperwork that can follow.
          */}
          {booked.warnings.map((w) => (
            <Alert key={w.code} severity="warning">
              {w.message ||
                (isKnownPaperworkReason(w.code.replace(/^.*\./, ""))
                  ? t(`booking.paperwork.${w.code.replace(/^.*\./, "")}`)
                  : t("booking.paperwork.unknown", { code: w.code }))}
            </Alert>
          ))}
          {/* The completion link, so the desk can send it or read it out. */}
          {booked.link ? (
            <SoftCard tone="soft" sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                {TEXT.linkTitle}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                <Box
                  sx={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: 13,
                    wordBreak: "break-all",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 1.25,
                    py: 1,
                  }}
                >
                  {booked.link.url}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<ContentCopy fontSize="small" />}
                  onClick={() => void copyLink(booked.link?.url ?? "")}
                >
                  {linkCopied ? "Zkopírováno" : "Kopírovat"}
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                {booked.link.emailQueued ? `${TEXT.linkSent} ` : ""}
                {booked.link.expiresAtUtc
                  ? TEXT.linkValidUntil(formatDeadline(booked.link.expiresAtUtc))
                  : ""}
              </Typography>
            </SoftCard>
          ) : booked.linkFailed && booked.patientId ? (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={retryLink.isPending}
                  onClick={() => retryLink.mutate(booked.patientId ?? "")}
                >
                  {TEXT.linkRetry}
                </Button>
              }
            >
              {TEXT.linkFailed}
            </Alert>
          ) : null}
        </Stack>
      </DrawerFrame>
    );
  }

  const dragged =
    whenComplete && selectionEnd
      ? selectionMinutes(moment, { date, time: selectionEnd })
      : null;
  const untilClock = activity && whenComplete ? endClock(moment, activity.durationMinutes) : "";

  /* The day's own word, when it is not an ordinary open day. Shown on both steps. */
  const dayNotice =
    whenComplete && previewQuery.isSuccess && dayWordKey !== null ? (
      <Box>
        <Alert severity="warning">
          {TEXT.dayOffersNothing}:{" "}
          {t(dayWordKey, { defaultValue: t("booking.grid.closed.other") })}.
          {day.kind === "nothing-to-book" ? ` ${t("booking.grid.noActivitiesWhy")}` : ""}
        </Alert>
        {day.kind === "nothing-to-book" && mayAssign ? (
          <Button size="small" component={RouterLink} to="/working-hours" sx={{ mt: 0.5 }}>
            {t("booking.grid.noActivitiesWhere")}
          </Button>
        ) : null}
      </Box>
    ) : null;

  /* ── Step 1: the slot, and who it is for ── */
  const slotCard =
    !editingWhen && whenComplete ? (
      <SoftCard tone="soft" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CalendarMonthOutlined fontSize="small" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {slotTitle(date, time, selectionEnd)}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              {[slotSubtitle(dragged), calendar?.name].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            aria-haspopup="menu"
            aria-expanded={changeAnchor !== null}
            disabled={seekingFree}
            onClick={(e) => setChangeAnchor(e.currentTarget)}
          >
            {seekingFree ? TEXT.seeking : TEXT.change}
          </Button>
        </Stack>
        {whenNote ? (
          <Typography variant="caption" sx={{ color: "warning.dark", display: "block", mt: 1 }}>
            {whenNote}
          </Typography>
        ) : null}
      </SoftCard>
    ) : (
      <SoftCard tone="soft" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={device === "phone" ? "column" : "row"} spacing={1.5}>
            {calendars.length > 1 ? (
              <TextField
                select
                fullWidth
                size="small"
                label={t("booking.new.calendar")}
                value={effectiveCalendarId}
                onChange={(e) => {
                  setCalendarId(e.target.value);
                  setConflict(null);
                }}
              >
                {calendars.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              type="date"
              size="small"
              label={TEXT.date}
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              type="time"
              size="small"
              label={TEXT.time}
              value={time}
              onChange={(e) => changeTime(normalizeTime(e.target.value))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
              sx={{ minWidth: 120 }}
            />
          </Stack>
          {!whenComplete ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {TEXT.pickWhenFirst}
            </Typography>
          ) : null}
          {/* The same quick choices the slot card's menu offers, for a drawer opened with no time. */}
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
            {onFindNextFree ? (
              <Button size="small" variant="outlined" disabled={seekingFree || effectiveCalendarId === ""} onClick={() => void findNextFree()}>
                {seekingFree ? TEXT.seeking : TEXT.nextFree}
              </Button>
            ) : null}
            <Button size="small" variant="outlined" disabled={!isDateOnly(date)} onClick={() => shiftDays(1)}>
              {TEXT.tomorrow}
            </Button>
            <Button size="small" variant="outlined" disabled={!isDateOnly(date)} onClick={() => shiftDays(7)}>
              {TEXT.nextWeek}
            </Button>
          </Stack>
          {whenNote ? (
            <Typography variant="caption" sx={{ color: "warning.dark" }}>
              {whenNote}
            </Typography>
          ) : null}
        </Stack>
      </SoftCard>
    );

  /* "Změnit" on the slot card: the quick ways to another time, then the fields. */
  const changeMenu = (
    <Menu
      open={changeAnchor !== null}
      anchorEl={changeAnchor}
      onClose={() => setChangeAnchor(null)}
      slotProps={{ list: { "aria-label": TEXT.changeMenu, dense: true } }}
    >
      {onFindNextFree ? (
        <MenuItem onClick={() => void findNextFree()} disabled={effectiveCalendarId === ""}>
          {TEXT.nextFree}
        </MenuItem>
      ) : null}
      <MenuItem onClick={() => shiftDays(1)}>{TEXT.tomorrow}</MenuItem>
      <MenuItem onClick={() => shiftDays(7)}>{TEXT.nextWeek}</MenuItem>
      <MenuItem onClick={editWhen}>{TEXT.otherWhen}</MenuItem>
      {fromGrid ? <MenuItem onClick={pickInGrid}>{TEXT.pickInGrid}</MenuItem> : null}
    </Menu>
  );

  /* Is the chosen time on the server's offer? The same answer for step 2 and for "Rychlá registrace". */
  const availabilityBlock = activity && whenComplete ? (
        <AsyncSection
          isLoading={availabilityQuery.isLoading}
          isSettled={availabilityQuery.isSuccess || availabilityQuery.isError}
          error={availabilityQuery.error}
          isEmpty={false}
          emptyText=""
          onRetry={() => void availabilityQuery.refetch()}
          skeletonRows={1}
        >
          {offered ? (
            <Stack spacing={0.75}>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                px: 1.5,
                py: 1.25,
                borderRadius: 2.5,
                bgcolor: DESIGN.tone.green.bg,
                color: DESIGN.tone.green.fg,
                border: "1px solid",
                borderColor: DESIGN.tone.green.line,
              }}
            >
              <CheckCircleOutline fontSize="small" />
              <Typography variant="body2">{listed ? TEXT.free : TEXT.freeTimeActive(time)}</Typography>
            </Stack>
            {listed && currentSlot?.kinds?.includes("chained") ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }} data-testid="chained-note">
                {TEXT.chainedNow}
              </Typography>
            ) : null}
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Alert severity="info">{TEXT.notOffered(time)}</Alert>
              {alternatives.length > 0 ? (
                <Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    {TEXT.pickOffered}
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, alignItems: "flex-start" }}>
                    {alternatives.map((slot) => (
                      <Stack key={slot.startUtc} sx={{ alignItems: "center" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={booking}
                          onClick={() => changeTime(pragueClock(slot.startUtc))}
                        >
                          {pragueClock(slot.startUtc)}
                        </Button>
                        {slot.kinds?.includes("chained") ? (
                          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 11, lineHeight: 1.2, mt: 0.25 }} data-testid="chained-label">
                            {TEXT.chained}
                          </Typography>
                        ) : null}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {TEXT.noneThatDay}
                </Typography>
              )}

              {/* "Jiný čas": any minute the desk types; the server accepts it when the whole length fits. */}
              <Stack spacing={0.75} data-testid="free-time">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{TEXT.freeTime}</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <TextField
                    size="small"
                    label={TEXT.freeTime}
                    placeholder="HH:mm"
                    value={freeDraft}
                    onChange={(e) => setFreeDraft(e.target.value)}
                    error={freeDraft !== "" && normalizeTime(freeDraft.trim().padStart(5, "0")) === ""}
                    helperText={freeDraft !== "" && normalizeTime(freeDraft.trim().padStart(5, "0")) === "" ? TEXT.freeTimeBad : TEXT.freeTimeHelp}
                    slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 5 } }}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={booking || normalizeTime(freeDraft.trim().padStart(5, "0")) === ""}
                    onClick={() => {
                      const typed = normalizeTime(freeDraft.trim().padStart(5, "0"));
                      if (typed === "") return;
                      changeTime(typed);
                      setFreeStart(true);
                    }}
                    sx={{ minHeight: 40 }}
                  >
                    {TEXT.freeTimeUse}
                  </Button>
                </Stack>
              </Stack>

              {/*
                6.4. Not an ordinary action: only a role that may override
                sees it at all, it is set apart, and it will not submit
                without a reason somebody typed.
              */}
              {mayOverride ? (
                overriding ? (
                  <Stack
                    spacing={1}
                    sx={{
                      border: "1px solid",
                      borderColor: DESIGN.tone.beige.line,
                      bgcolor: DESIGN.tone.beige.bg,
                      borderRadius: 2.5,
                      p: 2,
                    }}
                  >
                    <Typography variant="body2">{t("booking.new.overrideExplain")}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {TEXT.overrideTimeIs(`${formatDateOnly(date)} ${time}`)}
                    </Typography>
                    <TextField
                      size="small"
                      label={t("booking.new.overrideReason")}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        color="warning"
                        variant="contained"
                        disabled={!(mode === "quick" ? canOverrideQuick : canBookOverride)}
                        onClick={() => submitBooking(overrideReason.trim())}
                      >
                        {t("booking.new.overrideBook")}
                      </Button>
                      <Button size="small" onClick={() => setOverriding(false)}>
                        {t("booking.common.cancel")}
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box>
                    <Button size="small" color="warning" onClick={() => setOverriding(true)}>
                      {t("booking.new.overrideOpen")}
                    </Button>
                  </Box>
                )
              ) : null}
            </Stack>
          )}
        </AsyncSection>
      ) : null;

  const step1 = (
    <Stack spacing={3}>
      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess || calendarsQuery.isError}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.new.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={1}
      >
        {slotCard}
      </AsyncSection>
      {changeMenu}
      {dayNotice}

      {mode === "event" ? (
        <Box component="section" aria-label={TEXT.eventTitle}>
          <SectionLabel>{TEXT.eventTitle}</SectionLabel>
          <SoftCard sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {TEXT.eventExplain}
              </Typography>
              <TextField
                fullWidth
                autoFocus={device === "desktop"}
                placeholder="např. Školení, Servis přístroje"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                slotProps={{ htmlInput: { "aria-label": TEXT.eventName } }}
              />
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={() => changeMode("database")}
                sx={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600 }}
              >
                {TEXT.backToPatient}
              </Link>
            </Stack>
          </SoftCard>
        </Box>
      ) : (
        <Box component="section" aria-label={TEXT.who}>
          <SectionLabel>{TEXT.who}</SectionLabel>
          <ModeCards value={mode} onChange={changeMode} disabled={booking} />
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => changeMode("event")}
            sx={{ mt: 1, fontSize: 13, color: "text.secondary", fontWeight: 600 }}
          >
            {TEXT.eventLink}
          </Link>
        </Box>
      )}

      {mode === "database" ? (
        <Box component="section" aria-label={TEXT.findPatient}>
          <SectionLabel>{TEXT.findPatient}</SectionLabel>
          {patient ? (
            <PatientFilled hit={patient} onChange={() => setPatient(null)} />
          ) : (
            <PatientSearch
              enabled={open}
              /* A finger does not want the keyboard thrown up the moment the panel opens. */
              autoFocus={fromGrid && device === "desktop"}
              mayRegister={mayRegister}
              onPick={setPatient}
              onQuickRegister={quickRegisterFromSearch}
            />
          )}
        </Box>
      ) : null}

      {mode === "quick" ? (
        <Box component="section" aria-label={TEXT.newPatient}>
          <SectionLabel>{TEXT.newPatient}</SectionLabel>
          {serviceField ? <Box sx={{ mb: 1.5 }}>{serviceField}</Box> : null}
          <QuickPatientForm
            onSiteConsents={onSiteConsents}
            onOnSiteConsentsChange={setOnSiteConsents}
            value={quick}
            onChange={(next) => {
              setQuick(next);
              /* What was refused is no longer what is typed. */
              if (quickRefusal) setQuickRefusal(null);
              if (next.activityId !== quick.activityId) {
                setOverriding(false);
                setConflict(null);
              }
            }}
            activities={offeredActivities}
            otherActivities={otherActivities}
            disabled={booking}
            fieldErrors={
              quickRefusal?.field ? { [quickRefusal.field]: quickRefusal.message } : undefined
            }
          />
          {/* The server's answer on the chosen time, with the override for whoever may use it. */}
          {availabilityBlock ? <Box sx={{ mt: 2 }}>{availabilityBlock}</Box> : null}
          {conflict ? (
            <Alert severity="info" sx={{ mt: 1.5 }} onClose={() => setConflict(null)}>
              {errorText(conflict, t)}
            </Alert>
          ) : null}
          {quickRefusal && !quickRefusal.field ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {quickRefusal.message}
            </Alert>
          ) : null}
        </Box>
      ) : null}

    </Stack>
  );

  /* ── Step 2: the činnost, the time, the note ── */
  const whoCard =
    patient ? (
      <PatientFilled hit={patient} onChange={() => setStep(1)} />
    ) : (
      <SoftCard tone="soft" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText" }}>
            <EventBusyOutlined fontSize="small" />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {eventName.trim() || TEXT.eventTitle}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              {TEXT.eventExplain}
            </Typography>
          </Box>
          <Button size="small" onClick={() => setStep(1)}>
            {TEXT.change}
          </Button>
        </Stack>
      </SoftCard>
    );

  const readOnlyField = (label: string, value: string) => (
    <Box>
      <SectionLabel component="label" sx={{ mb: 0.5 }}>
        {label}
      </SectionLabel>
      <TextField
        fullWidth
        size="small"
        value={value}
        placeholder="—"
        slotProps={{
          input: { readOnly: true, sx: { bgcolor: DESIGN.head } },
          htmlInput: { "aria-label": label, tabIndex: -1 },
        }}
      />
    </Box>
  );

  const step2 = (
    <Stack spacing={3}>
      {whoCard}

      {serviceField}

      <Box component="section">
        <SectionLabel>{TEXT.activity}</SectionLabel>
        {serviceGate && effectiveServiceId === "" ? (
          <Typography variant="body2" data-testid="activity-hint" sx={{ color: "text.secondary" }}>
            Nejdřív vyberte službu.
          </Typography>
        ) : (
        <AsyncSection
          isLoading={activitiesQuery.isLoading || previewQuery.isLoading}
          isSettled={
            (activitiesQuery.isSuccess || activitiesQuery.isError) &&
            (previewQuery.isSuccess || previewQuery.isError)
          }
          error={activitiesQuery.error ?? previewQuery.error}
          isEmpty={activities.length === 0}
          emptyText={t("booking.new.noActivities")}
          onRetry={() => {
            void activitiesQuery.refetch();
            void previewQuery.refetch();
          }}
          skeletonRows={2}
        >
          {offeredActivities.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              {TEXT.dayOffersNothing}.
            </Typography>
          ) : null}
          <ActivityCards
            offered={offeredActivities}
            others={otherActivities}
            value={activity?.id ?? ""}
            onChange={(id) => {
              setActivityId(id);
              setOverriding(false);
              setConflict(null);
            }}
            disabled={booking}
          />
        </AsyncSection>
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: device === "phone" ? "1fr" : "1.4fr 1fr 1fr 1fr",
          gap: 1.5,
        }}
      >
        {calendars.length > 1 && !fromGrid ? (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <SectionLabel component="label" sx={{ mb: 0.5 }}>
              {t("booking.new.calendar")}
            </SectionLabel>
            <TextField
              select
              fullWidth
              size="small"
              value={effectiveCalendarId}
              onChange={(e) => {
                setCalendarId(e.target.value);
                setConflict(null);
              }}
              slotProps={{ select: { "aria-label": t("booking.new.calendar") } }}
            >
              {calendars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        ) : null}
        <Box>
          <SectionLabel component="label" sx={{ mb: 0.5 }}>
            {TEXT.date}
          </SectionLabel>
          <TextField
            type="date"
            size="small"
            fullWidth
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": TEXT.date } }}
          />
        </Box>
        <Box>
          <SectionLabel component="label" sx={{ mb: 0.5 }}>
            {TEXT.time}
          </SectionLabel>
          <TextField
            type="time"
            size="small"
            fullWidth
            value={time}
            onChange={(e) => changeTime(normalizeTime(e.target.value))}
            slotProps={{ htmlInput: { "aria-label": TEXT.time, step: 300 } }}
          />
        </Box>
        {readOnlyField(TEXT.duration, activity ? `${activity.durationMinutes} min` : "")}
        {readOnlyField(TEXT.until, untilClock)}
      </Box>

      {dayNotice}

      {conflict ? (
        <Alert severity="info" onClose={() => setConflict(null)}>
          {errorText(conflict, t)}
        </Alert>
      ) : null}

      {availabilityBlock}

      <Box component="section">
        <SectionLabel>{TEXT.note}</SectionLabel>
        <TextField
          fullWidth
          multiline
          minRows={2}
          placeholder={TEXT.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          slotProps={{ htmlInput: { "aria-label": TEXT.note } }}
        />
      </Box>

      <Stack spacing={0.5}>
        {/* 5.x: SMS confirmation is phase two. The control is shown so the
            desk knows it is coming, but it is disabled and sends nothing. */}
        <FormControlLabel
          control={
            <Checkbox disabled checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
          }
          label={
            <Box>
              <Typography variant="body2">{TEXT.sms(contactPhone)}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {TEXT.smsUnavailable}
              </Typography>
            </Box>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              disabled={patient === null || !mayRegister}
              checked={sendLink && patient !== null}
              onChange={(e) => setSendLink(e.target.checked)}
            />
          }
          label={
            <Box>
              <Typography variant="body2">{TEXT.sendLink}</Typography>
              {patient === null ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {TEXT.sendLinkNobody}
                </Typography>
              ) : null}
            </Box>
          }
        />
      </Stack>

      {/* A real failure, once the calm cases above have had their turn. */}
      {book.error && !conflict ? (
        <Alert severity="error">{errorText(book.error, t)}</Alert>
      ) : null}
    </Stack>
  );

  const phone = device === "phone";
  /* On a phone the primary action is the wider half of the pinned row. */
  const cancelButton = (
    <Button variant="outlined" onClick={close} sx={{ ...footerButton, flex: phone ? 1 : "none" }}>
      {t("booking.common.cancel")}
    </Button>
  );
  const primary = (label: string, disabled: boolean, onClick: () => void) => (
    <Button
      variant="contained"
      disabled={disabled}
      onClick={onClick}
      sx={{ ...footerButton, flex: phone ? 2 : "none" }}
    >
      {label}
    </Button>
  );

  const footer =
    step === 1 ? (
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        {cancelButton}
        {mode === "quick"
          ? primary(
              bookQuick.isPending ? TEXT.creating : TEXT.createQuick,
              !canBookQuick,
              () => submitBooking(),
            )
          : primary(
              TEXT.continue,
              !canContinue,
              continueStep1,
            )}
      </Stack>
    ) : (
      <Stack spacing={phone ? 1.5 : 0} direction={phone ? "column" : "row"} sx={{ alignItems: phone ? "stretch" : "center" }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: phone ? "baseline" : "flex-start", justifyContent: "space-between", flexDirection: phone ? "row" : "column" }}>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            {TEXT.total}
          </Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {formatCzk(activity?.priceCzk ?? null)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {cancelButton}
          {primary(TEXT.book, !canBook, () => submitBooking())}
        </Stack>
      </Stack>
    );

  return (
    <DrawerFrame
      open={open}
      onClose={close}
      onBack={step === 2 ? () => setStep(1) : undefined}
      labelId={labelId}
      title={drawerTitle(mode)}
      subtitle={stepSubtitle(step, mode)}
      footer={footer}
    >
      {step === 1 ? step1 : step2}
    </DrawerFrame>
  );
}

export default NewAppointmentDialog;
