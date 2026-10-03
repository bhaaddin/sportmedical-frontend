import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { partnerOrdersApi } from "../../api/partnerOrders";
import type { PartnerOrderDetail as PartnerOrder } from "../../api/partnerOrders";
import { clubBlocksApi } from "../../api/clubBlocks";
import type { ClubBlockView } from "../../api/clubBlocks";
import { partnerTypeName } from "../../api/bookingContracts";
import type { PartnerWindow } from "../../api/bookingContracts";
import { useDevice } from "../../layout/useDevice";
import { formatDateOnly, formatPragueDate, pragueDateKey, toDateOnly } from "../../utils/time";
import { AsyncSection } from "../../components/booking/AsyncSection";
import {
  NewPartnerOrderDialog,
  type PartnerOrderPrefill,
} from "../../components/booking/NewPartnerOrderDialog";
import { ReleaseWindowDialog } from "../../components/booking/ReleaseWindowDialog";
import { ClubScheduleReport } from "../../components/booking/ClubScheduleReport";
import { errorText } from "../../components/booking/errorText";
import { PageHeader, SectionLabel, SoftCard, StatusChip } from "../../components/ui";
import { blockRange } from "../../components/clubs/blockLogic";
import { pragueHHMM } from "../clubs/clubOrders";
import { PinnedActions } from "../clubs/PinnedActions";

/**
 * Partner reservations — contract 5.11, with 5.10 as the dialog that creates
 * one.
 *
 * Every number on this screen is the server's. 4.7 says the counts are computed
 * from the appointments on each read, so nothing here adds anything up: what
 * the answer says is what is drawn, and a write redraws from the answer to that
 * write. The one exception is the coverage arithmetic while an order is being
 * built, which is a property of the form rather than of any appointment - that
 * lives in the dialog and is marked there.
 *
 * **Two of the four actions 5.11 asks for have no endpoint**, measured against
 * the running API on 10. 9. 2026:
 *
 *   - *uvoľniť* → `POST .../windows/{id}/release` ✓
 *   - *predĺžiť lehotu* → `PUT .../deadlines` ✓
 *   - *zrušiť odkaz* → `POST .../revoke`, added in v36 **because this screen
 *     ran out of routes**: `isRevoked` was a state on the view that nothing
 *     could reach, and `Revoke()` had been sitting on the entity since stage 7
 *     with no caller.
 *   - *poslať pripomienku* → nothing, and nothing is planned for phase 1. The
 *     computation is done - `windows[].partnerReminderDate` - and the sending
 *     rides on the same outbox as patient reminders in phase 2. So the date is
 *     shown and no button pretends to send it.
 *
 * The one that is missing is not left as a dead button or a silent gap: the
 * screen says what is absent and why, which is the repository rule about a
 * removed function applied to one that has not arrived yet.
 *
 * Etapa 2: the page is "Hromadné objednávky" in three layouts (phone: one column,
 * the main action pinned to the bottom, full-width buttons; tablet and desktop:
 * two columns) and an order that came from a club block links back to it.
 *
 * Since the design board (3. 10. 2026) the calendar's "Rezervovat pro klub"
 * and the clubs page land here with a {@link ReservationHandoff} in
 * `location.state`: the dragged slot, the chosen club or the club typed into
 * the drawer. The page opens the new-reservation dialog with those filled in
 * and spends the handoff on the way out, so Back does not reopen it.
 */

/** What the calendar or the clubs page hands over to pre-fill a reservation. */
export interface ReservationHandoff {
  calendarId?: string;
  /** The dragged slot, as UTC instants. Both or neither. */
  startUtc?: string;
  endUtc?: string;
  /** A payer already on file (`/api/clubs`). */
  clubId?: string;
  /** A club typed into the drawer's "NEBO ZALOŽIT NOVÝ" form. */
  newClub?: {
    name: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    headcount?: number;
  };
}

/** True when the state carries anything worth opening the dialog for. */
export function isReservationHandoff(state: unknown): state is ReservationHandoff {
  if (state === null || typeof state !== "object") return false;
  const s = state as ReservationHandoff;
  return s.startUtc !== undefined || s.clubId !== undefined || s.newClub !== undefined;
}

/** The handoff as the dialog's prefill. Exported so the test can pin the mapping. */
export function prefillFromHandoff(handoff: ReservationHandoff): PartnerOrderPrefill {
  const windows =
    handoff.startUtc && handoff.endUtc
      ? [
          {
            date: pragueDateKey(handoff.startUtc),
            startTime: pragueHHMM(handoff.startUtc),
            endTime: pragueHHMM(handoff.endUtc),
          },
        ]
      : [];
  const note =
    handoff.newClub && (handoff.newClub.contactPerson || handoff.newClub.contactPhone)
      ? [handoff.newClub.contactPerson, handoff.newClub.contactPhone].filter(Boolean).join(" · ")
      : undefined;
  return {
    partnerName: handoff.newClub?.name,
    contactEmail: handoff.newClub?.contactEmail,
    note,
    clubId: handoff.clubId ?? null,
    headcount: handoff.newClub?.headcount,
    windows,
  };
}

export default function PartnerOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const phone = device === "phone";
  const columns = phone ? 1 : 2;

  const handoff = isReservationHandoff(location.state) ? location.state : null;

  const [calendarId, setCalendarId] = useState(handoff?.calendarId ?? "");
  const [creating, setCreating] = useState(handoff !== null);
  /* Kept in state: the location is cleared once the dialog closes. */
  const [prefill] = useState<PartnerOrderPrefill | undefined>(
    handoff === null ? undefined : prefillFromHandoff(handoff),
  );
  const [releasing, setReleasing] = useState<{
    order: PartnerOrder;
    window: PartnerWindow;
  } | null>(null);
  const [extending, setExtending] = useState<PartnerOrder | null>(null);
  const [newDeadline, setNewDeadline] = useState("");

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );

  /* The first calendar the user may see, until they choose another (6.5). */
  const chosen = calendarId || calendars[0]?.id || "";

  const ordersQuery = useQuery({
    queryKey: ["partner-orders", chosen],
    queryFn: () => partnerOrdersApi.list(chosen),
    enabled: chosen !== "",
  });

  const noticesQuery = useQuery({
    queryKey: ["partner-notices", chosen, toDateOnly(new Date())],
    queryFn: () => partnerOrdersApi.notices(chosen, toDateOnly(new Date())),
    enabled: chosen !== "",
  });

  /* Which block an order came from, for its link. An enrichment: when the read
     fails the order simply shows the link without the block's days. */
  const blocksQuery = useQuery({
    queryKey: ["club-blocks", "list"],
    queryFn: () => clubBlocksApi.list(),
    staleTime: 60 * 1000,
    retry: false,
  });
  const blockById = useMemo(
    () => new Map((blocksQuery.data ?? []).map((b) => [b.id, b] as const)),
    [blocksQuery.data],
  );

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["partner-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["partner-notices"] });
  };

  /* Spend the handoff on the way out, not on the way in - StrictMode mounts
     twice, and clearing it before the dialog was drawn left nothing to open. */
  const closeCreating = () => {
    setCreating(false);
    if (handoff !== null) {
      navigate(location.pathname, { replace: true, state: null });
    }
  };

  const extendDeadline = useMutation({
    mutationFn: ({ order, date }: { order: PartnerOrder; date: string }) =>
      partnerOrdersApi.setDeadlines(order.calendarId, order.id, {
        releaseDate: date,
      }),
    onSuccess: () => {
      setExtending(null);
      setNewDeadline("");
      reload();
    },
  });

  const revoke = useMutation({
    mutationFn: (order: PartnerOrder) =>
      partnerOrdersApi.revoke(order.calendarId, order.id),
    onSuccess: reload,
  });

  const orders = ordersQuery.data ?? [];

  const calendarPicker = (
    <TextField
      select
      size={phone ? "medium" : "small"}
      label={t("booking.new.calendar")}
      value={chosen}
      onChange={(e) => setCalendarId(e.target.value)}
      sx={{ minWidth: phone ? undefined : 200 }}
      fullWidth={phone}
    >
      {calendars.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box
      data-testid="partner-orders"
      data-layout={device}
      data-columns={columns}
      sx={{ maxWidth: 1180, mx: "auto" }}
    >
      <PageHeader
        title="Hromadné objednávky"
        subtitle="Kluby a firmy, kterým je vyhrazen čas. Počty se počítají z termínů, nesčítají se tady."
        actions={
          phone ? undefined : (
            <>
              {calendarPicker}
              <Button variant="contained" disabled={chosen === ""} onClick={() => setCreating(true)}>
                Nová hromadná objednávka
              </Button>
            </>
          )
        }
      />
      {phone ? <Box sx={{ mb: 2 }}>{calendarPicker}</Box> : null}

      {/*
        When this call fails the banner simply does not appear, and an absent
        banner reads as "nothing is due today" - a claim nobody checked. Found
        by `eng/audit-silent-failures.cjs`; the silence was the whole bug.
      */}
      {noticesQuery.isError ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void noticesQuery.refetch()}
            >
              {t("booking.common.retry")}
            </Button>
          }
        >
          {t("booking.partner.noticesFailed")}
        </Alert>
      ) : null}

      {/* What falls due today. 4.7: this says what to send, it does not send. */}
      {(noticesQuery.data ?? []).length > 0 ? (
        <Alert severity="info" sx={{ mb: 2, alignItems: "flex-start" }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            {t("booking.partner.dueToday")}
          </Typography>
          {(noticesQuery.data ?? []).map((n) => (
            <Typography key={`${n.orderId}-${n.windowId}`} variant="body2">
              {n.partnerName} · {formatDateOnly(n.windowDate)} · {n.bookedCount}/
              {n.requestedCount}
              {n.contactEmail ? ` · ${n.contactEmail}` : ""}
            </Typography>
          ))}
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("booking.partner.sendingIsPhase2")}
          </Typography>
        </Alert>
      ) : null}

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess || calendarsQuery.isError}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.grid.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={3}
      >
        <AsyncSection
          isLoading={ordersQuery.isLoading}
          isSettled={ordersQuery.isSuccess || ordersQuery.isError}
          error={ordersQuery.error}
          isEmpty={orders.length === 0}
          emptyText="Zatím žádná hromadná objednávka. Objednávka drží čas pro klub nebo firmu, dokud si ho nezaplní."
          emptyAction={{
            label: "Nová hromadná objednávka",
            onClick: () => setCreating(true),
          }}
          onRetry={() => void ordersQuery.refetch()}
          skeletonRows={4}
        >
          <Stack spacing={2}>
            {revoke.error ? (
              <Alert severity="error">{errorText(revoke.error, t)}</Alert>
            ) : null}
            <Box
              role="list"
              aria-label="Hromadné objednávky"
              sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 2, alignItems: "start" }}
            >
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                block={order.clubBlockId !== null ? (blockById.get(order.clubBlockId) ?? null) : null}
                phone={phone}
                onOpenBlock={() =>
                  navigate("/clubs", {
                    state: {
                      clubId: order.clubId ?? blockById.get(order.clubBlockId ?? "")?.clubId ?? undefined,
                      clubBlockId: order.clubBlockId ?? undefined,
                    },
                  })
                }
                busy={revoke.isPending}
                onRelease={(w) => setReleasing({ order, window: w })}
                onExtend={() => {
                  setExtending(order);
                  setNewDeadline("");
                }}
                onRevoke={() => revoke.mutate(order)}
              />
            ))}
            </Box>
          </Stack>
        </AsyncSection>
      </AsyncSection>

      {/* Extending the deadline: 4.7 puts it on the order, not on one window. */}
      {extending ? (
        <SoftCard tone="soft" sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {t("booking.partner.extendTitle", { partner: extending.partnerName })}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
            {t("booking.partner.extendExplain")}
          </Typography>
          {extendDeadline.error ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {errorText(extendDeadline.error, t)}
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField
              type="date"
              size="small"
              label={t("booking.partner.newDeadline")}
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              variant="contained"
              disabled={newDeadline === "" || extendDeadline.isPending}
              onClick={() =>
                extendDeadline.mutate({ order: extending, date: newDeadline })
              }
            >
              {t("booking.common.save")}
            </Button>
            <Button variant="outlined" onClick={() => setExtending(null)}>
              {t("booking.common.cancel")}
            </Button>
          </Stack>
        </SoftCard>
      ) : null}

      <PinnedActions>
        <Button variant="contained" disabled={chosen === ""} onClick={() => setCreating(true)}>
          Nová hromadná objednávka
        </Button>
      </PinnedActions>

      {creating && chosen !== "" ? (
        <NewPartnerOrderDialog
          open
          calendarId={chosen}
          initial={prefill}
          onClose={closeCreating}
          onCreated={reload}
        />
      ) : null}

      {releasing ? (
        <ReleaseWindowDialog
          open
          order={releasing.order}
          window={releasing.window}
          otherOrders={orders.filter((o) => o.id !== releasing.order.id)}
          onClose={() => setReleasing(null)}
          onReleased={reload}
        />
      ) : null}
    </Box>
  );
}

/** One partner order, laid out as 5.11 draws it, in the board's clothes. */
function OrderCard({
  order,
  block,
  phone,
  onOpenBlock,
  busy,
  onRelease,
  onExtend,
  onRevoke,
}: {
  order: PartnerOrder;
  /** The club block this order came from, when it came from one and is known. */
  block: ClubBlockView | null;
  phone: boolean;
  onOpenBlock: () => void;
  busy: boolean;
  onRelease: (w: PartnerWindow) => void;
  onExtend: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const today = toDateOnly(new Date());
  const typeKey = partnerTypeName(order.partnerType);
  const [reportOpen, setReportOpen] = useState(false);
  const free = Math.max(0, order.requestedCount - order.bookedCount);

  return (
    <SoftCard role="listitem" sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mb: 0.5 }}
      >
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>
          {order.partnerName}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {/* An unknown type is shown as unknown, not guessed at. */}
          {typeKey
            ? t(`booking.partner.type.${typeKey}`)
            : t("booking.partner.type.unknown", { code: order.partnerType })}
        </Typography>
        {order.isRevoked ? (
          <StatusChip tone="grey">{t("booking.partner.revoked")}</StatusChip>
        ) : free === 0 && order.requestedCount > 0 ? (
          <StatusChip tone="green">Obsazeno</StatusChip>
        ) : null}
        <Button
          size="small"
          variant="outlined"
          sx={{ ml: "auto", minHeight: phone ? 44 : undefined }}
          onClick={() => setReportOpen(true)}
        >
          Rozpis / tisk
        </Button>
      </Stack>
      {order.clubBlockId !== null ? (
        <Button
          size="small"
          variant="text"
          data-testid="order-block-link"
          onClick={onOpenBlock}
          sx={{ px: 0, minHeight: phone ? 44 : undefined, mb: 0.5 }}
        >
          {block !== null ? `Z bloku ${blockRange(block)} — otevřít blok` : "Z bloku klubu — otevřít blok"}
        </Button>
      ) : null}
      <ClubScheduleReport order={order} open={reportOpen} onClose={() => setReportOpen(false)} />

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        {order.linkSentAt
          ? t("booking.partner.linkSent", {
              when: formatPragueDate(order.linkSentAt),
            })
          : t("booking.partner.linkNotSent")}
        {order.expiresAt
          ? ` · ${t("booking.partner.validUntil", {
              when: formatPragueDate(order.expiresAt),
            })}`
          : ""}
      </Typography>

      {/* Taken places, the server's count (4.7). */}
      {order.requestedCount > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Obsazeno {order.bookedCount} z {order.requestedCount} míst
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {free} volných
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (order.bookedCount / order.requestedCount) * 100)}
            aria-label="Obsazenost míst"
          />
        </Box>
      ) : null}

      {/* The request, activity by activity. Counts are the server's (4.7). */}
      <SectionLabel>{t("booking.partner.step2")}</SectionLabel>
      {order.items.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("booking.partner.noItems")}
        </Typography>
      ) : (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {order.items.map((item) => (
            <Stack
              key={item.activityId}
              direction="row"
              spacing={2}
              sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <Typography variant="body2">{item.activityName}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.bookedCount} / {item.requestedCount}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 1.5 }} />

      <SectionLabel>{t("booking.partner.step3")}</SectionLabel>
      {order.windows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("booking.partner.noWindows")}
        </Typography>
      ) : (
        <Stack divider={<Divider />}>
          {order.windows.map((w) => {
            /*
             * "⚠ in two days" comes from comparing the deadline with today.
             * That is a fact about the clock, the same as `late` in 6.2, so it
             * is worked out here rather than expected from the server.
             */
            const daysLeft =
              w.releaseDate === null
                ? null
                : Math.round(
                    (new Date(`${w.releaseDate}T00:00:00Z`).getTime() -
                      new Date(`${today}T00:00:00Z`).getTime()) /
                      86_400_000,
                  );

            return (
              <Stack
                key={w.id}
                direction={phone ? "column" : "row"}
                spacing={phone ? 1 : 2}
                sx={{
                  py: 1,
                  alignItems: phone ? "stretch" : "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  opacity: w.releasedAt ? 0.6 : 1,
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                >
                  <Typography sx={{ fontWeight: 600 }}>
                    {formatDateOnly(w.date)}
                  </Typography>
                  <Typography variant="body2">
                    {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {t("booking.partner.covered", { minutes: w.coveredMinutes })}
                  </Typography>
                  {w.releaseDate ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          daysLeft !== null && daysLeft <= 2
                            ? "warning.main"
                            : "text.secondary",
                        fontWeight: daysLeft !== null && daysLeft <= 2 ? 700 : 400,
                      }}
                    >
                      {t("booking.partner.deadline", {
                        when: formatDateOnly(w.releaseDate),
                      })}
                      {daysLeft !== null && daysLeft <= 2
                        ? ` ⚠ ${t("booking.partner.inDays", { count: daysLeft })}`
                        : ""}
                    </Typography>
                  ) : null}
                  {w.releasedAt ? (
                    <StatusChip tone="grey" size="sm">{t("booking.partner.released")}</StatusChip>
                  ) : null}
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={w.releasedAt !== null}
                  onClick={() => onRelease(w)}
                  sx={{ minHeight: phone ? 44 : undefined }}
                >
                  {t("booking.partner.release")}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Stack direction={phone ? "column" : "row"} spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Button size="small" variant="outlined" onClick={onExtend} sx={{ minHeight: phone ? 44 : undefined }}>
          {t("booking.partner.extend")}
        </Button>
        {/*
          Revoking shuts the door; it does not put anybody out. Whoever already
          has an appointment keeps it, and the order stays in the list marked as
          revoked - which says more than it disappearing would.
        */}
        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={busy || order.isRevoked}
          onClick={onRevoke}
          sx={{ minHeight: phone ? 44 : undefined }}
        >
          {t("booking.partner.revokeLink")}
        </Button>
      </Stack>

      {/*
        5.11 lists two more actions - send a reminder, revoke the link - and
        neither has a route. Saying so beats a button that does nothing and
        beats leaving the gap for somebody to rediscover.
      */}
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
        {t("booking.partner.reminderIsPhase2", {
          when: order.windows[0]?.partnerReminderDate
            ? formatDateOnly(order.windows[0].partnerReminderDate)
            : "—",
        })}
      </Typography>
    </SoftCard>
  );
}
