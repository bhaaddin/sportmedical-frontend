import { useMemo } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../api/appointments";
import { formatPragueDate, formatPragueTime, pragueDateKey } from "../../utils/time";
import type { DateOnly } from "../../utils/time";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";

/**
 * The times an appointment may be given — the one place in this codebase that
 * answers that question, and it answers it by asking the server.
 *
 * 6.1 is the rule the whole calendar hangs on: the client never works out what
 * is free. Not from working hours, not from the day's appointments, not from
 * arithmetic on durations. It calls
 * `GET /api/calendars/{id}/availability` and offers exactly the starts that
 * come back, in the order they come back.
 *
 * It lives in its own file because it is used twice - moving an appointment
 * (5.8) and booking one (5.9) - and two copies of a rule drift. The second
 * caller is how this file came to exist.
 */

interface AvailabilityPickerProps {
  calendarId: string;
  activityId: string;
  from: DateOnly;
  to: DateOnly;
  /** The slot an appointment already occupies: offering it is not a move. */
  excludeStartUtc?: string;
  busy?: boolean;
  onPick: (startUtc: string) => void;
  emptyText: string;
}

export function AvailabilityPicker({
  calendarId,
  activityId,
  from,
  to,
  excludeStartUtc,
  busy = false,
  onPick,
  emptyText,
}: AvailabilityPickerProps) {
  const offer = useQuery({
    queryKey: ["availability", calendarId, activityId, from, to],
    queryFn: () =>
      appointmentsApi.getAvailability(calendarId, activityId, from, to),
    enabled: Boolean(calendarId && activityId),
  });

  const byDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const slot of offer.data ?? []) {
      if (excludeStartUtc && slot.startUtc === excludeStartUtc) continue;
      const key = pragueDateKey(slot.startUtc);
      const list = groups.get(key) ?? [];
      list.push(slot.startUtc);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [offer.data, excludeStartUtc]);

  return (
    <AsyncSection
      isLoading={offer.isLoading}
      error={offer.error}
      isSettled={offer.isSuccess || offer.isError}
      isEmpty={byDay.length === 0}
      emptyText={emptyText}
      onRetry={() => void offer.refetch()}
      skeletonRows={3}
    >
      <Stack spacing={1.5}>
        {byDay.map(([day, starts]) => (
          <Box key={day}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {formatPragueDate(starts[0])}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
              {starts.map((startUtc) => (
                <Button
                  key={startUtc}
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onPick(startUtc)}
                >
                  {formatPragueTime(startUtc)}
                </Button>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </AsyncSection>
  );
}

/** Wraps the picker with a heading and a place for the write's own failure. */
export function AvailabilityPanel({
  title,
  error,
  ...picker
}: AvailabilityPickerProps & { title: string; error?: unknown }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errorText(error, t)}
        </Alert>
      ) : null}
      <AvailabilityPicker {...picker} />
    </Box>
  );
}

export default AvailabilityPicker;
