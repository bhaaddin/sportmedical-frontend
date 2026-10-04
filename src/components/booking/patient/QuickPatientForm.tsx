import { useState } from "react";
import { Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { useDevice } from "../../../layout/useDevice";
import { SectionLabel, SoftCard } from "../../ui";
import { PhoneField } from "../../ui/PhoneField";
import { OnSiteConsentsField, type OnSiteConsentSelection } from "./OnSiteConsentsField";
import type { Activity } from "../../../api/bookingContracts";
import {
  formatCzk,
  quickDraftProblems,
  type QuickPatientDraft,
} from "../NewAppointmentDialog.logic";

export type { QuickPatientDraft };

/**
 * "Rychlá registrace" - the board's card for a new patient, and since Etapa 2
 * the real quick flow (decision 7): the patient phoned, the receptionist found
 * a slot and chose it, and now four things are typed - name and surname,
 * telephone (with its dialling code), e-mail, and the examination they called
 * about. **No date of birth, ever**: the patient gives that and the rest
 * through the completion link, and the clinic's own setting decides whether
 * the link asks for it at all.
 *
 * What the server refuses comes back at the box it names (`fieldErrors`),
 * never as a generic line.
 */
export function QuickPatientForm({
  value,
  onChange,
  activities,
  otherActivities = [],
  disabled = false,
  fieldErrors,
  onSiteConsents,
  onOnSiteConsentsChange,
}: {
  value: QuickPatientDraft;
  onChange: (next: QuickPatientDraft) => void;
  /** The činnosti to offer under "Prohlídka, na kterou volal" - the day's first. */
  activities: Activity[];
  /**
   * The rest of the price list, offered after the day's own and marked as not
   * on offer today: picking one is possible, but the server will not offer the
   * time for it, so booking it takes the override like any time off the offer.
   */
  otherActivities?: Activity[];
  disabled?: boolean;
  /** The field the server named when it refused the registration, so that box goes red. */
  fieldErrors?: Partial<Record<keyof QuickPatientDraft, string>>;
  /**
   * "Souhlasy podepsány na místě (papírově)": shown when the owner of the
   * registration call passes the selection and its setter. The owner records
   * them (`recordOnSiteConsents`) once the patient exists.
   */
  onSiteConsents?: OnSiteConsentSelection;
  onOnSiteConsentsChange?: (next: OnSiteConsentSelection) => void;
}) {
  const device = useDevice();
  const phone = device === "phone";
  const touchDevice = device !== "desktop";
  const set = (field: keyof QuickPatientDraft, next: string) =>
    onChange({ ...value, [field]: next });
  /* The obvious is said before the button is pressed; the server's word wins when it has one. */
  const [touched, setTouched] = useState<ReadonlySet<keyof QuickPatientDraft>>(new Set());
  const touch = (key: keyof QuickPatientDraft) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  const local = quickDraftProblems(value);
  const errors: Partial<Record<keyof QuickPatientDraft, string>> = { ...(fieldErrors ?? {}) };
  for (const key of touched) {
    if (errors[key] === undefined && local[key] !== undefined) errors[key] = local[key];
  }

  const field = (
    label: string,
    key: keyof QuickPatientDraft,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Box sx={{ minWidth: 0 }}>
      <SectionLabel component="label" sx={{ mb: 0.5 }}>
        {label}
      </SectionLabel>
      <TextField
        fullWidth
        disabled={disabled}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        onBlur={() => touch(key)}
        error={errors[key] !== undefined}
        helperText={errors[key]}
        slotProps={{ htmlInput: { "aria-label": label, style: { minHeight: 24 } } }}
        {...props}
      />
    </Box>
  );

  return (
    <SoftCard sx={{ p: phone ? 2 : 2.5 }}>
      <Stack spacing={2}>
        {field("Jméno a příjmení", "name", {
          placeholder: "Filip Fehér",
          /* Not on a touch device: the keyboard would cover the panel before it was read. */
          autoFocus: !touchDevice,
          autoComplete: "name",
        })}
        {/* Two fields on a row where there is room, one per row on a phone. */}
        <Box
          data-testid="quick-contact-row"
          sx={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "1fr 1fr", gap: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <SectionLabel component="label" sx={{ mb: 0.5 }}>
              Telefon
            </SectionLabel>
            <PhoneField
              label="Telefon"
              value={value.phone}
              onChange={(next) => set("phone", next)}
              disabled={disabled}
              onBlur={() => touch("phone")}
              error={errors.phone !== undefined}
              helperText={errors.phone}
            />
          </Box>
          {field("E-mail", "email", {
            type: "email",
            placeholder: "filip@email.cz",
            autoComplete: "email",
          })}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <SectionLabel component="label" sx={{ mb: 0.5 }}>
            Prohlídka, na kterou volal
          </SectionLabel>
          <TextField
            select
            fullWidth
            disabled={disabled}
            value={value.activityId}
            onChange={(e) => set("activityId", e.target.value)}
            error={errors.activityId !== undefined}
            helperText={errors.activityId}
            title={activities.find((x) => x.id === value.activityId)?.name}
            sx={{ "& .MuiSelect-select": { whiteSpace: "normal", lineHeight: 1.3, py: 1.25 } }}
            slotProps={{
              select: { displayEmpty: true, "aria-label": "Prohlídka, na kterou volal" },
            }}
          >
            <MenuItem value="" disabled>
              <Typography component="span" sx={{ color: "text.secondary" }}>
                Vyberte prohlídku
              </Typography>
            </MenuItem>
            {activities.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ minHeight: 44, whiteSpace: "normal" }}>
                {a.name} — {formatCzk(a.priceCzk)} · {a.durationMinutes} min
              </MenuItem>
            ))}
            {otherActivities.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ minHeight: 44, whiteSpace: "normal" }}>
                {a.name} — {formatCzk(a.priceCzk)} · {a.durationMinutes} min · dnes se nenabízí
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {onSiteConsents && onOnSiteConsentsChange ? (
          <OnSiteConsentsField
            activityId={value.activityId || null}
            value={onSiteConsents}
            onChange={onOnSiteConsentsChange}
            disabled={disabled}
          />
        ) : null}

        <SoftCard tone="muted" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <InfoOutlined fontSize="small" sx={{ color: "text.secondary", mt: "2px" }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Víc teď nepotřebujeme. Rodné číslo, pojišťovnu a dotazník vyplní pacient sám přes
              odkaz, který po objednání zkopírujete a pošlete.
            </Typography>
          </Stack>
        </SoftCard>
      </Stack>
    </SoftCard>
  );
}

export default QuickPatientForm;
