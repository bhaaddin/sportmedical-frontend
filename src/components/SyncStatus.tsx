import { useState, useEffect } from 'react';
import { Box, Typography, Paper, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Chip, IconButton } from '@mui/material';
import { CheckCircle, Error, Sync, SyncDisabled, Refresh } from '@mui/icons-material';

interface SyncJob {
  id: string;
  name: string;
  status: 'syncing' | 'completed' | 'error' | 'idle';
  lastSync?: string;
  progress?: number;
  error?: string;
}

const initialJobs: SyncJob[] = [
  { id: 'calendar', name: 'Kalendář', status: 'completed', lastSync: '2026-09-03 10:30' },
  { id: 'patients', name: 'Pacienti', status: 'completed', lastSync: '2026-09-03 10:15' },
  { id: 'wearables', name: 'Wearables', status: 'idle' },
  { id: 'invoices', name: 'Faktury', status: 'completed', lastSync: '2026-09-03 09:00' },
  { id: 'email', name: 'Email', status: 'error', error: 'SMTP connection timeout' },
];

export default function SyncStatus() {
  const [jobs, setJobs] = useState(initialJobs);

  const handleSync = (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'syncing', progress: 0 } : j));

    // Simulate sync progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setJobs(prev => prev.map(j => j.id === id ? { ...j, progress } : j));
      if (progress >= 100) {
        clearInterval(interval);
        setJobs(prev => prev.map(j => j.id === id ? {
          ...j,
          status: 'completed',
          lastSync: new Date().toLocaleString('cs-CZ'),
          progress: undefined,
        } : j));
      }
    }, 200);
  };

  const statusIcon = (status: SyncJob['status']) => {
    switch (status) {
      case 'syncing': return <Sync sx={{ color: 'info.main', animation: 'spin 1s linear infinite' }} />;
      case 'completed': return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'error': return <Error sx={{ color: 'error.main' }} />;
      default: return <SyncDisabled sx={{ color: 'text.disabled' }} />;
    }
  };

  const statusLabel = (status: SyncJob['status']) => {
    switch (status) {
      case 'syncing': return 'Synchronizuji';
      case 'completed': return 'Dokončeno';
      case 'error': return 'Chyba';
      default: return 'Neprobíhá';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Stav synchronizace</Typography>
        <IconButton onClick={() => jobs.filter(j => j.status !== 'syncing').forEach(j => handleSync(j.id))}>
          <Refresh />
        </IconButton>
      </Box>

      <List>
        {jobs.map((job) => (
          <ListItem key={job.id} secondaryAction={
            <IconButton size="small" onClick={() => handleSync(job.id)} disabled={job.status === 'syncing'}>
              <Refresh fontSize="small" />
            </IconButton>
          }>
            <ListItemIcon>{statusIcon(job.status)}</ListItemIcon>
            <ListItemText
              primary={job.name}
              secondary={
                <>
                  <Chip label={statusLabel(job.status)} size="small" color={
                    job.status === 'completed' ? 'success' :
                    job.status === 'error' ? 'error' :
                    job.status === 'syncing' ? 'info' : 'default'
                  } sx={{ mr: 1 }} />
                  {job.lastSync && <Typography variant="caption" component="span">Poslední sync: {job.lastSync}</Typography>}
                  {job.error && <Typography variant="caption" color="error" display="block">{job.error}</Typography>}
                  {job.status === 'syncing' && job.progress !== undefined && (
                    <LinearProgress variant="determinate" value={job.progress} sx={{ mt: 1 }} />
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
