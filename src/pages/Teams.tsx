import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Skeleton, List, ListItem, ListItemText, Divider, MenuItem, Autocomplete } from '@mui/material';
import { Group, Add, PersonAdd } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { teamsApi, type Team, type TeamDetail } from '../api/teams';
import { patientsApi, type Patient } from '../api/patients';
import toast from 'react-hot-toast';

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState({ name: '', sport: '', league: '', city: '', contactPerson: '', contactEmail: '', contactPhone: '' });
  const [memberForm, setMemberForm] = useState({ patientId: '', playerName: '', position: '', jerseyNumber: 0, dominantSide: 'Right' });

  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));
  const updateMember = (f: string, v: any) => setMemberForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    teamsApi.getAll()
      .then(setTeams)
      .catch(() => {})
      .finally(() => setLoading(false));
    patientsApi.getAll().then(setPatients).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.name) { toast.error('Zadejte název týmu'); return; }
    try {
      const newTeam = await teamsApi.create(form);
      setTeams(p => [...p, newTeam]);
      setOpen(false);
      toast.success('Tým vytvořen');
      setForm({ name: '', sport: '', league: '', city: '', contactPerson: '', contactEmail: '', contactPhone: '' });
    } catch { toast.error('Chyba při vytváření'); }
  };

  const handleAddMember = async () => {
    if (!selected || !memberForm.patientId || !memberForm.playerName) return;
    try {
      const member = await teamsApi.addMember(selected.id, {
        patientId: memberForm.patientId,
        playerName: memberForm.playerName,
        position: memberForm.position,
        jerseyNumber: memberForm.jerseyNumber,
        dominantSide: memberForm.dominantSide,
      });
      // Refresh team detail
      const detail = await teamsApi.getById(selected.id);
      setSelected(detail);
      // Update team in list
      setTeams(p => p.map(t => t.id === detail.id ? { ...t, playerCount: detail.members.length } : t));
      setMemberDialog(false);
      setSelectedPatient(null);
      setMemberForm({ patientId: '', playerName: '', position: '', jerseyNumber: 0, dominantSide: 'Right' });
      toast.success('Hráč přidán');
    } catch { toast.error('Chyba při přidávání hráče'); }
  };

  const handleSelectTeam = async (team: Team) => {
    try {
      const detail = await teamsApi.getById(team.id);
      setSelected(detail);
    } catch { toast.error('Chyba při načítání detailu'); }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3].map(i => <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}><Skeleton variant="rounded" height={150} sx={{ borderRadius: 3 }} /></Grid>)}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Group color="primary" /> Týmy a kluby
            </Typography>
            <Typography variant="body2" color="text.secondary">Správa sportovních týmů a hráčů</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
            Nový tým
          </Button>
        </Box>
      </motion.div>

      {teams.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8 }}><CardContent>
          <Group sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Žádné týmy</Typography>
          <Typography variant="body2" color="text.secondary">Vytvořte první sportovní tým</Typography>
        </CardContent></Card>
      ) : (
        <Grid container spacing={3}>
          {teams.map((team, i) => (
            <Grid key={team.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card sx={{ cursor: 'pointer', border: selected?.id === team.id ? '2px solid #0D7377' : 'none', transition: 'all 0.2s' }}
                  onClick={() => handleSelectTeam(team)}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{team.name}</Typography>
                    {team.sport && <Chip label={team.sport} size="small" sx={{ mt: 1, mb: 1 }} />}
                    <Typography variant="body2" color="text.secondary">
                      {team.league && `${team.league} • `}{team.city}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>{team.playerCount}</strong> hráčů • {team.contactPerson}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Team Detail */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{selected.name} — Soupiska</Typography>
                <Button variant="outlined" startIcon={<PersonAdd />} onClick={() => setMemberDialog(true)}
                  sx={{ borderColor: '#0D7377', color: '#0D7377', borderRadius: 2 }}>
                  Přidat hráče
                </Button>
              </Box>
              {selected.members.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  Žádní hráči v týmu
                </Typography>
              ) : (
                <List>
                  {selected.members.map((member, i) => (
                    <div key={member.id}>
                      <ListItem>
                        <ListItemText
                          primary={`${member.jerseyNumber ? `#${member.jerseyNumber} ` : ''}${member.playerName}`}
                          secondary={`${member.position || '—'} • ${member.dominantSide === 'Right' ? 'Pravák' : member.dominantSide === 'Left' ? 'Levák' : 'Obouruký'}`}
                        />
                      </ListItem>
                      {i < selected.members.length - 1 && <Divider />}
                    </div>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nový tým</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Název týmu" value={form.name} onChange={e => update('name', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Sport" value={form.sport} onChange={e => update('sport', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Liga" value={form.league} onChange={e => update('league', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Město" value={form.city} onChange={e => update('city', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Kontaktní osoba" value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Email" value={form.contactEmail} onChange={e => update('contactEmail', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Telefon" value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} sx={{ bgcolor: '#0D7377' }}>Vytvořit</Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialog} onClose={() => setMemberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Přidat hráče do týmu</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                options={patients}
                getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.id.slice(0, 8)}…)`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedPatient}
                onChange={(_, newValue) => {
                  setSelectedPatient(newValue);
                  updateMember('patientId', newValue?.id || '');
                }}
                renderInput={(params) => (
                  <TextField {...params} fullWidth required label="Pacient" placeholder="Hledejte pacienta..." />
                )}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Jméno hráče" value={memberForm.playerName} onChange={e => updateMember('playerName', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Pozice" value={memberForm.position} onChange={e => updateMember('position', e.target.value)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Číslo dresu" value={memberForm.jerseyNumber || ''} onChange={e => updateMember('jerseyNumber', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth select label="Dominantní" value={memberForm.dominantSide} onChange={e => updateMember('dominantSide', e.target.value)}>
                <MenuItem value="Right">Pravák</MenuItem>
                <MenuItem value="Left">Levák</MenuItem>
                <MenuItem value="Ambidextrous">Obouruký</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialog(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleAddMember} sx={{ bgcolor: '#0D7377' }}>Přidat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
