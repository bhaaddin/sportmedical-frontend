import type { ReactNode } from "react";
import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Close from "@mui/icons-material/Close";
import { DESIGN } from "../../ui";

/** The board's drawer is 580px wide at 1440; on a phone it is the whole screen. */
export const DRAWER_WIDTH = 580;

/**
 * The right-hand drawer every booking screen on the board lives in: a white
 * panel over a dark scrim, with a fixed header (title, the step under it,
 * `‹` back and `×` close), a scrolling body and a fixed footer for the
 * actions. The content decides what goes in; this decides where.
 */
export function DrawerFrame({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  footer,
  labelId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Shown as `‹` before the title; step 2 has one, step 1 has none. */
  onBack?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Id of the heading, so the dialog is named by its title. */
  labelId: string;
  children: ReactNode;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { sx: { bgcolor: alpha(DESIGN.inkSoft, 0.72) } },
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": labelId,
          sx: {
            width: { xs: "100%", sm: DRAWER_WIDTH },
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
            boxShadow: DESIGN.shadow.dialog,
          },
        } as Record<string, unknown>,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        {onBack ? (
          <IconButton
            aria-label="Zpět"
            onClick={onBack}
            sx={{ border: "1px solid", borderColor: "divider", width: 44, height: 44 }}
          >
            <ArrowBack fontSize="small" />
          </IconButton>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={labelId} variant="h5" component="h2" sx={{ lineHeight: 1.25 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton aria-label="Zavřít" onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>{children}</Box>

      {footer ? (
        <Box
          sx={{
            flexShrink: 0,
            px: 3,
            py: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Drawer>
  );
}

export default DrawerFrame;
