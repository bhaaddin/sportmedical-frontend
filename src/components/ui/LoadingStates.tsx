import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';

export function PageLoading() {
  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px">
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>Načítání...</Typography>
    </Box>
  );
}

export function InlineLoading({ message = 'Načítání...' }: { message?: string }) {
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <CircularProgress size={16} />
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </Box>
  );
}

export function ButtonLoading() {
  return <CircularProgress size={16} color="inherit" />;
}

export function CardSkeleton() {
  return (
    <Box>
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      <Box sx={{ pt: 2 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </Box>
    </Box>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} display="flex" gap={2} sx={{ py: 2 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={40} />
          ))}
        </Box>
      ))}
    </>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <>
      {Array.from({ length: items }).map((_, index) => (
        <Box key={index} display="flex" alignItems="center" gap={2} sx={{ py: 1.5 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
      ))}
    </>
  );
}

export function ContentSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width="30%" height={40} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 1 }} />
    </Box>
  );
}
