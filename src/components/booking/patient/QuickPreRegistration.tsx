import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { PreRegistrationError, preRegistrationApi } from "../../../api/preRegistration";
import type { PreRegistrationResult } from "../../../api/preRegistration";
import { patientRegistryApi } from "../../../api/patientRegistry";
import type { RegistrationCandidate } from "../../../api/patientRegistry";
import { formatDateOnly, toDateOnly } from "../../../utils/time";
import type { PatientHit } from "./patientTypeahead";
import {
  EMPTY_QUICK_DRAFT,
  candidateLine,
  guessNameFromSearch,
  validateQuickDraft,
} from "./quickPreRegistration.logic";
import type { QuickField, QuickPreRegistrationDraft } from "./quickPreRegistration.logic";

const TEXT = {
  title: "Rychlá předregistrace",
  help:
    "Pro pacienta, který v databázi není. Založí se jako „Předregistrace“ a po objednání dostane " +
    "osobní odkaz, přes který si sám doplní adresu, pojištění a zdravotní dotazník.",
  firstName: "Jméno",
  lastName: "Příjmení",
  dateOfBirth: "Datum narození",
  dateOfBirthHelp: "Registr ho vyžaduje; pacient ho přes odkaz jen potvrdí.",
  email: "E-mail",
  emailHelp: "Sem přijde odkaz k dokončení registrace.",
  phone: "Telefon (nepovinný)",
  phoneHelp: "S předvolbou nebo bez ní, např. 601 234 567.",
  submit: "Založit a pokračovat v objednání",
  cancel: "Zpět na hledání",
  reviewTitle: "Pacient se stejným jménem a datem narození už v databázi je",
  reviewHelp:
    "Než založíte druhý záznam téhož člověka, vyberte ho ze seznamu. Nový záznam založte jen tehdy, " +
    "když jde opravdu o jinou osobu.",
  useThis: "Objednat tohoto pacienta",
  createAnyway: "Je to jiný člověk — založit nový záznam",
  phoneUnusable: "Telefon není platné číslo. Zadejte ho s předvolbou, nebo ho vynechte.",
};

/**
 * The desk's quick path: four facts, one button, a provisional patient.
 *
 * The registry's own duplicate check still runs. When it answers with
 * candidates the desk sees them by name and date of birth and either books
 * one of them or says, explicitly, that this is somebody else — the same
 * decision the full registration form asks for, in the same words.
 */
export function QuickPreRegistration({
  typed,
  onPick,
  onCancel,
}: {
  /** Whatever was in the search box, so the name is not typed twice. */
  typed: string;
  onPick: (hit: PatientHit) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<QuickPreRegistrationDraft>(() => ({
    ...EMPTY_QUICK_DRAFT,
    ...guessNameFromSearch(typed),
  }));
  const [errors, setErrors] = useState<Partial<Record<QuickField, string>>>({});
  /* One id for the whole attempt: a retry after a review registers one person. */
  const [patientId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState<PreRegistrationResult | null>(null);

  const set = (field: QuickField, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setReview(null);
  };

  const register = useMutation({
    mutationFn: async (confirmed: PreRegistrationResult | null) => {
      const phone = draft.phone.trim();
      let e164: string | null = null;

      if (phone !== "") {
        /* The registry's own reading of the number, never one assembled here. */
        const inspected = await patientRegistryApi.inspectPhone({ value: phone, regionCode: "CZ" });
        if (!inspected.parses || !inspected.isValid || inspected.e164 === "") {
          throw new PreRegistrationError(TEXT.phoneUnusable, 400, "phone", { phone: TEXT.phoneUnusable });
        }
        e164 = inspected.e164;
      }

      return preRegistrationApi.preRegister({
        patientId,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        dateOfBirth: draft.dateOfBirth,
        email: draft.email.trim(),
        phone: e164,
        confirmation:
          confirmed === null
            ? undefined
            : {
                registrationFingerprint: confirmed.registrationFingerprint,
                authorizationScopeFingerprint: confirmed.authorizationScopeFingerprint ?? "",
                candidateSetFingerprint: confirmed.candidateSetFingerprint ?? "",
                candidates: confirmed.candidates,
              },
      });
    },
    onSuccess: (result) => {
      if (result.outcome === "CandidateReviewRequired") {
        setReview(result);
        return;
      }
      onPick({
        id: result.patientId,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`,
        dateOfBirth: draft.dateOfBirth,
        provisional: true,
      });
    },
    onError: (error) => {
      if (error instanceof PreRegistrationError) {
        setErrors((previous) => ({ ...previous, ...error.fieldErrors }));
      }
    },
  });

  const submit = (confirmed: PreRegistrationResult | null) => {
    const found = validateQuickDraft(draft, toDateOnly(new Date()));
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    register.mutate(confirmed);
  };

  const pickCandidate = (candidate: RegistrationCandidate) =>
    onPick({
      id: candidate.patientId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      fullName: candidate.fullName?.trim() || `${candidate.firstName} ${candidate.lastName}`,
      dateOfBirth: candidate.dateOfBirth,
    });

  const field = (
    name: QuickField,
    label: string,
    help: string | undefined,
    extra: Record<string, unknown> = {},
  ) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={draft[name]}
      onChange={(e) => set(name, e.target.value)}
      error={errors[name] !== undefined}
      helperText={errors[name] ?? help}
      disabled={register.isPending}
      {...extra}
    />
  );

  return (
    <Box
      component="section"
      aria-label={TEXT.title}
      sx={{ border: "1px solid", borderColor: "primary.light", borderRadius: 2, p: 1.5 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {TEXT.title}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
        {TEXT.help}
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        {field("firstName", TEXT.firstName, undefined, { autoFocus: draft.firstName === "", autoComplete: "off" })}
        {field("lastName", TEXT.lastName, undefined, { autoComplete: "off" })}
        {field("dateOfBirth", TEXT.dateOfBirth, TEXT.dateOfBirthHelp, {
          type: "date",
          slotProps: { inputLabel: { shrink: true } },
        })}
        {field("email", TEXT.email, TEXT.emailHelp, { type: "email", autoComplete: "off" })}
        <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
          {field("phone", TEXT.phone, TEXT.phoneHelp, { inputMode: "tel", autoComplete: "off" })}
        </Box>
      </Box>

      {review ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {TEXT.reviewTitle}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {TEXT.reviewHelp}
          </Typography>
          <Stack spacing={0.5}>
            {review.candidates.map((candidate) => (
              <Stack
                key={candidate.patientId}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{candidateLine(candidate, formatDateOnly)}</Typography>
                <Button size="small" variant="outlined" onClick={() => pickCandidate(candidate)}>
                  {TEXT.useThis}
                </Button>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Button
            size="small"
            color="warning"
            variant="contained"
            disabled={register.isPending}
            onClick={() => submit(review)}
          >
            {TEXT.createAnyway}
          </Button>
        </Alert>
      ) : null}

      {register.error && !(register.error instanceof PreRegistrationError && Object.keys(register.error.fieldErrors).length > 0) ? (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {register.error.message}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {review === null ? (
          <Button
            variant="contained"
            size="small"
            disabled={register.isPending}
            onClick={() => submit(null)}
          >
            {TEXT.submit}
          </Button>
        ) : null}
        <Button size="small" onClick={onCancel} disabled={register.isPending}>
          {TEXT.cancel}
        </Button>
      </Stack>
    </Box>
  );
}
