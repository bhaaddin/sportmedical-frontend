import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import GroupIcon from "@mui/icons-material/Group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import type { Calendar, CalendarInput } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";
import { CalendarAccessDialog } from "../../components/booking/CalendarAccessDialog";
import { ColorSelect } from "../../components/booking/ColorSelect";
import {
  DEFAULT_PALETTE_ENTRY,
  readableTextOn,
} from "../../utils/calendarPalette";

/** Calendars - contract screen 5.2, stage 1 of the running order in part 8. */

const CODEBOOK_STALE_MS = 5 * 60 * 1000; // 7.3: minutes for codebooks, not seconds.

function emptyDraft(sortOrder: number): CalendarInput {
  return {
    name: "",
    color: DEFAULT_PALETTE_ENTRY.hex,
    location: "",
    displayStepMinutes: 15,
    isActive: true,
    sortOrder,
    /* 4.1: unset means "no limit", which is the right default for a new one. */
    publicMinimumNoticeMinutes: null,
    publicHorizonDays: null,
  };
}

export default function CalendarsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Calendar | null>(null);
  const [draft, setDraft] = useState<CalendarInput | null>(null);
  const [accessFor, setAccessFor] = useState<Calendar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Calendar | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = useMemo(
    () =>
      [...(calendarsQuery.data ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [calendarsQuery.data],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["calendars"] });

  const closeDialog = () => {
    setDraft(null);
    setEditing(null);
  };

  // 6.6: settings changes wait for the server. Nothing here is optimistic.
  const save = useMutation({
    mutationFn: (input: CalendarInput) =>
      editing
        ? calendarsApi.update(editing.id, input)
        : calendarsApi.create(input),
    onSuccess: async () => {
      await invalidate();
      closeDialog();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => calendarsApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      setConfirmDelete(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft(calendars.length));
    save.reset();
  };

  const openEdit = (calendar: Calendar) => {
    setEditing(calendar);
    setDraft({
      name: calendar.name,
      color: calendar.color,
      location: calendar.location,
      displayStepMinutes: calendar.displayStepMinutes,
      isActive: calendar.isActive,
      sortOrder: calendar.sortOrder,
      /*
       * Carried through untouched. This screen does not offer them - they are
       * public-booking limits and public booking is phase 2 - but v27 makes a
       * `PUT` the whole entity, so leaving them out of the body would delete
       * them. Renaming a calendar must not quietly drop its limits.
       */
      publicMinimumNoticeMinutes: calendar.publicMinimumNoticeMinutes,
      publicHorizonDays: calendar.publicHorizonDays,
    });
    save.reset();
  };

  const nameIsValid = (draft?.name ?? "").trim().length > 0;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("booking.calendars.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.calendars.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          {t("booking.calendars.new")}
        </Button>
      </Box>

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.calendars.empty")}
        emptyAction={{ label: t("booking.calendars.new"), onClick: openCreate }}
        onRetry={() => void calendarsQuery.refetch()}
      >
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("booking.calendars.column.name")}</TableCell>
                <TableCell>{t("booking.calendars.column.location")}</TableCell>
                <TableCell>{t("booking.calendars.column.step")}</TableCell>
                <TableCell>{t("booking.calendars.column.state")}</TableCell>
                <TableCell align="right">
                  {t("booking.common.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calendars.map((calendar) => (
                <TableRow key={calendar.id} hover>
                  <TableCell>
                    {/* 7.1: the colour is decoration; the name carries the meaning. */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: "3px",
                          backgroundColor: calendar.color,
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontWeight: 600 }}>
                        {calendar.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{calendar.location || "-"}</TableCell>
                  <TableCell>
                    {t("booking.calendars.stepValue", {
                      minutes: calendar.displayStepMinutes,
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        calendar.isActive
                          ? t("booking.calendars.active")
                          : t("booking.calendars.inactive")
                      }
                      sx={
                        calendar.isActive
                          ? {
                              backgroundColor: calendar.color,
                              color: readableTextOn(calendar.color),
                            }
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t("booking.access.action")}>
                      <IconButton
                        aria-label={t("booking.access.action")}
                        onClick={() => setAccessFor(calendar)}
                      >
                        <GroupIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("booking.common.edit")}>
                      <IconButton
                        aria-label={t("booking.common.edit")}
                        onClick={() => openEdit(calendar)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("booking.common.delete")}>
                      <IconButton
                        aria-label={t("booking.common.delete")}
                        onClick={() => setConfirmDelete(calendar)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </AsyncSection>

      <Dialog
        open={draft !== null}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing
            ? t("booking.calendars.editTitle")
            : t("booking.calendars.newTitle")}
        </DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                autoFocus
                required
                fullWidth
                label={t("booking.calendars.column.name")}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={draft.name !== "" && !nameIsValid}
              />
              <ColorSelect
                label={t("booking.calendars.column.color")}
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
              />
              <TextField
                fullWidth
                label={t("booking.calendars.column.location")}
                value={draft.location}
                onChange={(e) =>
                  setDraft({ ...draft, location: e.target.value })
                }
              />
              <TextField
                fullWidth
                type="number"
                label={t("booking.calendars.column.step")}
                value={draft.displayStepMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    displayStepMinutes: Number(e.target.value) || 0,
                  })
                }
                helperText={t("booking.calendars.stepHelp")}
              />
              <TextField
                fullWidth
                type="number"
                label={t("booking.calendars.column.order")}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.isActive}
                    onChange={(e) =>
                      setDraft({ ...draft, isActive: e.target.checked })
                    }
                  />
                }
                label={t("booking.calendars.active")}
              />
              {save.error ? (
                <Alert severity="error">{errorText(save.error, t)}</Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t("booking.common.cancel")}</Button>
          <Button
            variant="contained"
            disabled={!nameIsValid || save.isPending}
            onClick={() => draft && save.mutate(draft)}
          >
            {t("booking.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
      >
        <DialogTitle>{t("booking.calendars.deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("booking.calendars.deleteBody", {
              name: confirmDelete?.name ?? "",
            })}
          </Typography>
          {remove.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(remove.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
          >
            {t("booking.common.delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {accessFor ? (
        <CalendarAccessDialog
          calendar={accessFor}
          open
          onClose={() => setAccessFor(null)}
        />
      ) : null}
    </Box>
  );
}
