import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ContentCopy from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import { useMutation } from "@tanstack/react-query";
import { patientPreRegistrationApi } from "../../../api/patientPreRegistration";

/**
 * From the appointment detail: (re)issues the patient's completion link so the
 * desk can copy it and send it again — the same 24 h link a quick registration
 * makes, reachable later from the booking that needs it.
 */
export function CompletionLinkButton({ patientId }: { patientId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = useMutation({
    mutationFn: async () => {
      const issued = await patientPreRegistrationApi.issueLink(patientId);
      return issued.url ?? `${window.location.origin}${issued.path}`;
    },
    onSuccess: (full) => setLink(full),
  });

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

  if (link) {
    return (
      <Alert severity="info" icon={false}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Odkaz pro pacienta (pošlete e-mailem):
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
          Platí 24 hodin. Vygenerování nového odkazu ten předchozí zneplatní.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        startIcon={<LinkIcon fontSize="small" />}
        disabled={issue.isPending}
        onClick={() => issue.mutate()}
      >
        {issue.isPending ? "Generuji…" : "Získat odkaz pro dokončení registrace"}
      </Button>
      {issue.isError ? (
        <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 0.5 }}>
          Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.
        </Typography>
      ) : null}
    </Box>
  );
}

export default CompletionLinkButton;
