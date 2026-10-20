import { Fragment } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useSlot } from '../api/siteContent';
import { KineticLines, LightWords } from '../motion/KineticText';

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
  /** The words arrive one by one ('kinetic': they rise out of a mask on load) or light up while read ('words': a scroll scene). */
  split?: 'kinetic' | 'words';
  /** Marks the element for a scroll scene (data-sm). */
  dataSm?: string;
  /** A section transition of the scroll scenes (data-fx). */
  fx?: string;
  /** Seconds before the first kinetic word. */
  delay?: number;
}

/** An editable text: the admin's wording, else the registry default. */
export function SlotText({ slotKey, as = 'span', sx, accentLast, accent, fallback, id, split, delay, dataSm, fx }: SlotTextProps) {
  const slot = useSlot(slotKey, fallback);
  return (
    <Box component={as} id={id} data-sm={dataSm} data-fx={fx} sx={sx}>
      {split === 'kinetic' ? (
        <KineticLines text={slot.text} accentLast={accentLast} accent={accent} delay={delay} />
      ) : split === 'words' ? (
        <LightWords text={slot.text} />
      ) : (
        <Lines text={slot.text} accentLast={accentLast} accent={accent} />
      )}
    </Box>
  );
}

/** The plain string of a text slot, for places that compose it into something else. */
export function useSlotText(slotKey: string, fallback = ''): string {
  return useSlot(slotKey, fallback).text;
}
