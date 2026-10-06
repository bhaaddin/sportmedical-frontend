import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { ClubOrderView } from "../../../api/clubOrders";
import { orderCode } from "../../clubs/order/orderFormat";
import { formatPlayersTotal } from "../../clubs/panel/seats";
import { orderWindows, termsWord } from "../../clubs/orders/orderWindows";

/*
 * The choice before a SECOND order of the same služba is created for a club (Etapa 10): one club, one order per
 * služba - so the desk is asked, never silently given two. "Přidat do té objednávky" turns the pick into an edit of
 * the existing order (its windows stay, the new ones and the new players are added); "Vytvořit samostatnou
 * objednávku" goes on as before.
 */
export function PickDuplicateDialog({
  order,
  onChoose,
}: {
  order: ClubOrderView | null;
  onChoose: (choice: "add" | "separate" | "dismiss") => void;
}) {
  if (order === null) return null;
  const terms = orderWindows(order).length || order.requestedRanges.length;
  const players = formatPlayersTotal(order.activitySeats.length > 0 ? order.activitySeats : [{ seats: order.totalSeats }]);
  return (
    <Dialog open onClose={() => onChoose("dismiss")} fullWidth maxWidth="xs" aria-labelledby="pick-duplicate-title" data-testid="pick-duplicate">
      <DialogTitle id="pick-duplicate-title">Klub už má objednávku na tuto službu</DialogTitle>
      <DialogContent>
        <Typography data-testid="pick-duplicate-line" sx={{ fontWeight: 600 }}>
          {`Klub už má objednávku ${orderCode(order.id)} na tuto službu (${terms} ${termsWord(terms)}, ${players}).`}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          Doporučujeme přidat nové termíny a hráče do ní — zůstane jedna objednávka a jeden odkaz pro sportovce.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, width: "100%", justifyContent: "flex-end" }}>
          <Button variant="text" onClick={() => onChoose("dismiss")} sx={{ minHeight: 44 }}>Zpět</Button>
          <Button variant="outlined" onClick={() => onChoose("separate")} sx={{ minHeight: 44 }}>Vytvořit samostatnou objednávku</Button>
          <Button variant="contained" onClick={() => onChoose("add")} sx={{ minHeight: 44 }}>Přidat do té objednávky</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
