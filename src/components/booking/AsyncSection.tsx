import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { errorText } from './errorText';

/**
 * The four states every booking screen owes the user (contract 5): loading,
 * empty, error, content. An empty state is never a blank white area — it says
 * what the screen is and offers the action that fills it.
 */

interface AsyncSectionProps {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyText: string;
  emptyAction?: { label: string; onClick: () => void };
  onRetry?: () => void;
  /** Skeleton rows to stand in for the content while it loads. */
  skeletonRows?: number;
  children: React.ReactNode;
}

export function AsyncSection({
  isLoading,
  error,
  isEmpty,
  emptyText,
  emptyAction,
  onRetry,
  skeletonRows = 4,
  children,
}: AsyncSectionProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Stack spacing={1} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} variant="rectangular" height={52} />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              {t('booking.common.retry')}
            </Button>
          ) : undefined
        }
      >
        {errorText(error, t)}
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <Box
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ mb: emptyAction ? 2 : 0, color: 'text.secondary' }}>
          {emptyText}
        </Typography>
        {emptyAction ? (
          <Button variant="contained" onClick={emptyAction.onClick}>
            {emptyAction.label}
          </Button>
        ) : null}
      </Box>
    );
  }

  return <>{children}</>;
}

