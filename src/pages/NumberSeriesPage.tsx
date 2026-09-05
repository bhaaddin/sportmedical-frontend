import { useState } from 'react';
import { Box, Typography, Tabs, Tab, Card, CardContent } from '@mui/material';
import { Numbers as NumbersIcon } from '@mui/icons-material';
import { NumberSeriesGenerator } from '../components/NumberSeriesGenerator';
import { NumberSeriesPreview } from '../components/NumberSeriesPreview';
import { NumberSeriesAuditTrail } from '../components/NumberSeriesAuditTrail';

const DOCUMENT_TYPES = [
  { value: 'Invoice', label: 'Faktury' },
  { value: 'PPD', label: 'PPD (Pokladní doklady)' },
  { value: 'CreditNote', label: 'Dobropisy' },
  { value: 'Booking', label: 'Rezervace' },
  { value: 'Patient', label: 'Pacienti' },
];

export default function NumberSeriesPage() {
  const [tab, setTab] = useState(0);
  const [selectedType, setSelectedType] = useState('Invoice');

  return (
    <Box maxWidth="lg" mx="auto">
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <NumbersIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Číselné řady</Typography>
          <Typography variant="body2" color="text.secondary">
            Generování a správa číselných řad pro doklady
          </Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Generátor" />
        <Tab label="Náhled" />
        <Tab label="Audit trail" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Typ dokumentu</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
              {DOCUMENT_TYPES.map((dt) => (
                <Box
                  key={dt.value}
                  onClick={() => setSelectedType(dt.value)}
                  sx={{
                    px: 2, py: 1, borderRadius: 2, cursor: 'pointer',
                    border: selectedType === dt.value ? '2px solid #0D7377' : '1px solid #ddd',
                    bgcolor: selectedType === dt.value ? '#E0F2F1' : 'transparent',
                    fontWeight: selectedType === dt.value ? 700 : 400,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#0D7377' },
                  }}
                >
                  {dt.label}
                </Box>
              ))}
            </Box>
            <NumberSeriesGenerator
              documentType={selectedType}
              onNumberGenerated={(num) => console.log('Generated:', num)}
            />
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <NumberSeriesPreview documentType={selectedType} />
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <NumberSeriesAuditTrail documentType={selectedType} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
