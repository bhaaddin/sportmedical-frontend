import {
  Table as MuiTable, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TableSortLabel,
  Paper, Typography, Checkbox, Box
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  data: any[];
  page?: number;
  rowsPerPage?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  selectedRows?: string[];
  onSelectRow?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  actions?: (row: any) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
}

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  '& .MuiTableCell-head': {
    fontWeight: 600,
    backgroundColor: theme.palette.grey?.[50] || '#FAFAFA',
    borderBottom: `2px solid ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:hover': {
    backgroundColor: theme.palette.action?.hover || 'rgba(0,0,0,0.04)',
  },
  '&.Mui-selected': {
    backgroundColor: (theme.palette.primary.main || '#1976D2') + '10',
    '&:hover': {
      backgroundColor: (theme.palette.primary.main || '#1976D2') + '15',
    },
  },
}));

export default function Table({
  columns,
  data,
  page = 0,
  rowsPerPage = 10,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  onSort,
  sortColumn,
  sortDirection = 'asc',
  selectable = false,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  actions,
  emptyMessage = 'Žádná data',
}: TableProps) {
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectAll) {
      onSelectAll(event.target.checked ? data.map(row => row.id) : []);
    }
  };

  return (
    <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
      <MuiTable stickyHeader>
        <StyledTableHead>
          <TableRow>
            {selectable && (
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedRows.length > 0 && selectedRows.length < data.length}
                  checked={data.length > 0 && selectedRows.length === data.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
            )}
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                style={{ minWidth: column.minWidth }}
              >
                {column.sortable ? (
                  <TableSortLabel
                    active={sortColumn === column.id}
                    direction={sortColumn === column.id ? sortDirection : 'asc'}
                    onClick={() => onSort?.(column.id, sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
            {actions && <TableCell align="right">Akce</TableCell>}
          </TableRow>
        </StyledTableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                align="center"
                sx={{ py: 8 }}
              >
                <Typography color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              const isSelected = selectedRows.includes(row.id);
              return (
                <StyledTableRow key={row.id} hover selected={isSelected}>
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => onSelectRow?.(row.id)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align}>
                      {column.render
                        ? column.render(row[column.id], row)
                        : row[column.id]}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {actions(row)}
                      </Box>
                    </TableCell>
                  )}
                </StyledTableRow>
              );
            })
          )}
        </TableBody>
      </MuiTable>
      {totalCount !== undefined && onPageChange && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => onPageChange(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => onRowsPerPageChange?.(parseInt(e.target.value, 10))}
          labelRowsPerPage="Řádků na stránku:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} z ${count}`
          }
        />
      )}
    </TableContainer>
  );
}
