import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { partnerOrdersApi } from "../../api/partnerOrders";
import { partnerTypeName } from "../../api/bookingContracts";
import type { PartnerOrder, PartnerWindow } from "../../api/bookingContracts";
import { formatDateOnly, formatPragueDate, toDateOnly } from "../../utils/time";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { NewPartnerOrderDialog } from "../../components/booking/NewPartnerOrderDialog";
import { ReleaseWindowDialog } from "../../components/booking/ReleaseWindowDialog";
import { errorText } from "../../components/booking/errorText";

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
 */

export default function PartnerOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [calendarId, setCalendarId] = useState("");
  const [creating, setCreating] = useState(false);
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

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["partner-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["partner-notices"] });
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

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("booking.partner.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.partner.subtitle")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <TextField
            select
            size="small"
            label={t("booking.new.calendar")}
            value={chosen}
            onChange={(e) => setCalendarId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {calendars.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={chosen === ""}
            onClick={() => setCreating(true)}
          >
            {t("booking.partner.new")}
          </Button>
        </Stack>
      </Stack>

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
        <Alert severity="info" sx={{ mb: 2 }}>
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
          emptyText={t("booking.partner.empty")}
          emptyAction={{
            label: t("booking.partner.new"),
            onClick: () => setCreating(true),
          }}
          onRetry={() => void ordersQuery.refetch()}
          skeletonRows={4}
        >
          <Stack spacing={2}>
            {revoke.error ? (
              <Alert severity="error">{errorText(revoke.error, t)}</Alert>
            ) : null}
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={revoke.isPending}
                onRelease={(w) => setReleasing({ order, window: w })}
                onExtend={() => {
                  setExtending(order);
                  setNewDeadline("");
                }}
                onRevoke={() => revoke.mutate(order)}
              />
            ))}
          </Stack>
        </AsyncSection>
      </AsyncSection>

      {/* Extending the deadline: 4.7 puts it on the order, not on one window. */}
      {extending ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, mt: 2, borderColor: "warning.main" }}
        >
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
            <Button onClick={() => setExtending(null)}>
              {t("booking.common.cancel")}
            </Button>
          </Stack>
        </Paper>
      ) : null}

      {creating ? (
        <NewPartnerOrderDialog
          open
          calendarId={chosen}
          onClose={() => setCreating(false)}
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

/** One partner order, laid out as 5.11 draws it. */
function OrderCard({
  order,
  busy,
  onRelease,
  onExtend,
  onRevoke,
}: {
  order: PartnerOrder;
  busy: boolean;
  onRelease: (w: PartnerWindow) => void;
  onExtend: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const today = toDateOnly(new Date());
  const typeKey = partnerTypeName(order.partnerType);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "baseline", flexWrap: "wrap", mb: 0.5 }}
      >
        <Typography sx={{ fontWeight: 700 }}>{order.partnerName}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {/* An unknown type is shown as unknown, not guessed at. */}
          {typeKey
            ? t(`booking.partner.type.${typeKey}`)
            : t("booking.partner.type.unknown", { code: order.partnerType })}
        </Typography>
        {order.isRevoked ? (
          <Chip size="small" color="default" label={t("booking.partner.revoked")} />
        ) : null}
      </Stack>

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

      {/* The request, activity by activity. Counts are the server's (4.7). */}
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

      <Divider sx={{ my: 1 }} />

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
                direction="row"
                spacing={2}
                sx={{
                  py: 1,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  opacity: w.releasedAt ? 0.6 : 1,
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: "baseline", flexWrap: "wrap" }}
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
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("booking.partner.released")}
                    />
                  ) : null}
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={w.releasedAt !== null}
                  onClick={() => onRelease(w)}
                >
                  {t("booking.partner.release")}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Button size="small" onClick={onExtend}>
          {t("booking.partner.extend")}
        </Button>
        {/*
          Revoking shuts the door; it does not put anybody out. Whoever already
          has an appointment keeps it, and the order stays in the list marked as
          revoked - which says more than it disappearing would.
        */}
        <Button
          size="small"
          color="warning"
          disabled={busy || order.isRevoked}
          onClick={onRevoke}
        >
          {t("booking.partner.revokeLink")}
        </Button>
      </Stack>

      {/*
        5.11 lists two more actions - send a reminder, revoke the link - and
        neither has a route. Saying so beats a button that does nothing and
        beats leaving the gap for somebody to rediscover.
      */}
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {t("booking.partner.reminderIsPhase2", {
          when: order.windows[0]?.partnerReminderDate
            ? formatDateOnly(order.windows[0].partnerReminderDate)
            : "—",
        })}
      </Typography>
    </Paper>
  );
}
