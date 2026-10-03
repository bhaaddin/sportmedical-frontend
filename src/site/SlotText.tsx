import { Fragment } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useSlot } from '../api/siteContent';

/** A text with "\n" line breaks as `<br>`; the last line may be drawn in an accent colour. */
export function Lines({ text, accentLast = false, accent }: { text: string; accentLast?: boolean; accent?: string }): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const isAccent = accentLast && index === lines.length - 1 && lines.length > 1;
    return (
      <Fragment key={index}>
        {index > 0 && <br />}
        {isAccent ? <Box component="span" sx={{ color: accent }}>{line}</Box> : line}
      </Fragment>
    );
  });
}

export interface SlotTextProps {
  slotKey: string;
  /** The element to render: 'h1', 'p', 'span', … */
  as?: ElementType;
  sx?: SxProps<Theme>;
  /** Draw the last line in `accent` (the hero headline). */
  accentLast?: boolean;
  accent?: string;
  /** Used only when the key is not in the registry and the admin has not written anything. */
  fallback?: string;
  id?: string;
}

/** An editable text: the admin's wording, else the registry default. */
export function SlotText({ slotKey, as = 'span', sx, accentLast, accent, fallback, id }: SlotTextProps) {
  const slot = useSlot(slotKey, fallback);
  return (
    <Box component={as} id={id} sx={sx}>
      <Lines text={slot.text} accentLast={accentLast} accent={accent} />
    </Box>
  );
}

/** The plain string of a text slot, for places that compose it into something else. */
export function useSlotText(slotKey: string, fallback = ''): string {
  return useSlot(slotKey, fallback).text;
}
