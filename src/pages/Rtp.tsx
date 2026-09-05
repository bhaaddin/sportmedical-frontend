import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, LinearProgress, Chip, Step, StepLabel,
  Stepper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Skeleton,
} from '@mui/material';
import { Add, CheckCircle, RadioButtonUnchecked, Flag, Healing } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { rtpApi, type RtpProtocol, type RtpMilestone } from '../api/rtp';
import toast from 'react-hot-toast';

const phaseLabels: Record<string, string> = {
  Acute: 'Akutní', Subacute: 'Subakutní', SportSpecific: 'Sportovní',
  ReturnToTraining: 'Návrat do tréninku', ReturnToPlay: 'Návrat do hry',
};

const phaseColors: Record<string, string> = {
  Acute: '#D32F2F', Subacute: '#ED6C02', SportSpecific: '#0288D1',
  ReturnToTraining: '#7B1FA2', ReturnToPlay: '#2E7D32',
};

const phases = ['Acute', 'Subacute', 'SportSpecific', 'ReturnToTraining', 'ReturnToPlay'];

export default function Rtp() {
  const [protocols, setProtocols] = useState<RtpProtocol[]>([]);
  const [selected, setSelected] = useState<RtpProtocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', injuryId: '', name: '' });

  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    // We'll load all protocols when a patient is selected
    setLoading(false);
  }, []);

  const handlePatientLoad = async () => {
    if (!form.patientId) { toast.error('Zadejte ID pacienta'); return; }
    try {
      const protos = await rtpApi.getByPatient(form.patientId);
      setProtocols(protos);
    } catch { toast.error('Chyba při načítání protokolů'); }
  };

  const handleCreate = async () => {
    if (!form.patientId || !form.name) { toast.error('Vyplňte pacienta a název'); return; }
    try {
      const newProtocol = await rtpApi.create({
        patientId: form.patientId,
        injuryId: form.injuryId || '00000000-0000-0000-0000-000000000000',
        name: form.name,
      });
      setProtocols(p => [newProtocol, ...p]);
      setOpen(false);
      toast.success('Protokol vytvořen');
      setForm({ patientId: form.patientId, injuryId: '', name: '' });
    } catch { toast.error('Chyba při vytváření'); }
  };

  const handleCompleteMilestone = async (protocolId: string, milestoneId: string) => {
    try {
      await rtpApi.completeMilestone(protocolId, milestoneId, {});
      // Refresh the selected protocol
      const updated = await rtpApi.getById(protocolId);
      setSelected(updated);
      setProtocols(p => p.map(proto => proto.id === protocolId ? updated : proto));
      toast.success('Milestone dokončen!');
    } catch { toast.error('Chyba při dokončování milestone'); }
  };

  const getActiveStep = (protocol: RtpProtocol) => {
    const currentIdx = phases.indexOf(protocol.currentPhase);
    return currentIdx >= 0 ? currentIdx : 0;
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Flag color="primary" /> Návrat do hry (RTP)
            </Typography>
            <Typography variant="body2" color="text.secondary">Protokoly návratu do sportovního výkonu</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3 }}>
            Nový protokol
          </Button>
        </Box>
      </motion.div>

      {/* Patient ID input for loading protocols */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 8 }}>
              <TextField fullWidth label="ID pacienta" value={form.patientId}
                onChange={e => update('patientId', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Button fullWidth variant="contained" onClick={handlePatientLoad}
                sx={{ bgcolor: '#0D7377', py: 1.5 }}>
                Načíst protokoly
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {protocols.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Flag sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Žádné protokoly</Typography>
            <Typography variant="body2" color="text.secondary">Vytvořte nový protokol návratu do hry</Typography>
          </CardContent>
        </Card>
      ) : (
        protocols.map((proto, i) => (
          <motion.div key={proto.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card sx={{ mb: 2, cursor: 'pointer', border: selected?.id === proto.id ? '2px solid #0D7377' : 'none' }}
              onClick={() => setSelected(proto)}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{proto.name}</Typography>
                  <Chip label={phaseLabels[proto.currentPhase] || proto.currentPhase} size="small"
                    sx={{ bgcolor: `${phaseColors[proto.currentPhase] || '#666'}18`, color: phaseColors[proto.currentPhase] || '#666' }} />
                </Box>
                <LinearProgress variant="determinate" value={proto.progressPercent}
                  sx={{ height: 8, borderRadius: 4, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">{proto.progressPercent}% dokončeno</Typography>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}

      {selected && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Healing sx={{ color: '#0D7377' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{selected.name} — Protokol</Typography>
              </Box>
              <Stepper activeStep={getActiveStep(selected)} alternativeLabel sx={{ mb: 3 }}>
                {phases.map(p => (
                  <Step key={p}><StepLabel>{phaseLabels[p]}</StepLabel></Step>
                ))}
              </Stepper>
              {phases.map(phase => {
                const phaseMilestones = selected.milestones.filter(m => m.phase === phase);
                if (phaseMilestones.length === 0) return null;
                return (
                  <Box key={phase} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: phaseColors[phase], fontWeight: 600, mb: 1 }}>
                      {phaseLabels[phase]}
                    </Typography>
                    {phaseMilestones.map(milestone => (
                      <Box key={milestone.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, pl: 2 }}>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!milestone.isCompleted) {
                              handleCompleteMilestone(selected.id, milestone.id);
                            }
                          }}
                          sx={{ minWidth: 'auto', p: 0 }}
                        >
                          {milestone.isCompleted
                            ? <CheckCircle sx={{ color: '#2E7D32', fontSize: 20 }} />
                            : <RadioButtonUnchecked sx={{ color: '#999', fontSize: 20 }} />
                          }
                        </Button>
                        <Box>
                          <Typography variant="body2" sx={{ textDecoration: milestone.isCompleted ? 'line-through' : 'none', opacity: milestone.isCompleted ? 0.6 : 1 }}>
                            {milestone.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{milestone.passCriteria}</Typography>
                        </Box>
                        {milestone.isCompleted && milestone.completedAt && (
                          <Chip label="Hotovo" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', ml: 'auto' }} />
                        )}
                      </Box>
                    ))}
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nový RTP protokol</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="ID poranění (nepovinné)" value={form.injuryId} onChange={e => update('injuryId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Název protokolu" value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="např. ACL Rehabilitation, Concussion RTP" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} sx={{ bgcolor: '#0D7377' }}>Vytvořit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
