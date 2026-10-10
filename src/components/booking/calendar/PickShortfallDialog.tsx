import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { Device } from "../../../layout/useDevice";
import { firstWord } from "../../clubs/order/routing";
import { BubbleButton, BubbleButtons, PickBubble } from "./PickBubble";
import { formatFree } from "./pickDays";
import { players, spareLine } from "./PickOrderPanel";
import type { Shortfall, ShortfallChoice } from "./usePickOrder";

/*
 * Etapa 12 (constitution IV: the desk decides, nothing slips through silently). "Potvrdit objednávku" with players
 * still without a slot - or with places picked beyond the players, which is money lost - does not create anything:
 * this bubble says exactly what is missing / spare and offers the choices.
 *
 *   Doplnit termíny       stay in pick mode; the panel scrolls to the short činnost with "Přidat další den"
 *   Zkrátit na potřebu    cut the spare windows back to what the players use (only on this click)
 *   Vytvořit i tak        the order as it is (the card of the order then shows what has no term)
 */

export const SHORTFALL_TEXT = {
  titleShort: "Chybí termíny",
  titleSpare: "Termíny navíc",
  fill: "Doplnit termíny",
  trim: "Zkrátit na potřebu",
  createAnyway: "Vytvořit i tak",
  saveAnyway: "Uložit i tak",
  confirmAnyway: "Potvrdit i tak",
} as const;

export function shortfallSentence(s: Shortfall): string {
  const names = s.perActivity.map((a) => `${firstWord(a.name)} ${a.remainingSeats}`).join(", ");
  return `Chybí termíny pro ${players(s.remainingSeats)}: ${names} — potřeba ještě ≈ ${formatFree(s.neededMinutes)}`;
}

export function PickShortfallDialog({ shortfall, device, onChoose }: {
  shortfall: Shortfall | null;
  device: Device;
  onChoose: (choice: ShortfallChoice) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const open = shortfall !== null;
  useEffect(() => {
    setAnchorEl(open ? document.querySelector('[data-testid="pick-confirm"]') : null);
  }, [open]);
  if (shortfall === null) return null;
  const short = shortfall.remainingSeats > 0;
  const spare = shortfall.spareSeats > 0;
  const anyway = short ? (shortfall.editing ? SHORTFALL_TEXT.saveAnyway : SHORTFALL_TEXT.createAnyway) : SHORTFALL_TEXT.confirmAnyway;

  return (
    <PickBubble
      device={device}
      anchorEl={anchorEl}
      titleId="pick-shortfall-title"
      testId="pick-shortfall-dialog"
      onEscape={() => onChoose("fill")}
      onOutside={() => onChoose("fill")}
    >
      <Typography id="pick-shortfall-title" component="h2" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
        {short ? SHORTFALL_TEXT.titleShort : SHORTFALL_TEXT.titleSpare}
      </Typography>
      {short ? (
        <Typography data-testid="pick-shortfall-text" sx={{ mt: 1, fontSize: 14 }}>{shortfallSentence(shortfall)}</Typography>
      ) : null}
      {spare ? (
        <Box data-testid="pick-shortfall-spare" sx={{ mt: 1 }}>
          {shortfall.spare.map((a) => (
            <Typography key={a.activityId} sx={{ fontSize: 14, color: "warning.main", fontWeight: 600 }}>
              {spareLine({ name: a.name, spareSeats: a.seats, spareMinutes: a.minutes }, a.lostCzk === null ? null : a.lostCzk / a.seats)}
            </Typography>
          ))}
        </Box>
      ) : null}
      {shortfall.unusedMinutes > 0 && !spare ? (
        <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.secondary" }}>{`Nevyužito ${formatFree(shortfall.unusedMinutes)} (kratší než jeden slot).`}</Typography>
      ) : null}
      <BubbleButtons>
        {short ? (
          <BubbleButton primary testId="pick-shortfall-fill" onClick={() => onChoose("fill")}>{SHORTFALL_TEXT.fill}</BubbleButton>
        ) : (
          <BubbleButton primary testId="pick-shortfall-trim" onClick={() => onChoose("trim")}>{SHORTFALL_TEXT.trim}</BubbleButton>
        )}
        {short && spare ? <BubbleButton testId="pick-shortfall-trim" onClick={() => onChoose("trim")}>{SHORTFALL_TEXT.trim}</BubbleButton> : null}
        <BubbleButton testId="pick-shortfall-create" onClick={() => onChoose("create")}>{anyway}</BubbleButton>
      </BubbleButtons>
    </PickBubble>
  );
}

export default PickShortfallDialog;
