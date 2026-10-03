import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DESIGN, StatusChip } from "../../ui";
import { useCompletionLink } from "./useCompletionLink";
import { useNow } from "./useNow";
import {
  deadlineSentence,
  deadlineView,
  formatDeadline,
  pendingChipText,
} from "./quickBooking";

/**
 * A desk quick registration that the patient has not finished yet: the clock
 * is running. The chip carries the time left - beige, red under three hours -
 * and "Zkopírovat odkaz" re-issues the completion link (the old one stops
 * working) and copies it, because nothing is sent by itself.
 *
 * When the deadline passes the server cancels the reservation and the slot
 * returns to the offer, so an expired card is only ever seen for the minute
 * before the sweep runs; it stops offering the link, which would answer 410.
 */
export function QuickPendingCard({
  patientId,
  email,
  deadlineUtc,
}: {
  patientId: string;
  email?: string;
  /** The server's `registrationDeadlineUtc`; null when it did not send one. */
  deadlineUtc: string | null;
}) {
  const now = useNow();
  const link = useCompletionLink(patientId);
  const view = deadlineUtc ? deadlineView(deadlineUtc, now) : null;
  const tone = view?.tone === "red" ? DESIGN.tone.red : DESIGN.tone.beige;
  const expired = view?.expired === true;
  const canMail = Boolean(email) && !expired;

  const sendAgain = async () => {
    const done = await link.ensure();
    if (!done || !email) return;
    const until = done.expiresAtUtc ?? deadlineUtc;
    const subject = encodeURIComponent("Dokončení registrace");
    const body = encodeURIComponent(
      `Dobrý den,\n\ndokončete prosím registraci na tomto odkazu:\n${done.url}\n${
        until ? `\nOdkaz platí do ${formatDeadline(until)}.` : ""
      }`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  return (
    <Box
      data-testid="quick-pending-card"
      sx={{
        bgcolor: tone.bg,
        border: "1px solid",
        borderColor: tone.line,
        borderRadius: 3,
        p: 2,
        color: tone.fg,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <WarningAmberIcon fontSize="small" sx={{ mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "inherit" }}>
              Registrace není dokončena
            </Typography>
            {view ? (
              <StatusChip tone={view.tone}>{pendingChipText(view)}</StatusChip>
            ) : (
              <StatusChip tone="beige">Čeká na dokončení registrace</StatusChip>
            )}
          </Stack>
          {deadlineUtc ? (
            <Typography variant="body2" sx={{ mt: 0.5, color: "inherit" }}>
              {expired
                ? "Lhůta uplynula — rezervaci právě ruší server a termín se vrací do nabídky."
                : deadlineSentence(deadlineUtc)}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ mt: 0.5, color: "inherit" }}>
              Pacient zatím nedokončil registraci přes odkaz.
            </Typography>
          )}
          <Stack direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              disabled={link.pending || expired}
              onClick={() => void link.copy()}
              sx={{ bgcolor: tone.fg, color: "#FFFFFF", "&:hover": { bgcolor: tone.fg } }}
            >
              {link.copied ? "Zkopírováno" : "Zkopírovat odkaz"}
            </Button>
            <Tooltip title={email ? "" : "Pacient nemá uvedený e-mail."}>
              <Box component="span">
                <Button
                  variant="outlined"
                  size="small"
                  disabled={link.pending || !canMail}
                  onClick={() => void sendAgain()}
                  sx={{ color: tone.fg, borderColor: tone.line, bgcolor: "transparent" }}
                >
                  Poslat znovu
                </Button>
              </Box>
            </Tooltip>
          </Stack>
          {link.link ? (
            <>
              <Box
                sx={{
                  mt: 1.5,
                  fontFamily: "monospace",
                  fontSize: 12,
                  wordBreak: "break-all",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: tone.line,
                  borderRadius: 2,
                  px: 1.25,
                  py: 0.75,
                  color: "text.primary",
                }}
              >
                {link.link}
              </Box>
              <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "inherit" }}>
                {link.expiresAtUtc ? `Platí do ${formatDeadline(link.expiresAtUtc)}. ` : ""}
                Vygenerování nového odkazu ten předchozí zneplatní. Nic se neodesílá — odkaz pošlete sami.
              </Typography>
            </>
          ) : null}
          {link.clipboardFailed ? (
            <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "inherit" }}>
              Schránka není dostupná — označte adresu výše a zkopírujte ji ručně.
            </Typography>
          ) : null}
          {link.failed ? (
            <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: DESIGN.tone.red.fg }}>
              Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}

export default QuickPendingCard;
