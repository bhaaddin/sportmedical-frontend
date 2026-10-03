import { useEffect, useRef, useState } from "react";
import { Box, Button, Snackbar, Stack, Typography } from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlineOutlined";
import ContentCopy from "@mui/icons-material/ContentCopy";
import { useDevice } from "../../../layout/useDevice";
import { DESIGN, SectionLabel, SoftCard } from "../../ui";
import { formatLongPragueDate } from "../appointmentEdit";
import { pragueClock } from "../NewAppointmentDialog.logic";
import { deadlineSentence } from "./quickBooking";

/**
 * What the desk sees once a quick registration went through: the reservation
 * is made, the patient has a limited time to finish the registration, and the
 * completion link is here to be copied and sent by hand.
 *
 * Nothing is sent. There is no mail or SMS provider yet, and saying otherwise
 * would send a receptionist away believing the patient had been written to -
 * so the one muted line under the link says it plainly.
 */

export interface QuickBookedView {
  startUtc: string;
  endUtc: string | null;
  activityName: string;
  calendarName?: string;
  /** From the server's `registrationDeadlineUtc`; its length is the clinic's setting. */
  deadlineUtc: string | null;
  linkUrl: string;
  /** What the patient will find already filled in when they open the link. */
  prefilled: {
    name: string;
    phone: string;
    email: string;
    activity: string;
  };
}

const TOAST_MS = 2500;

export function QuickBookedPanel({ view }: { view: QuickBookedView }) {
  const device = useDevice();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(view.linkUrl);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), TOAST_MS);
    } catch {
      /* clipboard blocked: the address is on screen to select by hand */
      setFailed(true);
    }
  };

  const when = `${formatLongPragueDate(view.startUtc)} · ${pragueClock(view.startUtc)}${
    view.endUtc ? ` — ${pragueClock(view.endUtc)}` : ""
  }`;
  const facts: [string, string][] = [
    ["Jméno", view.prefilled.name],
    ["Telefon", view.prefilled.phone],
    ["E-mail", view.prefilled.email],
    ["Činnost", view.prefilled.activity],
  ];

  return (
    <Stack spacing={2.5} data-testid="quick-booked-panel">
      <Stack
        direction="row"
        spacing={1.25}
        role="status"
        sx={{
          alignItems: "flex-start",
          px: 2,
          py: 1.5,
          borderRadius: 2.5,
          bgcolor: DESIGN.tone.green.bg,
          color: DESIGN.tone.green.fg,
          border: "1px solid",
          borderColor: DESIGN.tone.green.line,
        }}
      >
        <CheckCircleOutline fontSize="small" sx={{ mt: "2px" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, color: "inherit" }}>{when}</Typography>
          <Typography variant="body2" sx={{ color: "inherit" }}>
            {[view.activityName, view.calendarName].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      </Stack>

      {view.deadlineUtc ? (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor: DESIGN.tone.beige.bg,
            border: "1px solid",
            borderColor: DESIGN.tone.beige.line,
            color: DESIGN.tone.beige.fg,
          }}
        >
          <Typography sx={{ fontWeight: 700, color: "inherit" }}>
            {deadlineSentence(view.deadlineUtc)}
          </Typography>
          <Typography variant="body2" sx={{ color: "inherit", mt: 0.25 }}>
            Když ji do té doby nedokončí, rezervace se uvolní a termín se vrátí do nabídky.
          </Typography>
        </Box>
      ) : null}

      <Box>
        <SectionLabel>Odkaz na dokončení registrace</SectionLabel>
        <Stack spacing={1.25}>
          <Box
            data-testid="quick-completion-link"
            sx={{
              fontFamily: "monospace",
              fontSize: 13,
              wordBreak: "break-all",
              bgcolor: DESIGN.head,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2.5,
              px: 1.5,
              py: 1.25,
              userSelect: "all",
            }}
          >
            {view.linkUrl}
          </Box>
          <Button
            variant="contained"
            size="large"
            fullWidth={device === "phone"}
            startIcon={<ContentCopy />}
            onClick={() => void copy()}
            sx={{ minHeight: 52, fontSize: 16, alignSelf: device === "phone" ? "stretch" : "flex-start", px: 4 }}
          >
            {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
          {failed ? (
            <Typography variant="caption" sx={{ color: DESIGN.tone.red.fg }}>
              Schránka není dostupná — označte adresu výše a zkopírujte ji ručně.
            </Typography>
          ) : null}
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Odkaz zatím odešlete sami — odesílání zpráv se připravuje.
          </Typography>
        </Stack>
      </Box>

      <Box>
        <SectionLabel>Pacient už má vyplněno</SectionLabel>
        <SoftCard sx={{ p: 2 }}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: device === "phone" ? "1fr" : "1fr 1fr",
              gap: 1.5,
            }}
          >
            {facts.map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0 }}>
                <SectionLabel component="dt" sx={{ mb: 0.25 }}>
                  {label}
                </SectionLabel>
                <Typography component="dd" sx={{ m: 0, fontWeight: 600, overflowWrap: "anywhere" }}>
                  {value || "—"}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
            Zbytek — rodné číslo, pojišťovnu, dotazník a dokumenty činnosti — doplní pacient sám přes odkaz.
          </Typography>
        </SoftCard>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={TOAST_MS}
        onClose={() => setCopied(false)}
        message="Odkaz zkopírován do schránky"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

export default QuickBookedPanel;
