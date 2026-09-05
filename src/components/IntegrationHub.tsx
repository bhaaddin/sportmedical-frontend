import { useState } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button, Switch, FormControlLabel, Chip, IconButton, Alert } from '@mui/material';
import { Sync as SyncIcon, Payment as PaymentIcon, CalendarMonth as CalendarIcon, Fitbit as FitIcon, SmartToy as AiIcon, Webhook as WebhookIcon } from '@mui/icons-material';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string;
  color: string;
}

const defaultIntegrations: Integration[] = [
  { id: 'stripe', name: 'Stripe Payments', description: 'Online platby kartou', icon: <PaymentIcon />, connected: false, color: '#635BFF' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Synchronizace kalendáře', icon: <CalendarIcon />, connected: false, color: '#4285F4' },
  { id: 'outlook', name: 'Outlook Calendar', description: 'Synchronizace kalendáře', icon: <CalendarIcon />, connected: false, color: '#0078D4' },
  { id: 'fitbit', name: 'Fitbit', description: 'Fitness tracker data', icon: <FitIcon />, connected: false, color: '#00B0B9' },
  { id: 'ai-assistant', name: 'AI Assistant', description: 'AI diagnostika a doporučení', icon: <AiIcon />, connected: false, color: '#10A37F' },
  { id: 'webhooks', name: 'Webhooks', description: 'Vlastní integrace přes webhooky', icon: <WebhookIcon />, connected: false, color: '#FF6B35' },
];

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState(defaultIntegrations);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setIntegrations(prev =>
      prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i)
    );
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    // Simulate sync
    await new Promise(r => setTimeout(r, 2000));
    setIntegrations(prev =>
      prev.map(i => i.id === id ? { ...i, lastSync: new Date().toLocaleString('cs-CZ') } : i)
    );
    setSyncing(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Integrace</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Spravujte propojení s externími službami
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Některé integrace vyžadují konfiguraci API klíčů v nastavení aplikace.
      </Alert>

      <Grid container spacing={3}>
        {integrations.map((integration) => (
          <Grid size={{ xs: 12, md: 6 }} lg={4} key={integration.id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Box sx={{ color: integration.color }}>{integration.icon}</Box>
                  <Box flex={1}>
                    <Typography variant="h6">{integration.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{integration.description}</Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={integration.connected}
                        onChange={() => handleToggle(integration.id)}
                        color="primary"
                      />
                    }
                    label={integration.connected ? 'Připojeno' : 'Odpojeno'}
                  />
                  {integration.connected && (
                    <Chip label={integration.connected ? 'Aktivní' : 'Neaktivní'} color={integration.connected ? 'success' : 'default'} size="small" />
                  )}
                </Box>

                {integration.lastSync && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Poslední sync: {integration.lastSync}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<SyncIcon />}
                  onClick={() => handleSync(integration.id)}
                  disabled={syncing === integration.id || !integration.connected}
                >
                  {syncing === integration.id ? 'Synchronizuji...' : 'Synchronizovat'}
                </Button>
                <Button size="small" disabled={!integration.connected}>
                  Nastavení
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
