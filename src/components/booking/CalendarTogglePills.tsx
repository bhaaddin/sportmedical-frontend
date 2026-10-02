import { Box, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DESIGN } from "../ui";

/**
 * The row of calendar pills on the overview screens: every calendar on by
 * default, each with its own colour square (the board's SLUŽBY legend), and a
 * click turns one off or on. `selected === null` means "all", which is how the
 * screens have always spelled it, so the prop contract is unchanged.
 */
export function CalendarTogglePills({
  calendars,
  selected,
  onChange,
  ariaLabel = "Kalendáře",
}: {
  calendars: { id: string; name: string; color: string }[];
  selected: Set<string> | null;
  onChange: (next: Set<string>) => void;
  ariaLabel?: string;
}) {
  return (
    <Box role="group" aria-label={ariaLabel} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {calendars.map((calendar) => {
        const on = selected === null || selected.has(calendar.id);
        return (
          <ButtonBase
            key={calendar.id}
            aria-pressed={on}
            onClick={() => {
              const next = new Set(selected ?? calendars.map((c) => c.id));
              if (next.has(calendar.id)) next.delete(calendar.id);
              else next.add(calendar.id);
              onChange(next);
            }}
            sx={(theme) => ({
              borderRadius: 999,
              px: 1.75,
              minHeight: 36,
              fontSize: 13,
              fontWeight: 600,
              gap: 1,
              border: "1px solid",
              borderColor: on
                ? theme.palette.mode === "light"
                  ? DESIGN.softPrimary.line
                  : theme.palette.primary.main
                : theme.palette.divider,
              bgcolor: on
                ? theme.palette.mode === "light"
                  ? DESIGN.softPrimary.bg
                  : alpha(theme.palette.primary.main, 0.14)
                : theme.palette.background.paper,
              color: on ? theme.palette.primary.main : theme.palette.text.secondary,
              "&:hover": { bgcolor: on ? undefined : theme.palette.action.hover },
            })}
          >
            <Box
              component="span"
              sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: calendar.color, opacity: on ? 1 : 0.4 }}
            />
            {calendar.name}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default CalendarTogglePills;
