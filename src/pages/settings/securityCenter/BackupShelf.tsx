import { useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Download, FactCheck, VpnKey } from '@mui/icons-material';
import {
  securityCenterApi,
  securityErrorText,
  toSecurityCenterError,
  type BackupSection,
  type ConfigurationDryRunReport,
  type DownloadedFile,
  type SecurityThresholds,
} from '../../../api/securityCenter';
import { TYPE } from '../../../components/settings/settingsStyle';
import { StatusChip } from '../../../components/ui';
import {
  DRILL_WORD,
  FRESHNESS_WORD,
  LOCATION_WORD,
  agoText,
  bytesText,
  dateText,
  dateTimeText,
  sizeSeries,
  type LightView,
} from './model';
import { BIG, Fact, Shelf, Sparkline } from './parts';
import { ConfigCheckDialog, ReporterKeysDialog } from './BackupDialogs';

function saveFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const REASON_TONE = { red: 'red', amber: 'beige', info: 'blue' } as const;

export function BackupShelf({
  section,
  view,
  thresholds,
  now,
  onChanged,
}: {
  section: BackupSection;
  view: LightView;
  thresholds: SecurityThresholds;
  now: Date;
  onChanged: () => void;
}) {
  const a = section.assessment;
  const activeKeys = section.reporters.filter((key) => key.isActive).length;
  const [keysOpen, setKeysOpen] = useState(false);
  const [busy, setBusy] = useState<'kit' | 'export' | 'check' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; result: ConfigurationDryRunReport } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const download = async (kind: 'kit' | 'export') => {
    setBusy(kind);
    setProblem(null);
    try {
      saveFile(await (kind === 'kit' ? securityCenterApi.recoveryKit() : securityCenterApi.configExport()));
    } catch (error) {
      setProblem(securityErrorText(toSecurityCenterError(error)));
    } finally {
      setBusy(null);
    }
  };

  const check = async (file: File) => {
    setBusy('check');
    setProblem(null);
    try {
      setReport({ name: file.name, result: await securityCenterApi.checkConfigExport(await file.text()) });
    } catch (error) {
      setProblem(securityErrorText(toSecurityCenterError(error)));
    } finally {
      setBusy(null);
      if (picker.current !== null) picker.current.value = '';
    }
  };

  const never = a === null || a.freshness === 'never';
  /* The alert already says it when NOTHING was reported; a failed attempt is a different sentence and stays in the list. */
  const nothingReported = a !== null && never && a.lastAttemptAtUtc === null;
  const reasons = (a?.reasons ?? []).filter((reason) => !(nothingReported && reason.code === 'never'));

  return (
    <Shelf id="backups" title="Zálohy" view={view} headline={section.headline}>
      {section.error !== null && <Alert severity="error">{section.error}</Alert>}

      {a !== null && never && (
        <Alert severity="error" sx={{ mb: 1.5 }} data-testid="backup-never">
          <Typography sx={{ fontWeight: 700 }}>
            {nothingReported ? 'Záloha dosud nehlásila žádný běh - nastavte zálohování.' : 'Žádný běh zálohy zatím neskončil úspěšně.'}
          </Typography>
          <Typography component="div" sx={{ fontSize: 14, mt: 0.5 }}>
            Systém sám zálohy nedělá, jen hlásí, co mu úloha oznámí. 1. Rozhodněte, kde záloha poběží (malý server v EU).
            2. Vydejte klíč pro hlášení níže. 3. Spusťte skript scripts/backup/backup.sh s tímto klíčem. Do té doby tu
            nebude zelená ani žlutá.
          </Typography>
        </Alert>
      )}

      {a !== null && !never && (
        <Box sx={{ mb: 1 }}>
          <Typography sx={[TYPE.caption, { mb: 1 }]}>
            Co je níže, je to, co o sobě záloha hlásí. Systém nevidí úložiště a neumí ověřit, že soubor existuje. Jen ověřená
            obnova je důkaz, že jde záloha přečíst.
          </Typography>
          <Fact label="Poslední úspěšná záloha" testId="fact-last">
            {dateTimeText(a.lastSuccessAtUtc)} ({agoText(a.lastSuccessAtUtc, now)}){' '}
            <StatusChip tone={a.freshness === 'fresh' ? 'green' : a.freshness === 'stale' ? 'beige' : 'red'} size="sm">
              {FRESHNESS_WORD[a.freshness]}
            </StatusChip>
          </Fact>
          <Fact label="Velikost">{bytesText(a.lastSizeBytes)}</Fact>
          <Fact label="Kam šla">
            {a.targetLabel ?? '—'}
            {a.targetRegion !== null ? ` · ${a.targetRegion}` : ''} <span style={{ opacity: 0.8 }}>· {LOCATION_WORD[a.locationKind]}</span>
          </Fact>
          <Fact label="Šifrování">{a.encrypted === true ? 'Úloha hlásí: šifrováno' : a.encrypted === false ? 'Úloha hlásí: NEšifrováno' : 'Neuvedeno'}</Fact>
          <Fact label="Kontrolní součet">
            {a.sha256 === null ? 'Nenahlášen' : <span title={a.sha256}>{a.sha256.slice(0, 16)}…</span>}
          </Fact>
          <Fact label="Poslední ověřená obnova" testId="fact-restore">
            {a.lastRestoreVerifiedAtUtc === null
              ? 'Nikdy'
              : `${dateText(a.lastRestoreVerifiedAtUtc)} (${agoText(a.lastRestoreVerifiedAtUtc, now)})`}
          </Fact>
          <Fact label="Cvičná obnova">
            {DRILL_WORD[a.restoreDrill]}
            {a.nextRestoreDrillDueUtc !== null ? ` · další do ${dateText(a.nextRestoreDrillDueUtc)}` : ''}
          </Fact>
          <Fact label="Poslední pokus">
            {a.lastAttemptAtUtc === null
              ? '—'
              : `${dateTimeText(a.lastAttemptAtUtc)} · ${a.lastAttemptSucceeded === true ? 'uspěl' : 'selhal'}`}
          </Fact>
          <Box sx={{ mt: 1 }}>
            <Sparkline series={sizeSeries(section.recentRuns)} />
          </Box>
        </Box>
      )}

      {reasons.length > 0 && (
        <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0, mb: 1.5 }} aria-label="Důvody stavu zálohy">
          {reasons.map((reason) => (
            <Box component="li" key={reason.code} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <StatusChip tone={REASON_TONE[reason.severity as keyof typeof REASON_TONE] ?? 'grey'} size="sm">
                {reason.severity === 'info' ? 'Info' : reason.severity === 'red' ? 'Problém' : 'Pozor'}
              </StatusChip>
              <Typography sx={{ fontSize: 14, minWidth: 0 }}>{reason.text}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Typography sx={[TYPE.caption, { mb: 1.5 }]} data-testid="backup-rules">
        Pravidla: zelená jen u zálohy mladší než {thresholds.backupFreshHours} h s ověřenou obnovou v posledních {thresholds.restoreDrillDays} dnech,
        v EU a šifrované. Žlutá do {thresholds.backupStaleHours} h. Jinak, nebo když nic nepřišlo, červená.
      </Typography>

      {activeKeys === 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Žádný klíč pro hlášení záloh není vydán, takže žádná úloha nemůže hlásit.
        </Alert>
      )}
      {problem !== null && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<VpnKey />} onClick={() => setKeysOpen(true)} sx={BIG}>
          Klíče pro hlášení záloh ({activeKeys})
        </Button>
        <Button variant="outlined" startIcon={<Download />} onClick={() => void download('kit')} disabled={busy !== null} sx={BIG}>
          Návod k obnově
        </Button>
        <Button variant="outlined" startIcon={<Download />} onClick={() => void download('export')} disabled={busy !== null} sx={BIG}>
          Export konfigurace
        </Button>
        <Button variant="outlined" startIcon={<FactCheck />} onClick={() => picker.current?.click()} disabled={busy !== null} sx={BIG}>
          Zkontrolovat soubor konfigurace
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Soubor exportu konfigurace ke kontrole"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void check(file);
          }}
        />
      </Stack>

      <ReporterKeysDialog open={keysOpen} onClose={() => setKeysOpen(false)} keys={section.reporters} onChanged={onChanged} />
      <ConfigCheckDialog report={report} onClose={() => setReport(null)} />
    </Shelf>
  );
}
