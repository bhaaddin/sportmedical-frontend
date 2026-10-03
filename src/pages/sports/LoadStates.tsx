import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { SoftCard } from '../../components/ui/SoftCard';
import { useTouchSx } from './touch';

/**
 * A failed load says what failed and offers "Zkusit znovu" (brief, rule 8).
 * It never reads as an empty list: "nothing here" and "we could not ask" are
 * different sentences.
 */
export function LoadError({
  what,
  onRetry,
  detail,
}: {
  /** What did not load, as a noun phrase: "Poranění", "Frontu ke kontrole". */
  what: string;
  onRetry: () => void;
  detail?: string;
}) {
  const touch = useTouchSx();
  return (
    <SoftCard role="alert" data-state="error" sx={{ py: 5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{what} se nepodařilo načíst</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 2.5 }}>
        {detail ?? 'Zkontrolujte připojení a zkuste to znovu.'}
      </Typography>
      <Button variant="contained" startIcon={<Refresh />} onClick={onRetry} sx={touch}>
        Zkusit znovu
      </Button>
    </SoftCard>
  );
}

/** A placeholder that holds the space of a list, so nothing jumps when it fills. */
export function ListSkeleton({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <Stack spacing={1.25} data-state="loading" aria-busy="true" aria-label="Načítání">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={height} sx={{ borderRadius: 3 }} />
      ))}
    </Stack>
  );
}

/** The skeleton of a page whose header is already on screen: KPI row + list. */
export function PageSkeleton({ kpis = 0, rows = 4 }: { kpis?: number; rows?: number }) {
  return (
    <Box data-state="loading" aria-busy="true">
      {kpis > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(${kpis}, 1fr)` }, gap: 2, mb: 2.5 }}>
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      )}
      <ListSkeleton rows={rows} />
    </Box>
  );
}
