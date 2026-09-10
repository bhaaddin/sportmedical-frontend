import { useState } from 'react';
import {
  Box, Typography, Paper, Avatar, Divider, List, ListItem, ListItemIcon, ListItemText,
  Switch, TextField, Button, Grid, Card, CardContent, Snackbar, Alert, MenuItem,
} from '@mui/material';
import { Person, Security, Palette, Info, Logout, Save, DarkMode, LightMode, Notifications, Email, Phone, CalendarMonth, Timer, Schedule } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const sectionVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

export default function Settings() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [email, setEmail] = useState(user.email || '');

  const handleDarkModeToggle = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const updatedUser = { ...user, firstName, lastName, email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSaving(false);
      setSaved(true);
    }, 800);
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Nastavení</Typography>
      </motion.div>

      <motion.div custom={0} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 80, background: 'linear-gradient(135deg, #0D7377 0%, #14A3A8 50%, #1A1A2E 100%)' }} />
          <CardContent sx={{ pt: 0, mt: -4 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: '#0D7377', width: 72, height: 72, fontSize: 28, border: '4px solid white', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </Avatar>
              <Box sx={{ pb: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{user.firstName} {user.lastName}</Typography>
                <Typography color="text.secondary">{user.email}</Typography>
                <Typography variant="caption" sx={{ bgcolor: '#0D737718', color: '#0D7377', px: 1, py: 0.3, borderRadius: 1, fontWeight: 600 }}>
                  {user.role || 'Praktik'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={1} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Person sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Upravit profil</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Jméno" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Příjmení" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="E-mail" value={email} type="email"
                  onChange={e => setEmail(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
            </Grid>
            <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}
              sx={{ mt: 3, bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600, boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
              {saving ? 'Ukládání...' : 'Uložit změny'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={2} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Palette sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Vzhled</Typography>
            </Box>
            <List sx={{ p: 0 }}>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon>{darkMode ? <DarkMode /> : <LightMode />}</ListItemIcon>
                <ListItemText primary="Tmavý režim" secondary="Přepnout mezi světlým a tmavým motivem" />
                <Switch checked={darkMode} onChange={handleDarkModeToggle}
                  color="primary" sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="Primární barva"
                  secondary="Vyberte barvu aplikace"
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { color: '#0D7377', label: 'Teal' },
                    { color: '#1565C0', label: 'Modrá' },
                    { color: '#2E7D32', label: 'Zelená' },
                    { color: '#7B1FA2', label: 'Fialová' },
                    { color: '#D32F2F', label: 'Červená' },
                    { color: '#E65100', label: 'Oranžová' },
                  ].map(c => (
                    <Box key={c.color} sx={{
                      width: 32, height: 32, borderRadius: '50%', bgcolor: c.color, cursor: 'pointer',
                      border: '3px solid transparent', '&:hover': { transform: 'scale(1.15)' },
                      transition: 'transform 0.2s',
                    }} title={c.label} />
                  ))}
                </Box>
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Velikost písma" secondary="Nastavte velikost textu v aplikaci" />
                <TextField select defaultValue="medium" size="small" sx={{ width: 140 }}>
                  <MenuItem value="small">Malé</MenuItem>
                  <MenuItem value="medium">Střední</MenuItem>
                  <MenuItem value="large">Velké</MenuItem>
                </TextField>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={3} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <CalendarMonth sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Kalendář</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Výchozí délka termínu" defaultValue="60"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                  <MenuItem value="15">15 minut</MenuItem>
                  <MenuItem value="30">30 minut</MenuItem>
                  <MenuItem value="45">45 minut</MenuItem>
                  <MenuItem value="60">1 hodina</MenuItem>
                  <MenuItem value="90">1,5 hodiny</MenuItem>
                  <MenuItem value="120">2 hodiny</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Buffer mezi termíny" defaultValue="15"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                  <MenuItem value="0">Žádný buffer</MenuItem>
                  <MenuItem value="5">5 minut</MenuItem>
                  <MenuItem value="10">10 minut</MenuItem>
                  <MenuItem value="15">15 minut</MenuItem>
                  <MenuItem value="30">30 minut</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Začátek pracovní doby" type="time" defaultValue="08:00"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Konec pracovní doby" type="time" defaultValue="17:00"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
            </Grid>
            <Button variant="contained" startIcon={<Save />} sx={{ mt: 3, bgcolor: '#0D7377', borderRadius: 2, px: 3 }}>
              Uložit kalendář
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={4} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Notifications sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Oznámení</Typography>
            </Box>
            <List sx={{ p: 0 }}>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon><Notifications /></ListItemIcon>
                <ListItemText primary="Push oznámení" secondary="Přijímat oznámení v prohlížeči" />
                <Switch checked={notifications} onChange={e => setNotifications(e.target.checked)} color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon><Email /></ListItemIcon>
                <ListItemText primary="E-mailová upozornění" secondary="Upozornění e-mailem na kritické nálezy" />
                <Switch checked={emailAlerts} onChange={e => setEmailAlerts(e.target.checked)} color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon><Phone /></ListItemIcon>
                <ListItemText primary="SMS upozornění" secondary="Textové zprávy pro urgentní případy" />
                <Switch checked={smsAlerts} onChange={e => setSmsAlerts(e.target.checked)} color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={4} variants={sectionVariant} initial="hidden" animate="visible">
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Email sx={{ color: '#0D7377' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Automatizace a emaily</Typography>
            </Box>
            <List sx={{ p: 0 }}>
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Automatické potvrzení termínů" secondary="Odesílat email s ICS kalendářovou přílohou při vytvoření termínu" />
                <Switch defaultChecked color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Automatické pozvánky na kontrolu" secondary="Odesílat pozvánky na kontrolu 1, 3, 6 a 8 měsíců po poslední návštěvě" />
                <Switch defaultChecked color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Odesílání PDF reportů" secondary="Automaticky odesílat PDF report po diagnostické relaci" />
                <Switch defaultChecked color="primary"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
              </ListItem>
              <Divider />
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Časový rozvrh pracovních dnů" secondary="Nastavení pracovních dnů pro každého zaměstnance" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={5} variants={sectionVariant} initial="hidden" animate="visible">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Security sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Bezpečnost</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  <ListItem sx={{ px: 0, cursor: 'pointer' }}>
                    <ListItemText primary="Změnit heslo" secondary="Aktualizovat heslo účtu" />
                  </ListItem>
                  <Divider />
                  <ListItem sx={{ px: 0, cursor: 'pointer' }}>
                    <ListItemText primary="Dvoufaktorové ověření" secondary="Přidat další vrstvu zabezpečení" />
                  </ListItem>
                  <Divider />
                  <ListItem sx={{ px: 0, cursor: 'pointer' }}>
                    <ListItemText primary="Aktivní relace" secondary="Spravovat aktivní přihlášení" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Info sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>O aplikaci</Typography>
                </Box>
                <Box sx={{ py: 1 }}>
                  {[
                    ['Aplikace', 'SportMedical Diagnostics'],
                    ['Verze', '1.0.0'],
                    ['Framework', 'React + Vite + TypeScript'],
                    ['Backend', '.NET 10 + PostgreSQL'],
                  ].map(([label, value]) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </motion.div>

      <motion.div custom={5} variants={sectionVariant} initial="hidden" animate="visible">
        <Paper sx={{ mt: 3, p: 2, borderRadius: 3, textAlign: 'center' }}>
          <Button startIcon={<Logout />} onClick={handleLogout} color="error" sx={{ fontWeight: 600, px: 4 }}>
            Odhlásit se
          </Button>
        </Paper>
      </motion.div>

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>Profil uložen!</Alert>
      </Snackbar>
    </Box>
  );
}
