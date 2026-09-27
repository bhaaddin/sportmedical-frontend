import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopy from "@mui/icons-material/ContentCopy";
import PersonAddAlt from "@mui/icons-material/PersonAddAlt1";
import { useMutation } from "@tanstack/react-query";
import { patientPreRegistrationApi } from "../../../api/patientPreRegistration";
import { errorText } from "../errorText";
import { useTranslation } from "react-i18next";
import type { PatientHit } from "./patientTypeahead";

/**
 * Right under "Vyhledávání z databáze": when the caller is NOT in the register,
 * the desk makes a provisional patient from four facts and gets back the
 * patient's own 24 h link, which the desk copies and sends by e-mail by hand.
 * The new patient is selected for the booking straight away, so the desk can
 * finish the appointment above without searching again.
 */
export function QuickRegister({
  onRegistered,
  defaultLastName = "",
}: {
  onRegistered: (hit: PatientHit) => void;
  defaultLastName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState(defaultLastName);
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const register = useMutation({
    mutationFn: async () => {
      const { patientId } = await patientPreRegistrationApi.preRegister({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dob,
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      const issued = await patientPreRegistrationApi.issueLink(patientId);
      const full = issued.url ?? `${window.location.origin}${issued.path}`;
      return { patientId, full };
    },
    onSuccess: ({ patientId, full }) => {
      setLink(full);
      onRegistered({
        id: patientId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        dateOfBirth: dob || null,
      });
    },
  });

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dob.length > 0 &&
    email.trim().length > 0 &&
    !register.isPending;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the address is on screen to copy by hand */
    }
  };

  /* ── Done: the link, ready to send ── */
  if (link) {
    return (
      <Alert severity="success" icon={false}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Rychlá registrace hotová — pošlete pacientovi tento odkaz:
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box
            sx={{
              flex: 1,
              fontFamily: "monospace",
              fontSize: "0.85rem",
              wordBreak: "break-all",
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1,
              py: 0.75,
            }}
          >
            {link}
          </Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<ContentCopy fontSize="small" />}
            onClick={copy}
          >
            {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          Platí 24 hodin. Když pacient do té doby nedoplní údaje, rezervace se
          uvolní. Pacient je už vybraný — dokončete objednávku výše.
        </Typography>
        <Button size="small" sx={{ mt: 1 }} onClick={() => { setLink(null); setOpen(false); register.reset(); }}>
          Zavřít
        </Button>
      </Alert>
    );
  }

  /* ── Collapsed: a single prompt ── */
  if (!open) {
    return (
      <Typography variant="body2">
        Pacient v databázi není?{" "}
        <Button
          size="small"
          variant="outlined"
          startIcon={<PersonAddAlt fontSize="small" />}
          onClick={() => setOpen(true)}
        >
          Rychlá registrace + odkaz
        </Button>
      </Typography>
    );
  }

  /* ── The four (+ birth date) facts ── */
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "primary.light",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Rychlá registrace
      </Typography>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            label="Jméno"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
          <TextField
            size="small"
            fullWidth
            label="Příjmení"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            type="date"
            label="Datum narození"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            fullWidth
            label="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+420…"
          />
        </Stack>
        <TextField
          size="small"
          fullWidth
          type="email"
          label="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {register.error ? (
          <Alert severity="error">{errorText(register.error, t)}</Alert>
        ) : null}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={!canSubmit}
            onClick={() => register.mutate()}
          >
            {register.isPending ? "Vytvářím…" : "Vytvořit registraci a odkaz"}
          </Button>
          <Button onClick={() => setOpen(false)} disabled={register.isPending}>
            Zrušit
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default QuickRegister;
