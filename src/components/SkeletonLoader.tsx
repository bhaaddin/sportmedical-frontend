import { Box, Skeleton, Paper, Grid } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { DESIGN } from '../theme';

/*
 * Loading placeholders in the board's shapes: bordered cards, no shadow, the
 * theme's own skeleton tint (no gradient of its own). Each mirrors the screen
 * it stands in for, so the page does not jump when the data lands.
 *
 * Callers have always passed `sx` for spacing - `sx={{ mt: 1 }}` and the like -
 * so it takes `sx` and merges it after its own, through MUI's array form.
 */
function ShimmerBox({
  width,
  height,
  borderRadius = 8,
  sx,
}: {
  width: string | number;
  height: string | number;
  borderRadius?: number;
  sx?: SxProps<Theme>;
}) {
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={height}
      sx={[{ borderRadius }, ...(Array.isArray(sx) ? sx : [sx])]}
      animation="wave"
    />
  );
}

/** A bordered card with the board's padding, for a skeleton to sit in. */
function CardFrame({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper variant="outlined" sx={[{ p: 2.5, borderRadius: 3 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Paper>
  );
}

export function StatCardSkeleton() {
  return (
    <CardFrame sx={{ height: '100%', p: 2.25 }}>
      <ShimmerBox width="55%" height={12} />
      <ShimmerBox width="40%" height={28} sx={{ mt: 1 }} />
      <ShimmerBox width="65%" height={10} sx={{ mt: 1 }} />
    </CardFrame>
  );
}

export function DashboardSkeleton() {
  return (
    <Box>
      <ShimmerBox width="35%" height={28} sx={{ mb: 1 }} />
      <ShimmerBox width="25%" height={16} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <StatCardSkeleton />
          </Grid>
        ))}
      </Grid>
      <CardFrame sx={{ mb: 2.5 }}>
        <ShimmerBox width="20%" height={12} sx={{ mb: 1.5 }} />
        <ShimmerBox width="100%" height={44} />
      </CardFrame>
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 6, lg: 3 }}>
            <CardFrame>
              <ShimmerBox width="40%" height={12} sx={{ mb: 2 }} />
              {[1, 2, 3].map((j) => (
                <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <ShimmerBox width={40} height={14} />
                  <Box sx={{ flex: 1 }}>
                    <ShimmerBox width="60%" height={14} />
                    <ShimmerBox width="40%" height={10} sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
              ))}
            </CardFrame>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export function PatientListSkeleton() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <ShimmerBox width={160} height={28} />
          <ShimmerBox width={220} height={14} sx={{ mt: 1 }} />
        </Box>
        <ShimmerBox width={140} height={40} sx={{ borderRadius: 10 }} />
      </Box>
      <ShimmerBox width="100%" height={44} sx={{ mb: 2, borderRadius: 10 }} />
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 40, bgcolor: (t) => (t.palette.mode === 'light' ? DESIGN.head : t.palette.background.default) }} />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <ShimmerBox width="22%" height={14} />
            <ShimmerBox width="10%" height={14} />
            <ShimmerBox width="16%" height={14} />
            <ShimmerBox width="14%" height={14} />
            <ShimmerBox width="12%" height={14} />
            <ShimmerBox width={90} height={22} sx={{ borderRadius: 999 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

export function DiagnosticFormSkeleton() {
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ShimmerBox width="30%" height={28} sx={{ mb: 1 }} />
      <ShimmerBox width="40%" height={14} sx={{ mb: 3 }} />
      <CardFrame>
        <ShimmerBox width="25%" height={12} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ShimmerBox width="100%" height={48} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ShimmerBox width="100%" height={48} />
          </Grid>
        </Grid>
        <ShimmerBox width="20%" height={12} sx={{ mt: 3, mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid key={i} size={{ xs: 6, sm: 4 }}>
              <ShimmerBox width="100%" height={48} />
            </Grid>
          ))}
        </Grid>
        <ShimmerBox width="100%" height={100} sx={{ mt: 2 }} />
        <ShimmerBox width={200} height={40} sx={{ mt: 3, borderRadius: 10 }} />
      </CardFrame>
    </Box>
  );
}
