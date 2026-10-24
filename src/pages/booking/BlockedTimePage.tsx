import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { appointmentsApi } from "../../api/appointments";
import { PageFrame, Shelf, TARGET_SX } from "../../ui/shelf";
import { StatusChip } from "../../components/ui/StatusChip";
import { SettingsItemCard } from "./SettingsItemCard";
import { shelfState } from "./shelfState";
import { errorText } from "../../components/booking/errorText";
import { FIELD_LIMITS } from "../../api/fieldLimits";
import { SectionLabel } from "../../components/ui";
import {
  addDaysToDateOnly,
  formatDateOnly,
  formatPragueTime,
  pragueDateKey,
  pragueWallClockToInstant,
} from "../../utils/time";

/**
 * Blocked time - contract screen for §2.2 "Zablokovat čas bez pacienta":
 * servicing a device, a meeting, training. Time that is not for sale and has
 * no patient attached.
 *
 * The API had all three calls (`blocks`, `createBlock`, `deleteBlock`) and no
 * screen ever called any of them - a grep for them across every `.tsx` came
 * back empty. This is that screen.
 *
 * 3.3 on both edges: the operator picks a Prague date and a Prague wall-clock
 * time, `pragueWallClockToInstant` turns that into the right instant on the
 * two clock-change days as well, and what comes back is shown in Prague again.
 * Nothing here does date arithmetic in UTC.
 *
 * That helper exists because the first version of this screen got it wrong.
 * It added `hours * 3600000` to the start of the Prague day, which is only the
 * same thing on the 363 days that have 24 wall-clock hours. Blocking 13:00 on
 * 25. 10. 2026 stored 11:00Z and came back as 12:00 - an hour before what was
 * typed, on the one day nobody would think to check.
 *
 * Measured against the running API before this was written, because the client
 * existing does not mean the endpoint works:
 *
 *     POST   …/blocks  -> 201 and the block appears in the list
 *     DELETE …/blocks/{id} -> 200 and it leaves
 *     POST   …/appointments into a blocked time -> 409
 *
 * This screen first shipped carrying a warning that a blocked time still
 * appeared among the offered slots: the 409 was real (a database exclusion
 * constraint) but `AvailabilityService` only ever read appointments, never
 * blocks. Reported to the booking lane with both measurements rather than
 * patched here - filtering blocks client-side would have been a second
 * availability calculation, which 6.1 forbids precisely so the client and the
 * server cannot tell a receptionist different things.
 *
 * They matched blocks by overlap rather than by start, which is the better
 * rule and one this lane had not thought to test: a block can be an afternoon
 * or a fortnight, and one that began yesterday still covers this morning.
 * Measured against the server of the day, it held, and the warning came off.
 *
 * It is back. 5092 was moved to a different database and a different published
 * build, and this one does not carry that fix. Measured again on 11. 9. 2026,
 * after logging in to the new environment:
 *
 *     POST …/blocks            -> 201, and the row is in the list, times right
 *     GET  …/availability      -> the blocked slot is STILL OFFERED
 *     POST …/appointments      -> 409 "Tento čas už je obsazený."
 *
 * So the sentence goes back on the screen. It is not a retraction of the
 * earlier measurement - that one was true about the server that answered then.
 * It is the difference between "the fix exists" and "the fix is running here",
 * which is the distinction three lanes have each got wrong once this week.
 *
 * The warning goes when this environment measures clean, not when someone
 * says the fix is merged.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

interface Draft {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

function emptyDraft(today: string): Draft {
  return { date: today, startTime: "08:00", endTime: "09:00", reason: "" };
}

export default function BlockedTimePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /* The clinic's day, not the browser's: the times below are Prague times too. */
  const today = pragueDateKey(new Date());

  const [calendarId, setCalendarId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = calendarsQuery.data ?? [];
  const activeCalendarId = calendarId || calendars[0]?.id || "";

  /** The endpoint needs a range; this is the window the list covers. */
  const windowFrom = addDaysToDateOnly(today, -30);
  const windowTo = addDaysToDateOnly(today, 180);

  const blocksQuery = useQuery({
    queryKey: ["blocks", activeCalendarId, windowFrom, windowTo],
    queryFn: () =>
      appointmentsApi.blocks(activeCalendarId, windowFrom, windowTo),
    enabled: activeCalendarId !== "",
  });

  const blocks = useMemo(
    () =>
      [...(blocksQuery.data ?? [])].sort((a, b) =>
        a.startUtc.localeCompare(b.startUtc),
      ),
    [blocksQuery.data],
  );

  const save = useMutation({
    mutationFn: (input: Draft) =>
      appointmentsApi.createBlock(
        activeCalendarId,
        pragueWallClockToInstant(input.date, input.startTime),
        pragueWallClockToInstant(input.date, input.endTime),
        input.reason.trim(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["blocks", activeCalendarId],
      });
      setDraft(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      appointmentsApi.deleteBlock(activeCalendarId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["blocks", activeCalendarId] }),
  });

  const openCreate = () => {
    setDraft(emptyDraft(today));
    save.reset();
  };

  /*
   * The end has to be after the start, and the reason is required: a blocked
   * hour with no reason is indistinguishable from a mistake three weeks later,
   * and somebody has to decide whether to clear it.
   */
  const draftProblem = (d: Draft): string | null => {
    if (d.endTime <= d.startTime) return t("booking.blocks.endBeforeStart");
    if (d.reason.trim() === "") return t("booking.blocks.reasonRequired");
    return null;
  };

  const problem = draft ? draftProblem(draft) : null;
  const calState = shelfState(calendarsQuery, t);
  const listState = shelfState(blocksQuery, t);
  const nowIso = new Date().toISOString();
  const activeBlocks = blocks.filter((block) => block.endUtc >= nowIso);
  const pastBlocks = blocks.filter((block) => block.endUtc < nowIso).reverse();
  const card = (block: (typeof blocks)[number]) => {
    const running = block.startUtc <= nowIso && block.endUtc >= nowIso;
    return (
      <SettingsItemCard
        key={block.id}
        kind="block"
        id={block.id}
        title={`${formatDateOnly(pragueDateKey(block.startUtc))} · ${formatPragueTime(block.startUtc)}–${formatPragueTime(block.endUtc)}`}
        status={running ? <StatusChip tone="blue" size="sm">Právě</StatusChip> : undefined}
        dim={block.endUtc < nowIso}
        actions={
          <>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              color="error"
              aria-label={t("booking.blocks.release")}
              onClick={() => remove.mutate(block.id)}
              disabled={remove.isPending}
              sx={TARGET_SX}
            >
              {t("booking.blocks.release")}
            </Button>
          </>
        }
      >
        {/* The reason is required on the way in, so this is never blank. */}
        <span>{block.reason}</span>
      </SettingsItemCard>
    );
  };
  const calendarReady = !calState.loading && calState.error === false;
  const blocksReady = !listState.loading && listState.error === false;

  return (
    <PageFrame
      title={t("booking.blocks.title")}
      purpose={`${t("booking.blocks.subtitle")} ${t("booking.blocks.window", { from: formatDateOnly(windowFrom), to: formatDateOnly(windowTo) })}`}
      primaryAction={activeCalendarId === "" ? undefined : { label: t("booking.blocks.new"), icon: <AddIcon />, onClick: openCreate }}
    >
      {/* The warning that a blocked time still showed among the free slots is gone: measured on the dev API
          on 20. 10. 2026 (a block took the 07:00 slot off /availability, 17 -> 15 slots), which is the condition the
          note at the top of this file set for removing it. */}
      <Shelf
        id="blocks-calendar"
        title={t("booking.workingHours.calendar")}
        layout="board"
        loading={calState.loading}
        error={calState.error}
        onRetry={calState.onRetry}
        empty={calendarReady && calendars.length === 0}
        emptyState={{ text: t("booking.workingHours.noCalendars"), action: { label: "Kalendáře", to: "/calendars" } }}
      >
        <TextField
          select
          value={activeCalendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          slotProps={{ htmlInput: { "aria-label": t("booking.workingHours.calendar") } }}
          sx={{ minWidth: 280, maxWidth: "100%" }}
        >
          {calendars.map((calendar) => (
            <MenuItem key={calendar.id} value={calendar.id}>
              {calendar.name}
            </MenuItem>
          ))}
        </TextField>
      </Shelf>

      {calendarReady && calendars.length > 0 ? (
        <>
          {remove.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(remove.error, t)}
            </Alert>
          )}
          <Shelf
            id="blocks-active"
            title="Aktivní bloky"
            count={blocksReady ? activeBlocks.length : undefined}
            layout="grid"
            minCardWidth={300}
            cardHeight={110}
            loading={listState.loading}
            error={listState.error}
            onRetry={listState.onRetry}
            empty={blocksReady && activeBlocks.length === 0}
            emptyState={{ text: t("booking.blocks.empty"), action: { label: t("booking.blocks.new"), onClick: openCreate } }}
          >
            {activeBlocks.map(card)}
          </Shelf>
          {blocksReady && pastBlocks.length > 0 ? (
            <Shelf id="blocks-past" title="Minulé" count={pastBlocks.length} layout="grid" minCardWidth={300} cardHeight={110}>
              {pastBlocks.map(card)}
            </Shelf>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("booking.blocks.newTitle")}</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box>
                <SectionLabel>{t("booking.blocks.date")}</SectionLabel>
                <TextField
                  fullWidth
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  slotProps={{ htmlInput: { "aria-label": t("booking.blocks.date") } }}
                />
              </Box>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <SectionLabel>{t("booking.blocks.from")}</SectionLabel>
                  <TextField
                    fullWidth
                    type="time"
                    value={draft.startTime}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value })
                    }
                    slotProps={{ htmlInput: { "aria-label": t("booking.blocks.from") } }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <SectionLabel>{t("booking.blocks.to")}</SectionLabel>
                  <TextField
                    fullWidth
                    type="time"
                    value={draft.endTime}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value })
                    }
                    slotProps={{ htmlInput: { "aria-label": t("booking.blocks.to") } }}
                  />
                </Box>
              </Stack>
              <Box>
                <SectionLabel>{t("booking.blocks.reason")}</SectionLabel>
                <TextField
                  fullWidth
                  value={draft.reason}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  placeholder={t("booking.blocks.reasonPlaceholder")}
                  required
                  slotProps={{ htmlInput: { "aria-label": t("booking.blocks.reason"), maxLength: FIELD_LIMITS.reason } }}
                />
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                  Důvod se zobrazí v kalendáři místo jména pacienta.
                </Typography>
              </Box>

              {problem && <Alert severity="warning">{problem}</Alert>}
              {save.isError && (
                <Alert severity="error">{errorText(save.error, t)}</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDraft(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => draft && save.mutate(draft)}
            disabled={draft === null || problem !== null || save.isPending}
          >
            {t("booking.blocks.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageFrame>
  );
}
