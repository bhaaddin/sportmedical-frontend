import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import {
  securityCenterApi,
  securityErrorText,
  toSecurityCenterError,
  type BackupReporterKey,
  type ConfigurationDryRunReport,
  type IssuedReporterKey,
  type SecurityCenterError,
} from '../../../api/securityCenter';
import { TYPE } from '../../../components/settings/settingsStyle';
import { StatusChip } from '../../../components/ui';
import { signOut } from '../../../auth/signOut';
import { agoText, dateTimeText } from './model';
import { BIG, ConfirmDialog } from './parts';

/**
 * The keys backup jobs report with. The secret of a new key is on screen once, in this dialog, and nowhere else:
 * closing the dialog drops it from memory, and the list never holds it.
 */
export function ReporterKeysDialog({
  open,
  onClose,
  keys,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  keys: BackupReporterKey[];
  onChanged: () => void;
}) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SecurityCenterError | null>(null);
  const [issued, setIssued] = useState<IssuedReporterKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<{ key: BackupReporterKey; what: 'rotate' | 'revoke' } | null>(null);
  const now = new Date();

  const close = () => {
    setIssued(null);
    setLabel('');
    setError(null);
    setCopied(false);
    onClose();
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setIssued(await securityCenterApi.createReporter(label.trim()));
      setLabel('');
      onChanged();
    } catch (failure) {
      setError(toSecurityCenterError(failure));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (issued === null) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={close} maxWidth="sm" fullWidth aria-labelledby="keys-title">
        <DialogTitle id="keys-title">Klíče pro hlášení záloh</DialogTitle>
        <DialogContent>
          <Typography sx={[TYPE.caption, { mb: 2 }]}>
            Klíč má jediné oprávnění: poslat do systému zprávu, že proběhla záloha. Nic jiného s ním nejde a nelze jím zálohu zazelenit
            ručně, to umí jen úloha, která ji dělá. Klíč patří do tajných údajů té úlohy.
          </Typography>

          {issued !== null && (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="issued-key">
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{issued.notice}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box
                  component="code"
                  data-testid="issued-token"
                  sx={{ flex: 1, minWidth: 0, p: 1, borderRadius: 1, bgcolor: 'action.hover', fontSize: 13, overflowWrap: 'anywhere' }}
                >
                  {issued.token}
                </Box>
                <Tooltip title={copied ? 'Zkopírováno' : 'Zkopírovat klíč'}>
                  <IconButton aria-label="Zkopírovat klíč" onClick={() => void copy()} sx={BIG}>
                    <ContentCopy />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography sx={{ fontSize: 13, mt: 0.5 }}>Hlavička požadavku: {issued.headerName}</Typography>
            </Alert>
          )}

          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Vydané klíče">
            {keys.length === 0 && <Typography sx={TYPE.caption}>Žádný klíč zatím nebyl vydán.</Typography>}
            {keys.map((key) => (
              <Box
                component="li"
                key={key.id}
                sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', p: 1, border: 1, borderColor: 'divider', borderRadius: 2 }}
              >
                <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                  <Typography sx={TYPE.itemName}>{key.label}</Typography>
                  <Typography sx={TYPE.caption}>
                    {key.keyPrefix} · vydán {dateTimeText(key.createdAtUtc)} · naposledy použit{' '}
                    {key.lastUsedAtUtc === null ? 'nikdy' : agoText(key.lastUsedAtUtc, now)}
                  </Typography>
                </Box>
                {key.isActive ? (
                  <>
                    <Button size="small" onClick={() => setPending({ key, what: 'rotate' })} sx={BIG}>
                      Vyměnit
                    </Button>
                    <Button size="small" color="error" onClick={() => setPending({ key, what: 'revoke' })} sx={BIG}>
                      Odvolat
                    </Button>
                  </>
                ) : (
                  <StatusChip tone="grey" size="sm">
                    Odvolán {dateTimeText(key.revokedAtUtc)}
                  </StatusChip>
                )}
              </Box>
            ))}
          </Stack>

          <Box sx={{ mt: 2.5 }}>
            <Typography sx={TYPE.label}>Nový klíč</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.75 }}>
              <TextField
                size="small"
                fullWidth
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Název úlohy, například Noční záloha"
                slotProps={{ htmlInput: { 'aria-label': 'Název nového klíče', maxLength: 60 } }}
              />
              <Button variant="contained" onClick={() => void create()} disabled={busy || label.trim().length < 3} sx={[BIG, { flexShrink: 0 }]}>
                Vydat klíč
              </Button>
            </Stack>
            {error !== null && (
              <Alert
                severity="error"
                sx={{ mt: 1 }}
                action={
                  error.kind === 'reauth' ? (
                    <Button color="inherit" size="small" onClick={() => void signOut()} sx={BIG}>
                      Přihlásit se znovu
                    </Button>
                  ) : undefined
                }
              >
                {securityErrorText(error)}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} sx={BIG}>
            Zavřít
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.what === 'rotate' ? 'Vyměnit klíč?' : 'Odvolat klíč?'}
        confirmLabel={pending?.what === 'rotate' ? 'Vyměnit' : 'Odvolat'}
        danger={pending?.what === 'revoke'}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending === null) return;
          if (pending.what === 'rotate') {
            setIssued(await securityCenterApi.rotateReporter(pending.key.id));
          } else {
            await securityCenterApi.revokeReporter(pending.key.id);
          }
          onChanged();
        }}
      >
        {pending?.what === 'rotate'
          ? `Vznikne nový klíč „${pending.key.label}“ a starý přestane fungovat hned. Úloha, která ho používá, musí dostat nový.`
          : `Klíč „${pending?.key.label ?? ''}“ přestane fungovat hned. Úloha, která ho používá, pak nebude moct hlásit zálohy a stránka zčervená.`}
      </ConfirmDialog>
    </>
  );
}

const SECTION_WORD: Record<string, string> = {
  settings: 'Nastavení',
  priceList: 'Ceník',
  services: 'Služby',
  activities: 'Činnosti',
};

/** What a restore would do with an export file. Nothing was written to check it, and this says so first. */
export function ConfigCheckDialog({
  report,
  onClose,
}: {
  report: { name: string; result: ConfigurationDryRunReport } | null;
  onClose: () => void;
}) {
  const result = report?.result;

  return (
    <Dialog open={report !== null} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="check-title">
      <DialogTitle id="check-title">Kontrola souboru konfigurace</DialogTitle>
      <DialogContent>
        {result !== undefined && report !== null && (
          <>
            <Typography sx={[TYPE.caption, { mb: 1.5 }]}>{result.note}</Typography>
            <Alert severity={result.canRestore ? 'success' : 'error'} sx={{ mb: 1.5 }} data-testid="check-verdict">
              {result.canRestore ? `Soubor ${report.name} je v pořádku.` : `Soubor ${report.name} nelze použít.`}
            </Alert>
            {result.sections.length > 0 && (
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, mb: 1.5 }}>
                <thead>
                  <tr>
                    {['Část', 'V souboru', 'Přibyde', 'Změní se', 'Beze změny', 'Jen v databázi'].map((head) => (
                      <Box component="th" key={head} sx={{ textAlign: 'left', py: 0.5, pr: 1, fontWeight: 700 }}>
                        {head}
                      </Box>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sections.map((section) => (
                    <tr key={section.section}>
                      <td>{SECTION_WORD[section.section] ?? section.section}</td>
                      <td>{section.inFile}</td>
                      <td>{section.wouldAdd}</td>
                      <td>{section.wouldChange}</td>
                      <td>{section.unchanged}</td>
                      <td>{section.onlyInDatabase}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            )}
            <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Nalezené problémy">
              {result.issues.map((issue, index) => (
                <Box component="li" key={index} sx={{ display: 'flex', gap: 1 }}>
                  <StatusChip tone={issue.severity === 'error' ? 'red' : 'beige'} size="sm">
                    {issue.severity === 'error' ? 'Chyba' : 'Pozor'}
                  </StatusChip>
                  <Typography sx={{ fontSize: 14, minWidth: 0 }}>{issue.message}</Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={BIG}>
          Zavřít
        </Button>
      </DialogActions>
    </Dialog>
  );
}
