import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { numberSeriesApi } from '../services/numberSeriesApi';

interface NumberSeriesAuditTrailProps {
  documentType: string;
  limit?: number;
}

export const NumberSeriesAuditTrail: React.FC<NumberSeriesAuditTrailProps> = ({
  documentType,
  limit = 50,
}) => {
  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['audit-trail', documentType],
    queryFn: () => numberSeriesApi.getAuditTrail(documentType),
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error">
        Failed to load audit trail: {error.message}
      </Typography>
    );
  }

  const limitedEntries = entries?.slice(0, limit) ?? [];

  return (
    <TableContainer component={Paper}>
      <Typography variant="h6" p={2}>
        Audit Trail - {documentType}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Assigned Number</TableCell>
            <TableCell>Document ID</TableCell>
            <TableCell>Assigned By</TableCell>
            <TableCell>Assigned At</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {limitedEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell sx={{ fontFamily: 'monospace' }}>
                {entry.assignedNumber}
              </TableCell>
              <TableCell>{entry.documentId || '-'}</TableCell>
              <TableCell>{entry.assignedByUserId || '-'}</TableCell>
              <TableCell>
                {new Date(entry.assignedAt).toLocaleString('cs-CZ')}
              </TableCell>
            </TableRow>
          ))}
          {limitedEntries.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                No entries found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
