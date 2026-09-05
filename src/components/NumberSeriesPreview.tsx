import React, { useEffect, useState } from 'react';
import { 
  Typography, 
  Chip, 
  Box, 
  CircularProgress,
  Tooltip,
  IconButton 
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { numberSeriesApi } from '../services/numberSeriesApi';

interface NumberSeriesPreviewProps {
  documentType: string;
  showLabel?: boolean;
  showRefresh?: boolean;
  onNumberLoaded?: (number: string) => void;
}

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
      setError('Failed to load number preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNext();
  }, [documentType]);

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={16} />
        <Typography variant="caption">Načítání...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="caption" color="error">
          {error}
        </Typography>
        {showRefresh && (
          <IconButton size="small" onClick={fetchNext}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {showLabel && (
        <Typography variant="caption" color="text.secondary">
          Další číslo:
        </Typography>
      )}
      <Tooltip title={`Next number for ${documentType}`}>
        <Chip 
          label={nextNumber} 
          size="small" 
          color="primary" 
          variant="outlined"
          sx={{ fontFamily: 'monospace' }}
        />
      </Tooltip>
      {showRefresh && (
        <IconButton size="small" onClick={fetchNext}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};
