/*
 * "Přidat do kalendáře" for every patient: a Google Calendar link (works everywhere) and the
 * .ics for Apple Calendar / Outlook. The .ics goes out the way each platform can use it:
 *   - a real https URL from the server, when there is one (always the most reliable);
 *   - iPhone/iPad Safari: the current window opens a data: URI, which shows the add-event sheet;
 *   - iOS Chrome / Firefox / in-app browsers cannot do that, so a short hint says to open Safari;
 *   - everything else: a file download named *.ics.
 */
import { useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { CalendarMonthOutlined, EventOutlined } from '@mui/icons-material';
import {
  buildIcs, currentCalendarPlatform, downloadIcsFile, googleCalendarUrl, icsDataUri,
  type CalendarEvent, type CalendarPlatform,
} from './calendarLinks';

export interface AddToCalendarProps {
  event: CalendarEvent;
  /** A server https URL of the .ics; used as is when given. */
  icsUrl?: string;
  fileName?: string;
  /** A line above the buttons ("Přidat do kalendáře"). */
  heading?: string;
  /** How the buttons look on the page that hosts them. */
  buttonSx?: SxProps<Theme>;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  /** For tests. */
  platform?: CalendarPlatform;
  /** Tighter spacing, for a list row. */
  compact?: boolean;
  /** The .ics button is the strong one (the other keeps `variant`). */
  icsContained?: boolean;
  /** Centre the heading and buttons (a centred success screen). */
  centered?: boolean;
}

export function AddToCalendar({
  event, icsUrl, fileName = 'termin.ics', heading, buttonSx, variant = 'outlined', size = 'medium', fullWidth = false, platform, compact = false, centered = false, icsContained = false,
}: AddToCalendarProps) {
  const kind = useMemo(() => platform ?? currentCalendarPlatform(), [platform]);
  const google = useMemo(() => googleCalendarUrl(event), [event]);

  const openIcs = () => {
    const ics = buildIcs(event);
    try {
      if (kind === 'ios-safari') window.location.assign(icsDataUri(ics));
      else downloadIcsFile(ics, fileName);
    } catch {
      /* blocked - the time is on the page and the Google link is next to it. */
    }
  };

  const common = { variant, size, fullWidth, sx: buttonSx } as const;
  const hint = icsUrl === undefined && kind === 'ios-other';

  return (
    <Box data-testid="add-to-calendar" data-platform={kind} sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: fullWidth ? 'stretch' : centered ? 'center' : 'flex-start' }}>
      {heading !== undefined && <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{heading}</Typography>}
      <Box sx={{ display: 'flex', gap: compact ? 0.5 : 1.25, flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start', flexDirection: fullWidth ? 'column' : 'row' }}>
        <Button {...common} href={google} target="_blank" rel="noopener noreferrer" startIcon={<CalendarMonthOutlined />}>
          Google Kalendář
        </Button>
        {icsUrl !== undefined ? (
          <Button {...common} variant={icsContained ? 'contained' : variant} href={icsUrl} startIcon={<EventOutlined />}>Apple Kalendář / Outlook</Button>
        ) : (
          <Button {...common} variant={icsContained ? 'contained' : variant} onClick={openIcs} startIcon={<EventOutlined />}>Apple Kalendář / Outlook</Button>
        )}
      </Box>
      {hint && (
        <Typography data-testid="calendar-safari-hint" variant="caption" sx={{ opacity: 0.85 }}>
          Pro Apple Kalendář otevřete tuto stránku v Safari. Jinak použijte Google Kalendář.
        </Typography>
      )}
    </Box>
  );
}
