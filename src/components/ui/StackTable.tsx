import { useLayoutEffect, useRef } from 'react';
import { Box, type BoxProps } from '@mui/material';

/*
 * A table that becomes a stack of cards on a phone (<768), without a second markup: every row turns into a card, every
 * cell into a line "LABEL ........ value", the label read from the column's own head. From 768 it is the ordinary
 * table in a box that scrolls sideways if it must.
 *
 * It replaces a `TableContainer` (or the `<Box sx={{ overflowX: 'auto' }}>` around a `<Table>`); the markup inside is
 * untouched, so every button, switch and text stays where it was. Header cells that spell nothing give a cell no label.
 */
function labelCells(root: HTMLElement | null): void {
  const table = root?.querySelector('table');
  if (!table) return;
  const heads = Array.from(table.querySelectorAll(':scope > thead > tr:first-child > th')).map((th) => (th.textContent ?? '').trim());
  table.querySelectorAll(':scope > tbody > tr').forEach((tr) => {
    let column = 0;
    Array.from(tr.children).forEach((cell) => {
      const span = Number(cell.getAttribute('colspan') ?? 1) || 1;
      const label = span === 1 ? heads[column] : undefined;
      if (label) cell.setAttribute('data-label', label);
      else cell.removeAttribute('data-label');
      column += span;
    });
  });
}

export const STACK_TABLE_PHONE_SX = {
  '@media (max-width: 767.95px)': {
    overflowX: 'visible',
    '& table': { display: 'block', width: '100%', minWidth: '0 !important', tableLayout: 'auto' },
    '& thead': { display: 'block', position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
    '& tbody': { display: 'block' },
    '& tbody > tr': { display: 'block', borderBottom: '1px solid', borderColor: 'divider', py: 1 },
    '& tbody > tr:last-of-type': { borderBottom: 'none' },
    '& tbody > tr > td': {
      display: 'flex',
      flexDirection: 'row !important',
      /* A cell whose content is wider than the room beside its label puts it on the next line instead of sticking out. */
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.5,
      border: 'none',
      py: 0.75,
      px: 2,
      textAlign: 'right !important',
      width: 'auto !important',
      maxWidth: 'none !important',
      whiteSpace: 'normal',
    },
    '& tbody > tr > td[data-label]::before': {
      content: 'attr(data-label)',
      flex: '0 0 34%',
      textAlign: 'left',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'text.secondary',
    },
    '& tbody > tr > td > *': { minWidth: 0, maxWidth: '100%', marginLeft: 'auto' },
  },
} as const;

export function StackTable({ children, sx, ...rest }: BoxProps<'div'> & { component?: React.ElementType }) {
  const ref = useRef<HTMLDivElement | null>(null);
  /* After every render: the rows change whenever the data does. */
  useLayoutEffect(() => { labelCells(ref.current); });
  return (
    <Box
      ref={ref}
      data-stack-table=""
      sx={[{ position: 'relative', overflowX: 'auto', width: '100%' }, STACK_TABLE_PHONE_SX, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default StackTable;
