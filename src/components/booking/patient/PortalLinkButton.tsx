import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ContentCopy from "@mui/icons-material/ContentCopy";
import AccountCircle from "@mui/icons-material/AccountCircle";
import { useMutation } from "@tanstack/react-query";
import { issuePortalLink } from "../../../api/patientPortal";

/**
 * From the appointment detail (or the patient page): issues the patient's
 * personal portal link so the desk can copy it and send it. The same personal
 * link every time it is re-issued; the previous one stops working.
 */
export function PortalLinkButton({ patientId }: { patientId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = useMutation({
    mutationFn: async () => {
      const token = await issuePortalLink(patientId);
      return `${window.location.origin}/portal/${token}`;
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
      <Alert severity="success" icon={false}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Osobní odkaz do portálu (pošlete pacientovi):
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
          Jen pro tohoto pacienta. Nový odkaz ten předchozí zneplatní.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AccountCircle fontSize="small" />}
        disabled={issue.isPending}
        onClick={() => issue.mutate()}
      >
        {issue.isPending ? "Generuji…" : "Přístup do portálu"}
      </Button>
      {issue.isError ? (
        <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 0.5 }}>
          Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.
        </Typography>
      ) : null}
    </Box>
  );
}

export default PortalLinkButton;
