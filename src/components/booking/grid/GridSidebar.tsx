import {
  Box,
  Checkbox,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { parseDateOnly, toDateOnly, type DateOnly } from "../../../utils/time";
import { DESIGN } from "../../../theme";
import { SectionLabel } from "../../ui/SectionLabel";
import type { Employee } from "./filters";
import { GRID_TEXT } from "./gridText";
import { resolveMiniCalendar } from "./miniCalendarSlot";

/*
 * The left rail of the calendar, as the board draws it (3. 10. 2026): the
 * mini calendar, the calendars to show, who works in the period on screen,
 * and the SLUŽBY legend with a colour square per service - the colour of the
 * calendar that runs it, so the legend and the columns agree.
 *
 * The day / week / month switch lives in the top bar now. Every control here
 * drives the same state as its twin up there - one filter, two places to
 * reach it - so the two can never disagree.
 */

const MiniCalendar = resolveMiniCalendar();

export type GridView = "day" | "week" | "month";

export interface SidebarCalendar {
  id: string;
  name: string;
  color: string;
  /** Which služba the calendar runs; colours the legend. */
  clinicServiceId?: string | null;
}

export function GridSidebar({
  anchor,
  view,
  onDate,
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
  const colourOf = (service: { id: string }) =>
    calendars.find((c) => c.clinicServiceId === service.id)?.color ?? DESIGN.faint;

  return (
    <Stack spacing={3}>
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

      <Box component="section" aria-label={GRID_TEXT.calendars}>
        <SectionLabel component="h2">{GRID_TEXT.calendars}</SectionLabel>
        {calendars.map((calendar) => (
          <Box key={calendar.id} sx={{ display: "flex", alignItems: "center", minHeight: 32 }}>
            <Checkbox
              size="small"
              checked={isTicked(calendar.id)}
              onChange={() => onToggle(calendar.id)}
              slotProps={{ input: { "aria-label": calendar.name } }}
              sx={{ p: 0.5, mr: 0.5, color: calendar.color, "&.Mui-checked": { color: calendar.color } }}
            />
            <Link
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              title={GRID_TEXT.onlyThis}
              onClick={() => onOnly(calendar.id)}
              sx={{ textAlign: "left", fontSize: 14, lineHeight: 1.3 }}
            >
              {calendar.name}
            </Link>
          </Box>
        ))}
      </Box>

      <Box component="section" aria-label={GRID_TEXT.employees}>
        <SectionLabel component="h2">{GRID_TEXT.employees}</SectionLabel>
        {employees.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {GRID_TEXT.noEmployees}
          </Typography>
        ) : (
          <List dense disablePadding>
            <ListItemButton
              selected={employeeId === null}
              onClick={() => onEmployee(null)}
              sx={{ px: 1, minHeight: 34 }}
            >
              <ListItemText primary={GRID_TEXT.allEmployees} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
            </ListItemButton>
            {employees.map((employee) => (
              <ListItemButton
                key={employee.id}
                selected={employeeId === employee.id}
                onClick={() => onEmployee(employee.id)}
                sx={{ px: 1, minHeight: 34 }}
              >
                <ListItemText primary={employee.name} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      {services.length > 0 ? (
        <Box component="section" aria-label={GRID_TEXT.services}>
          <SectionLabel component="h2">{GRID_TEXT.services}</SectionLabel>
          <List dense disablePadding>
            <ListItemButton
              selected={serviceId === null}
              onClick={() => onService(null)}
              sx={{ px: 1, minHeight: 34 }}
            >
              <ListItemText primary={GRID_TEXT.allServices} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
            </ListItemButton>
            {services.map((service) => (
              <ListItemButton
                key={service.id}
                selected={serviceId === service.id}
                onClick={() => onService(service.id)}
                sx={{ px: 1, minHeight: 34, gap: 1.25 }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    borderRadius: "3px",
                    bgcolor: colourOf(service),
                  }}
                />
                <ListItemText primary={service.name} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ) : null}
    </Stack>
  );
}
