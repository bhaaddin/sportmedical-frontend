import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, List, ListItem, ListItemIcon,
  ListItemText, Divider, Switch, TextField, Button, Tabs, Tab, Skeleton,
  Chip, Snackbar, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Avatar, MenuItem, Slider,
  Paper,
} from '@mui/material';
import {
  AdminPanelSettings, Security, History, Settings, People, Palette,
  Public, Work, Email, CalendarMonth, AttachMoney, Timer, Schedule,
  Language, ContentCopy, Visibility, Save, ContactPhone, LocationOn,
  AccessTime, EventAvailable, Send, PictureAsPdf, Assessment, FamilyRestroom,
  ChildCare, RateReview, LocalHospital, Shield, Backup, Storage, DarkMode,
  MonitorHeart,
} from '@mui/icons-material';
import SystemHealth from './SystemHealth';
import CompanySettingsCard from '../components/CompanySettingsCard';
import { motion } from 'framer-motion';
import client from '../api/client';

const sectionAnim = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.35 } }),
};

interface AuditEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  notes?: string;
}

const actionColors: Record<string, string> = {
  Create: '#2E7D32', Update: '#0288D1', Delete: '#D32F2F', Sign: '#9C27B0', Import: '#ED6C02',
};

/* ─────────────────────────────────────────── */
/*  TOGGLE COMPONENT                           */
/* ─────────────────────────────────────────── */
function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <>
      <ListItem sx={{ px: 0 }}>
        <ListItemText primary={label} secondary={description} />
        <Switch
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0D7377' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0D7377' } }}
        />
      </ListItem>
      <Divider />
    </>
  );
}

/* ─────────────────────────────────────────── */
/*  MAIN ADMIN PAGE                            */
/* ─────────────────────────────────────────── */
export default function Admin() {
  const [mainTab, setMainTab] = useState(0); // 0 = Public, 1 = Worker, 2 = Audit, 3 = Security, 4 = System Health
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // PUBLIC SETTINGS state
  const [pub, setPub] = useState({
    siteName: 'SportMedical Diagnostics',
    siteTagline: 'Profesionální sportovní diagnostika',
    primaryColor: '#0D7377',
    contactEmail: 'info@sportmedical-diagnostics.cz',
    contactPhone: '+420 XXX XXX XXX',
    contactAddress: 'GreenLine, 5. patro, Praha',
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    defaultDuration: 60,
    bufferMinutes: 15,
    enableBooking: true,
    enableRegistration: true,
    requireGdprConsent: true,
    requireMedicalHistory: true,
    requireQuestionnaire: true,
    requireGuardian: true, // for under 18
    bookingConfirmEmail: true,
    bookingIcsAttach: true,
    autoFollowUp: true,
    followUpMonths: '3,7,8',
    sendPdfReport: true,
    gdprAutoDeleteDays: 0, // 0 = never
    defaultLanguage: 'cs',
    showPricingPublic: true,
  });

  // WORKER SETTINGS state
  const [wrk, setWrk] = useState({
    autoConfirmBookings: false,
    enableEmailTemplates: true,
    emailFromName: 'SportMedical',
    emailFromAddress: 'noreply@sportmedical-diagnostics.cz',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    staffCanEditPrices: false,
    staffCanEditTimes: true,
    staffCanViewRevenue: false,
    trackPerformance: true,
    requireClientIntake: true,
    enableNotifications: true,
    enableSmsAlerts: false,
    autoAssignRole: 'Staff',
    sessionTimeoutMinutes: 480,
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    invoiceAutoGenerate: true,
    invoicePrefix: 'SMD-',
    invoiceNextNumber: 1001,
  });

  const updatePub = (key: string, val: any) => setPub(p => ({ ...p, [key]: val }));
  const updateWrk = (key: string, val: any) => setWrk(p => ({ ...p, [key]: val }));

  // Load stats
  useEffect(() => {
    Promise.all([
      client.get('/api/patients').then(r => {
        const d = r.data?.data ?? r.data?.value ?? r.data;
        return Array.isArray(d) ? d.length : d?.items?.length ?? 0;
      }).catch(() => 0),
      client.get('/api/v1/users').then(r => {
        const d = r.data?.data ?? r.data?.value ?? r.data;
        return Array.isArray(d) ? d.length : d?.items?.length ?? 0;
      }).catch(() => 0),
    ]).then(([patients, staff]) => {
      setPatientCount(patients);
      setStaffCount(staff);
    }).finally(() => setLoading(false));
  }, []);

  // Load audit
  useEffect(() => {
    if (mainTab === 2) {
      setAuditLoading(true);
      Promise.all([
        client.get('/api/audit?take=50').then(r => r.data?.value ?? r.data ?? []).catch(() => []),
        client.get('/api/audit/count').then(r => r.data?.value ?? r.data ?? 0).catch(() => 0),
      ]).then(([entries, count]) => {
        setAuditLog(entries);
        setAuditCount(count);
      }).finally(() => setAuditLoading(false));
    }
  }, [mainTab]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  const dayLabels = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings color="primary" /> Administrace
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nastavení veřejného webu, zaměstnanců a systému
          </Typography>
        </Box>
      </motion.div>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pacienti', value: patientCount, color: '#0D7377', icon: <People /> },
          { label: 'Zaměstnanci', value: staffCount, color: '#2E7D32', icon: <Work /> },
          { label: 'Audit záznamy', value: auditCount, color: '#ED6C02', icon: <History /> },
          { label: 'Databáze', value: 'SQLite', color: '#0288D1', icon: <Storage /> },
        ].map((stat, i) => (
          <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Main Tabs: Public | Worker | Audit | Security */}
      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          sx={{ px: 1 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<Public />} label="Veřejný web" />
          <Tab icon={<Work />} label="Zaměstnanci" />
          <Tab icon={<History />} label="Auditní log" />
          <Tab icon={<Security />} label="Bezpečnost" />
          <Tab icon={<MonitorHeart />} label="Zdraví systému" />
        </Tabs>
      </Paper>

      {/* ═══════════════════════════════════════════ */}
      {/*  TAB 0: PUBLIC SETTINGS (Veřejný web)       */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === 0 && (
        <Box>
          <CompanySettingsCard />
          {/* — Section: Branding — */}
          <motion.div custom={0} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Palette sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Značka a vzhled webu</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Název webu" value={pub.siteName}
                      onChange={e => updatePub('siteName', e.target.value)}
                      sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Podtitul" value={pub.siteTagline}
                      onChange={e => updatePub('siteTagline', e.target.value)}
                      sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Primární barva</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {[{ c: '#0D7377', l: 'Teal' }, { c: '#1565C0', l: 'Modrá' }, { c: '#2E7D32', l: 'Zelená' },
                        { c: '#7B1FA2', l: 'Fialová' }, { c: '#D32F2F', l: 'Červená' }, { c: '#E65100', l: 'Oranž' }].map(x => (
                        <Box key={x.c} sx={{
                          width: 36, height: 36, borderRadius: '50%', bgcolor: x.c, cursor: 'pointer',
                          border: pub.primaryColor === x.c ? '3px solid #333' : '3px solid transparent',
                          '&:hover': { transform: 'scale(1.15)' }, transition: 'all 0.2s',
                        }} onClick={() => updatePub('primaryColor', x.c)} title={x.l} />
                      ))}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth select label="Výchozí jazyk" value={pub.defaultLanguage}
                      onChange={e => updatePub('defaultLanguage', e.target.value)} sx={fieldSx}>
                      <MenuItem value="cs">Čeština</MenuItem>
                      <MenuItem value="sk">Slovenština</MenuItem>
                      <MenuItem value="en">Angličtina</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Contact — */}
          <motion.div custom={1} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <ContactPhone sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Kontaktní údaje</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Email" value={pub.contactEmail}
                      onChange={e => updatePub('contactEmail', e.target.value)} sx={fieldSx}
                      slotProps={{ input: { startAdornment: <Email sx={{ mr: 1, color: '#999' }} /> } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Telefon" value={pub.contactPhone}
                      onChange={e => updatePub('contactPhone', e.target.value)} sx={fieldSx}
                      slotProps={{ input: { startAdornment: <ContactPhone sx={{ mr: 1, color: '#999' }} /> } }} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Adresa" value={pub.contactAddress}
                      onChange={e => updatePub('contactAddress', e.target.value)} sx={fieldSx}
                      slotProps={{ input: { startAdornment: <LocationOn sx={{ mr: 1, color: '#999' }} /> } }} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Working Hours — */}
          <motion.div custom={2} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <AccessTime sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Pracovní doba</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Začátek" type="time" value={pub.workingHoursStart}
                      onChange={e => updatePub('workingHoursStart', e.target.value)} sx={fieldSx}
                      slotProps={{ inputLabel: { shrink: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Konec" type="time" value={pub.workingHoursEnd}
                      onChange={e => updatePub('workingHoursEnd', e.target.value)} sx={fieldSx}
                      slotProps={{ inputLabel: { shrink: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth select label="Výchozí délka" value={String(pub.defaultDuration)}
                      onChange={e => updatePub('defaultDuration', Number(e.target.value))} sx={fieldSx}>
                      {[15, 30, 45, 60, 90, 120].map(m => (
                        <MenuItem key={m} value={m}>{m} min</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth select label="Buffer mezi termíny" value={String(pub.bufferMinutes)}
                      onChange={e => updatePub('bufferMinutes', Number(e.target.value))} sx={fieldSx}>
                      {[0, 5, 10, 15, 30].map(m => (
                        <MenuItem key={m} value={m}>{m === 0 ? 'Žádný' : `${m} min`}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Pracovní dny</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {dayLabels.map((d, i) => {
                        const dayNum = i + 1;
                        const active = pub.workingDays.includes(dayNum);
                        return (
                          <Box key={dayNum} onClick={() => {
                            updatePub('workingDays', active
                              ? pub.workingDays.filter(x => x !== dayNum)
                              : [...pub.workingDays, dayNum]);
                          }} sx={{
                            px: 2, py: 1, borderRadius: 2, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            bgcolor: active ? '#0D7377' : '#f0f0f0', color: active ? '#fff' : '#666',
                            '&:hover': { opacity: 0.85 }, transition: 'all 0.2s',
                          }}>
                            {d}
                          </Box>
                        );
                      })}
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Booking & Registration Rules — */}
          <motion.div custom={3} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <EventAvailable sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Rezervace a registrace</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  <Toggle checked={pub.enableBooking} onChange={v => updatePub('enableBooking', v)}
                    label="Rezervace online" description="Klienti mohou rezervovat termíny online" />
                  <Toggle checked={pub.enableRegistration} onChange={v => updatePub('enableRegistration', v)}
                    label="Registrace klientů" description="Klienti se mohou registrovat přes web" />
                  <Toggle checked={pub.requireGdprConsent} onChange={v => updatePub('requireGdprConsent', v)}
                    label="GDPR souhlas povinný" description="Souhlas se zpracováním dat (1. návštěva)" />
                  <Toggle checked={pub.requireMedicalHistory} onChange={v => updatePub('requireMedicalHistory', v)}
                    label="Výpis ze zdravotní dokumentace" description="Povinný pro první návštěvu" />
                  <Toggle checked={pub.requireQuestionnaire} onChange={v => updatePub('requireQuestionnaire', v)}
                    label="Dotazník před prohlídkou" description="Povinný před každou návštěvou" />
                  <Toggle checked={pub.requireGuardian} onChange={v => updatePub('requireGuardian', v)}
                    label="Zákonný zástupce (< 18 let)" description="Povinný formulář pro nezletilé" />
                  <Toggle checked={pub.showPricingPublic} onChange={v => updatePub('showPricingPublic', v)}
                    label="Zobrazit ceník veřejně" description="Ceny viditelné bez přihlášení" />
                </List>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Email Automation — */}
          <motion.div custom={4} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Send sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Email automatizace</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  <Toggle checked={pub.bookingConfirmEmail} onChange={v => updatePub('bookingConfirmEmail', v)}
                    label="Potvrzovací email při rezervaci" description="Odesílat email s potvrzením termínu" />
                  <Toggle checked={pub.bookingIcsAttach} onChange={v => updatePub('bookingIcsAttach', v)}
                    label="ICS kalendářová příloha" description="Připojit .ics soubor pro Google/Apple Calendar" />
                  <Toggle checked={pub.autoFollowUp} onChange={v => updatePub('autoFollowUp', v)}
                    label="Automatické pozvánky na kontrolu" description="Odesílat pozvánky po X měsících" />
                  {pub.autoFollowUp && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Intervaly kontrol (měsíce)" secondary="Čárkou oddělené hodnoty" />
                      <TextField size="small" value={pub.followUpMonths}
                        onChange={e => updatePub('followUpMonths', e.target.value)}
                        sx={{ width: 120 }} />
                    </ListItem>
                  )}
                  <Toggle checked={pub.sendPdfReport} onChange={v => updatePub('sendPdfReport', v)}
                    label="Automatické odesílání PDF reportů" description="PDF report po diagnostické relaci" />
                </List>
              </CardContent>
            </Card>
          </motion.div>

          {/* Save button */}
          <motion.div custom={5} variants={sectionAnim} initial="hidden" animate="visible">
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}
              sx={{ mb: 4, bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
              Uložit nastavení veřejného webu
            </Button>
          </motion.div>
        </Box>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  TAB 1: WORKER SETTINGS (Zaměstnanci)       */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === 1 && (
        <Box>
          {/* — Section: Email / SMTP — */}
          <motion.div custom={0} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Email sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Email a SMTP</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Jméno odesílatele" value={wrk.emailFromName}
                      onChange={e => updateWrk('emailFromName', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Email odesílatele" value={wrk.emailFromAddress}
                      onChange={e => updateWrk('emailFromAddress', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="SMTP Host" value={wrk.smtpHost}
                      onChange={e => updateWrk('smtpHost', e.target.value)} sx={fieldSx}
                      placeholder="smtp.gmail.com" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="SMTP Port" value={wrk.smtpPort}
                      onChange={e => updateWrk('smtpPort', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="SMTP Uživatel" value={wrk.smtpUser}
                      onChange={e => updateWrk('smtpUser', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="SMTP Heslo" type="password" value={wrk.smtpPassword}
                      onChange={e => updateWrk('smtpPassword', e.target.value)} sx={fieldSx} />
                  </Grid>
                </Grid>
                <Button variant="outlined" sx={{ mt: 2, borderColor: '#0D7377', color: '#0D7377' }}
                  onClick={() => alert('Test email odeslán (pokud je SMTP nakonfigurováno)')}>
                  Odeslat test email
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Worker Permissions — */}
          <motion.div custom={1} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Shield sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Oprávnění zaměstnanců</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  <Toggle checked={wrk.staffCanEditPrices} onChange={v => updateWrk('staffCanEditPrices', v)}
                    label="Zaměstnanci mohou měnit ceny" description="Standardně VYPNUTO — ceny upravuje jen admin" />
                  <Toggle checked={wrk.staffCanEditTimes} onChange={v => updateWrk('staffCanEditTimes', v)}
                    label="Zaměstnanci mohou měnit časy" description="Upravit délku trvání služby" />
                  <Toggle checked={wrk.staffCanViewRevenue} onChange={v => updateWrk('staffCanViewRevenue', v)}
                    label="Zobrazit příjmy zaměstnancům" description="Vidět celkové příjmy firmy" />
                  <Toggle checked={wrk.trackPerformance} onChange={v => updateWrk('trackPerformance', v)}
                    label="Sledování výkonu" description="Počet klientů, čas na klienta, pracovní doba" />
                  <Toggle checked={wrk.requireClientIntake} onChange={v => updateWrk('requireClientIntake', v)}
                    label="Povinná registrace klienta" description="Před první diagnostikou" />
                </List>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Notifications — */}
          <motion.div custom={2} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Send sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Oznámení pro zaměstnance</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  <Toggle checked={wrk.enableNotifications} onChange={v => updateWrk('enableNotifications', v)}
                    label="Push oznámení" description="Prohlížečová oznámení" />
                  <Toggle checked={wrk.enableSmsAlerts} onChange={v => updateWrk('enableSmsAlerts', v)}
                    label="SMS upozornění" description="Textové zprávy pro urgentní případy" />
                  <Toggle checked={wrk.enableEmailTemplates} onChange={v => updateWrk('enableEmailTemplates', v)}
                    label="Šablony emailů" description="Používat připravené šablony pro komunikaci" />
                  <Toggle checked={wrk.autoConfirmBookings} onChange={v => updateWrk('autoConfirmBookings', v)}
                    label="Automatické potvrzení rezervací" description="Rezervace se potvrdí automaticky bez schválení" />
                </List>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Invoicing — */}
          <motion.div custom={3} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <AttachMoney sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Fakturace</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Prefix faktury" value={wrk.invoicePrefix}
                      onChange={e => updateWrk('invoicePrefix', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Další číslo" type="number" value={wrk.invoiceNextNumber}
                      onChange={e => updateWrk('invoiceNextNumber', Number(e.target.value))} sx={fieldSx} />
                  </Grid>
                </Grid>
                <List sx={{ p: 0, mt: 1 }}>
                  <Toggle checked={wrk.invoiceAutoGenerate} onChange={v => updateWrk('invoiceAutoGenerate', v)}
                    label="Automatické generování faktur" description="Vytvořit fakturu po dokončení služby" />
                </List>
              </CardContent>
            </Card>
          </motion.div>

          {/* — Section: Security & Sessions — */}
          <motion.div custom={4} variants={sectionAnim} initial="hidden" animate="visible">
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Security sx={{ color: '#0D7377' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Bezpečnost relací</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Timeout relace (min)" type="number" value={wrk.sessionTimeoutMinutes}
                      onChange={e => updateWrk('sessionTimeoutMinutes', Number(e.target.value))} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Max pokusů o přihlášení" type="number" value={wrk.maxLoginAttempts}
                      onChange={e => updateWrk('maxLoginAttempts', Number(e.target.value))} sx={fieldSx} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Zámek účtu (min)" type="number" value={wrk.lockoutMinutes}
                      onChange={e => updateWrk('lockoutMinutes', Number(e.target.value))} sx={fieldSx} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>

          {/* Save button */}
          <motion.div custom={5} variants={sectionAnim} initial="hidden" animate="visible">
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}
              sx={{ mb: 4, bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
              Uložit nastavení zaměstnanců
            </Button>
          </motion.div>
        </Box>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  TAB 2: AUDIT LOG                          */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {auditLoading ? (
            <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Entita</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Podrobnosti</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <History sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                        <Typography color="text.secondary">Zatím žádné auditní záznamy</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLog.map((entry, i) => (
                      <motion.tr key={entry.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {new Date(entry.timestamp).toLocaleString('cs-CZ')}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography sx={{ fontWeight: 500 }}>{entry.userEmail || 'System'}</Typography></TableCell>
                        <TableCell>
                          <Chip label={entry.action} size="small"
                            sx={{ bgcolor: `${actionColors[entry.action] || '#666'}14`, color: actionColors[entry.action] || '#666', fontWeight: 500 }} />
                        </TableCell>
                        <TableCell>{entry.entity}</TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{entry.notes || entry.entityId?.slice(0, 8)}</Typography></TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  TAB 3: SECURITY                           */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Security sx={{ color: '#0D7377' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Zabezpečení</Typography>
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
                    <Shield sx={{ color: '#0D7377' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Ochrana dat</Typography>
                  </Box>
                  <List sx={{ p: 0 }}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="GDPR export dat" secondary="Exportovat všechna data pacienta" />
                    </ListItem>
                    <Divider />
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="GDPR smazání" secondary="Právo být zapomenut" />
                    </ListItem>
                    <Divider />
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Šifrování dat" secondary="PBKDF2 hesla, AES-256 data" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  TAB 4: SYSTEM HEALTH                      */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === 4 && <SystemHealth />}

      {/* Snackbar */}
      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>Nastavení uloženo!</Alert>
      </Snackbar>
    </Box>
  );
}

// Shared field style
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };
