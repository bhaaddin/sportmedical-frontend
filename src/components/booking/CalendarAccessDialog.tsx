import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import type { Calendar, CalendarAccessEntry } from "../../api/bookingContracts";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";

/**
 * Who sees this calendar — contract 5.3.
 *
 * Owner and Administrator can never be unticked, and neither can a worker the
 * calendar already rosters. Those rows are shown locked with the reason, not
 * hidden: the point is that the owner understands why the box will not move.
 */

interface CalendarAccessDialogProps {
  calendar: Calendar;
  open: boolean;
  onClose: () => void;
}

export function CalendarAccessDialog({
  calendar,
  open,
  onClose,
}: CalendarAccessDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /** Null until the user ticks something; the server's answer stands until then. */
  const [edited, setEdited] = useState<Set<string> | null>(null);

  const accessQuery = useQuery({
    queryKey: ["calendar-access", calendar.id],
    queryFn: () => calendarsApi.getAccess(calendar.id),
    enabled: open,
  });

  const entries = useMemo(() => accessQuery.data ?? [], [accessQuery.data]);

  const selected = useMemo(
    () =>
      edited ??
      new Set(
        entries.filter((entry) => entry.hasAccess).map((entry) => entry.userId),
      ),
    [edited, entries],
  );

  /**
   * 4.1: the body is the set of explicitly granted users. Locked rows are not
   * part of it - their access comes from a role or from a day assignment, and
   * sending them would imply this list could take it away.
   */
  const explicitlyGranted = useMemo(
    () =>
      entries
        .filter(
          (entry) => entry.lockedBy === null && selected.has(entry.userId),
        )
        .map((entry) => entry.userId),
    [entries, selected],
  );

  const save = useMutation({
    // 6.6: a settings change is never optimistic — it waits for the server.
    mutationFn: () => calendarsApi.setAccess(calendar.id, explicitlyGranted),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["calendar-access", calendar.id],
      });
      onClose();
    },
  });

  const toggle = (entry: CalendarAccessEntry) => {
    if (entry.lockedBy) return;
    const next = new Set(selected);
    if (next.has(entry.userId)) next.delete(entry.userId);
    else next.add(entry.userId);
    setEdited(next);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("booking.access.title", { name: calendar.name })}
      </DialogTitle>
      <DialogContent>
        <AsyncSection
          isLoading={accessQuery.isLoading}
          isSettled={accessQuery.isSuccess}
          error={accessQuery.error}
          isEmpty={entries.length === 0}
          emptyText={t("booking.access.empty")}
          onRetry={() => void accessQuery.refetch()}
          skeletonRows={5}
        >
          <Stack spacing={0.5}>
            {entries.map((entry) => (
              <Box
                key={entry.userId}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={
                        entry.lockedBy ? true : selected.has(entry.userId)
                      }
                      disabled={Boolean(entry.lockedBy)}
                      onChange={() => toggle(entry)}
                      slotProps={{ input: { "aria-label": entry.displayName } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography component="span">
                        {entry.displayName}
                      </Typography>
                      <Typography
                        component="span"
                        sx={{ ml: 1, color: "text.secondary", fontSize: 13 }}
                      >
                        {entry.role}
                      </Typography>
                    </Box>
                  }
                />
                {entry.lockedBy ? (
                  <Tooltip title={t(`booking.access.locked.${entry.lockedBy}`)}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: "text.secondary",
                        fontSize: 13,
                      }}
                    >
                      <LockIcon fontSize="small" />
                      {t(`booking.access.locked.${entry.lockedBy}`)}
                    </Box>
                  </Tooltip>
                ) : null}
              </Box>
            ))}
          </Stack>
        </AsyncSection>

        {save.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(save.error, t)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("booking.common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={() => save.mutate()}
          disabled={save.isPending || accessQuery.isLoading}
        >
          {t("booking.common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CalendarAccessDialog;
