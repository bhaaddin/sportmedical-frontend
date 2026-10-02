import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { calendarsApi } from "../../api/calendars";
import {
  absenceDraftProblem,
  employeeAbsencesApi,
  type EmployeeAbsence,
  type EmployeeAbsenceInput,
} from "../../api/employeeAbsences";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";
import { formatDateOnly, toDateOnly } from "../../utils/time";

/*
 * Nepřítomnost zaměstnanců - who is out, and when.
 *
 * Reached from Nastavení (Kalendáře a provoz) and from the employee's own row
 * in Tým a účty, which opens this screen already narrowed to that person
 * (`?userId=`). One screen for both, so there is one list and one form.
 *
 * What an absence does is the server's business and it does all of it: the
 * worker's days stop being offered online, the desk cannot book or move a
 * patient onto them, the grid marks them "nepřítomnost" and the day overview
 * says who is out. The way to still work such a day is a stand-in in Výjimky.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

interface Draft {
  userId: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

export default function EmployeeAbsencesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = toDateOnly(new Date());

  /** Everybody when empty; one person when opened from their row. */
  const userFilter = searchParams.get("userId") ?? "";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EmployeeAbsence | null>(null);

  const absencesQuery = useQuery({
    queryKey: ["employee-absences", userFilter],
    queryFn: () => employeeAbsencesApi.list(userFilter || undefined),
  });

  /*
   * Who can be recorded absent: every active account. The calendar access
   * list already answers that - it names every account that could be ticked,
   * whichever calendar is asked - so it is read rather than a second list of
   * staff being written for this screen.
   */
  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });
  const anyCalendarId = calendarsQuery.data?.[0]?.id ?? "";
  const peopleQuery = useQuery({
    queryKey: ["calendar-access", anyCalendarId],
    queryFn: () => calendarsApi.getAccess(anyCalendarId),
    enabled: anyCalendarId !== "",
    staleTime: CODEBOOK_STALE_MS,
  });

  const people = useMemo(
    () =>
      [...(peopleQuery.data ?? [])]
        .map((row) => ({ id: row.userId, name: row.displayName }))
        .sort((a, b) => a.name.localeCompare(b.name, "cs")),
    [peopleQuery.data],
  );

  const nameOf = (absence: EmployeeAbsence) =>
    absence.workerDisplayName ??
    people.find((p) => p.id === absence.userId)?.name ??
    t("booking.absences.unknownWorker");

  const absences = absencesQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee-absences"] });

  const save = useMutation({
    mutationFn: (input: EmployeeAbsenceInput) => employeeAbsencesApi.create(input),
    onSuccess: async () => {
      /* The grid and the day overview read absences through the server, so
         they are refreshed too rather than left showing the day as open. */
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["grid-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["day-summary"] }),
      ]);
      setDraft(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => employeeAbsencesApi.remove(id),
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["grid-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["day-summary"] }),
      ]);
      setConfirmDelete(null);
    },
  });

  const openCreate = () => {
    save.reset();
    setDraft({ userId: userFilter, fromDate: today, toDate: today, reason: "" });
  };

  const problem = draft ? absenceDraftProblem(draft) : null;

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
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
            {t("booking.absences.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.absences.subtitle")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t("booking.absences.new")}
        </Button>
      </Box>

      <TextField
        select
        label={t("booking.absences.worker")}
        value={userFilter}
        onChange={(e) =>
          setSearchParams(e.target.value ? { userId: e.target.value } : {}, {
            replace: true,
          })
        }
        sx={{ minWidth: 280, mb: 3 }}
      >
        <MenuItem value="">{t("booking.absences.everybody")}</MenuItem>
        {people.map((person) => (
          <MenuItem key={person.id} value={person.id}>
            {person.name}
          </MenuItem>
        ))}
        {/* Opened from a row whose person the list does not name (yet). */}
        {userFilter !== "" && !people.some((p) => p.id === userFilter) ? (
          <MenuItem value={userFilter}>{t("booking.absences.selectedWorker")}</MenuItem>
        ) : null}
      </TextField>

      <AsyncSection
        isLoading={absencesQuery.isLoading}
        isSettled={absencesQuery.isSuccess}
        error={absencesQuery.error}
        isEmpty={absences.length === 0}
        emptyText={t("booking.absences.empty")}
        emptyAction={{ label: t("booking.absences.new"), onClick: openCreate }}
        onRetry={() => void absencesQuery.refetch()}
      >
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("booking.absences.worker")}</TableCell>
                <TableCell>{t("booking.absences.from")}</TableCell>
                <TableCell>{t("booking.absences.to")}</TableCell>
                <TableCell>{t("booking.absences.reason")}</TableCell>
                <TableCell align="right">{t("booking.common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {absences.map((absence) => (
                <TableRow key={absence.id} hover>
                  <TableCell>{nameOf(absence)}</TableCell>
                  <TableCell>{formatDateOnly(absence.fromDate)}</TableCell>
                  <TableCell>{formatDateOnly(absence.toDate)}</TableCell>
                  <TableCell>{absence.reason || "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t("booking.absences.remove")}>
                      <IconButton
                        aria-label={t("booking.absences.removeFor", { name: nameOf(absence) })}
                        onClick={() => {
                          remove.reset();
                          setConfirmDelete(absence);
                        }}
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

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t("booking.absences.newTitle")}</DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {peopleQuery.isError || (calendarsQuery.isSuccess && anyCalendarId === "") ? (
                <Alert severity="warning">{t("booking.absences.peopleFailed")}</Alert>
              ) : null}
              <TextField
                select
                required
                fullWidth
                label={t("booking.absences.worker")}
                value={draft.userId}
                onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
              >
                {people.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                  </MenuItem>
                ))}
                {draft.userId !== "" && !people.some((p) => p.id === draft.userId) ? (
                  <MenuItem value={draft.userId}>{t("booking.absences.selectedWorker")}</MenuItem>
                ) : null}
              </TextField>
              <Stack direction="row" spacing={1}>
                <TextField
                  required
                  fullWidth
                  type="date"
                  label={t("booking.absences.from")}
                  value={draft.fromDate}
                  onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  required
                  fullWidth
                  type="date"
                  label={t("booking.absences.to")}
                  value={draft.toDate}
                  error={problem === "order"}
                  helperText={problem === "order" ? t("booking.absences.orderProblem") : undefined}
                  onChange={(e) => setDraft({ ...draft, toDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <TextField
                fullWidth
                label={t("booking.absences.reason")}
                placeholder={t("booking.absences.reasonPlaceholder")}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("booking.absences.effect")}
              </Typography>
              {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>{t("booking.common.cancel")}</Button>
          <Button
            variant="contained"
            disabled={draft === null || problem !== null || save.isPending}
            onClick={() =>
              draft &&
              save.mutate({
                userId: draft.userId,
                fromDate: draft.fromDate,
                toDate: draft.toDate,
                reason: draft.reason.trim() === "" ? null : draft.reason.trim(),
              })
            }
          >
            {t("booking.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>{t("booking.absences.removeTitle")}</DialogTitle>
        <DialogContent>
          <Typography>
            {confirmDelete
              ? t("booking.absences.removeBody", {
                  name: nameOf(confirmDelete),
                  from: formatDateOnly(confirmDelete.fromDate),
                  to: formatDateOnly(confirmDelete.toDate),
                })
              : ""}
          </Typography>
          {remove.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(remove.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>{t("booking.common.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={remove.isPending}
            onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
          >
            {t("booking.absences.remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
