import { Alert, Box, Button, Popover, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { clubBlocksApi } from "../../../api/clubBlocks";
import { clubOrdersApi, type ClubOrderView, type ReleaseUnfilledResult } from "../../../api/clubOrders";
import type { TimeBlock } from "../../../api/bookingContracts";
import { HOLD_TEXT, holdLabel, holdStateOf, releaseFailedText, releaseSummary, seatsLabel } from "../../../planner/components/board/clubHold";
import { DESIGN } from "../../../theme";
import { orderCode } from "../../clubs/order/orderFormat";
import { orderWindows, shortSplit, termsWord } from "../../clubs/orders/orderWindows";
import { WindowPills } from "../../clubs/orders/WindowPills";
import { UncoveredNotice } from "../../clubs/orders/UncoveredNotice";
import { CAL_TEXT } from "./calendarText";
import { cleanHex, rangeDates, type DayRange } from "./model";

/*
 * What a click on a club's window says. A window that belongs to a club ORDER opens the order - "Objednávka KO-… ·
 * FK Slaný", how many terms it has and which one was clicked, the činnosti split and "7/22 zapsáno", with "Otevřít
 * objednávku" and "Upravit termíny" - never the block. Only a legacy block (no order) keeps "Blok pro FK Slaný · …
 * Otevřít blok" (the clubs screen opens it from the router state it is given).
 */

export interface ClubBlockPick {
  clubBlockId: string;
  clubId: string | null;
  clubName: string;
  colorHex: string | null;
  range: DayRange;
  /** R13: the block as the server sent it (order, seats, hold state), when the click came from the main board. */
  block?: TimeBlock | undefined;
  /** Where on screen it was clicked. */
  x: number;
  y: number;
}

export function ClubBlockPopover({
  pick,
  today,
  onOpen,
  onOpenOrder,
  onEditTerms,
  onClose,
  mayRelease = false,
  onReleased,
}: {
  pick: ClubBlockPick | null;
  /** yyyy-MM-dd, the clinic's today. */
  today: string;
  onOpen: (pick: ClubBlockPick) => void;
  onOpenOrder: (orderId: string) => void;
  /** Present only for a user who may change orders: the calendar opens in pick mode on this order. */
  onEditTerms?: (order: ClubOrderView) => void;
  onClose: () => void;
  /** R13: the user may give back the unfilled part of the hold (bookings.edit). */
  mayRelease?: boolean;
  /** R13: the hold was released - the board reads its blocks again. */
  onReleased?: () => void;
}) {
  const colour = cleanHex(pick?.colorHex) ?? DESIGN.faint;
  const holdBlock = pick?.block ?? null;
  const hold = holdBlock ? holdStateOf(holdBlock) : null;
  const [released, setReleased] = useState<ReleaseUnfilledResult | null>(null);
  const [confirming, setConfirming] = useState<'all' | 'expired' | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  /* The calendar's block row carries no order: the block (cheap) says which order it belongs to. */
  const blockQuery = useQuery({
    queryKey: ["club-blocks", "popover", pick?.clubBlockId ?? ""],
    queryFn: () => clubBlocksApi.get(pick?.clubBlockId ?? ""),
    enabled: pick !== null,
    staleTime: 15_000,
    retry: false,
  });
  const orderId = blockQuery.data?.clubOrderId ?? null;
  const orderQuery = useQuery({
    queryKey: ["club-order", orderId],
    queryFn: () => clubOrdersApi.get(orderId ?? ""),
    enabled: pick !== null && orderId !== null && orderId !== "",
    staleTime: 15_000,
    retry: false,
  });
  const order = orderQuery.data;
  const loading = pick !== null && (blockQuery.isLoading || (orderId !== null && orderId !== "" && orderQuery.isLoading));
  const ownedByOrder = orderId !== null && orderId !== "";
  /* the block of the main board carries its order itself (stage 2); older servers need the block read above */
  const effectiveOrderId = holdBlock?.clubOrderId || orderId || '';
  const release = useMutation({
    mutationFn: (onlyExpired: boolean) => clubOrdersApi.releaseUnfilled(effectiveOrderId, { onlyExpired }),
    onSuccess: (result) => {
      setReleased(result);
      setConfirming(null);
      setReleaseError(null);
      onReleased?.();
    },
    onError: (error) => {
      setConfirming(null);
      setReleaseError(releaseFailedText(error));
    },
  });
  /* the action exists where the server told us about the hold (a Stage 2 server), for a confirmed order, for who may edit bookings */
  const canRelease = mayRelease && hold !== null && effectiveOrderId !== '' && released === null;

  const windows = order === undefined ? [] : orderWindows(order);
  const title = !pick
    ? ""
    : ownedByOrder
      ? CAL_TEXT.clubPopover.orderTitle(holdBlock?.orderCode || orderCode(orderId), pick.clubName)
      : loading
        ? pick.clubName
        : `${CAL_TEXT.clubPopover.title(pick.clubName)} · ${rangeDates(pick.range)}`;

  return (
    <Popover
      open={pick !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={pick ? { top: pick.y, left: pick.x } : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 340,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: "13px",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: DESIGN.shadow.dialog,
          },
        },
      }}
    >
      {pick ? (
        <Box role="dialog" aria-label={title} data-testid="club-popover" data-kind={ownedByOrder ? "order" : loading ? "loading" : "block"}>
          <Box
            sx={{
              px: 2,
              pt: 1.6,
              pb: 1.3,
              borderLeft: `4px solid ${colour}`,
              bgcolor: alpha(colour, 0.1),
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>{title}</Typography>
            {hold !== null && holdBlock !== null ? (
              <Typography data-testid="club-popover-hold" data-hold={hold} sx={{ fontSize: 12.5, fontWeight: 700, mt: 0.5 }}>
                {[holdLabel(hold), seatsLabel(holdBlock)].filter(Boolean).join(" · ")}
              </Typography>
            ) : null}
            {loading ? (
              <Skeleton variant="text" width="70%" aria-label={CAL_TEXT.clubPopover.loading} sx={{ mt: 0.5 }} />
            ) : ownedByOrder ? (
              order !== undefined ? (
                <Box data-testid="club-popover-order" sx={{ mt: 0.75 }}>
                  <Typography data-testid="club-popover-summary" sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                    {`${windows.length} ${termsWord(windows.length)} · ${shortSplit(order)} · ${order.registered}/${order.totalSeats} zapsáno`}
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <WindowPills order={order} today={today} highlightBlockId={pick.clubBlockId} testId="club-popover-windows" />
                    <UncoveredNotice order={order} compact />
                  </Box>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.75 }}>{CAL_TEXT.clubPopover.orderHint}</Typography>
                </Box>
              ) : null
            ) : (
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>{CAL_TEXT.clubPopover.hint}</Typography>
            )}
          </Box>
          {released !== null ? (
            <Alert severity="success" sx={{ m: 1.25, mb: 0 }} data-testid="club-popover-released">
              {releaseSummary(released)}
            </Alert>
          ) : null}
          {releaseError !== null ? (
            <Alert severity="error" sx={{ m: 1.25, mb: 0 }} data-testid="club-popover-release-error">
              {releaseError}
            </Alert>
          ) : null}
          {confirming !== null ? (
            <Box data-testid="club-popover-release-confirm" sx={{ m: 1.25, mb: 0, p: 1.25, border: "1px solid", borderColor: "warning.main", borderRadius: 2 }}>
              <Typography sx={{ fontSize: 13 }}>{HOLD_TEXT.releaseConfirm(confirming === "expired")}</Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
                <Button onClick={() => setConfirming(null)} disabled={release.isPending} sx={{ minHeight: 44 }}>
                  {HOLD_TEXT.back}
                </Button>
                <Button color="warning" variant="contained" disabled={release.isPending} onClick={() => release.mutate(confirming === "expired")} sx={{ minHeight: 44 }}>
                  {HOLD_TEXT.releaseGo}
                </Button>
              </Box>
            </Box>
          ) : null}
          <Box sx={{ display: "flex", gap: 1, p: 1.25, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button onClick={onClose} sx={{ minHeight: 44 }}>
              {CAL_TEXT.clubPopover.close}
            </Button>
            {canRelease && confirming === null ? (
              <>
                {hold === "expired" ? (
                  <Button variant="outlined" color="warning" onClick={() => setConfirming("expired")} sx={{ minHeight: 44 }} data-testid="club-release-expired">
                    {HOLD_TEXT.releaseExpired}
                  </Button>
                ) : null}
                <Button variant="outlined" color="warning" onClick={() => setConfirming("all")} sx={{ minHeight: 44 }} data-testid="club-release">
                  {HOLD_TEXT.release}
                </Button>
              </>
            ) : null}
            {ownedByOrder ? (
              <>
                {order !== undefined && order.status === "Confirmed" && onEditTerms !== undefined ? (
                  <Button variant="outlined" onClick={() => onEditTerms(order)} sx={{ minHeight: 44 }}>
                    {CAL_TEXT.clubPopover.editTerms}
                  </Button>
                ) : null}
                <Button variant="contained" onClick={() => onOpenOrder(orderId)} sx={{ minHeight: 44 }}>
                  {CAL_TEXT.clubPopover.openOrder}
                </Button>
              </>
            ) : (
              <Button variant="contained" disabled={loading} onClick={() => onOpen(pick)} sx={{ minHeight: 44 }}>
                {CAL_TEXT.clubPopover.open}
              </Button>
            )}
          </Box>
        </Box>
      ) : null}
    </Popover>
  );
}

/** A club block as the month and the grid know it, before they add where it was clicked. */
export type ClubBlockRef = Omit<ClubBlockPick, "x" | "y">;
