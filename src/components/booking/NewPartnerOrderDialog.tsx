import { useEffect, useMemo, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useIsPhone } from "../../layout/useDevice";
import { activitiesApi } from "../../api/activities";
import { partnerOrdersApi } from "../../api/partnerOrders";
import { workingHoursApi } from "../../api/workingHours";
import { PARTNER_TYPE_NAMES } from "../../api/bookingContracts";
import { clubsApi } from "../../services/clubsApi";
import { SectionLabel, SoftCard } from "../ui";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";
import { useCalendarDisplay } from "../../api/displaySettings";
import { hourToTime } from "../../utils/dayHours";

/**
 * Creating a partner reservation — contract 5.10.
 *
 * The screen exists for one thing, and 5.10 says so outright: **the coverage
 * arithmetic updates as windows are added, not after saving.** "Pokryté 62 h
 * z 80 h" while the owner is still typing is the entire point; a number that
 * only appears after a save tells them nothing while they are deciding.
 *
 * That is the one place in this lane where a total is worked out on the client,
 * and it is worth being exact about why it does not contradict 4.7. Two
 * different quantities share the word "count":
 *
 *   - **required and covered minutes** are properties of the *request* -
 *     activity length times how many, and the length of the windows. They exist
 *     before anything is saved and no appointment can change them.
 *   - **booked and remaining** are counted from appointments, on the server, on
 *     every read. Nothing here computes those, and once the order is saved the
 *     overview draws the server's numbers rather than these.
 *
 * The covered figure counts only the part of a window that falls inside the
 * calendar's working hours, because that is what the server counts. Measured:
 * a window of 08:00-16:00 on a day open 08:00-12:00 came back as 240 minutes,
 * not 480. Drawing the wall-clock length instead would have overstated the
 * cover by half and then quietly halved itself on save - a screen disagreeing
 * with itself across a button press. The hours come from `preview`, so this is
 * arithmetic over the server's own answer rather than a second opinion about
 * when the clinic is open.
 *
 * The order is created first and the items and windows are attached to it,
 * because that is what the API offers: `POST` takes the partner, and the rest
 * are their own routes. So a save is several calls, and a failure part-way
 * leaves an order with less in it than the form showed - which the dialog says
 * plainly rather than pretending it all landed.
 *
 * Since the design board (3. 10. 2026) the dialog can also be opened with a
 * head start: the calendar's "Rezervovat pro klub" hands over the dragged
 * slot, a club from the list, or a club typed into the drawer's "NEBO ZALOŽIT
 * NOVÝ" form. {@link PartnerOrderPrefill} is that handover; every field in it
 * is optional and only fills what the owner has not typed.
 */

/** 4.7 takes these as numbers; the strings that match the prose are refused. */
const PARTNER_TYPES = Object.keys(PARTNER_TYPE_NAMES).map(Number);

interface WindowDraft {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface ItemDraft {
  key: string;
  activityId: string;
  requestedCount: number;
}

/** What another screen may fill in before the owner sees the form. */
export interface PartnerOrderPrefill {
  partnerName?: string;
  contactEmail?: string;
  note?: string;
  /** The payer on file; its name and e-mail are looked up when not given. */
  clubId?: string | null;
  /** How many athletes the club said - becomes the count of the first item. */
  headcount?: number;
  /** Held days, typically the one slot dragged on the calendar. */
  windows?: { date: string; startTime: string; endTime: string }[];
}

export function NewPartnerOrderDialog({
  open,
  calendarId,
  initial,
  onClose,
  onCreated,
}: {
  open: boolean;
  calendarId: string;
  initial?: PartnerOrderPrefill;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const phone = useIsPhone();

  const [partnerName, setPartnerName] = useState(initial?.partnerName ?? "");
  const [partnerType, setPartnerType] = useState(0);
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    (initial?.windows ?? []).map((w, i) => ({ key: `w-init-${i}`, ...w })),
  );
  const [partial, setPartial] = useState<string | null>(null);

  // Bulk multi-day reservation: a club calls with N athletes and staff hold a
  // whole range of days at once instead of adding them one by one.
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  // The day's default hours are the clinic's calendar settings; typing overrides them.
  const { settings: display } = useCalendarDisplay();
  const defaultStart = hourToTime(display.dayStartHour);
  const defaultEnd = hourToTime(display.dayEndHour);
  const [bulkStartEdited, setBulkStart] = useState<string | null>(null);
  const [bulkEndEdited, setBulkEnd] = useState<string | null>(null);
  const bulkStart = bulkStartEdited ?? defaultStart;
  const bulkEnd = bulkEndEdited ?? defaultEnd;

  const addRange = () => {
    if (!bulkFrom || !bulkTo) return;
    const start = new Date(`${bulkFrom}T00:00:00`);
    const end = new Date(`${bulkTo}T00:00:00`);
    if (Number.isNaN(+start) || Number.isNaN(+end) || start > end) return;
    const rows: WindowDraft[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      rows.push({
        key: `w${Date.now()}${iso}`,
        date: iso,
        startTime: bulkStart || defaultStart,
        endTime: bulkEnd || defaultEnd,
      });
    }
    setWindows((prev) => [...prev, ...rows]);
  };

  /* A club handed over by id: its name and e-mail fill the empty fields. */
  const clubId = initial?.clubId ?? null;
  const clubsQuery = useQuery({
    queryKey: ["clubs"],
    queryFn: () => clubsApi.getAll(false),
    enabled: open && clubId !== null,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (clubId === null) return;
    const club = (clubsQuery.data ?? []).find((c) => c.id === clubId);
    if (!club) return;
    setPartnerName((name) => (name.trim() === "" ? club.name : name));
    setContactEmail((email) => (email.trim() === "" ? (club.contactEmail ?? "") : email));
  }, [clubId, clubsQuery.data]);

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: activitiesApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const activities = useMemo(
    () => (activitiesQuery.data?.activities ?? []).filter((a) => a.isActive),
    [activitiesQuery.data],
  );

  /* "62 sportovců" from the drawer becomes one line to choose the činnost for. */
  const headcount = initial?.headcount;
  useEffect(() => {
    if (headcount === undefined || headcount <= 0) return;
    setItems((prev) =>
      prev.length > 0
        ? prev
        : [{ key: "i-init", activityId: activities.length === 1 ? activities[0].id : "", requestedCount: headcount }],
    );
  }, [headcount, activities]);

  const durationOf = (activityId: string) =>
    activities.find((a) => a.id === activityId)?.durationMinutes ?? 0;

  /* The days the owner has put windows on, so the hours can be asked for once. */
  const days = useMemo(
    () => [...new Set(windows.map((w) => w.date).filter(Boolean))].sort(),
    [windows],
  );

  const hoursQuery = useQuery({
    queryKey: ["preview", calendarId, days[0], days[days.length - 1]],
    queryFn: () =>
      workingHoursApi.preview(calendarId, days[0], days[days.length - 1]),
    enabled: open && days.length > 0,
  });

  const dayHours = useMemo(
    () => new Map((hoursQuery.data ?? []).map((d) => [d.date, d])),
    [hoursQuery.data],
  );

  /* ── The arithmetic 5.10 exists for ── */
  const requiredMinutes = items.reduce(
    (sum, i) => sum + durationOf(i.activityId) * i.requestedCount,
    0,
  );

  const minutesOf = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };

  /** The part of one window the calendar is actually open for. */
  const coverOf = (w: WindowDraft): number => {
    const day = dayHours.get(w.date);
    if (!day || !day.isOpen || !day.startTime || !day.endTime) return 0;

    const from = Math.max(minutesOf(w.startTime), minutesOf(day.startTime));
    const to = Math.min(minutesOf(w.endTime), minutesOf(day.endTime));
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;

    let minutes = to - from;

    /* Lunch is not sellable time, and the server does not count it either. */
    if (day.breakStart && day.breakEnd) {
      const bFrom = Math.max(from, minutesOf(day.breakStart));
      const bTo = Math.min(to, minutesOf(day.breakEnd));
      if (Number.isFinite(bFrom) && Number.isFinite(bTo) && bTo > bFrom) {
        minutes -= bTo - bFrom;
      }
    }
    return Math.max(0, minutes);
  };

  const coveredMinutes = windows.reduce((sum, w) => sum + coverOf(w), 0);

  /* A window on a closed day covers nothing, and the owner needs to see that
     while they are choosing rather than after they have saved. */
  const closedDays = windows.filter(
    (w) => w.date !== "" && dayHours.has(w.date) && !dayHours.get(w.date)?.isOpen,
  );

  const save = useMutation({
    mutationFn: async () => {
      const order = await partnerOrdersApi.create(calendarId, {
        partnerName: partnerName.trim(),
        partnerType,
        contactEmail: contactEmail.trim() || null,
        note: note.trim() || null,
        clubId,
      });

      /*
       * From here the order exists. If one of these fails the dialog must say
       * so rather than closing on a success it did not have - the partner would
       * be in the list with an empty request and nobody would know why.
       */
      if (items.length > 0) {
        await partnerOrdersApi.setItems(
          calendarId,
          order.id,
          items.map((i) => ({
            activityId: i.activityId,
            requestedCount: i.requestedCount,
          })),
        );
      }
      for (const w of windows) {
        await partnerOrdersApi.addWindow(calendarId, order.id, {
          date: w.date,
          startTime: w.startTime,
          endTime: w.endTime,
        });
      }
      return order;
    },
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: () => {
      setPartial(t("booking.partner.partialSave"));
      onCreated();
    },
  });

  const canSave =
    partnerName.trim().length > 0 &&
    items.every((i) => i.activityId !== "" && i.requestedCount > 0) &&
    windows.every((w) => w.date !== "" && w.startTime !== "" && w.endTime !== "") &&
    !save.isPending;

  const short = requiredMinutes > 0 && coveredMinutes < requiredMinutes;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
      <DialogTitle>{t("booking.partner.newTitle")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* ── 1. Partner ── */}
          <Box>
            <SectionLabel>{t("booking.partner.step1")}</SectionLabel>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                size="small"
                autoFocus
                label={t("booking.partner.name")}
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
              />
              <TextField
                select
                size="small"
                label={t("booking.partner.typeLabel")}
                value={partnerType}
                onChange={(e) => setPartnerType(Number(e.target.value))}
                sx={{ minWidth: 160 }}
              >
                {PARTNER_TYPES.map((code) => (
                  <MenuItem key={code} value={code}>
                    {t(`booking.partner.type.${PARTNER_TYPE_NAMES[code]}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                size="small"
                label={t("booking.partner.email")}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Stack>
          </Box>

          {/* ── 2. The request ── */}
          <Box>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}
            >
              <SectionLabel sx={{ mb: 0 }}>{t("booking.partner.step2")}</SectionLabel>
              <Button
                size="small"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      key: `i${Date.now()}${prev.length}`,
                      activityId: "",
                      requestedCount: 1,
                    },
                  ])
                }
              >
                {t("booking.partner.addItem")}
              </Button>
            </Stack>

            <AsyncSection
              isLoading={activitiesQuery.isLoading}
              isSettled={activitiesQuery.isSuccess || activitiesQuery.isError}
              error={activitiesQuery.error}
              isEmpty={activities.length === 0}
              emptyText={t("booking.new.noActivities")}
              onRetry={() => void activitiesQuery.refetch()}
              skeletonRows={2}
            >
              <Stack spacing={1}>
                {items.map((item, index) => (
                  <Stack
                    key={item.key}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={t("booking.new.activity")}
                      value={item.activityId}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === index ? { ...p, activityId: e.target.value } : p,
                          ),
                        )
                      }
                    >
                      {activities.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name} · {a.durationMinutes} min
                          {a.priceCzk !== null ? ` · ${a.priceCzk.toLocaleString("cs-CZ")} Kč` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      type="number"
                      size="small"
                      label={t("booking.partner.count")}
                      value={item.requestedCount}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === index
                              ? { ...p, requestedCount: Number(e.target.value) || 0 }
                              : p,
                          ),
                        )
                      }
                      sx={{ width: 110 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", minWidth: 80 }}
                    >
                      {durationOf(item.activityId) * item.requestedCount} min
                    </Typography>
                    <IconButton
                      aria-label={t("booking.common.delete")}
                      onClick={() =>
                        setItems((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </AsyncSection>
          </Box>

          {/* ── 3. Windows, with the running coverage ── */}
          <Box>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}
            >
              <SectionLabel sx={{ mb: 0 }}>{t("booking.partner.step3")}</SectionLabel>
              <Button
                size="small"
                onClick={() =>
                  setWindows((prev) => [
                    ...prev,
                    {
                      key: `w${Date.now()}${prev.length}`,
                      date: "",
                      startTime: defaultStart,
                      endTime: defaultEnd,
                    },
                  ])
                }
              >
                {t("booking.partner.addWindow")}
              </Button>
            </Stack>

            {/* Bulk multi-day: hold a whole range of days in one action. */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Hromadně (více dní):
              </Typography>
              <TextField
                size="small"
                type="date"
                label="Od"
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <TextField
                size="small"
                type="date"
                label="Do"
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <TextField
                size="small"
                type="time"
                label="Od"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 110 }}
              />
              <TextField
                size="small"
                type="time"
                label="Do"
                value={bulkEnd}
                onChange={(e) => setBulkEnd(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 110 }}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={!bulkFrom || !bulkTo}
                onClick={addRange}
              >
                Přidat dny
              </Button>
            </Stack>

            <Stack spacing={1}>
              {windows.map((w, index) => (
                <Stack
                  key={w.key}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <TextField
                    type="date"
                    size="small"
                    label={t("booking.partner.day")}
                    value={w.date}
                    onChange={(e) =>
                      setWindows((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, date: e.target.value } : p,
                        ),
                      )
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label={t("booking.partner.from")}
                    value={w.startTime}
                    onChange={(e) =>
                      setWindows((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, startTime: e.target.value } : p,
                        ),
                      )
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label={t("booking.partner.to")}
                    value={w.endTime}
                    onChange={(e) =>
                      setWindows((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, endTime: e.target.value } : p,
                        ),
                      )
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <IconButton
                    aria-label={t("booking.common.delete")}
                    onClick={() =>
                      setWindows((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* The whole reason this screen is a screen. */}
          <SoftCard
            tone={short ? "plain" : "soft"}
            sx={{ p: 2, ...(short ? { borderColor: "warning.main" } : {}) }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {t("booking.partner.coverage", {
                covered: coveredMinutes,
                required: requiredMinutes,
              })}
            </Typography>
            {short ? (
              <Typography variant="body2" sx={{ color: "warning.main" }}>
                {t("booking.partner.short", {
                  minutes: requiredMinutes - coveredMinutes,
                })}
              </Typography>
            ) : null}
            {closedDays.length > 0 ? (
              <Typography variant="body2" sx={{ color: "warning.main" }}>
                {t("booking.partner.closedDay", {
                  days: closedDays.map((w) => w.date).join(", "),
                })}
              </Typography>
            ) : null}
            {hoursQuery.isError ? (
              <Typography variant="body2" sx={{ color: "warning.main" }}>
                {t("booking.partner.hoursFailed")}
              </Typography>
            ) : null}
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("booking.partner.coverageNote")}
            </Typography>
          </SoftCard>

          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label={t("booking.detail.note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {partial ? <Alert severity="warning">{partial}</Alert> : null}
          {save.error && !partial ? (
            <Alert severity="error">{errorText(save.error, t)}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>{t("booking.common.cancel")}</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => save.mutate()}>
          {t("booking.common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewPartnerOrderDialog;
