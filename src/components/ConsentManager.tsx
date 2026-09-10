import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Switch,
  Box,
  Alert,
  Chip,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  IconButton,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Download as DownloadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  usePatientConsents,
  useGrantConsent,
  useRevokeConsent,
  consentApi,
  ConsentType,
} from '../services/consentApi';
import type { Consent } from '../services/consentApi';

const CONSENT_LABELS: Record<ConsentType, { 
  label: string; 
  description: string;
  required?: boolean;
}> = {
  [ConsentType.Treatment]: {
    label: 'Léčebný souhlas',
    description: 'Souhlas se zpracováním zdravotních údajů pro účely poskytování zdravotních služeb',
    required: true,
  },
  [ConsentType.Marketing]: {
    label: 'Marketingový souhlas',
    description: 'Souhlas se zasíláním informací o službách a akcích',
  },
  [ConsentType.Communication]: {
    label: 'Komunikace',
    description: 'Souhlas se zasíláním emailových a SMS notifikací',
  },
  [ConsentType.ClubSharing]: {
    label: 'Sdílení s klubem',
    description: 'Souhlas se sdílením výsledků se sportovním klubem',
  },
  [ConsentType.DataExport]: {
    label: 'Export dat',
    description: 'Souhlas s exportem osobních údajů',
  },
};

interface ConsentManagerProps {
  patientId: string;
  readOnly?: boolean;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({
  patientId,
  readOnly = false
}) => {
  // Export (GDPR Art. 15) is admin-only; grant/revoke stays available to all staff (daily workflow)
  const isAdminUser = (() => {
    try {
      const role = JSON.parse(localStorage.getItem('user') || '{}').role ?? '';
      return ['Owner', 'Administrator', 'Admin', 'SuperAdmin'].includes(role);
    } catch {
      return false;
    }
  })();
  const { data: rawConsents = [], isLoading } = usePatientConsents(patientId);
  // Backend may return a wrapped/non-array payload — never let .find/.map crash the page
  const consents: Consent[] = Array.isArray(rawConsents) ? rawConsents : [];
  const grantMutation = useGrantConsent(patientId);
  const revokeMutation = useRevokeConsent(patientId);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ConsentType | null>(null);
  const [purpose, setPurpose] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(365);

  const getConsentStatus = (type: ConsentType): Consent | undefined => {
    return consents.find(c => c.type === type);
  };

  const getConsentStatusInfo = (consent?: Consent) => {
    if (!consent) {
      return { label: 'Neudělen', color: 'default' as const };
    }
    if (consent.status === 'Active') {
      return { label: 'Aktivní', color: 'success' as const };
    }
    if (consent.status === 'Expired') {
      return { label: 'Vypršel', color: 'warning' as const };
    }
    if (consent.status === 'Revoked') {
      return { label: 'Odvolán', color: 'error' as const };
    }
    return { label: 'Neaktivní', color: 'default' as const };
  };

  const handleGrantClick = (type: ConsentType) => {
    setSelectedType(type);
    setPurpose('');
    setExpiresInDays(365);
    setDialogOpen(true);
  };

  const handleGrantConfirm = async () => {
    if (!selectedType) return;

    try {
      await grantMutation.mutateAsync({
        type: selectedType,
        purpose: purpose || undefined,
        expiresInDays: expiresInDays || undefined,
      });
      toast.success('Souhlas udělen');
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Chyba při udělování souhlasu');
    }
  };

  const handleRevoke = async (type: ConsentType) => {
    try {
      await revokeMutation.mutateAsync({
        type,
        notes: 'Odvoláno uživatelem',
      });
      toast.success('Souhlas odvolán');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Chyba při odvolání souhlasu');
    }
  };

  const handleExport = async () => {
    try {
      const data = await consentApi.exportData(patientId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-consent-export-${patientId}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exportována');
    } catch (error) {
      toast.error('Chyba při exportu dat');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Správa souhlasů (GDPR)</Typography>
          <Box>
            {isAdminUser && (
              <Tooltip title="Exportovat data (GDPR čl. 15)">
                <IconButton onClick={handleExport} disabled={readOnly}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Zdravotní údaje vyžadují explicitní souhlas dle GDPR čl. 9. 
          Souhlas musí být svobodný, konkrétní, informovaný a jednoznačný.
        </Alert>

        {Object.entries(CONSENT_LABELS).map(([type, info]) => {
          const consentType = Number(type) as ConsentType;
          const consent = getConsentStatus(consentType);
          const statusInfo = getConsentStatusInfo(consent);

          return (
            <React.Fragment key={type}>
              <Box sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {info.label}
                      </Typography>
                      {info.required && (
                        <Chip label="Povinný" size="small" color="error" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {info.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={statusInfo.label}
                        color={statusInfo.color}
                        size="small"
                      />
                      {consent && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Udělen: {new Date(consent.grantedAt).toLocaleDateString('cs-CZ')}
                        </Typography>
                      )}
                    </Box>
                    {!readOnly && (
                      <Switch
                        checked={consent?.isGranted && consent.status === 'Active'}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleGrantClick(consentType);
                          } else {
                            handleRevoke(consentType);
                          }
                        }}
                        disabled={grantMutation.isPending || revokeMutation.isPending}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              <Divider />
            </React.Fragment>
          );
        })}
      </CardContent>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          Udělit souhlas - {selectedType !== null ? CONSENT_LABELS[selectedType].label : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Účel souhlasu"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              multiline
              rows={2}
              placeholder="Např. Zpracování zdravotních údajů pro poskytování zdravotních služeb"
            />
            <FormControl fullWidth>
              <InputLabel>Platnost souhlasu</InputLabel>
              <Select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                label="Platnost souhlasu"
              >
                <MenuItem value={30}>30 dní</MenuItem>
                <MenuItem value={90}>90 dní</MenuItem>
                <MenuItem value={180}>180 dní</MenuItem>
                <MenuItem value={365}>1 rok</MenuItem>
                <MenuItem value={730}>2 roky</MenuItem>
                <MenuItem value={0}>Neomezeně</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Zrušit</Button>
          <Button 
            onClick={handleGrantConfirm} 
            variant="contained" 
            disabled={grantMutation.isPending}
          >
            {grantMutation.isPending ? 'Uděluji...' : 'Udělit souhlas'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};
