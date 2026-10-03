import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useDevice } from '../../layout/useDevice';
import { SoftCard } from './SoftCard';

/**
 * One list, three layouts (Etapa 2 brief, rule 3).
 *
 *   phone    ≤ 767    a stack of cards - `renderCard(row)` draws one, no hover,
 *                     the whole card is the tap target when `onRowClick` is given
 *   tablet   768-1279 a table with the three columns marked `tablet`
 *                     (the first three when none is marked)
 *   desktop  ≥ 1280   the table with every column
 *
 * Columns are declared once; the card is the phone's own design rather than a
 * squeezed row, so it says only what a thumb needs: name, when, where it stands.
 */
export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Kept on the tablet's three-column table. */
  tablet?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

export function ResponsiveDataList<T>({
  rows,
  rowKey,
  columns,
  renderCard,
  onRowClick,
  empty,
  ariaLabel,
  footer,
}: {
  rows: readonly T[];
  rowKey: (row: T) => string;
  columns: readonly DataColumn<T>[];
  renderCard: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Shown instead of the rows when there are none. */
  empty?: React.ReactNode;
  ariaLabel?: string;
  footer?: React.ReactNode;
}) {
  const device = useDevice();

  if (rows.length === 0 && empty !== undefined) {
    return (
      <SoftCard sx={{ py: 5, textAlign: 'center' }}>
        {typeof empty === 'string' ? <Typography sx={{ color: 'text.secondary' }}>{empty}</Typography> : empty}
      </SoftCard>
    );
  }

  if (device === 'phone') {
    return (
      <Stack spacing={1.25} role="list" aria-label={ariaLabel} data-layout="cards">
        {rows.map((row) => (
          <SoftCard
            key={rowKey(row)}
            role="listitem"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            sx={{ p: 2, minHeight: 44, cursor: onRowClick ? 'pointer' : undefined }}
          >
            {renderCard(row)}
          </SoftCard>
        ))}
        {footer}
      </Stack>
    );
  }

  const shown =
    device === 'tablet'
      ? (() => {
          const marked = columns.filter((c) => c.tablet === true);
          return marked.length > 0 ? marked.slice(0, 3) : columns.slice(0, 3);
        })()
      : columns;

  return (
    <SoftCard sx={{ p: 0, overflow: 'hidden' }} data-layout={device === 'tablet' ? 'table-3' : 'table'}>
      <TableContainer>
        <Table aria-label={ariaLabel}>
          <TableHead>
            <TableRow>
              {shown.map((c) => (
                <TableCell key={c.key} align={c.align} sx={c.width !== undefined ? { width: c.width } : undefined}>
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                hover={onRowClick !== undefined}
                sx={{ cursor: onRowClick ? 'pointer' : undefined }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {shown.map((c) => (
                  <TableCell key={c.key} align={c.align}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {footer !== undefined && <Box>{footer}</Box>}
    </SoftCard>
  );
}

export default ResponsiveDataList;
