import { useState } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, LinearProgress, Chip, Alert } from '@mui/material';
import { Psychology, Warning, CheckCircle } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { aiApi, type RiskAssessment } from '../api/ai';
import toast from 'react-hot-toast';

const riskColors: Record<string, string> = { Low: '#2E7D32', Moderate: '#ED6C02', High: '#D32F2F', Critical: '#B71C1C' };

export default function AiRisk() {
  const [patientId, setPatientId] = useState('');
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAssess = async () => {
    if (!patientId) { toast.error('Zadejte ID pacienta'); return; }
    setLoading(true);
    try {
      const result = await aiApi.getRisk(patientId);
      setAssessment(result);
    } catch { toast.error('Chyba při hodnocení rizika'); }
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Psychology color="primary" /> AI Předpověď rizika zranění
        </Typography>
      </motion.div>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 8 }}><TextField fullWidth label="ID pacienta" value={patientId} onChange={e => setPatientId(e.target.value)} /></Grid>
            <Grid size={{ xs: 4 }}><Button fullWidth variant="contained" onClick={handleAssess} disabled={loading}
              sx={{ bgcolor: '#0D7377', py: 1.5 }}>{loading ? 'Hodnotím...' : 'Vyhodnotit riziko'}</Button></Grid>
          </Grid>
        </CardContent>
      </Card>

      {assessment && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ height: 8, bgcolor: riskColors[assessment.riskLevel] || '#666' }} />
            <CardContent>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h1" sx={{ fontWeight: 800, color: riskColors[assessment.riskLevel] }}>{assessment.overallRiskScore}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>{assessment.riskLevel}</Typography>
              </Box>
              <Alert severity={assessment.riskLevel === 'Low' ? 'success' : assessment.riskLevel === 'Moderate' ? 'warning' : 'error'} sx={{ mb: 2 }}>
                {assessment.recommendation}
              </Alert>
              {assessment.requiresPractitionerReview && <Alert severity="error" sx={{ mb: 2 }}>Vyžaduje přezkum praktikem!</Alert>}
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Faktory rizika</Typography>
              {assessment.factors.map((f, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0f0f0' }}>
                  <Box><Typography sx={{ fontWeight: 500 }}>{f.category}</Typography><Typography variant="body2" color="text.secondary">{f.description}</Typography></Box>
                  <Chip label={`${f.impact}%`} size="small" sx={{ bgcolor: `${riskColors[assessment.riskLevel]}18`, color: riskColors[assessment.riskLevel] }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Box>
  );
}
