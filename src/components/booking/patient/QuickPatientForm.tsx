import { Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { SectionLabel, SoftCard } from "../../ui";
import type { Activity } from "../../../api/bookingContracts";
import { formatCzk, type QuickPatientDraft, type QuickPath } from "../NewAppointmentDialog.logic";

export type { QuickPatientDraft };

/**
 * "Rychlá registrace" - the board's card for a new patient: name, telephone,
 * e-mail, the examination they called about, and the note that nothing more
 * is asked over the telephone. The date of birth is the one field the board
 * does not draw and the register insists on (`DateOfBirthRequired`), so it is
 * here, next to the e-mail: with both, a real patient is created and gets the
 * completion link; without them the slot is still booked, under the name and
 * telephone alone, and the info box says so.
 */
export function QuickPatientForm({
  value,
  onChange,
  activities,
  path,
  mayRegister,
  disabled = false,
}: {
  value: QuickPatientDraft;
  onChange: (next: QuickPatientDraft) => void;
  /** The činnosti to offer under "Prohlídka, na kterou volal" - the day's first. */
  activities: Activity[];
  path: QuickPath | null;
  mayRegister: boolean;
  disabled?: boolean;
}) {
  const set = (field: keyof QuickPatientDraft, next: string) =>
    onChange({ ...value, [field]: next });

  const field = (
    label: string,
    key: keyof QuickPatientDraft,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Box>
      <SectionLabel component="label" sx={{ mb: 0.5 }}>
        {label}
      </SectionLabel>
      <TextField
        fullWidth
        disabled={disabled}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        slotProps={{ htmlInput: { "aria-label": label } }}
        {...props}
      />
    </Box>
  );

  return (
    <SoftCard sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        {field("Jméno a příjmení", "name", { placeholder: "Filip Fehér", autoFocus: true })}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          {field("Telefon", "phone", { type: "tel", placeholder: "+420 773 539 001" })}
          {field("E-mail", "email", { type: "email", placeholder: "filip@email.cz" })}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          {field("Datum narození", "dateOfBirth", {
            type: "date",
            slotProps: { htmlInput: { "aria-label": "Datum narození" }, inputLabel: { shrink: true } },
          })}
          <Box>
            <SectionLabel component="label" sx={{ mb: 0.5 }}>
              Prohlídka, na kterou volal
            </SectionLabel>
            <TextField
              select
              fullWidth
              disabled={disabled}
              value={value.activityId}
              onChange={(e) => set("activityId", e.target.value)}
              slotProps={{ select: { displayEmpty: true, "aria-label": "Prohlídka, na kterou volal" } }}
            >
              <MenuItem value="">
                <Typography component="span" sx={{ color: "text.secondary" }}>
                  Vybrat později
                </Typography>
              </MenuItem>
              {activities.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} — {formatCzk(a.priceCzk)} · {a.durationMinutes} min
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <SoftCard tone="muted" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <InfoOutlined fontSize="small" sx={{ color: "text.secondary", mt: "2px" }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {path === "registered"
                ? "Víc teď nepotřebujeme. Rodné číslo, pojišťovnu a dotazník vyplní pacient sám přes odkaz, který mu odejde hned po objednání."
                : !mayRegister
                  ? "Termín se uloží se jménem a telefonem. Zakládat pacienty v registru nemáte oprávnění — registraci doplní kolega nebo pacient na místě."
                  : "S e-mailem a datem narození založíme pacienta rovnou a pošleme mu odkaz na dokončení registrace. Bez nich se termín uloží jen se jménem a telefonem a registrace se doplní na místě."}
            </Typography>
          </Stack>
        </SoftCard>
      </Stack>
    </SoftCard>
  );
}

export default QuickPatientForm;
