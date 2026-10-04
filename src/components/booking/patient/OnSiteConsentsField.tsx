import { useEffect, useState } from "react";
import { Alert, Box, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useDevice } from "../../../layout/useDevice";
import { SectionLabel } from "../../ui";
import {
  onSiteConsentsApi,
  type OnSiteConsentOption,
  type OnSiteConsentResult,
} from "../../../api/onSiteConsents";

/**
 * "Souhlasy podepsány na místě (papírově)" - the desk ticks which consents the
 * patient signed on paper. Never preselected: a box is ticked by a person who
 * has the signed paper in hand, or not at all.
 *
 * The list is the server's (`options`), asked again whenever the činnost
 * changes; with no činnost chosen it is just the treatment consent. Used by
 * the full and the quick registration, in every layout.
 */

export interface OnSiteConsentSelection {
  /** Codes of the ticked boxes. */
  codes: string[];
  note: string;
}

export const EMPTY_ON_SITE_CONSENTS: OnSiteConsentSelection = { codes: [], note: "" };

export function OnSiteConsentsField({
  activityId,
  value,
  onChange,
  disabled = false,
}: {
  /** The chosen činnost, "" or null when none. */
  activityId: string | null;
  value: OnSiteConsentSelection;
  onChange: (next: OnSiteConsentSelection) => void;
  disabled?: boolean;
}) {
  const device = useDevice();
  const phone = device === "phone";
  const [options, setOptions] = useState<OnSiteConsentOption[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    onSiteConsentsApi
      .getOptions(activityId || null)
      .then((res) => {
        if (!live) return;
        setOptions(res.options);
        setState("ready");
        /* A box that is no longer offered for this činnost is no longer ticked. */
        const offered = new Set(res.options.map((o) => o.code));
        const kept = value.codes.filter((c) => offered.has(c));
        if (kept.length !== value.codes.length) onChange({ ...value, codes: kept });
      })
      .catch(() => {
        if (!live) return;
        setOptions([]);
        setState("failed");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const toggle = (code: string, on: boolean) =>
    onChange({
      ...value,
      codes: on ? [...value.codes.filter((c) => c !== code), code] : value.codes.filter((c) => c !== code),
    });

  return (
    <Box component="section" data-testid="on-site-consents" data-device={device} sx={{ minWidth: 0 }}>
      <SectionLabel>Souhlasy podepsány na místě (papírově)</SectionLabel>
      {state === "failed" ? (
        <Alert severity="warning">
          Nabídku souhlasů se nepodařilo načíst. Souhlasy lze zapsat i později.
        </Alert>
      ) : (
        <Stack spacing={0.5}>
          {options.map((o) => (
            <FormControlLabel
              key={o.code}
              disabled={disabled}
              sx={{ alignItems: "flex-start", m: 0, minHeight: phone ? 44 : undefined }}
              control={
                <Checkbox
                  checked={value.codes.includes(o.code)}
                  onChange={(e) => toggle(o.code, e.target.checked)}
                  slotProps={{ input: { "aria-label": o.required ? o.label : `${o.label} (nepovinný)` } }}
                />
              }
              label={
                <Typography variant="body2" component="span" sx={{ pt: 1 }}>
                  {o.label}
                  {o.required ? "" : " (nepovinný)"}
                </Typography>
              }
            />
          ))}
          {options.length > 0 ? (
            <TextField
              fullWidth
              size="small"
              label="Poznámka"
              value={value.note}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
              sx={{ mt: 1 }}
            />
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

export type OnSiteRecordOutcome =
  | { status: "none" }
  | { status: "recorded"; result: OnSiteConsentResult }
  | { status: "failed"; message: string };

/** The server's problem `message`, when the failed call carried one. */
function problemMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  return typeof data?.message === "string" && data.message !== "" ? data.message : null;
}

/**
 * Records what was ticked, once the patient exists. Ticking nothing makes no
 * call. A failure never throws: the registration stands, and the caller shows
 * `message` as a warning that the recording can be repeated.
 */
export async function recordOnSiteConsents(
  patientId: string,
  activityId: string | null,
  selection: OnSiteConsentSelection,
): Promise<OnSiteRecordOutcome> {
  if (selection.codes.length === 0) return { status: "none" };
  try {
    const result = await onSiteConsentsApi.record(patientId, {
      activityId: activityId || null,
      consents: selection.codes,
      note: selection.note.trim() === "" ? null : selection.note.trim(),
    });
    return { status: "recorded", result };
  } catch (error) {
    const detail = problemMessage(error);
    return {
      status: "failed",
      message:
        "Pacient je zaregistrován, ale souhlasy se nepodařilo zapsat" +
        (detail ? ` (${detail})` : "") +
        ". Zapsání lze zopakovat.",
    };
  }
}

export default OnSiteConsentsField;
