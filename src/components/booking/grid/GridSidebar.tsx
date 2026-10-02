import {
  Box,
  Checkbox,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { parseDateOnly, toDateOnly, type DateOnly } from "../../../utils/time";
import type { Employee } from "./filters";
import { GRID_TEXT } from "./gridText";
import { resolveMiniCalendar } from "./miniCalendarSlot";

/*
 * The left side of the calendar, as the owner laid it out: the mini calendar,
 * the day / week / month switch, the calendars to show, who works in the
 * period on screen, and the services.
 *
 * Every control here drives the same state as its twin in the top bar - one
 * filter, two places to reach it - so the two can never disagree.
 */

const MiniCalendar = resolveMiniCalendar();

export type GridView = "day" | "week" | "month";

export interface SidebarCalendar {
  id: string;
  name: string;
  color: string;
}

export function GridSidebar({
  anchor,
  view,
  onDate,
  onView,
  holidays,
  closedDays,
  calendars,
  isTicked,
  onToggle,
  onOnly,
  employees,
  employeeId,
  onEmployee,
  services,
  serviceId,
  onService,
}: {
  anchor: DateOnly;
  view: GridView;
  onDate: (date: DateOnly) => void;
  onView: (view: GridView) => void;
  holidays: ReadonlySet<string>;
  closedDays: ReadonlySet<string>;
  calendars: SidebarCalendar[];
  isTicked: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOnly: (id: string) => void;
  employees: Employee[];
  employeeId: string | null;
  onEmployee: (id: string | null) => void;
  services: { id: string; name: string }[];
  serviceId: string | null;
  onService: (id: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      {MiniCalendar ? (
        <MiniCalendar
          value={parseDateOnly(anchor)}
          view={view}
          onSelect={(date) => onDate(toDateOnly(date))}
          holidays={holidays}
          closedDays={closedDays}
        />
      ) : (
        <TextField
          type="date"
          size="small"
          label={GRID_TEXT.jumpTo}
          value={anchor}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )}

      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        aria-label={GRID_TEXT.view}
        value={view}
        onChange={(_, next: GridView | null) => next && onView(next)}
      >
        <ToggleButton value="day">{t("booking.grid.day")}</ToggleButton>
        <ToggleButton value="week">{t("booking.grid.week")}</ToggleButton>
        <ToggleButton value="month">{t("booking.grid.month")}</ToggleButton>
      </ToggleButtonGroup>

      <Box component="section" aria-label={GRID_TEXT.calendars}>
        <SectionTitle>{GRID_TEXT.calendars}</SectionTitle>
        {calendars.map((calendar) => (
          <Box key={calendar.id} sx={{ display: "flex", alignItems: "center" }}>
            <Checkbox
              size="small"
              checked={isTicked(calendar.id)}
              onChange={() => onToggle(calendar.id)}
              slotProps={{ input: { "aria-label": calendar.name } }}
              sx={{ color: calendar.color, "&.Mui-checked": { color: calendar.color } }}
            />
            <Link
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              title={GRID_TEXT.onlyThis}
              onClick={() => onOnly(calendar.id)}
              sx={{ textAlign: "left", fontSize: 14 }}
            >
              {calendar.name}
            </Link>
          </Box>
        ))}
      </Box>

      <Box component="section" aria-label={GRID_TEXT.employees}>
        <SectionTitle>{GRID_TEXT.employees}</SectionTitle>
        {employees.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {GRID_TEXT.noEmployees}
          </Typography>
        ) : (
          <List dense disablePadding>
            <ListItemButton selected={employeeId === null} onClick={() => onEmployee(null)}>
              <ListItemText primary={GRID_TEXT.allEmployees} />
            </ListItemButton>
            {employees.map((employee) => (
              <ListItemButton
                key={employee.id}
                selected={employeeId === employee.id}
                onClick={() => onEmployee(employee.id)}
              >
                <ListItemText primary={employee.name} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      {services.length > 0 ? (
        <Box component="section" aria-label={GRID_TEXT.services}>
          <SectionTitle>{GRID_TEXT.services}</SectionTitle>
          <List dense disablePadding>
            <ListItemButton selected={serviceId === null} onClick={() => onService(null)}>
              <ListItemText primary={GRID_TEXT.allServices} />
            </ListItemButton>
            {services.map((service) => (
              <ListItemButton
                key={service.id}
                selected={serviceId === service.id}
                onClick={() => onService(service.id)}
              >
                <ListItemText primary={service.name} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ) : null}
    </Stack>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography
      component="h2"
      sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "text.secondary", mb: 0.5 }}
    >
      {children}
    </Typography>
  );
}
