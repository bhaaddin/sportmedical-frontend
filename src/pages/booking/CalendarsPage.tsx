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
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditIcon from "@mui/icons-material/Edit";
import GroupIcon from "@mui/icons-material/Group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import MenuItem from "@mui/material/MenuItem";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi } from "../../api/clinicServices";
import { useLocation, useNavigate } from "react-router-dom";
import { handoffFrom, handoffIsOfferable } from "./serviceHandoff";
import { hiddenCount, offerDeactivateInstead, visibleCalendars } from "./calendarLifecycle";
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
    /* Empty until one is picked: a calendar that runs no service offers
       nothing, so the save waits rather than making a silent one. */
    clinicServiceId: null,
    /* 4.1: unset means "no limit", which is the right default for a new one. */
    publicMinimumNoticeMinutes: null,
    publicHorizonDays: null,
  };
}

export default function CalendarsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const location = useLocation();
  const navigate = useNavigate();

  const [editing, setEditing] = useState<Calendar | null>(null);
  const [draft, setDraft] = useState<CalendarInput | null>(null);
  const [accessFor, setAccessFor] = useState<Calendar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Calendar | null>(null);
  /*
   * Hidden by default. The owner's complaint is a crowded screen, and the
   * answer to a crowded screen is to hide what is finished with, not to
   * delete it - deleting takes the appointments with it. Contract v37, 4.1.
   */
  const [showInactive, setShowInactive] = useState(false);

  /*
   * Which služba each calendar runs. Only the ones still offered: a retired
   * service is not something to point a calendar at.
   */
  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    staleTime: CODEBOOK_STALE_MS,
    select: (all) => all.filter((s) => s.isActive),
  });
  const clinicServices = servicesQuery.data ?? [];
  const serviceName = (id: string | null) =>
    clinicServices.find((s) => s.id === id)?.name ?? null;
  const noServicesYet = servicesQuery.isSuccess && clinicServices.length === 0;
  /* The save waits: a calendar saved without a service is a calendar that
     silently offers nothing, which is worse than a button that will not move. */
  const serviceIsChosen = (draft?.clinicServiceId ?? null) !== null;

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const allCalendars = useMemo(
    () =>
      [...(calendarsQuery.data ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [calendarsQuery.data],
  );
  const hidden = hiddenCount(allCalendars);
  const calendars = visibleCalendars(allCalendars, showInactive);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["calendars"] });

  const closeDialog = () => {
    setDraft(null);
    setEditing(null);
    /* Spend the handoff on the way out, not on the way in. Clearing it before
       the dialog was drawn is what broke this in the browser: StrictMode
       mounts twice, the first mount emptied the history entry, and the second
       had nothing left to open. */
    if (location.state !== null) {
      navigate(location.pathname, { replace: true, state: null });
    }
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

  /*
   * Its own button, not a switch inside the edit form. Deactivating is an act
   * with a consequence somebody should mean - no new bookings from that moment
   * - and it used to share a button with deleting, which is what the owner
   * objected to: "neaktívny je keď ho zneaktívnim, a nie keď ho odstránim".
   */
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? calendarsApi.activate(id) : calendarsApi.deactivate(id),
    onSuccess: invalidate,
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
      /* Sent back as it came - `PUT` is the whole calendar, so leaving it out
         would clear it and the calendar would go quiet. */
      clinicServiceId: calendar.clinicServiceId,
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

  /*
   * Arriving from a služba that is missing this.
   *
   * The Služby screen can name that gap and cannot close it - the server takes
   * the link from this side only - so it sends the service here and the form
   * opens ready for it. Without this the button would land somebody on a list
   * and leave them to find the same service again in a dropdown, which is the
   * errand the button was added to save.
   *
   * Decided while rendering rather than in an effect, and the handoff is spent
   * when the dialog closes rather than when it opens. The first version did
   * the opposite and was green in every test and dead in the browser:
   * StrictMode mounts twice, the first mount cleared the history entry, and
   * the second found nothing to act on. `render` in the tests does not double
   * mount, so nothing saw it. There is a StrictMode test below now.
   */
  const handedOver = handoffFrom(location.state);
  const handoffUsable =
    handedOver !== null
    && handoffIsOfferable(handedOver, servicesQuery.data) === true;

  /* Which handoff has already opened a form. Without it, closing the dialog
     while the state is still on the history entry would reopen it forever. */
  const [handoffTaken, setHandoffTaken] = useState<string | null>(null);
  if (handoffUsable && handedOver !== handoffTaken) {
    setHandoffTaken(handedOver);
    setEditing(null);
    setDraft({ ...emptyDraft(calendars.length), clinicServiceId: handedOver });
  }

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
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          {/* Offered only when something is hidden. A switch that never
              changes anything is furniture, and it would sit here forever on
              a clinic that never deactivates a calendar. */}
          {hidden > 0 ? (
            <FormControlLabel
              control={
                <Switch
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
              }
              label={t("booking.calendars.showInactive", { count: hidden })}
            />
          ) : null}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            {t("booking.calendars.new")}
          </Button>
        </Stack>
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
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>
                          {calendar.name}
                        </Typography>
                        {/*
                          * Which služba it runs, and a warning when it runs
                          * none - because then it offers nothing on any day,
                          * and nothing else on any screen says why. This was
                          * the state every calendar was in until booking's
                          * fix: a filter with no way to set what it filtered
                          * on.
                          */}
                        {calendar.clinicServiceId === null ? (
                          <Typography variant="caption" sx={{ color: "warning.main" }}>
                            Neprovozuje žádnou službu — nenabídne nic
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {serviceName(calendar.clinicServiceId) ?? "Služba už neexistuje"}
                          </Typography>
                        )}
                      </Box>
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
                    <Tooltip
                      title={
                        calendar.isActive
                          ? t("booking.calendars.deactivateAction")
                          : t("booking.calendars.activateAction")
                      }
                    >
                      <IconButton
                        aria-label={`${
                          calendar.isActive
                            ? t("booking.calendars.deactivateAction")
                            : t("booking.calendars.activateAction")
                        } — ${calendar.name}`}
                        disabled={setActive.isPending}
                        onClick={() =>
                          setActive.mutate({
                            id: calendar.id,
                            active: !calendar.isActive,
                          })
                        }
                      >
                        {calendar.isActive ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <PlayArrowIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("booking.common.delete")}>
                      <IconButton
                        aria-label={`${t("booking.common.delete")} — ${calendar.name}`}
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
              {/*
                * Which služba this calendar runs. Required in practice though
                * the server allows none: a calendar without one offers nothing
                * on any day, and no screen anywhere would say why.
                */}
              <TextField
                select
                required
                fullWidth
                label="Služba"
                value={draft.clinicServiceId ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    clinicServiceId: e.target.value === "" ? null : e.target.value,
                  })
                }
                error={servicesQuery.isError || noServicesYet}
                helperText={
                  servicesQuery.isError
                    ? "Služby se nepodařilo načíst — bez nich kalendář nic nenabídne."
                    : noServicesYet
                      ? "Zatím není žádná služba. Nejdřív ji založte v Nastavení → Služby."
                      : "Co se v tomhle kalendáři dělá. Bez ní nenabídne žádnou činnost."
                }
              >
                {clinicServices.map((service) => (
                  <MenuItem key={service.id} value={service.id}>
                    {service.name}
                  </MenuItem>
                ))}
              </TextField>

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
              {/*
                * The active switch used to live here, saving through `PUT`.
                * Activating and deactivating have their own routes now
                * (4.1, changes 87 and 88) and their own button in the list,
                * so a switch here would be a second way to do one thing
                * through a different door. The `PUT` still carries the
                * calendar's current `isActive` untouched.
                */}
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
            disabled={!nameIsValid || !serviceIsChosen || save.isPending}
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
          {/* It really deletes now - periods, hours, day activities,
              exceptions, blocks and access go with it. Saying so is the
              difference between this and the button it used to be. */}
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t("booking.calendars.deleteWarning")}
          </Alert>
          {remove.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {/*
                * Shown as it arrived. A 409 here carries the count - "obsahuje
                * 12 termínů" - and the count is the whole message: without it
                * nobody knows whether this is a calendar with one stray
                * appointment or a year of work.
                */}
              {errorText(remove.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>
            {t("booking.common.cancel")}
          </Button>
          {/* The way the server's own message points. Offered only once it
              has refused, so it is an answer to what just happened rather
              than a second button to weigh up front. */}
          {/* `confirmDelete !== null` is repeated for the compiler: the helper
              guarantees it, and a type guard would tie the helper's shape to
              this call site for no gain. */}
          {confirmDelete !== null
            && offerDeactivateInstead(confirmDelete, remove.error !== null) ? (
            <Button
              variant="outlined"
              disabled={setActive.isPending}
              onClick={() => {
                setActive.mutate(
                  { id: confirmDelete.id, active: false },
                  { onSuccess: () => setConfirmDelete(null) },
                );
              }}
            >
              {t("booking.calendars.deactivateAction")}
            </Button>
          ) : null}
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
