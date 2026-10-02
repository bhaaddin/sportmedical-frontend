import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/LockOutlined";
import { toast } from "react-hot-toast";
import client from "../api/client";
import { patientsApi } from "../api/patients";
import { patientIdentityApi } from "../api/patientIdentity";
import { issuePortalLink } from "../api/patientPortal";
import { usePermission } from "../auth/usePermission";
import type { InsuranceRegistrationKind, ResidenceType } from "../api/patientRegistry";
import { parseBirthNumber } from "../services/patientRegistration/insuranceIdentifier";
import type { MapySuggestion } from "../api/addressLookup";
import { PageHeader, SectionLabel, SoftCard, StatusChip } from "../components/ui";
import MapyAddressPicker from "../components/registration/MapyAddressPicker";
import FormField from "../components/registration/FormField";
import IssuedLinkCard from "../components/registration/IssuedLinkCard";
import StickyFormFooter from "../components/registration/StickyFormFooter";

/**
 * Editing a patient - the `app` lane's contract,
 * `docs/engineering/patient-identity-write-contract.md`.
 *
 * This screen used to be one five-step form that sent everything to
 * `PUT /api/patients/{id}` and `PUT /api/patients/{id}/profile`. The second of
 * those wrote the birth number, insurance number, insurer and address as plain
 * text into a table of its own: no validation, no author, no reason, and
 * invisible to the patient registry. The clinic ended up with two answers to
 * "what is this patient's birth number", and the one this screen showed was the
 * one nobody governed - so a typo corrected here stayed a typo everywhere it
 * mattered.
 *
 * Those four fields are now read-only here and change through two routes that
 * ask why, record who, and run the checks registration runs. The profile save
 * sends them back exactly as it received them, which the contract supports as
 * the ordinary load-edit-save round trip; changing one there is refused with a
 * 409 naming the fields, and that refusal is a backstop, not the normal path.
 *
 * Dressed on 3. 10. 2026 to the design board, the same way as "Nový pacient":
 * PageHeader, bordered cards with small-caps labels, labels over the inputs,
 * the governed identity as label/value pairs in the right rail, and a sticky
 * footer whose "Uložit a pokračovat" saves whatever changed and goes back to
 * the card. The per-card "Uložit" buttons stay: each is one governed route.
 */

type Sex = "Male" | "Female" | "NotSpecified" | "Unknown";

/** The four fields this screen may show but not write. */
interface GovernedIdentity {
  birthNumber: string;
  insuranceNumber: string;
  healthInsurerCode: string;
  address: string;
}

type Demographics = {
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  sex: Sex;
};

/**
 * What the server says when it refuses a correction. `code` names the rule;
 * neither it nor `message` ever repeats a value that was sent.
 */
const CORRECTION_REFUSALS: Record<string, string> = {
  "patients.change_reason.required": "Napište, proč se údaje mění.",
  "patients.change_reason.too_long": "Důvod změny je příliš dlouhý.",
  "patients.change_reason.invalid_characters": "Důvod změny obsahuje nepovolené znaky.",
  "patients.sex.invalid": "Zvolte pohlaví.",
};

type ProfileFields = {
  insuredFrom: string;
  insuranceType: string;
  citizenship: string;
  treatingDoctors: string;
  occupation: string;
  employer: string;
  employmentType: string;
  notes: string;
};

const EMPTY_DEMOGRAPHICS: Demographics = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  sex: "Male",
};

const EMPTY_PROFILE: ProfileFields = {
  insuredFrom: "",
  insuranceType: "",
  citizenship: "",
  treatingDoctors: "",
  occupation: "",
  employer: "",
  employmentType: "",
  notes: "",
};

const EMPTY_GOVERNED: GovernedIdentity = {
  birthNumber: "",
  insuranceNumber: "",
  healthInsurerCode: "",
  address: "",
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "Male", label: "Muž" },
  { value: "Female", label: "Žena" },
  { value: "NotSpecified", label: "Neuvedeno" },
];

/** The label element a select names itself after - see FormField. */
const selectLabelledBy = (id: string) => ({ select: { labelId: `${id}-label` } });

export default function PatientForm() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  /*
   * The insurance correction rewrites the birth number and the insurance
   * number, so the server takes it only from somebody who may see them. For
   * anybody else the profile sends both as null: the dialog would open empty
   * and every save would be refused.
   */
  const maySeeIdentity = usePermission("patients.sensitive_identity.view");

  /**
   * Loaded through the same machinery as the booking screens: a query, and the
   * edited value laid over the server's answer. An effect that copies a
   * response into form state has to decide when to overwrite what the user is
   * typing, and gets it wrong at exactly the wrong moment.
   */
  const patientQuery = useQuery({
    queryKey: ["patient-edit", patientId],
    queryFn: async () => {
      const [patient, prof] = await Promise.all([
        patientsApi.getById(patientId!),
        patientsApi.getProfile(patientId!),
      ]);
      const p = (prof ?? {}) as Record<string, string | null>;
      return {
        demographics: {
          firstName: patient?.firstName ?? "",
          lastName: patient?.lastName ?? "",
          preferredName: (patient as { preferredName?: string })?.preferredName ?? "",
          dateOfBirth: (patient?.dateOfBirth ?? "").slice(0, 10),
          sex: ((patient?.sex as Sex) ?? "Male") as Sex,
        },
        profile: {
          insuredFrom: (p.insuredFrom ?? "").slice(0, 10),
          insuranceType: p.insuranceType ?? "",
          citizenship: p.citizenship ?? "",
          treatingDoctors: p.treatingDoctors ?? "",
          occupation: p.occupation ?? "",
          employer: p.employer ?? "",
          employmentType: p.employmentType ?? "",
          notes: p.notes ?? "",
        },
        /* Held exactly as the server gave them and sent back untouched. */
        governed: {
          birthNumber: p.birthNumber ?? "",
          insuranceNumber: p.insuranceNumber ?? "",
          healthInsurerCode: p.healthInsurerCode ?? "",
          address: p.address ?? "",
        } as GovernedIdentity,
      };
    },
    enabled: Boolean(patientId),
  });

  const [editedDemographics, setEditedDemographics] = useState<Demographics | null>(null);
  const [editedProfile, setEditedProfile] = useState<ProfileFields | null>(null);
  /* The patient's personal portal link, shown once after the desk issues it. */
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const issuePortal = async () => {
    if (!patientId) return;
    setPortalBusy(true);
    try {
      const token = await issuePortalLink(patientId);
      setPortalLink(`${window.location.origin}/portal/${token}`);
      toast.success("Přístup do portálu vytvořen.");
    } catch {
      toast.error("Odkaz se nepodařilo vytvořit.");
    } finally {
      setPortalBusy(false);
    }
  };

  const demographics = editedDemographics ?? patientQuery.data?.demographics ?? EMPTY_DEMOGRAPHICS;
  const profile = editedProfile ?? patientQuery.data?.profile ?? EMPTY_PROFILE;
  const governed = patientQuery.data?.governed ?? EMPTY_GOVERNED;

  const setDemographics = setEditedDemographics;
  const setProfile = setEditedProfile;

  const [demographicsReason, setDemographicsReason] = useState("");
  const [demographicsError, setDemographicsError] = useState<string | null>(null);
  const [savingDemographics, setSavingDemographics] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  const load = () => {
    setEditedDemographics(null);
    setEditedProfile(null);
    setDemographicsReason("");
    void patientQuery.refetch();
  };

  /*
   * Route 1: name, date of birth and sex identify the patient, so the server
   * takes a correction only with a reason, and records it with the signed-in
   * author. Sex is sent too - leaving it out made every save a 400.
   *
   * Answers whether it saved, so the footer can stop before going anywhere.
   */
  const saveDemographics = async (): Promise<boolean> => {
    if (!patientId || demographicsReason.trim() === "") return false;
    setSavingDemographics(true);
    setDemographicsError(null);
    try {
      await patientsApi.update(patientId, {
        firstName: demographics.firstName,
        lastName: demographics.lastName,
        preferredName: demographics.preferredName.trim() === "" ? null : demographics.preferredName,
        dateOfBirth: demographics.dateOfBirth,
        sex: demographics.sex,
        changeReason: demographicsReason.trim(),
      });
      toast.success("Jméno a demografie uloženy.");
      load();
      return true;
    } catch (error) {
      const body = (error as { response?: { data?: { code?: string; message?: string } } })
        ?.response?.data;
      setDemographicsError(
        (body?.code !== undefined ? CORRECTION_REFUSALS[body.code] : undefined)
          ?? body?.message
          ?? "Uložení se nezdařilo.",
      );
      return false;
    } finally {
      setSavingDemographics(false);
    }
  };

  const saveProfile = async (): Promise<boolean> => {
    if (!patientId) return false;
    setSavingProfile(true);
    try {
      /* The four governed fields go back exactly as they arrived. */
      await client.put(`/api/patients/${patientId}/profile`, {
        ...profile,
        ...governed,
      });
      toast.success("Ostatní údaje uloženy.");
      load();
      return true;
    } catch (error) {
      const refused = (
        error as { response?: { data?: { refusedFields?: string[]; message?: string } } }
      )?.response?.data;
      if (refused?.refusedFields?.length) {
        toast.error(
          `Server odmítl změnu identity: ${refused.refusedFields.join(", ")}. Použijte tlačítko Opravit.`,
        );
      } else {
        toast.error("Uložení se nezdařilo.");
      }
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  /*
   * The footer's "Uložit a pokračovat": saves whatever was touched - each
   * through its own route - and goes back to the card only when all of it
   * went through. A changed name without a reason stops here, at the reason.
   */
  const saveAndContinue = async () => {
    if (!patientId) return;
    const demographicsTouched = editedDemographics !== null;
    const profileTouched = editedProfile !== null;

    if (demographicsTouched && demographicsReason.trim() === "") {
      setDemographicsError(CORRECTION_REFUSALS["patients.change_reason.required"]!);
      const reasonBox = document.querySelector('[data-field="changeReason"]');
      if (reasonBox !== null && typeof reasonBox.scrollIntoView === "function") {
        reasonBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSavingAll(true);
    try {
      if (demographicsTouched && !(await saveDemographics())) return;
      if (profileTouched && !(await saveProfile())) return;
      navigate(`/patients/${patientId}`);
    } finally {
      setSavingAll(false);
    }
  };

  if (!patientId) return null;

  if (patientQuery.isPending) {
    return <Typography sx={{ p: 3 }}>Načítám…</Typography>;
  }

  if (patientQuery.isError) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Zkusit znovu
            </Button>
          }
        >
          Pacienta se nepodařilo načíst.
        </Alert>
      </Box>
    );
  }

  const loaded = patientQuery.data?.demographics;
  const fullName = loaded ? `${loaded.firstName} ${loaded.lastName}`.trim() : "";
  const busy = savingDemographics || savingProfile || savingAll;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 0, maxWidth: 1200, mx: "auto" }}>
      <PageHeader
        title="Úprava karty"
        subtitle={fullName !== "" ? `${fullName} · karta pacienta` : "Karta pacienta"}
        actions={
          <Button variant="outlined" onClick={() => navigate(`/patients/${patientId}`)}>
            Zpět na kartu
          </Button>
        }
      />

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Stack spacing={2} sx={{ flexGrow: 1, width: "100%", minWidth: 0 }}>
          {/* 1. Name and demographics — route 1 */}
          <SoftCard>
            <SectionLabel>Základní údaje</SectionLabel>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Jméno">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      value={demographics.firstName}
                      onChange={(e) =>
                        setDemographics({ ...demographics, firstName: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Příjmení">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      value={demographics.lastName}
                      onChange={(e) =>
                        setDemographics({ ...demographics, lastName: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Datum narození">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      type="date"
                      value={demographics.dateOfBirth}
                      onChange={(e) =>
                        setDemographics({ ...demographics, dateOfBirth: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Pohlaví">
                  {(id) => (
                    <TextField
                      id={id}
                      select
                      fullWidth
                      value={demographics.sex}
                      onChange={(e) =>
                        setDemographics({ ...demographics, sex: e.target.value as Sex })
                      }
                      slotProps={selectLabelledBy(id)}
                    >
                      {SEX_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </FormField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Oslovení">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      placeholder="Nepovinné"
                      value={demographics.preferredName}
                      onChange={(e) =>
                        setDemographics({ ...demographics, preferredName: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={12}>
                <FormField label="Důvod změny" required name="changeReason">
                  {(id) => (
                    <TextField
                      id={id}
                      required
                      fullWidth
                      multiline
                      minRows={2}
                      value={demographicsReason}
                      onChange={(e) => setDemographicsReason(e.target.value)}
                      helperText="Jméno, datum narození a pohlaví se bez důvodu neuloží. Zapíše se s vaším jménem."
                    />
                  )}
                </FormField>
              </Grid>
              {demographicsError ? (
                <Grid size={12}>
                  <Alert severity="error">{demographicsError}</Alert>
                </Grid>
              ) : null}
              <Grid size={12}>
                <Button
                  variant="outlined"
                  onClick={() => { void saveDemographics(); }}
                  disabled={busy || demographicsReason.trim() === ""}
                >
                  Uložit
                </Button>
              </Grid>
            </Grid>
          </SoftCard>

          {/* 3. Everything else — route 2 */}
          <SoftCard>
            <SectionLabel>Ostatní</SectionLabel>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Povolání">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      value={profile.occupation}
                      onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormField label="Zaměstnavatel">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      value={profile.employer}
                      onChange={(e) => setProfile({ ...profile, employer: e.target.value })}
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={12}>
                <FormField label="Ošetřující lékaři">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      value={profile.treatingDoctors}
                      onChange={(e) =>
                        setProfile({ ...profile, treatingDoctors: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={12}>
                <FormField label="Poznámky">
                  {(id) => (
                    <TextField
                      id={id}
                      fullWidth
                      multiline
                      minRows={3}
                      value={profile.notes}
                      onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                    />
                  )}
                </FormField>
              </Grid>
              <Grid size={12}>
                <Button variant="outlined" onClick={() => { void saveProfile(); }} disabled={busy}>
                  Uložit
                </Button>
              </Grid>
            </Grid>
          </SoftCard>
        </Stack>

        {/* 2. Identity — read-only, changed through the governed routes */}
        <Stack
          spacing={2}
          sx={{
            width: { xs: "100%", lg: 320 },
            flexShrink: 0,
            position: { lg: "sticky" },
            top: { lg: 16 },
          }}
        >
          <SoftCard>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <SectionLabel sx={{ mb: 0 }}>Pojištění a adresa</SectionLabel>
              <LockIcon sx={{ fontSize: 14, color: "text.secondary", ml: "auto" }} />
            </Stack>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Mění se jen se zdůvodněním — každá změna se zapisuje s autorem a důvodem
              do registru pacientů.
            </Typography>

            <Stack spacing={1.5}>
              <LabelValue label="Rodné číslo" value={governed.birthNumber} />
              <LabelValue label="Číslo pojištěnce" value={governed.insuranceNumber} />
              <LabelValue label="Pojišťovna" value={governed.healthInsurerCode} />
              <Divider />
              <LabelValue label="Adresa" value={governed.address} />
            </Stack>

            <Stack spacing={1} sx={{ mt: 2.5 }}>
              {maySeeIdentity && (
                <Button
                  startIcon={<EditIcon fontSize="small" />}
                  variant="outlined"
                  fullWidth
                  onClick={() => setInsuranceOpen(true)}
                >
                  Opravit pojištění
                </Button>
              )}
              <Button
                startIcon={<EditIcon fontSize="small" />}
                variant="outlined"
                fullWidth
                onClick={() => setAddressOpen(true)}
              >
                Opravit adresu
              </Button>
            </Stack>
          </SoftCard>

          <SoftCard>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <SectionLabel sx={{ mb: 0 }}>Portál pacienta</SectionLabel>
              {portalLink !== null && (
                <StatusChip tone="green" size="sm" sx={{ ml: "auto" }}>Vytvořen</StatusChip>
              )}
            </Stack>
            {portalLink === null ? (
              <>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
                  Osobní odkaz, přes který pacient vidí své termíny, dokumenty a faktury.
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={portalBusy}
                  onClick={() => { void issuePortal(); }}
                >
                  {portalBusy ? "Vytvářím…" : "Přístup do portálu"}
                </Button>
              </>
            ) : (
              <IssuedLinkCard
                label="Osobní odkaz pacienta"
                link={portalLink}
                note="Pošlete ho pacientovi. Nový odkaz ten předchozí zneplatní."
              />
            )}
          </SoftCard>
        </Stack>
      </Stack>

      <StickyFormFooter
        start={
          editedDemographics !== null || editedProfile !== null
            ? "Máte neuložené změny."
            : undefined
        }
      >
        <Button variant="outlined" disabled={busy} onClick={() => navigate(`/patients/${patientId}`)}>
          Zrušit
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => { void saveAndContinue(); }}>
          {savingAll ? "Ukládám…" : "Uložit a pokračovat"}
        </Button>
      </StickyFormFooter>

      {/* Mounted only while open: the dialog's opening state is its initial
          state, so there is no effect resetting fields after the fact. */}
      {insuranceOpen ? (
        <InsuranceDialog
          patientId={patientId}
          current={governed}
          onClose={() => setInsuranceOpen(false)}
          onSaved={() => {
            setInsuranceOpen(false);
            load();
          }}
        />
      ) : null}
      {addressOpen ? (
        <AddressDialog
          patientId={patientId}
          onClose={() => setAddressOpen(false)}
          onSaved={() => {
            setAddressOpen(false);
            load();
          }}
        />
      ) : null}
    </Box>
  );
}

/** The board's label-over-value pair (OSOBNÍ ÚDAJE on the patient card). */
function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <SectionLabel sx={{ mb: 0.25 }}>{label}</SectionLabel>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

/**
 * Route 3. The insurance number is typed twice on purpose: a mistyped one is
 * silent - it looks like a number and belongs to somebody else.
 */
function InsuranceDialog({
  patientId,
  current,
  onClose,
  onSaved,
}: {
  patientId: string;
  current: GovernedIdentity;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<InsuranceRegistrationKind>("CzechPublicHealthInsurance");
  const [birthNumber, setBirthNumber] = useState(current.birthNumber);
  const [number, setNumber] = useState(current.insuranceNumber);
  const [confirmation, setConfirmation] = useState("");
  const [insurer, setInsurer] = useState(current.healthInsurerCode);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Whether the číslo pojištěnce was filled in from the rodné číslo rather than
     typed. A derived value stays in step with the rodné číslo; the moment staff
     type over it, it is theirs and the rodné číslo stops touching it. */
  const [numberDerived, setNumberDerived] = useState(false);

  /*
   * A Czech rodné číslo IS the číslo pojištěnce (the same digits) and it carries
   * its own checksum, so typing it fills the insurance number and — because there
   * is nothing hand-typed to mistype — its own confirmation. Only into an empty or
   * previously-derived box, so a number staff typed by hand is never overwritten.
   */
  const onBirthNumberChange = (raw: string): void => {
    setBirthNumber(raw);
    const digits = raw.replace(/\D/g, "");
    if (
      kind === "CzechPublicHealthInsurance" &&
      parseBirthNumber(digits) !== null &&
      (number === "" || numberDerived)
    ) {
      setNumber(digits);
      setConfirmation(digits);
      setNumberDerived(true);
    }
  };

  const mismatch = confirmation !== "" && confirmation !== number;
  const canSave = reason.trim() !== "" && !mismatch && confirmation !== "" && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await patientIdentityApi.updateAdministrativeProfile(
        patientId,
        {
          insuranceRegistrationKind: kind,
          birthNumber: birthNumber || null,
          healthInsuranceNumber: number || null,
          healthInsuranceNumberConfirmation: confirmation || null,
          healthInsurerCode: insurer || null,
          insuranceEvidenceSource: "InsuranceCardInspected",
          identityDocumentType: null,
          identityDocumentIssuingCountryCode: null,
          identityDocumentNumber: null,
        },
        reason,
      );
      toast.success(result.changed ? "Pojištění opraveno." : "Beze změny — hodnoty se shodují.");
      onSaved();
    } catch (e) {
      const body = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setError(body?.message ?? "Opravu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Oprava pojištění</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormField label="Druh registrace">
            {(id) => (
              <TextField
                id={id}
                select
                fullWidth
                value={kind}
                onChange={(e) => setKind(e.target.value as InsuranceRegistrationKind)}
                slotProps={selectLabelledBy(id)}
              >
                <MenuItem value="CzechPublicHealthInsurance">České veřejné zdravotní pojištění</MenuItem>
                <MenuItem value="NoCzechHealthInsuranceNumber">Bez českého čísla pojištěnce</MenuItem>
              </TextField>
            )}
          </FormField>
          <FormField label="Rodné číslo">
            {(id) => (
              <TextField
                id={id}
                fullWidth
                value={birthNumber}
                onChange={(e) => onBirthNumberChange(e.target.value)}
                helperText="Doplní číslo pojištěnce."
              />
            )}
          </FormField>
          <FormField label="Číslo pojištěnce">
            {(id) => (
              <TextField
                id={id}
                fullWidth
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value);
                  setNumberDerived(false);
                }}
              />
            )}
          </FormField>
          <FormField label="Číslo pojištěnce ještě jednou">
            {(id) => (
              <TextField
                id={id}
                fullWidth
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value);
                  setNumberDerived(false);
                }}
                error={mismatch}
                helperText={mismatch ? "Čísla se neshodují." : "Opište číslo znovu, ne kopírujte."}
              />
            )}
          </FormField>
          <FormField label="Zdravotní pojišťovna">
            {(id) => (
              <TextField
                id={id}
                fullWidth
                value={insurer}
                onChange={(e) => setInsurer(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Důvod změny" required>
            {(id) => (
              <TextField
                id={id}
                required
                fullWidth
                multiline
                minRows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                helperText="Bez důvodu se změna identity neuloží."
              />
            )}
          </FormField>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Zrušit</Button>
        <Button variant="contained" disabled={!canSave} onClick={save}>
          Uložit opravu
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Route 4. The address is a RÚIAN point, never free text. */
function AddressDialog({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [residenceType, setResidenceType] = useState<ResidenceType>(
    "PermanentResidenceInCzechia",
  );
  const [point, setPoint] = useState<MapySuggestion | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (point === null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await patientIdentityApi.updateResidenceAddress(
        patientId,
        residenceType,
        {
          ruianAddressPointCode: 0,
          street: point.street,
          number: point.number,
          municipalityPart: point.municipalityPart,
          municipality: point.municipality,
          zip: point.zip,
        },
        reason,
      );
      toast.success(result.changed ? "Adresa opravena." : "Beze změny — adresa se shoduje.");
      onSaved();
    } catch (e) {
      const body = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setError(body?.message ?? "Opravu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Oprava adresy</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormField label="Typ pobytu">
            {(id) => (
              <TextField
                id={id}
                select
                fullWidth
                value={residenceType}
                onChange={(e) => setResidenceType(e.target.value as ResidenceType)}
                slotProps={selectLabelledBy(id)}
              >
                <MenuItem value="PermanentResidenceInCzechia">Trvalý pobyt v ČR</MenuItem>
                <MenuItem value="ReportedResidenceInCzechia">Hlášený pobyt v ČR</MenuItem>
              </TextField>
            )}
          </FormField>

          <MapyAddressPicker selected={point} onSelect={setPoint} />

          <FormField label="Důvod změny" required>
            {(id) => (
              <TextField
                id={id}
                required
                fullWidth
                multiline
                minRows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                helperText="Bez důvodu se změna adresy neuloží."
              />
            )}
          </FormField>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Zrušit</Button>
        <Button
          variant="contained"
          disabled={reason.trim() === "" || point === null || saving}
          onClick={save}
        >
          Uložit opravu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
