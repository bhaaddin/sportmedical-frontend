import React, { useState } from 'react';
import {
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Chip,
} from '@mui/material';
import { useGenerateNumber } from '../services/numberSeriesApi';

interface NumberSeriesGeneratorProps {
  documentType: string;
  onNumberGenerated?: (number: string) => void;
}

export const NumberSeriesGenerator: React.FC<NumberSeriesGeneratorProps> = ({
  documentType,
  onNumberGenerated,
}) => {
  const [generatedNumber, setGeneratedNumber] = useState<string>('');
  const [documentId, setDocumentId] = useState<string>('');
  
  const generateMutation = useGenerateNumber();

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        documentType,
        documentId: documentId || undefined,
      });
      setGeneratedNumber(result.number);
      onNumberGenerated?.(result.number);
    } catch (error) {
      console.error('Failed to generate number:', error);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom>
        Generate Number - {documentType}
      </Typography>
      
      <Box display="flex" flexDirection="column" gap={2}>
        <TextField
          label="Document ID (optional)"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          size="small"
          fullWidth
        />
        
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          startIcon={generateMutation.isPending && <CircularProgress size={16} />}
        >
          Generate Next Number
        </Button>

        {generateMutation.isError && (
          <Alert severity="error">
            Failed to generate number: {generateMutation.error?.message}
          </Alert>
        )}

        {generatedNumber && (
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2">Generated:</Typography>
            <Chip 
              label={generatedNumber}
              color="success"
              variant="outlined"
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
};
