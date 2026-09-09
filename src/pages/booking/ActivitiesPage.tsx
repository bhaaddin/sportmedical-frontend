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
import PublicIcon from "@mui/icons-material/Public";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { activitiesApi } from "../../api/activities";
import { servicesApi } from "../../api/services";
import RestoreIcon from "@mui/icons-material/Restore";
import MenuItem from "@mui/material/MenuItem";
import { warningKey } from "../../api/bookingContracts";
import type {
  Activity,
  ActivityInput,
  ActivityWarning,
} from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";
import { ColorSelect } from "../../components/booking/ColorSelect";
import {
  DEFAULT_PALETTE_ENTRY,
  readableTextOn,
} from "../../utils/calendarPalette";

/**
 * Activities - contract screen 5.6.
 *
 * Two rules shape this screen. The duration is free: no fixed list and no
 * 15-minute step. And the backend's remark about an unsellable remainder is a
 * warning the owner may walk past, never a blocking error.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

function emptyDraft(sortOrder: number): ActivityInput {
  return {
    name: "",
    durationMinutes: 30,
    color: DEFAULT_PALETTE_ENTRY.hex,
    publicNote: "",
    isPubliclyBookable: false,
    sortOrder,
    serviceItemId: null,
  };
}

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Activity | null>(null);
  const [draft, setDraft] = useState<ActivityInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);
  /** Warnings the owner has clicked away this session. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: activitiesApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  /* The price list itself belongs to the `app` lane; this screen only points at it. */
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getAll,
    staleTime: CODEBOOK_STALE_MS,
  });

  const activities = useMemo(
    () =>
      [...(activitiesQuery.data?.activities ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [activitiesQuery.data],
  );

  /**
   * 3.1: the read carries the same warnings as the write, so an unsellable
   * remainder is visible on opening the screen - it is a state of the codebook,
   * not the outcome of the last save.
   */
  const warnings: ActivityWarning[] = (
    activitiesQuery.data?.warnings ?? []
  ).filter((warning) => !dismissed.has(warningKey(warning)));

  const closeDialog = () => {
    setDraft(null);
    setEditing(null);
  };

  const save = useMutation({
    mutationFn: (input: ActivityInput) =>
      editing
        ? activitiesApi.update(editing.id, input)
        : activitiesApi.create(input),
    onSuccess: async () => {
      // The save went through either way; the refetched list carries the warnings.
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      setDismissed(new Set());
      closeDialog();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => activitiesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      setConfirmDelete(null);
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => activitiesApi.restore(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft(activities.length));
    save.reset();
  };

  const openEdit = (activity: Activity) => {
    setEditing(activity);
    setDraft({
      name: activity.name,
      durationMinutes: activity.durationMinutes,
      color: activity.color,
      publicNote: activity.publicNote,
      isPubliclyBookable: activity.isPubliclyBookable,
      sortOrder: activity.sortOrder,
      /*
       * 4.3 (v25): `PUT` is the whole activity, and a missing `serviceItemId`
       * clears the link. Carrying it here is the difference between renaming an
       * activity and quietly taking its price away.
       */
      serviceItemId: activity.serviceItemId,
    });
    save.reset();
  };

  const nameIsValid = (draft?.name ?? "").trim().length > 0;
  const durationIsValid = (draft?.durationMinutes ?? 0) > 0;

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
            {t("booking.activities.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.activities.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          {t("booking.activities.new")}
        </Button>
      </Box>

      {warnings.map((warning) => (
        <Alert
          key={warningKey(warning)}
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() =>
            setDismissed((prev) => new Set(prev).add(warningKey(warning)))
          }
        >
          {warning.message}
        </Alert>
      ))}

      <AsyncSection
        isLoading={activitiesQuery.isLoading}
        isSettled={activitiesQuery.isSuccess}
        error={activitiesQuery.error}
        isEmpty={activities.length === 0}
        emptyText={t("booking.activities.empty")}
        emptyAction={{
          label: t("booking.activities.new"),
          onClick: openCreate,
        }}
        onRetry={() => void activitiesQuery.refetch()}
      >
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("booking.activities.column.name")}</TableCell>
                <TableCell>{t("booking.activities.column.duration")}</TableCell>
                <TableCell>
                  {t("booking.activities.column.publicNote")}
                </TableCell>
                <TableCell>{t("booking.activities.column.price")}</TableCell>
                <TableCell>{t("booking.activities.column.public")}</TableCell>
                <TableCell align="right">
                  {t("booking.common.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  hover
                  sx={{ opacity: activity.isActive ? 1 : 0.55 }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: "3px",
                          backgroundColor: activity.color,
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontWeight: 600 }}>
                        {activity.name}
                      </Typography>
                      {/* 4.3: a discard keeps the row and its slug. Say so in
                          words - the dimming alone is not the message (7.1). */}
                      {activity.isActive ? null : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t("booking.activities.discarded")}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t("booking.activities.durationValue", {
                        minutes: activity.durationMinutes,
                      })}
                      sx={{
                        backgroundColor: activity.color,
                        color: readableTextOn(activity.color),
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    {activity.publicNote || "-"}
                  </TableCell>
                  {/*
                    4.3 (v25): read through the link, never stored here. No link
                    means no price - written as such, because "0 Kč" would read
                    as free rather than as unpriced.
                  */}
                  <TableCell>
                    {activity.priceCzk === null
                      ? t("booking.activities.noPrice")
                      : t("booking.activities.priceValue", {
                          price: activity.priceCzk,
                        })}
                  </TableCell>
                  <TableCell>
                    {/* Icon plus text: colour and icon alone would not carry it (7.1). */}
                    {activity.isPubliclyBookable ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <PublicIcon fontSize="small" />
                        {t("booking.activities.publicYes")}
                      </Box>
                    ) : (
                      t("booking.activities.publicNo")
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t("booking.common.edit")}>
                      <IconButton
                        aria-label={t("booking.common.edit")}
                        onClick={() => openEdit(activity)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {activity.isActive ? (
                      <Tooltip title={t("booking.common.delete")}>
                        <IconButton
                          aria-label={t("booking.common.delete")}
                          onClick={() => setConfirmDelete(activity)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title={t("booking.activities.restore")}>
                        <IconButton
                          aria-label={t("booking.activities.restore")}
                          disabled={restore.isPending}
                          onClick={() => restore.mutate(activity.id)}
                        >
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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
            ? t("booking.activities.editTitle")
            : t("booking.activities.newTitle")}
        </DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                autoFocus
                required
                fullWidth
                label={t("booking.activities.column.name")}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={draft.name !== "" && !nameIsValid}
              />
              <TextField
                required
                fullWidth
                type="number"
                label={t("booking.activities.column.duration")}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: Number(e.target.value) || 0,
                  })
                }
                error={!durationIsValid}
                helperText={t("booking.activities.durationHelp")}
              />
              <ColorSelect
                label={t("booking.activities.column.color")}
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
              />
              {/*
                4.3 (v25). The price is not typed here and never was: the
                activity points at an item in the price list and the price is
                read through that. Choosing "no link" is allowed - it is what
                `price.unlinked` warns about, not what it forbids.

                The duration is deliberately not kept in step with the item's:
                the owner sets it, and a difference is reported by
                `price.duration_drift` rather than corrected behind their back.
              */}
              <TextField
                select
                fullWidth
                label={t("booking.activities.serviceItem")}
                value={draft.serviceItemId ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    serviceItemId: e.target.value === "" ? null : e.target.value,
                  })
                }
                helperText={
                  servicesQuery.isError
                    ? t("booking.activities.serviceItemUnavailable")
                    : t("booking.activities.serviceItemHelp")
                }
                error={servicesQuery.isError}
              >
                <MenuItem value="">
                  {t("booking.activities.noServiceItem")}
                </MenuItem>
                {/*
                  A link the owner already has stays selectable even when the
                  item is archived or gone from the list - otherwise opening the
                  dialog would silently drop it on the next save.
                */}
                {(servicesQuery.data ?? []).map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {t("booking.activities.priceValue", {
                      price: item.priceCzk,
                    })}
                  </MenuItem>
                ))}
                {draft.serviceItemId &&
                !(servicesQuery.data ?? []).some(
                  (item) => item.id === draft.serviceItemId,
                ) ? (
                  <MenuItem value={draft.serviceItemId}>
                    {t("booking.activities.serviceItemUnknown")}
                  </MenuItem>
                ) : null}
              </TextField>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t("booking.activities.column.publicNote")}
                value={draft.publicNote}
                onChange={(e) =>
                  setDraft({ ...draft, publicNote: e.target.value })
                }
              />
              <TextField
                fullWidth
                type="number"
                label={t("booking.activities.column.order")}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.isPubliclyBookable}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        isPubliclyBookable: e.target.checked,
                      })
                    }
                  />
                }
                label={t("booking.activities.publicLabel")}
              />
              {/* 422 keeps the form filled in, so the message sits inside the dialog. */}
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
            disabled={!nameIsValid || !durationIsValid || save.isPending}
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
        <DialogTitle>{t("booking.activities.deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("booking.activities.deleteBody", {
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
    </Box>
  );
}
