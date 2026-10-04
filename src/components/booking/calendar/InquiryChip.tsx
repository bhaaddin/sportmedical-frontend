import { Box } from "@mui/material";
import { inquiryLabel, inquiryTitle, type InquiryRef } from "./inquiries";

/*
 * A light dashed chip "Poptávka · {club}" (or "Klub žádá" on the order being processed). With `onOpen` it is a button
 * that opens the order; without it (inside a day button) it is plain text.
 */
export function InquiryChip({ inquiry, onOpen }: { inquiry: InquiryRef; onOpen?: (orderId: string) => void }) {
  const sx = {
    display: "block",
    maxWidth: "100%",
    font: "inherit",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    px: 0.75,
    minHeight: 18,
    color: inquiry.current ? "primary.main" : "text.secondary",
    bgcolor: inquiry.current ? "rgba(25,118,210,0.08)" : "transparent",
    border: "1px dashed",
    borderColor: inquiry.current ? "primary.main" : "text.disabled",
    borderRadius: "4px",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const;
  const common = { "data-testid": `inquiry-chip-${inquiry.orderId}`, title: inquiryTitle(inquiry) };
  return onOpen ? (
    <Box
      component="button"
      type="button"
      {...common}
      data-grid-item="inquiry"
      onClick={(event: React.MouseEvent) => {
        event.stopPropagation();
        onOpen(inquiry.orderId);
      }}
      sx={{ ...sx, cursor: "pointer" }}
    >
      {inquiryLabel(inquiry)}
    </Box>
  ) : (
    <Box component="span" {...common} sx={sx}>
      {inquiryLabel(inquiry)}
    </Box>
  );
}
