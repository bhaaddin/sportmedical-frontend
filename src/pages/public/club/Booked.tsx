/* The success screen: when, which činnost, where, what to bring - and one click for the next player. */
import { Box, Button, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import { ARCHIVO, BRAND, clinicDate } from '../../../components/public/brand';
import { LABEL_COLOR, Panel, SOFT_TEXT, ctaSx, longWhen } from '../../../components/public/kit';

export interface BookedInfo {
  startUtc: string;
  date: string | null;
  startLocal: string | null;
  endLocal: string | null;
  calendarName: string | null;
  activityName: string | null;
  /** What to bring / what the činnost is, when the činnost carries it. */
  bring: string | null;
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const hhmm = (time: string): string => time.slice(0, 5);

export function Booked({
  booked, title, next, bringTitle, addLabel, onAdd,
}: { booked: BookedInfo; title: string; next: string; bringTitle: string; addLabel: string; onAdd: (() => void) | null }) {
  const when = booked.date !== null && booked.startLocal !== null
    ? `${capitalise(clinicDate(booked.date))} v ${hhmm(booked.startLocal)}${booked.endLocal !== null ? `–${hhmm(booked.endLocal)}` : ''}`
    : capitalise(longWhen(booked.startUtc));
  return (
    <Panel sx={{ alignItems: 'center', textAlign: 'center', py: 5 }}>
      <CheckCircleOutlined sx={{ fontSize: 56, color: BRAND.accent }} aria-hidden />
      <Typography component="h1" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em' }}>{title}</Typography>
      <Typography data-testid="booked-when" sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 20 }}>{when}</Typography>
      {(booked.activityName !== null || booked.calendarName !== null) && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 16, color: SOFT_TEXT }}>
          {booked.activityName !== null && <li>Činnost: {booked.activityName}</li>}
          {booked.calendarName !== null && <li>Místo: {booked.calendarName}</li>}
        </Box>
      )}
      {booked.bring !== null && (
        <Box sx={{ textAlign: 'left', maxWidth: 520, p: '12px 16px', bgcolor: BRAND.page, borderRadius: '12px' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{bringTitle}</Typography>
          <Typography sx={{ fontSize: 15, color: SOFT_TEXT, whiteSpace: 'pre-line' }}>{booked.bring}</Typography>
        </Box>
      )}
      <Typography sx={{ color: LABEL_COLOR }}>{next}</Typography>
      {onAdd !== null && (
        <Button variant="contained" onClick={onAdd} sx={ctaSx(50)}>{addLabel}</Button>
      )}
    </Panel>
  );
}
