import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';
import { motion } from 'framer-motion';

function ShimmerBox({ width, height, borderRadius = 8 }: { width: string | number; height: string | number; borderRadius?: number }) {
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={height}
      sx={{ borderRadius, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)' }}
      animation="wave"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <ShimmerBox width="60%" height={16} />
            <ShimmerBox width="40%" height={36} sx={{ mt: 1 }} />
          </Box>
          <Skeleton variant="circular" width={48} height={48} />
        </Box>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <Box>
      <ShimmerBox width="35%" height={36} sx={{ mb: 1 }} />
      <ShimmerBox width="25%" height={20} sx={{ mb: 3 }} />
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCardSkeleton />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <ShimmerBox width="30%" height={24} sx={{ mb: 2 }} />
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <ShimmerBox width="50%" height={16} />
                  <ShimmerBox width="30%" height={12} sx={{ mt: 0.5 }} />
                </Box>
              </Box>
            ))}
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3 }}>
            <ShimmerBox width="40%" height={24} sx={{ mb: 2 }} />
            {[1, 2, 3].map((i) => (
              <ShimmerBox key={i} width="100%" height={48} sx={{ mb: 1.5, borderRadius: 2 }} />
            ))}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export function PatientListSkeleton() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <ShimmerBox width="20%" height={36} />
        <ShimmerBox width={140} height={40} sx={{ borderRadius: 2 }} />
      </Box>
      <Card sx={{ p: 2, mb: 3 }}>
        <ShimmerBox width="100%" height={40} />
      </Card>
      <Card>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderBottom: '1px solid #f0f0f0' }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <ShimmerBox width="25%" height={16} />
              <ShimmerBox width="15%" height={12} sx={{ mt: 0.5 }} />
            </Box>
            <ShimmerBox width="12%" height={14} />
            <ShimmerBox width="8%" height={14} />
            <ShimmerBox width="10%" height={24} sx={{ borderRadius: 12 }} />
          </Box>
        ))}
      </Card>
    </Box>
  );
}

export function DiagnosticFormSkeleton() {
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ShimmerBox width="40%" height={36} sx={{ mb: 1 }} />
      <ShimmerBox width="30%" height={20} sx={{ mb: 3 }} />
      <Card sx={{ p: 3 }}>
        <ShimmerBox width="25%" height={24} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ShimmerBox width="100%" height={56} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ShimmerBox width="100%" height={56} />
          </Grid>
        </Grid>
        <ShimmerBox width="20%" height={24} sx={{ mt: 3, mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid key={i} size={{ xs: 6, sm: 4 }}>
              <ShimmerBox width="100%" height={56} />
            </Grid>
          ))}
        </Grid>
        <ShimmerBox width="100%" height={100} sx={{ mt: 2, borderRadius: 2 }} />
        <ShimmerBox width={200} height={48} sx={{ mt: 3, borderRadius: 2 }} />
      </Card>
    </Box>
  );
}
