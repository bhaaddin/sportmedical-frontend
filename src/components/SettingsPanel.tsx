/* ══════════════════════════════════════════════════════════════
   SETTINGS PANEL
   Tabs: Appearance, Calendar, Billing, User Management
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Switch, TextField,
  Button, Grid, Chip, Slider, Divider, List, ListItem, ListItemText,
  ListItemSecondaryAction, IconButton, Tooltip,
  MenuItem,
} from '@mui/material';
import {
  Palette, CalendarMonth, Receipt, People, Delete, Edit, Add, RestartAlt,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { PRESETS as CALENDAR_PRESETS } from '../pages/Calendar';
import { ALL_ROLES, ALL_PERMISSIONS, roleHasPermission, type Permission } from '../auth/rbac';

const FONT_SIZES = [
  { label: 'Malý', value: 13 },
  { label: 'Střední', value: 14 },
  { label: 'Velký', value: 16 },
];

export default function SettingsPanel() {
  const [tab, setTab] = useState(0);
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Nastavení</Typography>

      <Grid container spacing={3}>
        {/* Left nav */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <Tabs
              orientation="vertical"
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{ '& .MuiTab-root': { justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600, minHeight: 48 } }}
            >
              <Tab icon={<Palette />} iconPosition="start" label="Vzhled" />
              <Tab icon={<CalendarMonth />} iconPosition="start" label="Kalendář" />
              <Tab icon={<Receipt />} iconPosition="start" label="Fakturace" />
              <Tab icon={<People />} iconPosition="start" label="Uživatelé" />
            </Tabs>
          </Card>
        </Grid>

        {/* Content */}
        <Grid size={{ xs: 12, md: 9 }}>
          {/* ── Appearance ── */}
          {tab === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Motiv</Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    {[
                      { mode: 'light' as const, label: 'Světlý', preview: '#F8FAFC' },
                      { mode: 'dark' as const, label: 'Tmavý', preview: '#0F172A' },
                    ].map(m => (
                      <Card key={m.mode} onClick={() => useAppStore.getState().setTheme(m.mode)} sx={{
                        flex: 1, cursor: 'pointer', textAlign: 'center', p: 2,
                        border: theme === m.mode ? '3px solid #0D7377' : '2px solid #e0e0e0',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: '#0D7377' },
                      }}>
                        <Box sx={{ width: 60, height: 40, bgcolor: m.preview, borderRadius: 1, mx: 'auto', mb: 1, border: '1px solid #e0e0e0' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.label}</Typography>
                      </Card>
                    ))}
                  </Box>

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Velikost písma</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {FONT_SIZES.map(fs => (
                      <Chip key={fs.value} label={fs.label} size="small" variant="outlined" clickable
                        sx={{ '&:hover': { bgcolor: '#E0F2F1' } }} />
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Kompaktní režim</Typography>
                      <Typography variant="caption" color="text.secondary">Menší padding, více dat na obrazovce</Typography>
                    </Box>
                    <Switch />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Zmenšit postranní panel</Typography>
                      <Typography variant="caption" color="text.secondary">Skrýt text, zobrazit jen ikony</Typography>
                    </Box>
                    <Switch checked={sidebarCollapsed} onChange={toggleSidebar} />
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Calendar Settings ── */}
          {tab === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Kalendář</Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField fullWidth size="small" label="Začátek dne" type="time" defaultValue="06:00"
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField fullWidth size="small" label="Konec dne" type="time" defaultValue="22:00"
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Rychlé presety
                    <Tooltip title="Upravit presety pro rychlé vytváření termínů">
                      <IconButton size="small"><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {CALENDAR_PRESETS.map(p => (
                      <Chip key={p.minutes} label={`${p.minutes} min`} size="small"
                        sx={{ bgcolor: '#0D737714', color: '#0D7377', fontWeight: 600 }} />
                    ))}
                    <Chip label="+" size="small" variant="outlined" sx={{ cursor: 'pointer' }} />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Výchozí chování při kliknutí</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {['Otevřít presety', 'Drag-to-create', 'Manuální vstup'].map((opt, i) => (
                      <Chip key={opt} label={opt} size="small" variant={i === 0 ? 'filled' : 'outlined'}
                        clickable sx={i === 0 ? { bgcolor: '#0D7377', color: '#fff' } : {}} />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Billing Settings ── */}
          {tab === 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Fakturace</Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Automatické odesílání</Typography>
                      <Typography variant="caption" color="text.secondary">Automaticky odeslat faktury po vytvoření</Typography>
                    </Box>
                    <Switch />
                  </Box>

                  <TextField fullWidth select size="small" label="Výchozí pojišťovna" defaultValue="111" sx={{ mb: 2 }}>
                    <MenuItem value="111">111 — VZP</MenuItem>
                    <MenuItem value="201">201 — VOZP</MenuItem>
                    <MenuItem value="205">205 — ČPZP</MenuItem>
                    <MenuItem value="207">207 — OZP</MenuItem>
                  </TextField>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Pravidla dávkového zpracování</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Maximální počet faktur v jedné dávce:
                  </Typography>
                  <Slider defaultValue={100} min={10} max={500} step={10}
                    valueLabelDisplay="auto" marks={[
                      { value: 10, label: '10' },
                      { value: 250, label: '250' },
                      { value: 500, label: '500' },
                    ]} sx={{ color: '#0D7377' }} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── User Management (Admin only) ── */}
          {tab === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Správa oprávnění</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Přehled oprávnění podle rolí. Kliknutím přepnete oprávnění pro roli.
                  </Typography>

                  {/* Role × Permission matrix */}
                  <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #e0e0e0', fontWeight: 700 }}>Oprávnění</th>
                          {ALL_ROLES.map(r => (
                            <th key={r} style={{ textAlign: 'center', padding: 8, borderBottom: '2px solid #e0e0e0', fontWeight: 700, minWidth: 70 }}>
                              {r}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_PERMISSIONS.map(perm => (
                          <tr key={perm.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 500 }}>
                              {perm.label}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>
                                {perm.category}
                              </Typography>
                            </td>
                            {ALL_ROLES.map(r => (
                              <td key={r} style={{ textAlign: 'center', padding: 6 }}>
                                <Switch size="small" checked={roleHasPermission(r, perm.key)}
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
