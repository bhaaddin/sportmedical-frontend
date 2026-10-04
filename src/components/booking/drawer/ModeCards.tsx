import { Box, ButtonBase, Typography } from "@mui/material";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import PersonAddAlt1Outlined from "@mui/icons-material/PersonAddAlt1Outlined";
import { useDevice } from "../../../layout/useDevice";
import { DESIGN } from "../../ui";
import type { DrawerMode } from "../NewAppointmentDialog.logic";

/** The two cards under "KDO SE OBJEDNÁVÁ", in the board's order. */
const CARDS: { mode: DrawerMode; label: string; icon: React.ReactNode }[] = [
  { mode: "database", label: "Z databáze", icon: <PersonSearchOutlined fontSize="small" /> },
  { mode: "quick", label: "Rychlá registrace", icon: <PersonAddAlt1Outlined fontSize="small" /> },
];

/**
 * Who the slot is for, as two cards: an icon over a word, the chosen one in
 * the accent with a 2px border and the soft tint. The fourth way - a block of
 * time with nobody behind it - is a small link under the cards, not a card:
 * the board has two, and an event is the exception, not a peer.
 */
export function ModeCards({
  value,
  onChange,
  disabled = false,
}: {
  value: DrawerMode;
  onChange: (mode: DrawerMode) => void;
  disabled?: boolean;
}) {
  /* On a phone the cards are rows: wide, one under the other, easy to hit. */
  const phone = useDevice() === "phone";
  return (
    <Box
      role="radiogroup"
      aria-label="Kdo se objednává"
      sx={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "repeat(2, 1fr)", gap: phone ? 1 : 1.5 }}
    >
      {CARDS.map((card) => {
        const selected = value === card.mode;
        return (
          <ButtonBase
            key={card.mode}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(card.mode)}
            sx={{
              display: "flex",
              flexDirection: phone ? "row" : "column",
              alignItems: "center",
              justifyContent: phone ? "flex-start" : "center",
              gap: phone ? 1.5 : 1,
              minHeight: phone ? 56 : 44,
              py: phone ? 1.5 : 2,
              px: phone ? 2 : 1,
              borderRadius: 3,
              border: "1px solid",
              borderColor: selected ? "primary.main" : "divider",
              boxShadow: selected ? (t) => `inset 0 0 0 1px ${t.palette.primary.main}` : "none",
              bgcolor: selected ? DESIGN.softPrimary.bg : "background.paper",
              color: selected ? "primary.main" : "text.primary",
              fontFamily: "inherit",
              "&:hover": { bgcolor: selected ? DESIGN.softPrimary.bg : "action.hover" },
              "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
            }}
          >
            {card.icon}
            <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 600 }}>
              {card.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default ModeCards;
