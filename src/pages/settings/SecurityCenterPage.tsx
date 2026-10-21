import { useRef } from 'react';
import { Alert, Box, Button, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';
import { SettingsScreen } from './SettingsFrame';
import { TYPE } from '../../components/settings/settingsStyle';
import { useReveal } from '../../motion/Reveal';
import { STAGGER } from '../../motion/tokens';
import { LightPill } from './securityCenter/parts';
import { LightsSummary } from './securityCenter/LightsSummary';
import { BackupShelf } from './securityCenter/BackupShelf';
import { AccountsShelf, ActivityShelf, EnvironmentShelf, NotMeasuredShelf } from './securityCenter/OtherShelves';
import { dateTimeText, lightViews, overallLight, summarySentence, type ShelfId } from './securityCenter/model';
import { useSecurityCenter } from './securityCenter/useSecurityCenter';
import type { SecurityOverview } from '../../api/securityCenter';

/*
 * Zabezpečení a zálohy (Nastavení -> Systém).
 *
 * One hub that shows what the system can PROVE about its security and its backups, and lets the owner act on a few
 * safe things. Nothing on it is green without the evidence in the same answer (model.ts holds that rule), a part
 * that could not be measured is grey, and what the page cannot see at all is listed at the foot.
 *
 * Organised in titled shelves (Zálohy, Účty, Prostředí, Aktivita) under a four-light summary, so the shelf design
 * system can take the shelves over one by one: each shelf is one component fed by one section of the overview.
 * The document never scrolls: the settings frame is the scrolling region from 768 px, the region around it below.
 */

const headlinesOf = (overview: SecurityOverview): Record<ShelfId, string> => ({
  backups: overview.backups.headline,
  accounts: overview.accounts.headline,
  environment: overview.environment.headline,
  activity: overview.activity.headline,
});

function Shelves({ overview, data }: { overview: SecurityOverview; data: ReturnType<typeof useSecurityCenter> }) {
  const grid = useRef<HTMLDivElement>(null);
  const views = lightViews(overview);
  const now = new Date(overview.generatedAtUtc);

  /* The shelves arrive one after another as they scroll into view (the motion kit; nothing under "vypnuto"). */
  useReveal(grid, { variant: 'rise', step: STAGGER.items, targets: (root) => Array.from(root.querySelectorAll<HTMLElement>('[data-shelf]')) });

  const open = (id: ShelfId) => {
    const shelf = document.getElementById(`shelf-${id}`);
    shelf?.scrollIntoView({ behavior: 'auto', block: 'start' });
    shelf?.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true });
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }} aria-live="polite">
        <Typography sx={TYPE.label}>Celkově</Typography>
        <LightPill light={overallLight(views)} testId="overall-light" />
        <Typography component="span" sx={visuallyHidden} data-testid="summary-sentence">
          {summarySentence(views)}
        </Typography>
      </Box>

      <LightsSummary views={views} headlines={headlinesOf(overview)} onOpen={open} />

      <Box
        ref={grid}
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <BackupShelf section={overview.backups} view={views.backups} thresholds={overview.thresholds} now={now} onChanged={() => void data.refresh()} />
        <AccountsShelf section={overview.accounts} view={views.accounts} thresholds={overview.thresholds} onChanged={() => void data.refresh()} />
        <EnvironmentShelf section={overview.environment} view={views.environment} />
        <ActivityShelf
          section={overview.activity}
          view={views.activity}
          events={data.events}
          eventsTotal={data.eventsTotal}
          eventsFailure={data.eventsFailure}
          eventsLoading={data.eventsLoading}
          onMore={() => void data.loadMoreEvents()}
          now={now}
        />
        <NotMeasuredShelf items={overview.notMeasured} />
      </Box>
    </>
  );
}

export default function SecurityCenterPage() {
  const data = useSecurityCenter();

  return (
    <SettingsScreen
      title="Zabezpečení a zálohy"
      subtitle={
        data.overview !== null
          ? `Změřeno ${dateTimeText(data.overview.generatedAtUtc)}. Nic tu není zelené bez důkazu; co systém neumí ověřit, je uvedeno dole.`
          : 'Co o zabezpečení a zálohách opravdu víme, a co s tím můžete udělat.'
      }
      aside={false}
      related={false}
      scope={false}
      actions={
        <Tooltip title="Obnovit data">
          <span>
            <IconButton aria-label="Obnovit data" onClick={() => void data.refresh()} disabled={data.refreshing} sx={{ minHeight: 44, minWidth: 44 }}>
              <Refresh />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {data.loading ? (
        <Box aria-busy="true" aria-label="Načítám stav zabezpečení" sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="rounded" height={96} />
          <Skeleton variant="rounded" height={260} />
        </Box>
      ) : data.overview === null ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<Refresh />} onClick={() => void data.refresh()} sx={{ minHeight: 44 }}>
              Zkusit znovu
            </Button>
          }
        >
          {data.failure ?? 'Stav zabezpečení se nepodařilo načíst.'} Nemůžeme říct nic, ani že je všechno v pořádku.
        </Alert>
      ) : (
        <Shelves overview={data.overview} data={data} />
      )}
    </SettingsScreen>
  );
}
