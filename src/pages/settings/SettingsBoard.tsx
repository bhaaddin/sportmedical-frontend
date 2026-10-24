/*
 * A settings screen's block of fields as a shelf: one titled glass board with its own padding. Every converted settings
 * page uses this instead of a bordered card of its own, so a form reads the same on every screen
 * (docs/ui-shelf-system.md, section 3: `board` layout).
 */
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Shelf, type ShelfProps } from '../../ui/shelf';

type Props = Omit<ShelfProps, 'layout' | 'children'> & { children: ReactNode; padding?: number };

export function SettingsBoard({ children, padding = 2, stagger = false, ...shelf }: Props) {
  return (
    <Shelf {...shelf} layout="board" stagger={stagger}>
      <Box sx={{ p: padding, minWidth: 0 }}>{children}</Box>
    </Shelf>
  );
}
