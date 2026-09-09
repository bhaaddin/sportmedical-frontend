import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import { toast } from "react-hot-toast";
import client from "../api/client";
import { patientsApi } from "../api/patients";
import { patientIdentityApi } from "../api/patientIdentity";
import patientRegistryApi, {
  type AddressLocality,
  type AddressPoint,
  type InsuranceRegistrationKind,
  type ResidenceType,
} from "../api/patientRegistry";

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
 */

type Sex = "Male" | "Female" | "NotSpecified" | "Unknown";

interface Contact {
  channel: string;
  value: string;
  note: string;
}

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

type ProfileFields = {
  titlesBeforeName: string;
  titlesAfterName: string;
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
  titlesBeforeName: "",
  titlesAfterName: "",
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

export default function PatientForm() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();

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
      let contacts: Contact[] = [];
      try {
        contacts = JSON.parse(p.contactsJson ?? "[]") as Contact[];
      } catch {
        contacts = [];
      }
      return {
        demographics: {
          firstName: patient?.firstName ?? "",
          lastName: patient?.lastName ?? "",
          preferredName: (patient as { preferredName?: string })?.preferredName ?? "",
          dateOfBirth: (patient?.dateOfBirth ?? "").slice(0, 10),
          sex: ((patient?.sex as Sex) ?? "Male") as Sex,
        },
        profile: {
          titlesBeforeName: p.titlesBeforeName ?? "",
          titlesAfterName: p.titlesAfterName ?? "",
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
        contacts,
      };
    },
    enabled: Boolean(patientId),
  });

  const [editedDemographics, setEditedDemographics] = useState<Demographics | null>(null);
  const [editedProfile, setEditedProfile] = useState<ProfileFields | null>(null);

  const demographics = editedDemographics ?? patientQuery.data?.demographics ?? EMPTY_DEMOGRAPHICS;
  const profile = editedProfile ?? patientQuery.data?.profile ?? EMPTY_PROFILE;
  const governed = patientQuery.data?.governed ?? EMPTY_GOVERNED;
  const contacts = patientQuery.data?.contacts ?? [];

  const setDemographics = setEditedDemographics;
  const setProfile = setEditedProfile;

  const [savingDemographics, setSavingDemographics] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  const load = () => {
    setEditedDemographics(null);
    setEditedProfile(null);
    void patientQuery.refetch();
  };

  const saveDemographics = async () => {
    if (!patientId) return;
    setSavingDemographics(true);
    try {
      await patientsApi.update(patientId, {
        firstName: demographics.firstName,
        lastName: demographics.lastName,
        dateOfBirth: demographics.dateOfBirth,
      });
      toast.success("Jméno a demografie uloženy.");
      load();
    } catch {
      toast.error("Uložení se nezdařilo.");
    } finally {
      setSavingDemographics(false);
    }
  };

  const saveProfile = async () => {
    if (!patientId) return;
    setSavingProfile(true);
    try {
      /* The four governed fields go back exactly as they arrived. */
      await client.put(`/api/patients/${patientId}/profile`, {
        ...profile,
        ...governed,
        contactsJson: JSON.stringify(contacts.filter((c) => c.value.trim() !== "")),
      });
      toast.success("Ostatní údaje uloženy.");
      load();
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
    } finally {
      setSavingProfile(false);
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

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        Úprava pacienta
      </Typography>

      {/* 1. Name and demographics — route 1 */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Jméno a demografie
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Jméno"
                value={demographics.firstName}
                onChange={(e) =>
                  setDemographics({ ...demographics, firstName: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="Příjmení"
                value={demographics.lastName}
                onChange={(e) =>
                  setDemographics({ ...demographics, lastName: e.target.value })
                }
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                type="date"
                label="Datum narození"
                value={demographics.dateOfBirth}
                onChange={(e) =>
                  setDemographics({ ...demographics, dateOfBirth: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                select
                fullWidth
                label="Pohlaví"
                value={demographics.sex}
                onChange={(e) =>
                  setDemographics({ ...demographics, sex: e.target.value as Sex })
                }
              >
                {SEX_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Box>
              <Button
                variant="contained"
                onClick={saveDemographics}
                disabled={savingDemographics}
              >
                Uložit
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Identity — read-only, changed through the governed routes */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <LockIcon fontSize="small" color="action" />
            <Typography variant="h6">Identita</Typography>
          </Stack>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Rodné číslo, pojištění a adresa se mění jen se zdůvodněním — každá
            změna se zapisuje s autorem a důvodem do registru pacientů.
          </Typography>

          <Stack spacing={1.5}>
            <ReadOnlyRow label="Rodné číslo" value={governed.birthNumber} />
            <ReadOnlyRow label="Číslo pojištěnce" value={governed.insuranceNumber} />
            <ReadOnlyRow label="Zdravotní pojišťovna" value={governed.healthInsurerCode} />
            <Divider />
            <ReadOnlyRow label="Adresa" value={governed.address} />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              onClick={() => setInsuranceOpen(true)}
            >
              Opravit pojištění
            </Button>
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              onClick={() => setAddressOpen(true)}
            >
              Opravit adresu
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 3. Everything else — route 2 */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Ostatní
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Titul před jménem"
                value={profile.titlesBeforeName}
                onChange={(e) =>
                  setProfile({ ...profile, titlesBeforeName: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="Titul za jménem"
                value={profile.titlesAfterName}
                onChange={(e) =>
                  setProfile({ ...profile, titlesAfterName: e.target.value })
                }
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Povolání"
                value={profile.occupation}
                onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
              />
              <TextField
                fullWidth
                label="Zaměstnavatel"
                value={profile.employer}
                onChange={(e) => setProfile({ ...profile, employer: e.target.value })}
              />
            </Stack>
            <TextField
              fullWidth
              label="Ošetřující lékaři"
              value={profile.treatingDoctors}
              onChange={(e) =>
                setProfile({ ...profile, treatingDoctors: e.target.value })
              }
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Poznámky"
              value={profile.notes}
              onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
            />
            <Box>
              <Button variant="contained" onClick={saveProfile} disabled={savingProfile}>
                Uložit
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Button onClick={() => navigate(`/patients/${patientId}`)}>Zpět na pacienta</Button>

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

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      <Typography sx={{ color: "text.secondary", minWidth: 180 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value || "—"}</Typography>
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
          <TextField
            select
            fullWidth
            label="Druh registrace"
            value={kind}
            onChange={(e) => setKind(e.target.value as InsuranceRegistrationKind)}
          >
            <MenuItem value="CzechPublicHealthInsurance">České veřejné zdravotní pojištění</MenuItem>
            <MenuItem value="NoCzechHealthInsuranceNumber">Bez českého čísla pojištěnce</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="Rodné číslo"
            value={birthNumber}
            onChange={(e) => setBirthNumber(e.target.value)}
          />
          <TextField
            fullWidth
            label="Číslo pojištěnce"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <TextField
            fullWidth
            label="Číslo pojištěnce ještě jednou"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            error={mismatch}
            helperText={mismatch ? "Čísla se neshodují." : "Opište číslo znovu, ne kopírujte."}
          />
          <TextField
            fullWidth
            label="Zdravotní pojišťovna"
            value={insurer}
            onChange={(e) => setInsurer(e.target.value)}
          />
          <TextField
            required
            fullWidth
            multiline
            minRows={2}
            label="Důvod změny"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Bez důvodu se změna identity neuloží."
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
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
  const [query, setQuery] = useState("");
  const [localities, setLocalities] = useState<AddressLocality[]>([]);
  const [locality, setLocality] = useState<AddressLocality | null>(null);
  const [houseNumber, setHouseNumber] = useState("");
  const [points, setPoints] = useState<AddressPoint[]>([]);
  const [pointCode, setPointCode] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datasetQuery = useQuery({
    queryKey: ["address-dataset-status"],
    queryFn: () => patientRegistryApi.getAddressDatasetStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const datasetLoaded = datasetQuery.data?.loaded ?? null;

  const searchLocalities = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) return;
    try {
      setLocalities(await patientRegistryApi.searchLocalities(text));
    } catch {
      setLocalities([]);
    }
  };

  /** A point needs the locality and the house number; the search takes both. */
  const findPoints = async (value: AddressLocality | null, number: string) => {
    setPointCode(null);
    if (!value || number.trim() === "") {
      setPoints([]);
      return;
    }
    try {
      setPoints(
        await patientRegistryApi.searchAddressPoints({
          streetCode: value.streetCode,
          municipalityPartCode: value.municipalityPartCode,
          number,
        }),
      );
    } catch {
      setPoints([]);
    }
  };

  const save = async () => {
    if (pointCode === null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await patientIdentityApi.updateResidenceAddress(
        patientId,
        residenceType,
        pointCode,
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
          {datasetLoaded === false ? (
            <Alert severity="error">
              Adresní registr RÚIAN není v této instalaci nahraný. Bez adresního bodu
              nelze adresu opravit — dataset musí nejdřív naimportovat správce.
            </Alert>
          ) : null}

          <TextField
            select
            fullWidth
            label="Typ pobytu"
            value={residenceType}
            onChange={(e) => setResidenceType(e.target.value as ResidenceType)}
          >
            <MenuItem value="PermanentResidenceInCzechia">Trvalý pobyt v ČR</MenuItem>
            <MenuItem value="ReportedResidenceInCzechia">Hlášený pobyt v ČR</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label="Ulice nebo obec"
            value={query}
            onChange={(e) => void searchLocalities(e.target.value)}
            disabled={datasetLoaded === false}
          />
          {localities.length > 0 ? (
            <TextField
              select
              fullWidth
              label="Vyberte lokalitu"
              value={locality?.displayValue ?? ""}
              onChange={(e) => {
                const found = localities.find((l) => l.displayValue === e.target.value);
                setLocality(found ?? null);
                void findPoints(found ?? null, houseNumber);
              }}
            >
              {localities.map((l) => (
                <MenuItem key={l.displayValue} value={l.displayValue}>
                  {l.displayValue}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {locality ? (
            <TextField
              fullWidth
              label="Číslo popisné / orientační"
              value={houseNumber}
              onChange={(e) => {
                setHouseNumber(e.target.value);
                void findPoints(locality, e.target.value);
              }}
            />
          ) : null}
          {points.length > 0 ? (
            <TextField
              select
              fullWidth
              label="Adresní bod"
              value={pointCode ?? ""}
              onChange={(e) => setPointCode(Number(e.target.value))}
            >
              {points.map((p) => (
                <MenuItem key={p.addressPointCode} value={p.addressPointCode}>
                  {p.formattedAddress}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            required
            fullWidth
            multiline
            minRows={2}
            label="Důvod změny"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Bez důvodu se změna adresy neuloží."
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button
          variant="contained"
          disabled={reason.trim() === "" || pointCode === null || saving}
          onClick={save}
        >
          Uložit opravu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
