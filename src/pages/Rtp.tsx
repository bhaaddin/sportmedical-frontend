import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, LinearProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, Skeleton, Stack, IconButton,
} from '@mui/material';
import { Add, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { rtpApi, type RtpProtocol } from '../api/rtp';
import { PageHeader, SectionLabel, SoftCard, StatusChip, type ChipTone } from '../components/ui';
import toast from 'react-hot-toast';

const phaseLabels: Record<string, string> = {
  Acute: 'Akutní', Subacute: 'Subakutní', SportSpecific: 'Sportovní',
  ReturnToTraining: 'Návrat do tréninku', ReturnToPlay: 'Návrat do hry',
};

const phaseTones: Record<string, ChipTone> = {
  Acute: 'red', Subacute: 'beige', SportSpecific: 'blue',
  ReturnToTraining: 'grey', ReturnToPlay: 'green',
};

const phases = ['Acute', 'Subacute', 'SportSpecific', 'ReturnToTraining', 'ReturnToPlay'];

/* The five phases as a strip of pills; the current one is filled with the accent. */
function PhaseStrip({ active }: { active: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
      {phases.map((p, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <Box
            key={p}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.75,
              borderRadius: 999, px: 1.5, py: 0.5, fontSize: 13, fontWeight: 600,
              border: '1px solid',
              borderColor: current ? 'primary.main' : 'divider',
              bgcolor: current ? 'primary.main' : 'background.paper',
              color: current ? 'primary.contrastText' : done ? 'text.primary' : 'text.secondary',
            }}
          >
            {done && <CheckCircle sx={{ fontSize: 14, color: 'primary.main' }} />}
            {phaseLabels[p]}
          </Box>
        );
      })}
    </Stack>
  );
}

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
      toast.success('Milník dokončen');
    } catch { toast.error('Chyba při dokončování milníku'); }
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
      <PageHeader
        title="Návrat do hry"
        subtitle="Protokoly návratu do sportovního výkonu (RTP)"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
            Nový protokol
          </Button>
        }
      />

      {/* Patient ID input for loading protocols */}
      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Pacient</SectionLabel>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField fullWidth label="ID pacienta" value={form.patientId}
            onChange={e => update('patientId', e.target.value)} />
          <Button variant="contained" onClick={handlePatientLoad} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            Načíst protokoly
          </Button>
        </Stack>
      </SoftCard>

      {protocols.length === 0 ? (
        <SoftCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontWeight: 600 }}>Žádné protokoly</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Načtěte pacienta nebo vytvořte nový protokol návratu do hry.
          </Typography>
        </SoftCard>
      ) : (
        <Stack spacing={1.5}>
          {protocols.map((proto) => {
            const isSelected = selected?.id === proto.id;
            return (
              <SoftCard
                key={proto.id}
                onClick={() => setSelected(proto)}
                tone={isSelected ? 'soft' : 'plain'}
                sx={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'primary.main' : undefined,
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>{proto.name}</Typography>
                  <StatusChip tone={phaseTones[proto.currentPhase] ?? 'grey'}>
                    {phaseLabels[proto.currentPhase] || proto.currentPhase}
                  </StatusChip>
                </Stack>
                <LinearProgress variant="determinate" value={proto.progressPercent} sx={{ mb: 0.75 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{proto.progressPercent} % dokončeno</Typography>
              </SoftCard>
            );
          })}
        </Stack>
      )}

      {selected && (
        <SoftCard sx={{ mt: 2.5 }}>
          <SectionLabel>Protokol</SectionLabel>
          <Typography sx={{ fontSize: 17, fontWeight: 700, mb: 2 }}>{selected.name}</Typography>
          <PhaseStrip active={getActiveStep(selected)} />
          {phases.map(phase => {
            const phaseMilestones = selected.milestones.filter(m => m.phase === phase);
            if (phaseMilestones.length === 0) return null;
            return (
              <Box key={phase} sx={{ mb: 2.5 }}>
                <SectionLabel>{phaseLabels[phase]}</SectionLabel>
                {phaseMilestones.map(milestone => (
                  <Box
                    key={milestone.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, py: 1,
                      borderBottom: '1px solid', borderColor: 'divider',
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <IconButton
                      size="small"
                      aria-label={milestone.isCompleted ? 'Milník dokončen' : 'Dokončit milník'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!milestone.isCompleted) {
                          handleCompleteMilestone(selected.id, milestone.id);
                        }
                      }}
                    >
                      {milestone.isCompleted
                        ? <CheckCircle sx={{ color: 'primary.main', fontSize: 20 }} />
                        : <RadioButtonUnchecked sx={{ color: 'text.disabled', fontSize: 20 }} />
                      }
                    </IconButton>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, textDecoration: milestone.isCompleted ? 'line-through' : 'none', color: milestone.isCompleted ? 'text.secondary' : 'text.primary' }}>
                        {milestone.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{milestone.passCriteria}</Typography>
                    </Box>
                    {milestone.isCompleted && milestone.completedAt && (
                      <StatusChip tone="green" size="sm">Hotovo</StatusChip>
                    )}
                  </Box>
                ))}
              </Box>
            );
          })}
        </SoftCard>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nový RTP protokol</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="ID poranění (nepovinné)" value={form.injuryId} onChange={e => update('injuryId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Název protokolu" value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="např. Rehabilitace ACL, RTP po otřesu mozku" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate}>Vytvořit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
