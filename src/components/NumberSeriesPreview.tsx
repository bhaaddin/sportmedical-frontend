import React, { useEffect, useState } from 'react';
import { Typography, Box, CircularProgress, Button } from '@mui/material';
import { numberSeriesApi } from '../services/numberSeriesApi';
import { SectionLabel } from './ui';

interface NumberSeriesPreviewProps {
  documentType: string;
  showLabel?: boolean;
  showRefresh?: boolean;
  onNumberLoaded?: (number: string) => void;
}

/**
 * "DALŠÍ ČÍSLO DOKLADU  2026-0419" at the top of a new document - what the
 * numbering series will hand out next, peeked, not taken.
 */
export const NumberSeriesPreview: React.FC<NumberSeriesPreviewProps> = ({
  documentType,
  showLabel = true,
  showRefresh = true,
  onNumberLoaded,
}) => {
  const [nextNumber, setNextNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNext = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await numberSeriesApi.peekNextNumber(documentType);
      setNextNumber(response.number);
      onNumberLoaded?.(response.number);
    } catch (error) {
      console.error('Failed to fetch next number:', error);
      setError('Číslo dokladu se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNext();
  }, [documentType]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Načítám číslo dokladu…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="error">
          {error}
        </Typography>
        {showRefresh && (
          <Button size="small" variant="text" onClick={fetchNext}>Zkusit znovu</Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      {showLabel && <SectionLabel sx={{ mb: 0 }}>Další číslo dokladu</SectionLabel>}
      <Box
        component="span"
        title={`Další číslo řady ${documentType}`}
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 13,
          fontWeight: 600,
          px: 1.25,
          py: 0.375,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        {nextNumber}
      </Box>
      {showRefresh && (
        <Button size="small" variant="text" onClick={fetchNext} aria-label="Načíst číslo znovu">
          Obnovit
        </Button>
      )}
    </Box>
  );
};
