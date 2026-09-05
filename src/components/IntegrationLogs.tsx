import { useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, TextField, MenuItem } from '@mui/material';
import { Refresh, CheckCircle, Error, Info } from '@mui/icons-material';

interface LogEntry {
  id: string;
  timestamp: string;
  integration: string;
  action: string;
  status: 'success' | 'error' | 'info';
  details: string;
}

const sampleLogs: LogEntry[] = [
  { id: '1', timestamp: '2026-09-03 10:30:15', integration: 'Google Calendar', action: 'Sync', status: 'success', details: '12 events synced' },
  { id: '2', timestamp: '2026-09-03 10:15:00', integration: 'Stripe', action: 'Payment', status: 'success', details: 'Invoice INV-2026-0042 paid (2,500 Kč)' },
  { id: '3', timestamp: '2026-09-03 09:45:30', integration: 'Email', action: 'Send', status: 'error', details: 'SMTP timeout — appointment reminder' },
  { id: '4', timestamp: '2026-09-03 09:00:00', integration: 'Fitbit', action: 'Sync', status: 'info', details: 'Waiting for device connection' },
  { id: '5', timestamp: '2026-09-02 16:20:00', integration: 'AI Assistant', action: 'Query', status: 'success', details: 'Risk assessment completed for patient #1234' },
  { id: '6', timestamp: '2026-09-02 14:00:00', integration: 'Webhooks', action: 'Dispatch', status: 'success', details: 'appointment.created → 2 endpoints' },
];

export default function IntegrationLogs() {
  const [logs] = useState(sampleLogs);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? logs : logs.filter(l => l.integration.toLowerCase() === filter);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />;
      case 'error': return <Error sx={{ color: 'error.main', fontSize: 18 }} />;
      default: return <Info sx={{ color: 'info.main', fontSize: 18 }} />;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Logy integrací</Typography>
        <Box display="flex" gap={1}>
          <TextField
            select
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">Všechny</MenuItem>
            <MenuItem value="google calendar">Google Calendar</MenuItem>
            <MenuItem value="stripe">Stripe</MenuItem>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="fitbit">Fitbit</MenuItem>
            <MenuItem value="ai assistant">AI Assistant</MenuItem>
            <MenuItem value="webhooks">Webhooks</MenuItem>
          </TextField>
          <IconButton><Refresh /></IconButton>
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Čas</TableCell>
              <TableCell>Integrace</TableCell>
              <TableCell>Akce</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell>Detaily</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.timestamp}</TableCell>
                <TableCell>{log.integration}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>
                  <Chip icon={statusIcon(log.status)} label={log.status} size="small" color={
                    log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'info'
                  } />
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
