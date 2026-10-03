import { Box, ButtonBase, Checkbox, Link, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { DESIGN } from "../../../theme";
import { parseDateOnly, toDateOnly, type DateOnly } from "../../../utils/time";
import { SectionLabel } from "../../ui/SectionLabel";
import { MiniCalendar } from "../MiniCalendar";
import { CAL_TEXT } from "../calendar/calendarText";
import { cleanHex } from "../calendar/model";
import type { Employee } from "./filters";
import { GRID_TEXT } from "./gridText";

/*
 * What the calendar puts beside the grid, as the board draws the sidebar
 * (Main.dc.html): the mini calendar, and "SLUŽBY" - a legend with a colour
 * square per service that is also the service filter.
 *
 * The same content is shown in three places, one at a time (never two
 * sidebars side by side):
 *   desktop  inside the shell's sidebar, through `SidebarPortal`;
 *   tablet   a collapsible block above the grid;
 *   phone    a "Kalendář a filtry" bottom sheet.
 * Where it lives is the page's business; this file is only the content.
 *
 * The calendars to show and the employee are a second kind of filter and live
 * in `CalendarFilters` (the toolbar's "Kalendáře" menu), not here: the sidebar
 * is short.
 */

export type GridView = "day" | "week" | "month";

export interface SidebarCalendar {
  id: string;
  name: string;
  color: string;
  /** Which služba the calendar runs; colours the legend when the service has no colour of its own. */
  clinicServiceId?: string | null;
}

export interface LegendService {
  id: string;
  name: string;
  /** The service's colour (C1 `colorHex`), or a fallback the caller worked out. */
  color: string;
}

/** "SLUŽBY": a colour square and the name per service; the square ticks the service on and off. */
export function ServiceLegend({
  services,
  isShown,
  onToggle,
  onOnly,
  onAll,
  touch = false,
}: {
  services: LegendService[];
  isShown: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOnly: (id: string) => void;
  /** Back to every service; offered only while some are hidden. */
  onAll: () => void;
  touch?: boolean;
}) {
  if (services.length === 0) return null;
  const hiddenSome = services.some((s) => !isShown(s.id));
  return (
    <Box component="section" aria-label={GRID_TEXT.services}>
      <SectionLabel component="h2" sx={{ mb: 0.5 }}>
        {GRID_TEXT.services}
      </SectionLabel>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {services.map((service) => {
          const shown = isShown(service.id);
          const colour = cleanHex(service.color) ?? DESIGN.faint;
          return (
            <Box
              key={service.id}
              sx={{
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                "& .only": { opacity: 0 },
                "&:hover .only, &:focus-within .only": { opacity: 1 },
                "@media (hover: none)": { "& .only": { opacity: 1 } },
              }}
            >
              <Box
                component="label"
                sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: 1, minHeight: 44, minWidth: 0, fontSize: 14, cursor: "pointer" }}
              >
                <Box
                  component="input"
                  type="checkbox"
                  checked={shown}
                  onChange={() => onToggle(service.id)}
                  aria-label={service.name}
                  sx={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                />
                <Box
                  aria-hidden
                  data-testid={`legend-square-${service.id}`}
                  sx={{
                    width: 15,
                    height: 15,
                    flex: "0 0 15px",
                    borderRadius: "4px",
                    border: `1px solid ${shown ? colour : DESIGN.faint}`,
                    bgcolor: shown ? colour : "background.paper",
                  }}
                />
                <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {service.name}
                </Box>
              </Box>
              <ButtonBase
                className="only"
                onClick={() => onOnly(service.id)}
                aria-label={`${CAL_TEXT.serviceOnly}: ${service.name}`}
                title={CAL_TEXT.serviceOnly}
                sx={{
                  minHeight: touch ? 44 : 32,
                  minWidth: 44,
                  px: 1,
                  fontSize: 12,
                  color: "text.secondary",
                  borderRadius: 1.5,
                  transition: "opacity 120ms",
                }}
              >
                jen
              </ButtonBase>
            </Box>
          );
        })}
      </Box>
      {hiddenSome ? (
        <Link component="button" type="button" underline="hover" onClick={onAll} sx={{ fontSize: 13, mt: 0.5, minHeight: 32 }}>
          {GRID_TEXT.allServices}
        </Link>
      ) : null}
    </Box>
  );
}

/** The sidebar's content: the mini calendar and the service legend. */
export function GridSidebar({
  anchor,
  view,
  onDate,
  holidays,
  closedDays,
  services,
  isServiceShown,
  onToggleService,
  onOnlyService,
  onAllServices,
  touch = false,
}: {
  anchor: DateOnly;
  view: GridView;
  onDate: (date: DateOnly) => void;
  holidays: ReadonlySet<string>;
  closedDays: ReadonlySet<string>;
  services: LegendService[];
  isServiceShown: (id: string) => boolean;
  onToggleService: (id: string) => void;
  onOnlyService: (id: string) => void;
  onAllServices: () => void;
  touch?: boolean;
}) {
  return (
    <Stack spacing={3} data-testid="calendar-side-panel">
      <MiniCalendar
        value={parseDateOnly(anchor)}
        view={view}
        onSelect={(date) => onDate(toDateOnly(date))}
        holidays={holidays}
        closedDays={closedDays}
        touch={touch}
      />
      <ServiceLegend
        services={services}
        isShown={isServiceShown}
        onToggle={onToggleService}
        onOnly={onOnlyService}
        onAll={onAllServices}
        touch={touch}
      />
    </Stack>
  );
}

/**
 * The calendars to show and the worker whose days to show - the second kind of
 * filter, in the toolbar's "Kalendáře" menu and in the phone sheet. Ticking a
 * calendar redraws at once; clicking its name shows only that one.
 */
export function CalendarFilters({
  calendars,
  isTicked,
  onToggle,
  onOnly,
  employees,
  employeeId,
  onEmployee,
}: {
  calendars: SidebarCalendar[];
  isTicked: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOnly: (id: string) => void;
  employees: Employee[];
  employeeId: string | null;
  onEmployee: (id: string | null) => void;
}) {
  return (
    <Stack spacing={2.5}>
      <Box component="section" aria-label={GRID_TEXT.calendars}>
        <SectionLabel component="h2">{GRID_TEXT.calendars}</SectionLabel>
        {calendars.map((calendar) => (
          <Box key={calendar.id} sx={{ display: "flex", alignItems: "center", minHeight: 44 }}>
            <Checkbox
              checked={isTicked(calendar.id)}
              onChange={() => onToggle(calendar.id)}
              slotProps={{ input: { "aria-label": calendar.name } }}
              sx={{ p: 1.25, mr: 0.25, color: calendar.color, "&.Mui-checked": { color: calendar.color } }}
            />
            <Link
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              title={GRID_TEXT.onlyThis}
              onClick={() => onOnly(calendar.id)}
              sx={{ textAlign: "left", fontSize: 14, lineHeight: 1.3, minHeight: 44 }}
            >
              {calendar.name}
            </Link>
          </Box>
        ))}
      </Box>

      <Box component="section" aria-label={GRID_TEXT.employees}>
        <SectionLabel component="h2">{GRID_TEXT.employees}</SectionLabel>
        {employees.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{GRID_TEXT.noEmployees}</Typography>
        ) : (
          <List dense disablePadding>
            <ListItemButton selected={employeeId === null} onClick={() => onEmployee(null)} sx={{ px: 1, minHeight: 44 }}>
              <ListItemText primary={GRID_TEXT.allEmployees} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
            </ListItemButton>
            {employees.map((employee) => (
              <ListItemButton
                key={employee.id}
                selected={employeeId === employee.id}
                onClick={() => onEmployee(employee.id)}
                sx={{ px: 1, minHeight: 44 }}
              >
                <ListItemText primary={employee.name} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Stack>
  );
}
