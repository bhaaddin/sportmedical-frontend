/* ══════════════════════════════════════════════════════════════
   WORKFLOW AUTOMATION — PLAN-01 Feature A81-A85
   - Rule-based automation
   - Auto-assign, auto-remind, auto-follow-up
   - Enable/disable rules
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, FormControlLabel,
  Grid, TextField, Button, List, ListItem, ListItemText,
  ListItemSecondaryAction, Divider, Alert, Snackbar, Chip
} from '@mui/material';
import {
  AccountTree as AutomationIcon, Save as SaveIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
}

export default function WorkflowAutomation() {
  const [rules, setRules] = useState<WorkflowRule[]>([
    { id: '1', name: 'Automatické přiřazení', description: ' automaticky přiřadí pacienta k nejbližšímu dostupnému lékaři', enabled: true, config: {} },
    { id: '2', name: 'Automatická připomínka', description: 'Odešle email/SMS 24h před termínem', enabled: true, config: { hours: 24 } },
    { id: '3', name: 'Následná kontrola', description: 'Automaticky naplánuje kontrolu po 3 měsících', enabled: false, config: { months: 3 } },
    { id: '4', name: 'Automatická fakturace', description: 'Vytvoří fakturu po dokončení služby', enabled: true, config: {} },
    { id: '5', name: 'Upozornění na expiraci', description: 'Upozorní na expirující dokumenty 7 dní předem', enabled: true, config: { days: 7 } },
  ]);
  const [saved, setSaved] = useState(false);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutomationIcon color="primary" /> Automatické procesy
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Nastavení automatických pravidel a procesů
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Uložit
          </Button>
        </Box>
      </motion.div>

      <Card>
        <CardContent>
          <List>
            {rules.map((rule, i) => (
              <Box key={rule.id}>
                <ListItem>
                  <ListItemText
                    primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {rule.name}
                      <Chip label={rule.enabled ? 'Aktivní' : 'Vypnuto'} size="small"
                        color={rule.enabled ? 'success' : 'default'} />
                    </Box>}
                    secondary={rule.description}
                  />
                  <ListItemSecondaryAction>
                    <Switch edge="end" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  </ListItemSecondaryAction>
                </ListItem>
                {i < rules.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        </CardContent>
      </Card>

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success">Nastavení uloženo!</Alert>
      </Snackbar>
    </Box>
  );
}
