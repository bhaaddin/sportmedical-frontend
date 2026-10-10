import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { ClubOrderView } from "../../../api/clubOrders";
import { orderCode } from "../../clubs/order/orderFormat";
import { formatPlayersTotal } from "../../clubs/panel/seats";
import { orderWindows, termsWord } from "../../clubs/orders/orderWindows";
import type { DuplicateChoice, LiveOrdersFound } from "./usePickOrder";

/*
 * The choice before a SECOND, disconnected order is created for a club (Etapa 10, extended): one club, one order per
 * službě's own window, but never a silent duplicate - so the desk is asked, every time the club already holds a live
 * order (Requested/Confirmed) this pick could join.
 *
 * - Only a SAME-služba live order: the original two-way choice - "Přidat do té objednávky" merges the new picks and
 *   players into it (the windows stay, the numbers sum up); "Vytvořit samostatnou objednávku" goes on as before.
 * - Only a DIFFERENT-služba live order (one): "Přidat jako dodatek k objednávce KO-..." starts that order's own
 *   addendum flow (the same "Přidat další službu" the order card itself offers); "Vytvořit samostatnou objednávku"
 *   still works.
 * - Both, or several different-služba live orders: every live order is listed, each with its own matching action,
 *   "Vytvořit samostatnou objednávku" once at the bottom.
 */

const orderSummary = (order: ClubOrderView): string => {
  const terms = orderWindows(order).length || order.requestedRanges.length;
  const players = formatPlayersTotal(order.activitySeats.length > 0 ? order.activitySeats : [{ seats: order.totalSeats }]);
  return `${terms} ${termsWord(terms)}, ${players}`;
};

export function PickDuplicateDialog({
  duplicate,
  onChoose,
}: {
  duplicate: LiveOrdersFound | null;
  onChoose: (choice: DuplicateChoice) => void;
}) {
  if (duplicate === null) return null;
  const { sameService, others } = duplicate;
  const separate = (
    <Button key="separate" variant="outlined" onClick={() => onChoose({ kind: "separate" })} sx={{ minHeight: 44 }}>
      Vytvořit samostatnou objednávku
    </Button>
  );
  const dismiss = (
    <Button key="dismiss" variant="text" onClick={() => onChoose({ kind: "dismiss" })} sx={{ minHeight: 44 }}>Zpět</Button>
  );

  /* A single same-služba order and nothing else: the original, unchanged dialog. */
  if (sameService !== null && others.length === 0) {
    return (
      <Dialog open onClose={() => onChoose({ kind: "dismiss" })} fullWidth maxWidth="xs" aria-labelledby="pick-duplicate-title" data-testid="pick-duplicate">
        <DialogTitle id="pick-duplicate-title">Klub už má objednávku na tuto službu</DialogTitle>
        <DialogContent>
          <Typography data-testid="pick-duplicate-line" sx={{ fontWeight: 600 }}>
            {`Klub už má objednávku ${orderCode(sameService.id)} na tuto službu (${orderSummary(sameService)}).`}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            Doporučujeme přidat nové termíny a hráče do ní — zůstane jedna objednávka a jeden odkaz pro sportovce.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, width: "100%", justifyContent: "flex-end" }}>
            {dismiss}
            {separate}
            <Button variant="contained" onClick={() => onChoose({ kind: "merge" })} sx={{ minHeight: 44 }}>Přidat do té objednávky</Button>
          </Stack>
        </DialogActions>
      </Dialog>
    );
  }

  /* A single different-služba order and nothing else: the same shape, the addendum action in its place. */
  if (sameService === null && others.length === 1) {
    const other = others[0];
    return (
      <Dialog open onClose={() => onChoose({ kind: "dismiss" })} fullWidth maxWidth="xs" aria-labelledby="pick-duplicate-title" data-testid="pick-duplicate">
        <DialogTitle id="pick-duplicate-title">Klub už má otevřenou objednávku</DialogTitle>
        <DialogContent>
          <Typography data-testid="pick-duplicate-line" sx={{ fontWeight: 600 }}>
            {`Klub už má objednávku ${orderCode(other.id)} na jinou službu (${other.serviceName}, ${orderSummary(other)}).`}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            Novou službu lze přidat jako dodatek k ní — zůstane jedna faktura a jeden odkaz pro sportovce; nebo založte samostatnou objednávku.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, width: "100%", justifyContent: "flex-end" }}>
            {dismiss}
            {separate}
            <Button variant="contained" onClick={() => onChoose({ kind: "addendum", order: other })} sx={{ minHeight: 44 }}>
              {`Přidat jako dodatek k objednávce ${orderCode(other.id)}`}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    );
  }

  /* Both a same-služba order and at least one different one, or several different-služba orders: list every one. */
  const rows: { order: ClubOrderView; action: "merge" | "addendum" }[] = [
    ...(sameService !== null ? [{ order: sameService, action: "merge" as const }] : []),
    ...others.map((order) => ({ order, action: "addendum" as const })),
  ];
  return (
    <Dialog open onClose={() => onChoose({ kind: "dismiss" })} fullWidth maxWidth="xs" aria-labelledby="pick-duplicate-title" data-testid="pick-duplicate">
      <DialogTitle id="pick-duplicate-title">Klub už má otevřené objednávky</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5, color: "text.secondary" }}>
          Vyberte, do které objednávky se má nová služba přidat, nebo založte samostatnou objednávku.
        </Typography>
        <Stack spacing={1} data-testid="pick-duplicate-rows">
          {rows.map(({ order, action }) => (
            <Stack
              key={order.id}
              direction="row"
              data-testid="pick-duplicate-row"
              sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
            >
              <Typography variant="body2">
                {`${orderCode(order.id)} · ${order.serviceName} (${orderSummary(order)})`}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => onChoose(action === "merge" ? { kind: "merge" } : { kind: "addendum", order })}
                sx={{ minHeight: 44 }}
              >
                {action === "merge" ? "Přidat do této objednávky" : "Přidat jako dodatek k této"}
              </Button>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, width: "100%", justifyContent: "flex-end" }}>
          {dismiss}
          {separate}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
