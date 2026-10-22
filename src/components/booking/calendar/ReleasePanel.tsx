/*
 * R13 - "Uvolnit nevyplněné": gives back the part of a club's hold that nobody filled (`POST /api/v1/club-orders/{id}/release-unfilled`).
 * Loaded when a popover of a club hold is shown (the planner's first load does not carry it). It asks first, says what it did in words,
 * and never touches a booked athlete (the server guarantees it; the text says so).
 */
import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { clubOrdersApi, type ReleaseUnfilledResult } from "../../../api/clubOrders";
import type { HoldState } from "../../../planner/components/board/clubHold";
import { HOLD_RELEASE_TEXT, releaseFailedText, releaseSummary } from "../../../planner/components/board/clubRelease";

export default function ReleasePanel({ orderId, hold, onReleased }: { orderId: string; hold: HoldState; onReleased?: (() => void) | undefined }) {
  const [released, setReleased] = useState<ReleaseUnfilledResult | null>(null);
  const [confirming, setConfirming] = useState<"all" | "expired" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const release = useMutation({
    mutationFn: (onlyExpired: boolean) => clubOrdersApi.releaseUnfilled(orderId, { onlyExpired }),
    onSuccess: (result) => {
      setReleased(result);
      setConfirming(null);
      setError(null);
      onReleased?.();
    },
    onError: (e) => {
      setConfirming(null);
      setError(releaseFailedText(e));
    },
  });
  return (
    <>
      {released !== null ? (
        <Alert severity="success" sx={{ m: 1.25, mb: 0 }} data-testid="club-popover-released">
          {releaseSummary(released)}
        </Alert>
      ) : null}
      {error !== null ? (
        <Alert severity="error" sx={{ m: 1.25, mb: 0 }} data-testid="club-popover-release-error">
          {error}
        </Alert>
      ) : null}
      {confirming !== null ? (
        <Box data-testid="club-popover-release-confirm" sx={{ m: 1.25, mb: 0, p: 1.25, border: "1px solid", borderColor: "warning.main", borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13 }}>{HOLD_RELEASE_TEXT.confirm(confirming === "expired")}</Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirming(null)} disabled={release.isPending} sx={{ minHeight: 44 }}>
              {HOLD_RELEASE_TEXT.back}
            </Button>
            <Button color="warning" variant="contained" disabled={release.isPending} onClick={() => release.mutate(confirming === "expired")} sx={{ minHeight: 44 }}>
              {HOLD_RELEASE_TEXT.go}
            </Button>
          </Box>
        </Box>
      ) : null}
      {released === null && confirming === null ? (
        <Box sx={{ display: "flex", gap: 1, px: 1.25, pt: 1.25, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {hold === "expired" ? (
            <Button variant="outlined" color="warning" onClick={() => setConfirming("expired")} sx={{ minHeight: 44 }} data-testid="club-release-expired">
              {HOLD_RELEASE_TEXT.expired}
            </Button>
          ) : null}
          <Button variant="outlined" color="warning" onClick={() => setConfirming("all")} sx={{ minHeight: 44 }} data-testid="club-release">
            {HOLD_RELEASE_TEXT.all}
          </Button>
        </Box>
      ) : null}
    </>
  );
}
